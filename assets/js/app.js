const yearEl = document.getElementById('year');
if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
}

const page = document.body && document.body.dataset ? document.body.dataset.page || null : null;

const showFeedback = (element, message = '', type) => {
    if (!element) return;
    element.textContent = message;
const yearEl = document.getElementById("year");
if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
}

const page = document.body ? document.body.dataset.page : null;

const storageAvailable = (() => {
    try {
        const testKey = '__tt_storage_test__';
        window.localStorage.setItem(testKey, 'ok');
        window.localStorage.removeItem(testKey);
        return true;
    } catch (error) {
        console.warn('LocalStorage är inte tillgängligt. Data sparas endast under sessionen.', error);
        return false;
    }
})();

const showFeedback = (element, message, type) => {
    if (!element) {
        return;
    }
    element.textContent = message || '';
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
const initScreeningPage = () => {
    const recruitmentForm = document.getElementById('recruitmentForm');
    const questionListEl = document.getElementById('questionList');
    const addQuestionBtn = document.getElementById('addQuestionButton');
    const thresholdInput = document.getElementById('recruitmentThreshold');
    const recruitmentFeedback = document.getElementById('recruitmentFeedback');
    const recruitmentListEl = document.getElementById('recruitmentList');

    const activeTitleEl = document.getElementById('activeRecruitmentTitle');
    const activeMetaEl = document.getElementById('activeRecruitmentMeta');
    const activeRoleEl = document.getElementById('activeRecruitmentRole');
    const activeThresholdEl = document.getElementById('activeThreshold');
    const activeRequirementsEl = document.getElementById('activeRequirements');
    const activeQuestionListEl = document.getElementById('activeQuestionList');

    const candidateForm = document.getElementById('candidateForm');
    const candidateHelper = document.getElementById('candidateFormHelper');
    const candidateQuestionFields = document.getElementById('candidateQuestionFields');
    const candidateFeedback = document.getElementById('candidateFeedback');

    const pipelineCountEl = document.getElementById('pipelineCount');
    const acceptedCountEl = document.getElementById('acceptedCount');
    const pipelineEmptyEl = document.getElementById('pipelineEmpty');
    const reviewContentEl = document.getElementById('candidateReviewContent');
    const acceptBtn = document.getElementById('acceptCandidateBtn');
    const rejectBtn = document.getElementById('rejectCandidateBtn');
    const reviewFeedback = document.getElementById('reviewFeedback');

    if (!recruitmentForm || !questionListEl || !addQuestionBtn || !thresholdInput || !recruitmentListEl || !candidateForm) {
        return;
    }

    const STORAGE_KEY = 'tandemTalentRecruitmentsV1';
    const MIN_QUESTIONS = 3;
    const MAX_QUESTIONS = 6;
    const DEFAULT_QUESTIONS = [
        'Har du minst ett års erfarenhet inom området?',
        'Kan du börja inom 30 dagar?',
        'Kan du arbeta skift eller kväll vid behov?',
        'Har du relevanta certifikat eller behörigheter?',
        'Talar du svenska på yrkesmässig nivå?',
    ];

    let questionCounter = 0;

    const state = {
        recruitments: [],
        activeRecruitmentId: null,
    };

    const sanitizeString = (value, fallback = '') => {
        if (typeof value === 'string') {
            return value.trim();
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return String(value);
        }
        return fallback;
    };

    const normalizeQuestion = (question, index) => {
        if (typeof question === 'string') {
            const text = question.trim();
            return {
                id: `q${index + 1}`,
                text: text || `Fråga ${index + 1}`,
            };
        }

        if (question && typeof question === 'object') {
            const idRaw = 'id' in question ? question.id : null;
            const textRaw = 'text' in question ? question.text : null;
            const labelRaw = 'label' in question ? question.label : null;
            const promptRaw = 'prompt' in question ? question.prompt : null;

            const id = sanitizeString(idRaw, `q${index + 1}`) || `q${index + 1}`;
            const textCandidate = sanitizeString(textRaw) || sanitizeString(labelRaw) || sanitizeString(promptRaw);
            const text = textCandidate || `Fråga ${index + 1}`;

            return { id, text };
        }

        return {
            id: `q${index + 1}`,
            text: `Fråga ${index + 1}`,
        };
    };

    const normalizeAnswers = (answers, questions = []) => {
        if (!Array.isArray(answers)) {
            return [];
        }

        return answers.map((answer, index) => {
            if (typeof answer === 'string') {
                const trimmedAnswer = answer.trim();
                const question = questions[index];
                const lower = trimmedAnswer.toLowerCase();
                return {
                    id: question ? question.id : `q${index + 1}`,
                    text: question ? question.text : trimmedAnswer || `Fråga ${index + 1}`,
                    value: lower.includes('nej') ? 'nej' : lower.includes('ja') ? 'ja' : 'nej',
                };
            }

            if (answer && typeof answer === 'object') {
                const relatedQuestion = questions.find((question) => question.id === answer.id) || questions[index];
                const id = sanitizeString(answer.id, relatedQuestion ? relatedQuestion.id : `q${index + 1}`) ||
                    `q${index + 1}`;
                const textCandidate = sanitizeString(answer.text) || sanitizeString(answer.question);
                const text = textCandidate || (relatedQuestion ? relatedQuestion.text : `Fråga ${index + 1}`);
                const valueRaw = sanitizeString(answer.value).toLowerCase();
                const value = valueRaw === 'ja' ? 'ja' : valueRaw === 'nej' ? 'nej' : 'nej';

                return { id, text, value };
            }

            return {
                id: `q${index + 1}`,
                text: `Fråga ${index + 1}`,
                value: 'nej',
            };
        });
    };

    const normalizeCandidate = (candidate, questions = []) => {
        const source = candidate && typeof candidate === 'object' ? candidate : {};
        const answers = normalizeAnswers(source.answers, questions);
        const positiveCount = Number.isFinite(source.positiveCount)
            ? Number(source.positiveCount)
            : answers.filter((answer) => answer.value === 'ja').length;
        const experience = Number(source.experience);
        const scoreRaw = Number(source.score);
        const score = Number.isFinite(scoreRaw) ? scoreRaw : Math.round((positiveCount / Math.max(answers.length, 1)) * 100);

        return {
            id: sanitizeString(source.id, `cand-${Date.now()}`) || `cand-${Date.now()}`,
            name: sanitizeString(source.name, 'Okänd kandidat'),
            experience: Number.isFinite(experience) ? experience : 0,
            location: sanitizeString(source.location, 'Okänd ort'),
            pitch: sanitizeString(source.pitch, ''),
            answers,
            positiveCount,
            score,
            submittedAt: sanitizeString(source.submittedAt, new Date().toISOString()),
        };
    };

    const normalizeRecruitment = (entry) => {
        const requirements = Array.isArray(entry.requirements)
            ? entry.requirements
                .map((requirement) => sanitizeString(requirement))
                .filter((requirement) => requirement.length)
            : [];

        const questionsSource = Array.isArray(entry.questions) && entry.questions.length
            ? entry.questions
            : DEFAULT_QUESTIONS;
        const questions = questionsSource.map((question, index) => normalizeQuestion(question, index));

        const minThreshold = 1;
        const questionCount = questions.length || MIN_QUESTIONS;
        const maxThreshold = Math.max(questionCount, minThreshold);
        const thresholdRaw = Number(entry.threshold);
        const threshold = Number.isFinite(thresholdRaw)
            ? Math.min(Math.max(thresholdRaw, minThreshold), maxThreshold)
            : Math.min(Math.max(MIN_QUESTIONS, minThreshold), maxThreshold);

        return {
            id: sanitizeString(entry.id, `rec-${Date.now()}`) || `rec-${Date.now()}`,
            name: sanitizeString(entry.name, 'Namnlös rekrytering'),
            role: sanitizeString(entry.role, 'Roll ej angiven'),
            location: sanitizeString(entry.location, 'Plats ej angiven'),
            threshold,
            requirements,
            questions,
            pipeline: Array.isArray(entry.pipeline)
                ? entry.pipeline.map((candidate) => normalizeCandidate(candidate, questions))
                : [],
            accepted: Array.isArray(entry.accepted)
                ? entry.accepted.map((candidate) => normalizeCandidate(candidate, questions))
                : [],
            rejected: Array.isArray(entry.rejected)
                ? entry.rejected.map((candidate) => normalizeCandidate(candidate, questions))
                : [],
            createdAt: sanitizeString(entry.createdAt, new Date().toISOString()),
        };
    };
    const normalizeCandidate = (candidate) => ({
        id: candidate.id,
        name: candidate.name,
        experience: candidate.experience,
        location: candidate.location,
        pitch: candidate.pitch,
        answers: Array.isArray(candidate.answers) ? candidate.answers : [],
        positiveCount: candidate.positiveCount || 0,
        score: candidate.score || 0,
        submittedAt: candidate.submittedAt || new Date().toISOString(),
    });

    const normalizeRecruitment = (entry) => ({
        id: entry.id,
        name: entry.name,
        role: entry.role,
        location: entry.location,
        threshold: entry.threshold || MIN_QUESTIONS,
        requirements: Array.isArray(entry.requirements) ? entry.requirements : [],
        questions: Array.isArray(entry.questions) ? entry.questions : [],
        pipeline: Array.isArray(entry.pipeline) ? entry.pipeline.map(normalizeCandidate) : [],
        accepted: Array.isArray(entry.accepted) ? entry.accepted.map(normalizeCandidate) : [],
        rejected: Array.isArray(entry.rejected) ? entry.rejected.map(normalizeCandidate) : [],
        createdAt: entry.createdAt || new Date().toISOString(),
    });

    const createDefaultState = () => {
        const defaultRecruitment = {
            id: 'rec-default',
            name: 'Lagerteam Göteborg',
            role: 'Lagermedarbetare',
            location: 'Göteborg',
            threshold: 4,
            requirements: [
                'Minst 1 års erfarenhet av lagerarbete',
                'Giltigt truckkort A-B',
                'Kan arbeta skift och kväll vid behov',
            ],
            questions: [
                { id: 'q1', text: 'Har du arbetat med lagerhantering minst ett år?' },
                { id: 'q2', text: 'Kan du börja inom 30 dagar?' },
                { id: 'q3', text: 'Kan du arbeta skift eller kväll?' },
                { id: 'q4', text: 'Har du giltigt truckkort eller motsvarande certifiering?' },
                { id: 'q5', text: 'Talar du svenska på yrkesmässig nivå?' },
            ],
            pipeline: [
                normalizeCandidate({
                    id: 'cand-demo',
                    name: 'Emilia Larsson',
                    experience: 4,
                    location: 'Göteborg',
                    pitch: 'Logistikdriven lagerspecialist som trivs i högt tempo.',
                    answers: [
                        { id: 'q1', text: 'Har du arbetat med lagerhantering minst ett år?', value: 'ja' },
                        { id: 'q2', text: 'Kan du börja inom 30 dagar?', value: 'ja' },
                        { id: 'q3', text: 'Kan du arbeta skift eller kväll?', value: 'ja' },
                        { id: 'q4', text: 'Har du giltigt truckkort eller motsvarande certifiering?', value: 'ja' },
                        { id: 'q5', text: 'Talar du svenska på yrkesmässig nivå?', value: 'ja' },
                    ],
                    positiveCount: 5,
                    score: 100,
                    submittedAt: new Date().toISOString(),
                }),
            ],
            accepted: [],
            rejected: [],
            createdAt: new Date().toISOString(),
        };

        return {
            recruitments: [defaultRecruitment],
            activeRecruitmentId: defaultRecruitment.id,
        };
    };

    const loadState = () => {
        if (!storageAvailable) {
            Object.assign(state, createDefaultState());
            return;
        }

        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                Object.assign(state, createDefaultState());
                return;
            }

            const parsed = JSON.parse(stored);
            if (!parsed || !Array.isArray(parsed.recruitments)) {
                throw new Error('Ogiltig lagrad struktur');
            }

            state.recruitments = parsed.recruitments.map(normalizeRecruitment);
            state.activeRecruitmentId = parsed.activeRecruitmentId || (state.recruitments[0] ? state.recruitments[0].id : null);

            if (!state.recruitments.length) {
                Object.assign(state, createDefaultState());
            }
        } catch (error) {
            console.warn('Kunde inte läsa rekryteringar från lagring.', error);
            Object.assign(state, createDefaultState());
        }
    };

    const saveState = () => {
        if (!storageAvailable) {
            return;
        }

        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    recruitments: state.recruitments,
                    activeRecruitmentId: state.activeRecruitmentId,
                }),
            );
        } catch (error) {
            console.warn('Kunde inte spara rekryteringar till lagring.', error);
        }
    };

    const getActiveRecruitment = () => state.recruitments.find((recruitment) => recruitment.id === state.activeRecruitmentId) || null;

    const createMetaChip = (text) => {
        const span = document.createElement('span');
        span.textContent = text;
        return span;
    };

    const updateQuestionControls = () => {
        const items = Array.from(questionListEl.querySelectorAll('.question-item'));
        items.forEach((item, index) => {
            const label = item.querySelector('label');
            if (label) {
                label.textContent = `Fråga ${index + 1}`;
            }
            const removeBtn = item.querySelector('.remove-question');
            if (removeBtn) {
                const disable = items.length <= MIN_QUESTIONS;
                removeBtn.disabled = disable;
                removeBtn.style.visibility = disable ? 'hidden' : 'visible';
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
            addQuestionBtn.disabled = items.length >= MAX_QUESTIONS;
        }

        if (thresholdInput) {
            const maxQuestions = Math.max(items.length, MIN_QUESTIONS);
            thresholdInput.max = String(maxQuestions);
            if (Number(thresholdInput.value) > maxQuestions) {
                thresholdInput.value = String(maxQuestions);
            }
        }
    };

    const createQuestionField = (value = '') => {
        questionCounter += 1;
        const wrapper = document.createElement('div');
        wrapper.className = 'question-item';
        wrapper.dataset.questionId = `builder-${questionCounter}`;

        const label = document.createElement('label');
        label.setAttribute('for', `question-${questionCounter}`);
        label.textContent = `Fråga ${questionCounter}`;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `question-${questionCounter}`;
        input.required = true;
        input.placeholder = 'Ex. Kan du arbeta skift?';
        input.value = text;
        input.name = `question-${questionCounter}`;
        input.required = true;
        input.placeholder = 'Ex. Kan du arbeta skift?';
        input.value = value;

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
        questionListEl.appendChild(wrapper);
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
        questionListEl.innerHTML = '';
        questionCounter = 0;
        DEFAULT_QUESTIONS.forEach((question) => createQuestionField(question));
        thresholdInput.value = String(Math.min(4, DEFAULT_QUESTIONS.length));
        updateQuestionControls();
        showFeedback(recruitmentFeedback, '');
    };

    const renderRecruitmentList = () => {
        recruitmentListEl.innerHTML = '';

        if (!state.recruitments.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'Inga rekryteringar ännu. Skapa en för att börja.';
            recruitmentList.appendChild(empty);
            empty.textContent = 'Inga rekryteringar ännu. Skapa din första för att börja samla kandidater.';
            recruitmentListEl.appendChild(empty);
            return;
        }

        state.recruitments.forEach((recruitment) => {
            const entry = document.createElement('article');
            entry.className = `recruitment-entry${recruitment.id === state.activeRecruitmentId ? ' is-active' : ''}`;
            const isActive = recruitment.id === state.activeRecruitmentId;
            const entry = document.createElement('article');
            entry.className = `recruitment-entry${isActive ? ' is-active' : ''}`;

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
            const button = document.createElement('button');
            button.type = 'button';
            if (isActive) {
                button.textContent = 'Aktiv';
                button.disabled = true;
            } else {
                button.textContent = 'Välj';
                button.addEventListener('click', () => {
                    state.activeRecruitmentId = recruitment.id;
                    saveState();
                    renderActiveSummary();
                    renderPipeline();
                    renderRecruitmentList();
                });
            }

            header.append(title, button);

            const meta = document.createElement('div');
            meta.className = 'entry-meta';
            meta.append(
                createMetaChip(`🎯 ${recruitment.role}`),
                createMetaChip(`📍 ${recruitment.location}`),
                createMetaChip(`Tröskel: ${recruitment.threshold}`),
            );

            const stats = document.createElement('p');
            stats.innerHTML = `<strong>${recruitment.pipeline.length}</strong> i kö · <strong>${recruitment.accepted.length}</strong> accepterade`;

            entry.append(header, meta, stats);
            recruitmentList.appendChild(entry);
            recruitmentListEl.appendChild(entry);
        });
    };

    const renderCandidateQuestions = (recruitment) => {
        candidateQuestions.innerHTML = '';
        if (!recruitment) return;
        if (!candidateQuestionFields) {
            return;
        }

        candidateQuestionFields.innerHTML = '';
        if (!recruitment) {
            return;
        }

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
            const yesId = `candidate-${question.id}-yes`;
            const noId = `candidate-${question.id}-no`;

            const yesLabel = document.createElement('label');
            yesLabel.className = 'radio-pill';
            const yesInput = document.createElement('input');
            yesInput.type = 'radio';
            yesInput.name = `question-${question.id}`;
            yesInput.id = yesId;
            yesInput.value = 'ja';
            yesInput.required = true;
            const yesSpan = document.createElement('span');
            yesSpan.textContent = 'Ja';
            yesLabel.append(yesInput, yesSpan);

            const noLabel = document.createElement('label');
            noLabel.className = 'radio-pill';
            const noInput = document.createElement('input');
            noInput.type = 'radio';
            noInput.name = `question-${question.id}`;
            noInput.id = noId;
            noInput.value = 'nej';
            noInput.required = true;
            const noSpan = document.createElement('span');
            noSpan.textContent = 'Nej';
            noLabel.append(noInput, noSpan);

            options.append(yesLabel, noLabel);
            fieldset.append(legend, options);
            candidateQuestionFields.appendChild(fieldset);
        });
    };

    const setCandidateFormAvailability = (recruitment) => {
        const isActive = Boolean(recruitment);
        const fields = candidateForm.querySelectorAll('input, textarea, select');
        fields.forEach((field) => {
            field.disabled = !isActive;
        });
        const submitButton = candidateForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = !isActive;
        }
        candidateForm.classList.toggle('is-disabled', !isActive);

        if (!isActive) {
            if (candidateHelper) {
                candidateHelper.textContent = 'Välj en rekrytering för att aktivera formuläret.';
            }
            candidateForm.reset();
            if (candidateQuestionFields) {
                candidateQuestionFields.innerHTML = '';
            }
            candidateHelper.textContent = 'Välj en rekrytering för att aktivera formuläret.';
            candidateForm.reset();
            candidateQuestionFields.innerHTML = '';
            showFeedback(candidateFeedback, '');
            return;
        }

        if (candidateHelper) {
            candidateHelper.textContent = `Aktiv rekrytering: ${recruitment.name}. Minst ${recruitment.threshold} "ja" krävs.`;
        }
        candidateHelper.textContent = `Aktiv rekrytering: ${recruitment.name}. Minst ${recruitment.threshold} "ja" krävs.`;
        candidateForm.reset();
        renderCandidateQuestions(recruitment);
        showFeedback(candidateFeedback, '');
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
            if (activeTitleEl) {
                activeTitleEl.textContent = 'Ingen rekrytering vald';
            }
            if (activeMetaEl) {
                activeMetaEl.textContent = 'Skapa eller välj en rekrytering för att se detaljer.';
            }
            if (activeRoleEl) {
                activeRoleEl.textContent = '–';
            }
            if (activeThresholdEl) {
                activeThresholdEl.textContent = '–';
            }
            if (activeRequirementsEl) {
                activeRequirementsEl.innerHTML = '';
            }
            if (activeQuestionListEl) {
                activeQuestionListEl.innerHTML = '';
            }
            setCandidateFormAvailability(null);
            return;
        }

        if (activeTitleEl) {
            activeTitleEl.textContent = recruitment.name;
        }
        if (activeMetaEl) {
            const created = recruitment.createdAt ? new Date(recruitment.createdAt) : null;
            activeMetaEl.textContent = created
                ? `Skapad ${created.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}`
                : 'Skapad i TandemTalent';
        }
        if (activeRoleEl) {
            activeRoleEl.textContent = `${recruitment.role} • ${recruitment.location}`;
        }
        if (activeThresholdEl) {
            activeThresholdEl.textContent = `${recruitment.threshold} av ${recruitment.questions.length} "ja"`;
        }
        if (activeRequirementsEl) {
            activeRequirementsEl.innerHTML = '';
            if (recruitment.requirements.length) {
                recruitment.requirements.forEach((req) => {
                    const li = document.createElement('li');
                    li.textContent = req;
                    activeRequirements.appendChild(li);
                    activeRequirementsEl.appendChild(li);
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
                activeRequirementsEl.appendChild(li);
            }
        }
        if (activeQuestionListEl) {
            activeQuestionListEl.innerHTML = '';
            recruitment.questions.forEach((question) => {
                const li = document.createElement('li');
                li.textContent = question.text;
                activeQuestionListEl.appendChild(li);
            });
        }

        setCandidateFormAvailability(recruitment);
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
        const pipeline = recruitment ? recruitment.pipeline : [];

        if (pipelineCountEl) {
            pipelineCountEl.textContent = recruitment ? String(pipeline.length) : '0';
        }
        if (acceptedCountEl) {
            acceptedCountEl.textContent = recruitment ? String(recruitment.accepted.length) : '0';
        }

        if (!recruitment || !pipeline.length) {
            if (reviewContentEl) {
                reviewContentEl.innerHTML = '';
            }
            if (pipelineEmptyEl) {
                pipelineEmptyEl.style.display = 'block';
            }
            if (acceptBtn) {
                acceptBtn.disabled = true;
            }
            if (rejectBtn) {
                rejectBtn.disabled = true;
            }
            showFeedback(reviewFeedback, '');
            return;
        }

        if (pipelineEmptyEl) {
            pipelineEmptyEl.style.display = 'none';
        }
        if (acceptBtn) {
            acceptBtn.disabled = false;
        }
        if (rejectBtn) {
            rejectBtn.disabled = false;
        }

        const candidate = pipeline[0];
        if (reviewContentEl) {
            reviewContentEl.innerHTML = '';
            const card = document.createElement('div');
            card.className = 'candidate-card';

            const header = document.createElement('div');
            header.className = 'candidate-card-header';
            const name = document.createElement('strong');
            name.textContent = candidate.name;
            const score = document.createElement('span');
            score.className = 'score-badge';
            score.textContent = `${candidate.score}% match`;
            header.append(name, score);

            const meta = document.createElement('p');
            meta.className = 'candidate-meta';
            meta.append(
                createMetaChip(`🎯 ${recruitment.role}`),
                createMetaChip(`📍 ${candidate.location}`),
                createMetaChip(`🗓️ ${candidate.experience} år erfarenhet`),
            );

            const pitch = document.createElement('p');
            pitch.textContent = candidate.pitch;

            const answersList = document.createElement('ul');
            answersList.className = 'answer-list';
            candidate.answers.forEach((answer) => {
                const li = document.createElement('li');
                const questionSpan = document.createElement('span');
                questionSpan.textContent = answer.text;
                const valueSpan = document.createElement('span');
                valueSpan.textContent = answer.value === 'ja' ? '✅ Ja' : '⛔ Nej';
                li.append(questionSpan, valueSpan);
                answersList.appendChild(li);
            });

            const submitted = document.createElement('time');
            if (candidate.submittedAt) {
                submitted.dateTime = candidate.submittedAt;
                const submittedDate = new Date(candidate.submittedAt);
                submitted.textContent = `Registrerad ${submittedDate.toLocaleDateString('sv-SE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                })} kl. ${submittedDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
            }

            card.append(header, meta, pitch, answersList, submitted);
            reviewContentEl.appendChild(card);
        }

        showFeedback(reviewFeedback, '');
    };

    const handleRecruitmentSubmit = (event) => {
        event.preventDefault();
        const formData = new FormData(recruitmentForm);

        const name = safeString(formData.get('name'));
        const role = safeString(formData.get('role'));
        const location = safeString(formData.get('location'));
        const requirementsRaw = safeString(formData.get('requirements'));
        const thresholdValue = Number(formData.get('threshold'));
        const name = (formData.get('name') || '').toString().trim();
        const role = (formData.get('role') || '').toString().trim();
        const location = (formData.get('location') || '').toString().trim();
        const thresholdValueRaw = (formData.get('threshold') || '').toString().trim();
        const requirementsRaw = (formData.get('requirements') || '').toString();

        const questionInputs = Array.from(questionListEl.querySelectorAll("input[type='text']"));
        const questions = questionInputs
            .map((input) => input.value.trim())
            .filter((value) => value.length);

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

        if (questions.length < MIN_QUESTIONS) {
            showFeedback(recruitmentFeedback, `Lägg till minst ${MIN_QUESTIONS} frågor innan du sparar.`, 'error');
            return;
        }

        const thresholdValue = Number(thresholdValueRaw || questions.length);
        if (!Number.isFinite(thresholdValue) || thresholdValue < 1) {
            showFeedback(recruitmentFeedback, 'Ange en giltig tröskel för antal "ja"-svar.', 'error');
            return;
        }

        if (thresholdValue > questions.length) {
            showFeedback(recruitmentFeedback, 'Tröskeln kan inte vara högre än antalet frågor.', 'error');
            return;
        }

        const requirements = requirementsRaw
            .split('\n')
            .map((req) => req.trim())
            .filter((req) => req.length);

        const recruitment = {
            id: `rec-${Date.now()}`,
            name,
            role,
            location,
            threshold: thresholdValue,
            requirements: requirementsRaw
                ? requirementsRaw.split('\n').map((item) => item.trim()).filter(Boolean)
                : [],
            requirements,
            questions: questions.map((text, index) => ({ id: `q${index + 1}`, text })),
            pipeline: [],
            accepted: [],
            rejected: [],
            createdAt: new Date().toISOString(),
        };

        state.recruitments.unshift(recruitment);
        state.activeRecruitmentId = recruitment.id;
        refreshStorage();
        state.recruitments = [recruitment, ...state.recruitments];
        state.activeRecruitmentId = recruitment.id;
        saveState();
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

        const name = (formData.get('name') || '').toString().trim();
        const experienceValue = (formData.get('experience') || '').toString().trim();
        const location = (formData.get('location') || '').toString().trim();
        const pitch = (formData.get('pitch') || '').toString().trim();

        if (!name || !experienceValue || !location || !pitch) {
            showFeedback(candidateFeedback, 'Fyll i samtliga fält innan du skickar in kandidaten.', 'error');
(function () {
    const storageKey = "tandemTalentCandidates";
    const relevantThreshold = 4;

    const form = document.getElementById("candidateForm");
    const feedback = document.getElementById("candidateFeedback");
    const list = document.getElementById("candidateList");
    const countEl = document.getElementById("candidateCount");
    const emptyState = document.getElementById("candidateEmpty");

    if (!form || !feedback || !list || !countEl || !emptyState) {
        return;
    }

    const state = {
        candidates: [],
    };

    const supportsLocalStorage = (() => {
        try {
            const testKey = "__tt_test__";
            window.localStorage.setItem(testKey, "1");
            window.localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn("LocalStorage är inte tillgängligt. Kandidater sparas inte mellan besök.", error);
            return false;
        }
    })();

    const clearFeedback = () => {
        feedback.textContent = "";
        feedback.classList.remove("success", "error");
    };

    const showFeedback = (message, type) => {
        feedback.textContent = message;
        feedback.classList.remove("success", "error");
        if (type) {
            feedback.classList.add(type);
        }
    };

    const updateEmptyState = () => {
        if (!state.candidates.length) {
            emptyState.style.display = "block";
        } else {
            emptyState.style.display = "none";
        }
    };

    const updateCount = () => {
        countEl.textContent = state.candidates.length.toString();
    };

    const createCandidateElement = (candidate) => {
        const listItem = document.createElement("li");
        listItem.className = "candidate-card";

        const name = document.createElement("strong");
        name.textContent = candidate.name;

        const meta = document.createElement("div");
        meta.className = "candidate-meta";

        const role = document.createElement("span");
        role.textContent = `🎯 ${candidate.role}`;

        const location = document.createElement("span");
        location.textContent = `📍 ${candidate.location}`;

        const experience = document.createElement("span");
        experience.textContent = `🗓️ ${candidate.experience} år`;

        meta.append(role, location, experience);

        const score = document.createElement("p");
        score.className = "candidate-score";
        score.textContent = `Matchningspoäng: ${candidate.score}% (${candidate.positiveAnswers} av 5 "ja")`;

        const added = document.createElement("p");
        added.className = "candidate-added";
        const addedDate = candidate.addedAt ? new Date(candidate.addedAt) : new Date();
        added.textContent = `Tillagd ${addedDate.toLocaleDateString("sv-SE", {
            year: "numeric",
            month: "short",
            day: "numeric",
        })} kl. ${addedDate.toLocaleTimeString("sv-SE", {
            hour: "2-digit",
            minute: "2-digit",
        })}`;

        listItem.append(name, meta, score, added);
        return listItem;
    };

    const renderCandidates = () => {
        list.innerHTML = "";
        state.candidates.forEach((candidate) => {
            list.appendChild(createCandidateElement(candidate));
        });
        updateCount();
        updateEmptyState();
    };

    const loadCandidates = () => {
        if (!supportsLocalStorage) {
            state.candidates = [];
            renderCandidates();
            return;
        }

        try {
            const stored = window.localStorage.getItem(storageKey);
            state.candidates = stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn("Kunde inte läsa kandidater från lagring.", error);
            state.candidates = [];
        }

        renderCandidates();
    };

    const persistCandidates = () => {
        if (!supportsLocalStorage) {
            return;
        }

        try {
            window.localStorage.setItem(storageKey, JSON.stringify(state.candidates));
        } catch (error) {
            console.warn("Kunde inte spara kandidater till lagring.", error);
        }
    };

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        clearFeedback();

        const formData = new FormData(form);
        const name = (formData.get("name") || "").toString().trim();
        const role = (formData.get("role") || "").toString().trim();
        const experienceValue = (formData.get("experience") || "").toString().trim();
        const location = (formData.get("location") || "").toString().trim();

        if (!name || !role || !experienceValue || !location) {
            showFeedback("Fyll i alla fält innan du skickar in kandidaten.", "error");
            return;
        }

        const experience = Number(experienceValue);
        if (!Number.isFinite(experience) || experience < 0) {
            showFeedback(candidateFeedback, 'Ange erfarenhet i år som ett heltal 0 eller större.', 'error');
            showFeedback("Ange antal år av erfarenhet som ett heltal 0 eller större.", "error");
            return;
        }

        const answers = [];
        for (const question of recruitment.questions) {
            const value = formData.get(`question-${question.id}`);
            if (!value) {
                showFeedback(candidateFeedback, 'Besvara alla screeningfrågor.', 'error');
                return;
            }
            answers.push({ id: question.id, text: question.text, value: value.toString() });
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
                `Kandidaten fick ${positiveCount} av ${recruitment.questions.length} "ja" och stoppas innan rekryterarvyn.`,
                'error',
            );
            candidateForm.reset();
            renderCandidateQuestions(recruitment);
            const nameField = document.getElementById('candidateName');
            if (nameField) {
                nameField.focus();
            }
        for (let i = 1; i <= 5; i += 1) {
            const value = formData.get(`q${i}`);
            if (!value) {
                showFeedback("Besvara samtliga fem frågor för att gå vidare.", "error");
                return;
            }
            answers.push(value);
        }

        const positiveAnswers = answers.filter((answer) => answer === "ja").length;

        if (positiveAnswers < relevantThreshold) {
            showFeedback("Kandidaten uppfyller inte kraven och sparas därför inte i databasen.", "error");
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
        saveState();
        renderPipeline();
        renderRecruitmentList();
        candidateForm.reset();
        renderCandidateQuestions(recruitment);
        showFeedback(candidateFeedback, 'Kandidaten kvalificerades och lades till i rekryterarvyn.', 'success');
        const nameField = document.getElementById('candidateName');
        if (nameField) {
            nameField.focus();
        }
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
        if (!recruitment || !recruitment.pipeline.length) {
            return;
        }

        const candidate = recruitment.pipeline.shift();
        const targetCollection = decision === 'accept' ? recruitment.accepted : recruitment.rejected;
        targetCollection.push({ ...candidate, decidedAt: new Date().toISOString() });

        saveState();
        renderPipeline();
        renderRecruitmentList();
        if (decision === 'accept') {
            showFeedback(reviewFeedback, `${candidate.name} markerades som klar för nästa steg.`, 'success');
        } else {
            showFeedback(reviewFeedback, `${candidate.name} togs bort från flödet.`, 'notice');
        }
    };

    addQuestionBtn.addEventListener('click', () => createQuestionField());
    recruitmentForm.addEventListener('submit', handleRecruitmentSubmit);
    candidateForm.addEventListener('submit', handleCandidateSubmit);
    acceptBtn.addEventListener('click', () => handleDecision('accept'));
    rejectBtn.addEventListener('click', () => handleDecision('reject'));


    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => handleDecision('accept'));
    }
    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => handleDecision('reject'));
    }

    loadState();
    resetRecruitmentForm();
    renderRecruitmentList();
    renderActiveSummary();
    renderPipeline();
};

const initContactPage = () => {
    const form = document.getElementById('contactForm');
    const feedback = document.getElementById('contactFeedback');
    if (!form || !feedback) return;
    if (!form || !feedback) {
        return;
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const name = safeString(formData.get('name'));
        const email = safeString(formData.get('email'));
        const name = (formData.get('name') || '').toString().trim();
        const email = (formData.get('email') || '').toString().trim();

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
    initScreeningPage();
}

if (page === 'kontakt') {
    initContactPage();
}
            id: Date.now(),
            name,
            role,
            experience,
            location,
            answers,
            positiveAnswers,
            score: Math.round((positiveAnswers / 5) * 100),
            addedAt: new Date().toISOString(),
        };

        state.candidates = [candidate, ...state.candidates];
        renderCandidates();
        persistCandidates();
        form.reset();
        showFeedback("Kandidaten har kvalificerats och lagts till i databasen.", "success");
        const nameField = document.getElementById("candidateName");
        if (nameField) {
            nameField.focus();
        }
    });

    loadCandidates();
})();
