// =============================================
// --- 1. GLOBAL STATE & CONSTANTS -----------
// =============================================

// The 'state' object holds all the application's data as it changes.
let state = {
    currentStep: 0,
    numCriteria: 0,
    numAlternatives: 0,
    criteriaNames: [],
    alternativeNames: [],
    criteriaMatrix: [],
    criteriaWeights: [],
    criteriaCR: 0,
    alternativeMatrices: [],
    alternativeWeights: [],
    alternativeCRs: [],
    currentAltComparisonIndex: 0
};

// The Random Index (RI) from Saaty, matching the values in the provided C code.
const RI = [0, 0, 0.52, 0.89, 1.11, 1.25, 1.35, 1.40, 1.45, 1.49];

// Pre-defined templates for common decision-making scenarios.
const smartSuggestions = {
    'Buying a Car': {
        criteria: ['Price', 'Mileage', 'Safety', 'Looks', 'Maintenance', 'Features'],
        alternatives: ['Maruti Swift', 'Hyundai i20', 'Tata Altroz', 'Kia Seltos']
    },
    'Selecting a Smartphone': {
        criteria: ['Price', 'Camera', 'Battery Life', 'Performance', 'Screen'],
        alternatives: ['iPhone 15', 'Samsung S24', 'Pixel 8', 'OnePlus 12']
    },
    'Choosing a T-Shirt': {
        criteria: ['Price', 'Comfort', 'Style', 'Brand'],
        alternatives: ['Cotton Crew-Neck', 'V-Neck Dri-Fit', 'Polo Shirt']
    }
};


// =============================================
// --- 2. CORE AHP LOGIC & PROCESSING --------
// =============================================

function processCriteriaComparison() {
    if (!allComparisonsMade('criteria-comparison-container')) {
        alert('Please make a choice for every comparison.');
        return;
    }
    clearHighlights('criteria-comparison-container');
    const originalMatrix = getMatrixFromTable('criteria');
    state.criteriaMatrix = originalMatrix;
    const matrixToNormalize = JSON.parse(JSON.stringify(originalMatrix));
    state.criteriaWeights = normalizeMatrixAndGetWeights(matrixToNormalize);
    state.criteriaCR = calculateCR(state.criteriaMatrix, state.criteriaWeights);
    addConsistencyFeedback(document.getElementById('criteria-comparison-container'), state.criteriaCR, "Criteria");
    if (state.criteriaCR <= 0.2) {
        lockInputs('criteria-comparison-container', true);
        document.querySelector('#step-6 .btn-primary').style.display = 'none';
        showPreloader();
        setTimeout(() => {
            hidePreloader();
            setupNextAlternativeComparison();
            goToStep(7);
        }, state.criteriaCR > 0.1 ? 2500 : 1500);
    } else {
        const mostInconsistent = findMostInconsistentPair(state.criteriaMatrix, state.criteriaWeights);
        highlightInconsistentRow('criteria', mostInconsistent.i, mostInconsistent.j);
    }
}

function processAlternativeComparison() {
    const i = state.currentAltComparisonIndex;
    if (!allComparisonsMade('alternative-comparison-container')) {
        alert('Please make a choice for every comparison.');
        return;
    }
    clearHighlights('alternative-comparison-container');
    const originalMatrix = getMatrixFromTable(`alt-comp-${i}`);
    const matrixToNormalize = JSON.parse(JSON.stringify(originalMatrix));
    const weights = normalizeMatrixAndGetWeights(matrixToNormalize);
    const cr = calculateCR(originalMatrix, weights);
    addConsistencyFeedback(document.getElementById('alternative-comparison-container'), cr, `"${state.criteriaNames[i]}"`);
    if (cr <= 0.2) {
        state.alternativeMatrices.push(originalMatrix);
        state.alternativeWeights.push(weights);
        state.alternativeCRs.push(cr);
        lockInputs('alternative-comparison-container', true);
        document.querySelector('#step-7 .btn-primary').style.display = 'none';
        showPreloader();
        setTimeout(() => {
            hidePreloader();
            state.currentAltComparisonIndex++;
            if (state.currentAltComparisonIndex < state.numCriteria) {
                setupNextAlternativeComparison();
            } else {
                calculateAndShowFinalResults();
            }
        }, cr > 0.1 ? 2500 : 1500);
    } else {
        const mostInconsistent = findMostInconsistentPair(originalMatrix, weights);
        highlightInconsistentRow(`alt-comp-${i}`, mostInconsistent.i, mostInconsistent.j);
    }
}


