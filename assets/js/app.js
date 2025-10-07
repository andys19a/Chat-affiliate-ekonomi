const yearEl = document.getElementById("year");
if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
}

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
            showFeedback("Ange antal år av erfarenhet som ett heltal 0 eller större.", "error");
            return;
        }

        const answers = [];
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
