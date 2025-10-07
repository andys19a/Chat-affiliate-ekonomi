const yearEl = document.getElementById('year');
if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
}

const page = document.body && document.body.dataset ? document.body.dataset.page || null : null;

const showFeedback = (element, message = '', type) => {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('success', 'error', 'notice');
    if (message && type) {
        element.classList.add(type);
    }
};

const safeString = (value, fallback = '') => {
    if (typeof value === 'string') {
        return value.trim() || fallback;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return fallback;
};

const defaultQuestions = [
    'Har du arbetat minst ett år inom området?',
    'Kan du börja inom 30 dagar?',
    'Är du tillgänglig för skift eller kvällsarbete?',
    'Har du relevanta certifikat?',
    'Talar du svenska på yrkesmässig nivå?',
];

const buildDefaultRecruitment = () => ({
    id: 'rec-default',
    name: 'Lagerteam Göteborg',
    role: 'Lagermedarbetare',
    location: 'Göteborg',
    threshold: 4,
    requirements: [
        'Minst 1 års erfarenhet av lagerarbete',
        'Giltigt truckkort A-B',
        'Tillgänglig för skift och kväll',
    ],
    questions: defaultQuestions.map((text, index) => ({ id: `q${index + 1}`, text })),
    pipeline: [],
    accepted: [],
    rejected: [],
    createdAt: new Date().toISOString(),
});

const ensureObject = (value) => {
    if (value !== null && typeof value === 'object') {
        return value;
    }
    return null;
};

const createId = (prefix) => {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `${prefix}-${crypto.randomUUID()}`;
        }
    } catch (error) {
        // ignore and fall back below
    }
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}-${Date.now()}-${random}`;
};

const firstNonEmpty = (...values) => {
    for (let index = 0; index < values.length; index += 1) {
        const str = safeString(values[index]);
        if (str) {
            return str;
        }
    }
    return '';
};

const storage = (() => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const testKey = '__tt_storage_test__';
            window.localStorage.setItem(testKey, 'ok');
            window.localStorage.removeItem(testKey);
            return window.localStorage;
        }
    } catch (error) {
        console.warn('Lokal lagring är inte tillgänglig. Data sparas endast under sessionen.', error);
    }
    return null;
})();

const STORAGE_KEY = 'tandemTalent.recruitments.v2';

const loadStoredState = () => {
    try {
        if (!storage) {
            const fallback = buildDefaultRecruitment();
            return { recruitments: [fallback], activeRecruitmentId: fallback.id };
        }

        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) {
            const fallback = buildDefaultRecruitment();
            return { recruitments: [fallback], activeRecruitmentId: fallback.id };
        }

        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.recruitments)) {
            throw new Error('Ogiltig struktur');
        }

        const cleanRecruitments = parsed.recruitments
            .map((item) => {
                const entry = ensureObject(item);
                if (!entry) {
                    return null;
                }

                const questionsSource = Array.isArray(entry.questions) && entry.questions.length
                    ? entry.questions
                    : defaultQuestions.map((text, index) => ({ id: `q${index + 1}`, text }));

                const normalizedQuestions = questionsSource.map((question, index) => {
                    if (typeof question === 'string') {
                        const trimmed = question.trim();
                        return { id: `q${index + 1}`, text: trimmed || `Fråga ${index + 1}` };
                    }

                    const questionObj = ensureObject(question) || {};
                    const id = safeString(questionObj.id, `q${index + 1}`);
                    const text = firstNonEmpty(
                        questionObj.text,
                        questionObj.label,
                        questionObj.prompt,
                        `Fråga ${index + 1}`,
                    ) || `Fråga ${index + 1}`;

                    return { id, text };
                });

                const normalizeCandidate = (candidate) => {
                    const candidateObj = ensureObject(candidate) || {};
                    const answersSource = Array.isArray(candidateObj.answers) ? candidateObj.answers : [];

                    const answers = answersSource.map((answer, idx) => {
                        const answerObj = ensureObject(answer) || {};
                        const relatedQuestion = normalizedQuestions[idx] || null;
                        const id = safeString(
                            answerObj.id,
                            relatedQuestion ? relatedQuestion.id : `q${idx + 1}`,
                        );
                        const text = firstNonEmpty(
                            answerObj.text,
                            answerObj.question,
                            relatedQuestion ? relatedQuestion.text : `Fråga ${idx + 1}`,
                        ) || `Fråga ${idx + 1}`;
                        const rawValue = safeString(answerObj.value).toLowerCase();
                        const value = rawValue === 'ja' ? 'ja' : 'nej';

                        return { id, text, value };
                    });

                    const positiveCount = answers.filter((answer) => answer.value === 'ja').length;
                    const score = answers.length ? Math.round((positiveCount / answers.length) * 100) : 0;
                    const decided = safeString(candidateObj.decidedAt);

                    return {
                        id: safeString(candidateObj.id, createId('cand')),
                        name: safeString(candidateObj.name, 'Okänd kandidat'),
                        experience: Number.isFinite(Number(candidateObj.experience))
                            ? Number(candidateObj.experience)
                            : 0,
                        location: safeString(candidateObj.location, 'Okänd ort'),
                        pitch: safeString(candidateObj.pitch),
                        answers,
                        positiveCount,
                        score,
                        submittedAt: safeString(candidateObj.submittedAt, new Date().toISOString()),
                        decidedAt: decided || undefined,
                    };
                };

                return {
                    id: safeString(entry.id, createId('rec')),
                    name: safeString(entry.name, 'Namnlös rekrytering'),
                    role: safeString(entry.role, 'Roll ej angiven'),
                    location: safeString(entry.location, 'Plats ej angiven'),
                    threshold: Number.isFinite(Number(entry.threshold))
                        ? Math.max(1, Math.min(Number(entry.threshold), normalizedQuestions.length))
                        : Math.min(4, normalizedQuestions.length),
                    requirements: Array.isArray(entry.requirements)
                        ? entry.requirements.map((req) => safeString(req)).filter(Boolean)
                        : [],
                    questions: normalizedQuestions,
                    pipeline: Array.isArray(entry.pipeline) ? entry.pipeline.map(normalizeCandidate) : [],
                    accepted: Array.isArray(entry.accepted) ? entry.accepted.map(normalizeCandidate) : [],
                    rejected: Array.isArray(entry.rejected) ? entry.rejected.map(normalizeCandidate) : [],
                    createdAt: safeString(entry.createdAt, new Date().toISOString()),
                };
            })
            .filter(Boolean);

        if (!cleanRecruitments.length) {
            const fallback = buildDefaultRecruitment();
            return { recruitments: [fallback], activeRecruitmentId: fallback.id };
        }

        const activeId = safeString(parsed.activeRecruitmentId);
        const foundActive = cleanRecruitments.find((item) => item.id === activeId);
        const activeRecruitmentId = foundActive ? foundActive.id : cleanRecruitments[0].id;

        return { recruitments: cleanRecruitments, activeRecruitmentId };
    } catch (error) {
        console.warn('Återgår till standarddata på grund av lagringsfel.', error);
        const fallback = buildDefaultRecruitment();
        return { recruitments: [fallback], activeRecruitmentId: fallback.id };
    }
};

const persistState = (state) => {
    if (!storage) {
        return;
    }

    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('Kunde inte spara rekryteringar.', error);
    }
};

const initScreeningPage = () => {
    const recruitmentForm = document.getElementById('recruitmentForm');
    const questionList = document.getElementById('questionList');
    const addQuestionBtn = document.getElementById('addQuestionButton');
    const thresholdInput = document.getElementById('recruitmentThreshold');
    const recruitmentFeedback = document.getElementById('recruitmentFeedback');
    const recruitmentList = document.getElementById('recruitmentList');

    const activeTitle = document.getElementById('activeRecruitmentTitle');
    const activeMeta = document.getElementById('activeRecruitmentMeta');
    const activeRole = document.getElementById('activeRecruitmentRole');
    const activeThreshold = document.getElementById('activeThreshold');
    const activeRequirements = document.getElementById('activeRequirements');
    const activeQuestions = document.getElementById('activeQuestionList');

    const candidateForm = document.getElementById('candidateForm');
    const candidateHelper = document.getElementById('candidateFormHelper');
    const candidateQuestions = document.getElementById('candidateQuestionFields');
    const candidateFeedback = document.getElementById('candidateFeedback');

    const reviewContent = document.getElementById('candidateReviewContent');
    const reviewFeedback = document.getElementById('reviewFeedback');
    const pipelineEmpty = document.getElementById('pipelineEmpty');
    const pipelineCount = document.getElementById('pipelineCount');
    const acceptedCount = document.getElementById('acceptedCount');
    const acceptBtn = document.getElementById('acceptCandidateBtn');
    const rejectBtn = document.getElementById('rejectCandidateBtn');

    if (
        !recruitmentForm ||
        !questionList ||
        !addQuestionBtn ||
        !thresholdInput ||
        !recruitmentList ||
        !candidateForm ||
        !candidateQuestions ||
        !reviewContent ||
        !pipelineEmpty ||
        !pipelineCount ||
        !acceptedCount ||
        !acceptBtn ||
        !rejectBtn
    ) {
        return;
    }

    const state = loadStoredState();
    let questionCounter = 0;

    const getActiveRecruitment = () => state.recruitments.find((item) => item.id === state.activeRecruitmentId) || null;

    const refreshStorage = () => persistState(state);

    const updateQuestionControls = () => {
        const items = Array.from(questionList.querySelectorAll('.question-item'));
        items.forEach((item, index) => {
            const label = item.querySelector('label');
            if (label) label.textContent = `Fråga ${index + 1}`;
            const removeBtn = item.querySelector('button');
            if (removeBtn) {
                const disabled = items.length <= 3;
                removeBtn.disabled = disabled;
                removeBtn.style.visibility = disabled ? 'hidden' : 'visible';
            }
        });

        if (addQuestionBtn) {
            addQuestionBtn.disabled = items.length >= 6;
        }

        const maxQuestions = Math.max(items.length, 3);
        thresholdInput.max = String(maxQuestions);
        if (Number(thresholdInput.value) > maxQuestions) {
            thresholdInput.value = String(maxQuestions);
        }
    };

    const createQuestionField = (text = '') => {
        questionCounter += 1;
        const wrapper = document.createElement('div');
        wrapper.className = 'question-item';

        const label = document.createElement('label');
        label.setAttribute('for', `question-${questionCounter}`);
        label.textContent = `Fråga ${questionCounter}`;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `question-${questionCounter}`;
        input.required = true;
        input.placeholder = 'Ex. Kan du arbeta skift?';
        input.value = text;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-question';
        removeBtn.textContent = 'Ta bort';
        removeBtn.addEventListener('click', () => {
            wrapper.remove();
            updateQuestionControls();
        });

        wrapper.append(label, input, removeBtn);
        questionList.appendChild(wrapper);
        updateQuestionControls();
    };

    const resetRecruitmentForm = () => {
        recruitmentForm.reset();
        questionList.innerHTML = '';
        questionCounter = 0;
        defaultQuestions.forEach((question) => createQuestionField(question));
        thresholdInput.value = '4';
        showFeedback(recruitmentFeedback);
    };

    const renderRecruitmentList = () => {
        recruitmentList.innerHTML = '';

        if (!state.recruitments.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'Inga rekryteringar ännu. Skapa en för att börja.';
            recruitmentList.appendChild(empty);
            return;
        }

        state.recruitments.forEach((recruitment) => {
            const entry = document.createElement('article');
            entry.className = `recruitment-entry${recruitment.id === state.activeRecruitmentId ? ' is-active' : ''}`;

            const header = document.createElement('header');
            const title = document.createElement('h3');
            title.textContent = recruitment.name;

            const selectBtn = document.createElement('button');
            selectBtn.type = 'button';
            selectBtn.textContent = recruitment.id === state.activeRecruitmentId ? 'Aktiv' : 'Välj';
            selectBtn.disabled = recruitment.id === state.activeRecruitmentId;
            selectBtn.addEventListener('click', () => {
                state.activeRecruitmentId = recruitment.id;
                refreshStorage();
                renderRecruitmentList();
                renderActiveSummary();
                renderPipeline();
            });

            header.append(title, selectBtn);

            const meta = document.createElement('div');
            meta.className = 'entry-meta';
            const chip = (text) => {
                const span = document.createElement('span');
                span.textContent = text;
                return span;
            };
            meta.append(chip(`🎯 ${recruitment.role}`), chip(`📍 ${recruitment.location}`), chip(`Tröskel: ${recruitment.threshold}`));

            const stats = document.createElement('p');
            stats.innerHTML = `<strong>${recruitment.pipeline.length}</strong> i kö · <strong>${recruitment.accepted.length}</strong> accepterade`;

            entry.append(header, meta, stats);
            recruitmentList.appendChild(entry);
        });
    };

    const renderCandidateQuestions = (recruitment) => {
        candidateQuestions.innerHTML = '';
        if (!recruitment) return;

        recruitment.questions.forEach((question) => {
            const fieldset = document.createElement('fieldset');
            const legend = document.createElement('legend');
            legend.textContent = question.text;

            const options = document.createElement('div');
            options.className = 'radio-options';

            ['ja', 'nej'].forEach((value) => {
                const label = document.createElement('label');
                label.className = 'radio-pill';

                const input = document.createElement('input');
                input.type = 'radio';
                input.name = `question-${question.id}`;
                input.value = value;
                input.required = true;

                const span = document.createElement('span');
                span.textContent = value === 'ja' ? 'Ja' : 'Nej';

                label.append(input, span);
                options.appendChild(label);
            });

            fieldset.append(legend, options);
            candidateQuestions.appendChild(fieldset);
        });
    };

    const toggleCandidateForm = (recruitment) => {
        const fields = candidateForm.querySelectorAll('input, textarea, button');
        fields.forEach((field) => {
            if (field.type === 'submit') {
                field.disabled = !recruitment;
            } else {
                field.disabled = !recruitment;
            }
        });

        if (!recruitment) {
            candidateForm.reset();
            candidateQuestions.innerHTML = '';
            if (candidateHelper) {
                candidateHelper.textContent = 'Välj en rekrytering för att aktivera formuläret.';
            }
            showFeedback(candidateFeedback);
        } else if (candidateHelper) {
            candidateHelper.textContent = `Aktiv rekrytering: ${recruitment.name}. Minst ${recruitment.threshold} "ja" krävs.`;
        }
    };

    const renderActiveSummary = () => {
        const recruitment = getActiveRecruitment();
        if (!recruitment) {
            if (activeTitle) activeTitle.textContent = 'Ingen rekrytering vald';
            if (activeMeta) activeMeta.textContent = 'Skapa eller välj en rekrytering för att se detaljer.';
            if (activeRole) activeRole.textContent = '–';
            if (activeThreshold) activeThreshold.textContent = '–';
            if (activeRequirements) activeRequirements.innerHTML = '';
            if (activeQuestions) activeQuestions.innerHTML = '';
            toggleCandidateForm(null);
            return;
        }

        if (activeTitle) activeTitle.textContent = recruitment.name;
        if (activeMeta) {
            const created = recruitment.createdAt ? new Date(recruitment.createdAt) : null;
            activeMeta.textContent = created
                ? `Skapad ${created.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}`
                : 'Skapad i TandemTalent';
        }
        if (activeRole) activeRole.textContent = `${recruitment.role} • ${recruitment.location}`;
        if (activeThreshold) activeThreshold.textContent = `${recruitment.threshold} av ${recruitment.questions.length} "ja"`;

        if (activeRequirements) {
            activeRequirements.innerHTML = '';
            if (recruitment.requirements.length) {
                recruitment.requirements.forEach((req) => {
                    const li = document.createElement('li');
                    li.textContent = req;
                    activeRequirements.appendChild(li);
                });
            } else {
                const li = document.createElement('li');
                li.textContent = 'Inga specifika krav angivna.';
                activeRequirements.appendChild(li);
            }
        }

        if (activeQuestions) {
            activeQuestions.innerHTML = '';
            recruitment.questions.forEach((question) => {
                const li = document.createElement('li');
                li.textContent = question.text;
                activeQuestions.appendChild(li);
            });
        }

        toggleCandidateForm(recruitment);
        renderCandidateQuestions(recruitment);
    };

    const renderPipeline = () => {
        const recruitment = getActiveRecruitment();
        const pipeline = recruitment && Array.isArray(recruitment.pipeline) ? recruitment.pipeline : [];

        pipelineCount.textContent = recruitment ? String(pipeline.length) : '0';
        acceptedCount.textContent = recruitment ? String(recruitment.accepted.length) : '0';

        if (!recruitment || !pipeline.length) {
            reviewContent.innerHTML = '';
            pipelineEmpty.style.display = 'block';
            acceptBtn.disabled = true;
            rejectBtn.disabled = true;
            showFeedback(reviewFeedback);
            return;
        }

        const candidate = pipeline[0];
        reviewContent.innerHTML = '';
        pipelineEmpty.style.display = 'none';
        acceptBtn.disabled = false;
        rejectBtn.disabled = false;

        const card = document.createElement('div');
        card.className = 'candidate-card';

        const header = document.createElement('header');
        header.innerHTML = `<h3>${candidate.name}</h3><p>${candidate.location} • ${candidate.experience} år erf.</p>`;

        const pitch = document.createElement('p');
        pitch.className = 'candidate-pitch';
        pitch.textContent = candidate.pitch || 'Ingen pitch angiven.';

        const answersList = document.createElement('ul');
        answersList.className = 'candidate-answers';
        candidate.answers.forEach((answer) => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${answer.text}</strong><span>${answer.value === 'ja' ? '✅ Ja' : '❌ Nej'}</span>`;
            answersList.appendChild(li);
        });

        const score = document.createElement('p');
        score.className = 'candidate-score';
        score.textContent = `Matchpoäng: ${candidate.score}% (${candidate.positiveCount} st "ja")`;

        card.append(header, pitch, answersList, score);
        reviewContent.appendChild(card);
        showFeedback(reviewFeedback);
    };

    const handleRecruitmentSubmit = (event) => {
        event.preventDefault();
        const formData = new FormData(recruitmentForm);

        const name = safeString(formData.get('name'));
        const role = safeString(formData.get('role'));
        const location = safeString(formData.get('location'));
        const requirementsRaw = safeString(formData.get('requirements'));
        const thresholdValue = Number(formData.get('threshold'));

        if (!name || !role || !location) {
            showFeedback(recruitmentFeedback, 'Fyll i namn, roll och ort för rekryteringen.', 'error');
            return;
        }

        const questions = Array.from(questionList.querySelectorAll('input[type="text"]'))
            .map((input) => input.value.trim())
            .filter(Boolean);

        if (questions.length < 3) {
            showFeedback(recruitmentFeedback, 'Lägg till minst 3 frågor innan du sparar.', 'error');
            return;
        }

        if (!Number.isFinite(thresholdValue) || thresholdValue < 1 || thresholdValue > questions.length) {
            showFeedback(recruitmentFeedback, 'Ange en tröskel mellan 1 och antalet frågor.', 'error');
            return;
        }

        const recruitment = {
            id: `rec-${Date.now()}`,
            name,
            role,
            location,
            threshold: thresholdValue,
            requirements: requirementsRaw
                ? requirementsRaw.split('\n').map((item) => item.trim()).filter(Boolean)
                : [],
            questions: questions.map((text, index) => ({ id: `q${index + 1}`, text })),
            pipeline: [],
            accepted: [],
            rejected: [],
            createdAt: new Date().toISOString(),
        };

        state.recruitments.unshift(recruitment);
        state.activeRecruitmentId = recruitment.id;
        refreshStorage();
        renderRecruitmentList();
        renderActiveSummary();
        renderPipeline();
        resetRecruitmentForm();
        showFeedback(recruitmentFeedback, 'Rekryteringen sparades och sattes som aktiv.', 'success');
    };

    const handleCandidateSubmit = (event) => {
        event.preventDefault();
        const recruitment = getActiveRecruitment();
        if (!recruitment) {
            showFeedback(candidateFeedback, 'Välj en rekrytering innan du lägger till kandidater.', 'error');
            return;
        }

        const formData = new FormData(candidateForm);
        const name = safeString(formData.get('name'));
        const experience = Number(formData.get('experience'));
        const location = safeString(formData.get('location'));
        const pitch = safeString(formData.get('pitch'));

        if (!name || !location || !pitch || !Number.isFinite(experience) || experience < 0) {
            showFeedback(candidateFeedback, 'Kontrollera att alla fält är korrekt ifyllda.', 'error');
            return;
        }

        const answers = recruitment.questions.map((question) => {
            const value = formData.get(`question-${question.id}`);
            return {
                id: question.id,
                text: question.text,
                value: value === 'ja' ? 'ja' : 'nej',
            };
        });

        if (answers.some((answer) => !formData.get(`question-${answer.id}`))) {
            showFeedback(candidateFeedback, 'Besvara alla screeningfrågor.', 'error');
            return;
        }

        const positiveCount = answers.filter((answer) => answer.value === 'ja').length;
        if (positiveCount < recruitment.threshold) {
            showFeedback(
                candidateFeedback,
                `Kandidaten hade ${positiveCount} "ja" och stoppas innan rekryterarvyn.`,
                'notice',
            );
            candidateForm.reset();
            renderCandidateQuestions(recruitment);
            return;
        }

        const candidate = {
            id: `cand-${Date.now()}`,
            name,
            experience,
            location,
            pitch,
            answers,
            positiveCount,
            score: Math.round((positiveCount / recruitment.questions.length) * 100),
            submittedAt: new Date().toISOString(),
        };

        recruitment.pipeline.push(candidate);
        refreshStorage();
        renderPipeline();
        renderRecruitmentList();
        candidateForm.reset();
        renderCandidateQuestions(recruitment);
        showFeedback(candidateFeedback, 'Kandidaten kvalificerades och lades till i rekryterarvyn.', 'success');
    };

    const handleDecision = (decision) => {
        const recruitment = getActiveRecruitment();
        if (!recruitment || !recruitment.pipeline.length) return;

        const candidate = recruitment.pipeline.shift();
        const target = decision === 'accept' ? recruitment.accepted : recruitment.rejected;
        target.push({ ...candidate, decidedAt: new Date().toISOString() });

        refreshStorage();
        renderPipeline();
        renderRecruitmentList();
        showFeedback(
            reviewFeedback,
            decision === 'accept'
                ? `${candidate.name} markerades som redo för nästa steg.`
                : `${candidate.name} togs bort från flödet.`,
            decision === 'accept' ? 'success' : 'notice',
        );
    };

    addQuestionBtn.addEventListener('click', () => createQuestionField());
    recruitmentForm.addEventListener('submit', handleRecruitmentSubmit);
    candidateForm.addEventListener('submit', handleCandidateSubmit);
    acceptBtn.addEventListener('click', () => handleDecision('accept'));
    rejectBtn.addEventListener('click', () => handleDecision('reject'));

    resetRecruitmentForm();
    renderRecruitmentList();
    renderActiveSummary();
    renderPipeline();
};

const initContactPage = () => {
    const form = document.getElementById('contactForm');
    const feedback = document.getElementById('contactFeedback');
    if (!form || !feedback) return;

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const name = safeString(formData.get('name'));
        const email = safeString(formData.get('email'));

        if (!name || !email) {
            showFeedback(feedback, 'Fyll i namn och e-post för att boka en demo.', 'error');
            return;
        }

        showFeedback(feedback, 'Tack! Vi återkommer inom 24 timmar med en demo.', 'success');
        form.reset();
    });
};

if (page === 'screening') {
    try {
        initScreeningPage();
    } catch (error) {
        console.error('Kunde inte initiera screeningvyn.', error);
    }
}

if (page === 'kontakt') {
    initContactPage();
}