// =============================================
// --- 3. UI GENERATION & NAVIGATION ---------
// =============================================

function generateStepHTML() {
    const wizardContainer = document.getElementById('wizard-container');
    const templateCatButtons = `<div class="template-category-container">${Object.keys(smartSuggestions).map(key => `<button class="template-cat-btn btn" onclick="displayTemplateOptions('${key}')">${key}</button>`).join('')}</div>`;
    const steps = [
        `<h1>Multi-Criteria Decision-Making System</h1><h2>How would you like to begin?</h2><div class="starter-choice-container"><button class="starter-btn" onclick="goToStep(2)"><strong>Start Manually</strong><span>Define all your own criteria and alternatives from scratch.</span></button><button class="starter-btn" onclick="goToStep(1)"><strong>Use a Template</strong><span>Get suggestions for common decisions to speed things up.</span></button></div>`,
        `<h1>Step 1: Choose a Template</h1><h2>Select a category to see suggested criteria and alternatives that you can customize.</h2>${templateCatButtons}<div id="template-selection-area"><div class="criteria-selection"><h3>Select Your Criteria</h3><div class="checkbox-list" id="template-criteria-list"></div></div><div class="alternative-selection"><h3>Select Your Alternatives</h3><div class="checkbox-list" id="template-alternatives-list"></div></div></div>`,
        `<h1>Step 2: Define Criteria</h1><h2>How many factors will you use to evaluate?</h2><div class="form-group"><input type="number" id="numCriteria" min="2" max="10" placeholder="Enter a number (2-10)"></div>`,
        `<h1>Step 3: Name Your Criteria</h1><h2>Enter a unique name for each criterion.</h2><div id="criteria-names-container"></div>`,
        `<h1>Step 4: Define Alternatives</h1><h2>How many options are you choosing between?</h2><div class="form-group"><input type="number" id="numAlternatives" min="2" max="10" placeholder="Enter a number (2-10)"></div>`,
        `<h1>Step 5: Name Your Alternatives</h1><h2>Enter the name for each option.</h2><div id="alternative-names-container"></div>`,
        `<h1>Step 6: Compare Criteria</h1><h2>Which criterion is more important, and by how much?</h2><div id="criteria-comparison-container"></div>`,
        `<h1>Step 7: Compare Alternatives</h1><h2 id="alt-comparison-title"></h2><div id="alternative-comparison-container"></div>`,
        `<h1>Your Results Are In!</h1><h2>Based on your judgments, here is the ranked list of alternatives.</h2><ol id="results-list"></ol>`
    ];
    const actions = [
        null, { back: 0, next: { text: 'Continue with Selection', action: 'processTemplateSelection()', class: 'btn-primary' } }, { back: 0, next: { text: 'Next', action: 'setupCriteriaInputs()', class: 'btn-primary' } }, { back: 2, next: { text: 'Continue', action: 'saveCriteriaNames()', class: 'btn-primary' } }, { back: 3, next: { text: 'Next', action: 'setupAlternativeInputs()', class: 'btn-primary' } }, { back: 4, next: { text: 'Start Comparing', action: 'saveAlternativeNames()', class: 'btn-primary' } }, { back: 0, next: { text: 'Check Consistency', action: 'processCriteriaComparison()', class: 'btn-primary' } }, { back: 6, next: { text: 'Check & Continue', action: 'processAlternativeComparison()', class: 'btn-primary' } }, { center: true, next: { text: 'Start New Decision', action: 'restart()', class: 'btn-primary' } }
    ];
    steps.forEach((content, i) => {
        const stepDiv = document.createElement('div');
        stepDiv.className = `wizard-step`;
        stepDiv.id = `step-${i}`;
        const action = actions[i];
        let buttonsHTML = '';
        if (action) {
            const backBtnHTML = (action.back !== null) ? `<button class="btn btn-secondary" onclick="goBack(${action.back})">Back</button>` : '<div></div>';
            buttonsHTML = `<div class="button-group">${backBtnHTML}<button class="btn ${action.next.class}" onclick="${action.next.action}">${action.next.text}</button></div>`;
            if (action.center) {
                buttonsHTML = `<div class="button-group" style="justify-content:center;"><button class="btn ${action.next.class}" onclick="${action.next.action}">${action.next.text}</button></div>`;
            }
        }
        stepDiv.innerHTML = content + buttonsHTML;
        wizardContainer.appendChild(stepDiv);
    });
}

function goToStep(stepNumber) {
    if (stepNumber > 8 || stepNumber < 0) return;
    document.getElementById('wizard-container').scrollTop = 0;
    setTimeout(() => {
        const currentActive = document.querySelector('.wizard-step.active');
        if (currentActive) {
            currentActive.classList.remove('active');
        }
        const nextStep = document.getElementById(`step-${stepNumber}`);
        if (nextStep) {
            nextStep.classList.add('active');
        }
        state.currentStep = stepNumber;
        updateProgressBar();
    }, 50);
}

function goBack(step) {
    goToStep(step);
}

function generateProgressBar() {
    const stepper = document.getElementById('progress-stepper');
    stepper.innerHTML = '';
    const stepLabels = ["Start", "Template", "Count", "Names", "Count", "Names", "Compare Criteria", "Compare Alts", "Results"];
    stepLabels.forEach((label, i) => {
        if (i === 0 || i === 1 || i === stepLabels.length - 1) return;
        const stepItem = document.createElement('li');
        stepItem.className = 'progress-step';
        const stepNum = i - 1;
        stepItem.innerHTML = `<div class="step-circle">${stepNum}</div><span class="step-label">${label}</span>`;
        stepper.appendChild(stepItem);
    });
}

function updateProgressBar() {
    const steps = document.querySelectorAll('.progress-step');
    steps.forEach((step, i) => {
        step.classList.remove('active', 'completed');
        const stepIndex = i + 2;
        if (stepIndex < state.currentStep) {
            step.classList.add('completed');
        } else if (stepIndex === state.currentStep) {
            step.classList.add('active');
        }
    });
}

// =============================================
// --- 4. HELPER & UTILITY FUNCTIONS ---------
// =============================================

function displayTemplateOptions(category) {
    document.querySelectorAll('.template-cat-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`.template-cat-btn[onclick="displayTemplateOptions('${category}')"]`).classList.add('selected');
    const suggestion = smartSuggestions[category];
    const criteriaContainer = document.getElementById('template-criteria-list');
    const altsContainer = document.getElementById('template-alternatives-list');
    criteriaContainer.innerHTML = suggestion.criteria.map(c => `<label><input type="checkbox" class="template-crit-check" value="${c}" checked> ${c}</label>`).join('');
    altsContainer.innerHTML = suggestion.alternatives.map(a => `<label><input type="checkbox" class="template-alt-check" value="${a}" checked> ${a}</label>`).join('');
    document.getElementById('template-selection-area').style.display = 'grid';
}

function processTemplateSelection() {
    const selectedCriteria = Array.from(document.querySelectorAll('.template-crit-check:checked')).map(cb => cb.value);
    const selectedAlts = Array.from(document.querySelectorAll('.template-alt-check:checked')).map(cb => cb.value);
    if (selectedCriteria.length < 2 || selectedAlts.length < 2) {
        alert("Please select at least 2 criteria and 2 alternatives to continue.");
        return;
    }
    state.criteriaNames = selectedCriteria;
    state.numCriteria = selectedCriteria.length;
    state.alternativeNames = selectedAlts;
    state.numAlternatives = selectedAlts.length;
    document.getElementById('criteria-comparison-container').innerHTML = createComparisonTable('criteria', state.criteriaNames);
    goToStep(6);
}

function setupCriteriaInputs() {
    const num = parseInt(document.getElementById('numCriteria').value);
    if (num >= 2 && num <= 10) {
        state.numCriteria = num;
        const container = document.getElementById('criteria-names-container');
        container.innerHTML = '';
        for (let i = 0; i < num; i++) {
            container.innerHTML += `<div class="form-group"><input type="text" class="criteria-name-input" placeholder="Criterion ${i + 1}"></div>`;
        }
        goToStep(3);
    } else {
        alert("Please enter a number between 2 and 10.");
    }
}

function saveCriteriaNames() {
    state.criteriaNames = [];
    const inputs = document.querySelectorAll('.criteria-name-input');
    let allFilled = true;
    inputs.forEach(input => { if (!input.value.trim()) allFilled = false; });
    if (allFilled) {
        inputs.forEach(input => state.criteriaNames.push(input.value.trim()));
        goToStep(4);
    } else {
        alert("Please fill out all criteria names.");
    }
}

function setupAlternativeInputs() {
    const num = parseInt(document.getElementById('numAlternatives').value);
    if (num >= 2 && num <= 10) {
        state.numAlternatives = num;
        const container = document.getElementById('alternative-names-container');
        container.innerHTML = '';
        for (let i = 0; i < num; i++) {
            container.innerHTML += `<div class="form-group"><input type="text" class="alternative-name-input" placeholder="Alternative ${i + 1}"></div>`;
        }
        goToStep(5);
    } else {
        alert("Please enter a number between 2 and 10.");
    }
}

function saveAlternativeNames() {
    state.alternativeNames = [];
    const inputs = document.querySelectorAll('.alternative-name-input');
    let allFilled = true;
    inputs.forEach(input => { if (!input.value.trim()) allFilled = false; });
    if (allFilled) {
        inputs.forEach(input => state.alternativeNames.push(input.value.trim()));
        document.getElementById('criteria-comparison-container').innerHTML = createComparisonTable('criteria', state.criteriaNames);
        goToStep(6);
    } else {
        alert("Please fill out all alternative names.");
    }
}

function createComparisonTable(idPrefix, items) {
    let tableHTML = `<div class="comparison-table" id="table-${idPrefix}">`;
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            tableHTML += `<div class="comparison-card" id="row-${idPrefix}-${i}-${j}">${createChoiceButtons(idPrefix, i, j, items)}</div>`;
        }
    }
    return tableHTML + '</div><div class="consistency-feedback-container" style="min-height: 80px;"></div>';
}

function createChoiceButtons(idPrefix, i, j, items) {
    const cellId = `cell-${idPrefix}-${i}-${j}`;
    const btnData = [{ v: 9, t: "Extreme" }, { v: 5, t: "Strong" }, { v: 3, t: "Slight" }];
    return `
        <div class="comparison-card-header">
            <span class="item-name">${items[i]}</span><span class="vs-text">vs</span><span class="item-name">${items[j]}</span>
        </div>
        <div class="comparison-choice-container" id="${cellId}">
            <div class="comparison-side">${btnData.map(d => `<button type="button" class="comparison-btn" data-value="${d.v}" onclick="selectChoice(this, '${cellId}')">${d.t}</button>`).join('')}</div>
            <button type="button" class="comparison-btn equal" data-value="1" onclick="selectChoice(this, '${cellId}')">Equal</button>
            <div class="comparison-side">${btnData.map(d => `<button type="button" class="comparison-btn" data-value="${(1/d.v).toFixed(10)}" onclick="selectChoice(this, '${cellId}')">${d.t}</button>`).join('')}</div>
        </div>`;
}

function selectChoice(button, containerId) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.comparison-btn').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
    container.dataset.selectedValue = parseFloat(button.dataset.value);
}

function setupNextAlternativeComparison() {
    const i = state.currentAltComparisonIndex;
    if (i < state.numCriteria) {
        document.getElementById("alt-comparison-title").innerHTML = `Compare Alternatives for: <strong>"${state.criteriaNames[i]}"</strong>`;
        document.getElementById("alternative-comparison-container").innerHTML = createComparisonTable(`alt-comp-${i}`, state.alternativeNames);
        const btn = document.querySelector("#step-7 .btn-primary");
        btn.textContent = "Check & Continue";
        btn.style.display = "inline-flex";
        if (i === state.numCriteria - 1) {
            btn.textContent = "Check and View Results";
        }
    }
}

function getMatrixFromTable(idPrefix) {
    const items = idPrefix === "criteria" ? state.criteriaNames : state.alternativeNames;
    const size = items.length;
    const matrix = Array.from({ length: size }, () => Array(size).fill(0));
    for (let i = 0; i < size; i++) {
        matrix[i][i] = 1;
        for (let j = i + 1; j < size; j++) {
            const value = parseFloat(document.getElementById(`cell-${idPrefix}-${i}-${j}`).dataset.selectedValue);
            matrix[i][j] = value;
            matrix[j][i] = 1 / value;
        }
    }
    return matrix;
}

function normalizeMatrixAndGetWeights(matrix) {
    const size = matrix.length;
    const columnSums = new Array(size).fill(0);
    const weights = new Array(size).fill(0);
    for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
            columnSums[j] += matrix[i][j];
        }
    }
    for (let i = 0; i < size; i++) {
        let rowSum = 0;
        for (let j = 0; j < size; j++) {
            matrix[i][j] /= columnSums[j];
            rowSum += matrix[i][j];
        }
        weights[i] = rowSum / size;
    }
    return weights;
}

function calculateCR(originalMatrix, weights) {
    const size = originalMatrix.length;
    if (size < 3) return 0;
    const columnSums = new Array(size).fill(0);
    let lambdaMax = 0;
    for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
            columnSums[j] += originalMatrix[i][j];
        }
    }
    for (let i = 0; i < size; i++) {
        lambdaMax += columnSums[i] * weights[i];
    }
    const CI = (lambdaMax - size) / (size - 1);
    const riValue = RI[size - 1];
    if (riValue > 0) {
        return CI / riValue;
    }
    return 0;
}

function calculateAndShowFinalResults() {
    const finalScores = new Array(state.numAlternatives).fill(0);
    for (let i = 0; i < state.numAlternatives; i++) {
        for (let j = 0; j < state.numCriteria; j++) {
            finalScores[i] += state.criteriaWeights[j] * state.alternativeWeights[j][i];
        }
    }
    const results = state.alternativeNames
        .map((name, i) => ({ name: name, score: finalScores[i] }))
        .sort((a, b) => b.score - a.score);
    const listElement = document.getElementById("results-list");
    listElement.innerHTML = "";
    results.forEach((res, idx) => {
        const listItem = document.createElement("li");
        const percentage = (res.score * 100).toFixed(2);
        listItem.innerHTML = `
            <span class="result-rank">#${idx + 1}</span>
            <div class="result-name">${res.name}</div>
            <div class="score-bar-container"><div class="score-bar" style="width:${percentage}%"></div></div>
            <span class="result-score">${percentage}%</span>`;
        listElement.appendChild(listItem);
    });
    goToStep(8);
}

const showPreloader = () => document.getElementById('preloader').style.display = 'flex';
const hidePreloader = () => document.getElementById('preloader').style.display = 'none';
const restart = () => { window.location.reload(); };
const allComparisonsMade = (containerId) => {
    const numComparisons = document.getElementById(containerId).querySelectorAll('.comparison-card').length;
    const numSelected = document.getElementById(containerId).querySelectorAll('.comparison-btn.selected').length;
    return numComparisons === numSelected;
};
const findMostInconsistentPair = (m, w) => { let e = -1, p = { i: -1, j: -1 }; const s = m.length; for (let i = 0; i < s; i++) for (let j = i + 1; j < s; j++) { const a = m[i][j], x = w[i] / w[j], r = a > x ? a / x : x / a; if (r > e) e = r, p = { i, j } } return p };
const highlightInconsistentRow = (idPrefix, i, j) => { document.getElementById(`row-${idPrefix}-${i}-${j}`).classList.add("inconsistent-highlight"); };
const clearHighlights = cId => { document.getElementById(cId).querySelectorAll(".comparison-card").forEach(r => r.classList.remove("inconsistent-highlight")) };
const lockInputs = (cId, l) => { document.getElementById(cId).querySelectorAll(".comparison-btn").forEach(b => b.disabled = l) };
function addConsistencyFeedback(container, cr, name) {
    const feedbackContainer = container.querySelector('.consistency-feedback-container');
    let status = 'good';
    let icon = '✔';
    let title = 'Excellent Consistency!';
    let message = `Your judgments for ${name} are perfectly consistent.`;
    if (cr > 0.1 && cr <= 0.2) { status = 'warning';
        icon = '⚠️';
        title = 'Minor Inconsistency';
        message = `Slightly inconsistent, but acceptable. Continuing...`; } else if (cr > 0.2) { status = 'bad';
        icon = '✖';
        title = 'High Inconsistency!';
        message = `Please revise the highlighted comparison for a reliable result.`; }
    feedbackContainer.innerHTML = `<div class="consistency-feedback ${status}"><div class="feedback-icon">${icon}</div><div class="feedback-text"><strong>${title}</strong><span>${message} (CR: <span class="cr-value">${(cr*100).toFixed(1)}%</span>)</span></div></div>`;
}

// =============================================
// --- 5. INITIALIZATION & EVENT LISTENERS ---
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    generateProgressBar();
    generateStepHTML();
    
    // All theme-related code has been removed.
    
    goToStep(0); // Start the application at the first step
});