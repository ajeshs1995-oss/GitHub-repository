// ==========================================
// 1. STATE & CONSTANTS
// ==========================================
const state = {
    // API Output Data
    sourceMetadata: {},
    allQuestions: [],
    
    // Active Practice Session State
    activeQuestions: [],
    currentIndex: 0,
    results: [], // Results for the *current* round: { isCorrect: boolean, difficulty: string }
    selectedOption: null, // String (e.g., 'A', 'B', etc.)
    incorrectQuestions: [], // Array of question objects answered wrong in current round
    
    // Performance Baseline tracking
    firstAttemptResults: null, // Copy of results array from the first attempt
    
    attachedFiles: [], // Array of file objects: { id, name, size, type, base64Data, textContent, icon }
    uiConfig: {}
};

const screens = {
    setup: document.getElementById('setup-screen'),
    loading: document.getElementById('loading-screen'),
    summary: document.getElementById('summary-screen'),
    quiz: document.getElementById('quiz-screen'),
    retryDialog: document.getElementById('retry-dialog-screen'),
    results: document.getElementById('results-screen')
};

// ==========================================
// 2. THEME CONTROLLER (Light/Dark Mode)
// ==========================================
const themeToggleBtn = document.getElementById('theme-toggle');
const darkIcon = document.getElementById('theme-icon-dark');
const lightIcon = document.getElementById('theme-icon-light');

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcons(savedTheme);
}

function updateThemeIcons(theme) {
    if (theme === 'dark') {
        darkIcon.style.display = 'block';
        lightIcon.style.display = 'none';
    } else {
        darkIcon.style.display = 'none';
        lightIcon.style.display = 'block';
    }
}

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
});

// ==========================================
// 3. STORAGE & KEY RETRIEVAL
// ==========================================
const apiKeyInput = document.getElementById('api-key-input');
const saveKeyCheckbox = document.getElementById('save-key-checkbox');
const togglePasswordBtn = document.getElementById('toggle-password');
const notesInput = document.getElementById('notes-input');

function initApiKey() {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        saveKeyCheckbox.checked = true;
    } else {
        saveKeyCheckbox.checked = false;
    }
}

// Toggle show/hide API key password text
togglePasswordBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    
    // Toggle icon visual
    togglePasswordBtn.innerHTML = isPassword ? 
        `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>` : 
        `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>`;
});

// ==========================================
// 4. SCREEN NAVIGATION
// ==========================================
function showScreen(screenKey) {
    Object.keys(screens).forEach(key => {
        if (key === screenKey) {
            screens[key].classList.add('active');
        } else {
            screens[key].classList.remove('active');
        }
    });
}

// ==========================================
// 5. STATUS MESSAGES & VALIDATION
// ==========================================
const statusBanner = document.getElementById('status-banner');
const statusMessage = document.getElementById('status-message');

function showStatus(text, type = 'error') {
    statusMessage.textContent = text;
    statusBanner.style.display = 'flex';
    statusBanner.className = `status-banner ${type}`;
    // Auto-scroll to top status if needed
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideStatus() {
    statusBanner.style.display = 'none';
}

// ==========================================
// 6. MULTIMODAL MULTI-FILE UPLOAD CONTROLS
// ==========================================
const uploadZone = document.getElementById('upload-zone');
const fileSelector = document.getElementById('file-selector');
const fileListContainer = document.getElementById('file-list-container');

// Size formatting helper
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Handle file triggers
uploadZone.addEventListener('click', () => fileSelector.click());

fileSelector.addEventListener('change', (e) => {
    handleFilesSelection(e.target.files);
});

// Drag over elements
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

['dragleave', 'dragend', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
    });
});

uploadZone.addEventListener('drop', (e) => {
    handleFilesSelection(e.dataTransfer.files);
});

function handleFilesSelection(files) {
    if (!files || files.length === 0) return;
    hideStatus();

    Array.from(files).forEach(file => {
        // Prevent duplicate files in stack
        if (state.attachedFiles.some(f => f.name === file.name && f.size === file.size)) {
            return;
        }

        // 15MB upload sanity check
        if (file.size > 15 * 1024 * 1024) {
            showStatus(`⚠️ File "${file.name}" exceeds the 15MB limit. Please upload smaller files.`, 'error');
            return;
        }

        const type = file.type;
        const isText = type === 'text/plain' || type === 'text/markdown' || file.name.endsWith('.txt') || file.name.endsWith('.md');
        const isPDF = type === 'application/pdf';
        const isImage = type.startsWith('image/');

        if (!isText && !isPDF && !isImage) {
            showStatus(`⚠️ File "${file.name}" has an unsupported format. Please upload Images, PDFs, TXT, or Markdown documents.`, 'error');
            return;
        }

        let itemIcon = '📄';
        if (isImage) itemIcon = '🖼️';
        if (isPDF) itemIcon = '📕';

        const reader = new FileReader();

        reader.onload = (e) => {
            const attachedFile = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                name: file.name,
                size: file.size,
                type: isText ? 'text' : type,
                base64Data: null,
                textContent: null,
                icon: itemIcon
            };

            if (isText) {
                attachedFile.textContent = e.target.result;
            } else {
                // Strip data URL scheme to get raw base64 data
                const dataUrl = e.target.result;
                const base64Index = dataUrl.indexOf(';base64,');
                if (base64Index !== -1) {
                    attachedFile.base64Data = dataUrl.substring(base64Index + 8);
                }
            }

            state.attachedFiles.push(attachedFile);
            renderFilesList();
        };

        reader.onerror = () => {
            showStatus(`⚠️ Failed to read the file "${file.name}". Please try again.`, 'error');
        };

        if (isText) {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    });
}

function renderFilesList() {
    fileListContainer.innerHTML = '';
    
    state.attachedFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        
        item.innerHTML = `
            <div class="file-info">
                <span class="file-icon">${file.icon}</span>
                <div class="file-details">
                    <span class="file-name" title="${file.name}">${file.name}</span>
                    <span class="file-size">${formatBytes(file.size)}</span>
                </div>
            </div>
            <button class="file-remove-btn" type="button" title="Remove attachment" aria-label="Remove attachment">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </button>
        `;
        
        // Remove item from state and UI list
        item.querySelector('.file-remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            state.attachedFiles = state.attachedFiles.filter(f => f.id !== file.id);
            renderFilesList();
        });
        
        fileListContainer.appendChild(item);
    });
}

// ==========================================
// 7. GENERATE QUIZ (API REQUEST)
// ==========================================
const generateBtn = document.getElementById('generate-btn');

generateBtn.addEventListener('click', async () => {
    hideStatus();
    
    const apiKey = apiKeyInput.value.trim();
    const notes = notesInput.value.trim();

    if (!apiKey) {
        showStatus('⚠️ Please enter your Gemini API Key.', 'error');
        return;
    }
    if (!notes && state.attachedFiles.length === 0) {
        showStatus('⚠️ Please enter study notes OR upload one or more files to generate the quiz.', 'error');
        return;
    }

    // Persist or delete key based on check box state
    if (saveKeyCheckbox.checked) {
        localStorage.setItem('gemini_api_key', apiKey);
    } else {
        localStorage.removeItem('gemini_api_key');
    }

    // Dynamic loading subtext
    const loadingSubtext = document.getElementById('loading-subtext');
    if (state.attachedFiles.length > 0) {
        loadingSubtext.textContent = `Analyzing ${state.attachedFiles.length} study files and parsing core concepts...`;
    } else {
        loadingSubtext.textContent = 'Structuring notes facts into practice challenges...';
    }

    // Transition to loading view
    showScreen('loading');
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    // Assemble multimodal parts
    const parts = [];
    
    let promptText = `
    Identify the primary language used in the uploaded study materials. You MUST generate the ENTIRE JSON response (questions, options, correct_answers, concepts, memory_tricks, topics, and ui_config translation buttons) in that EXACT same detected language. Do not mix languages (e.g. keep all options, concepts, and labels fully localized).
    
    Analyze the following study material carefully and output strictly a JSON object with:
    1. "source_metadata": An object summarizing the uploaded documents with:
       - "type": Detect the type of materials (e.g. PDF Documents, Image Notes, Code Snippets, Mixed Study Guide, etc.)
       - "pages": Total pages or length description (e.g. "X pages across Y files")
       - "difficulty_of_learning": Overall conceptual depth of learning (Easy, Medium, Hard)
       - "topics": An array of core topic titles identified in the study materials.
    2. "ui_config": Standard UI button translation strings.
    3. "quiz_data": An array of multiple choice questions (MCQs).
       For each question, include:
       - "question": The question text.
       - "options": An array of 4 options. They MUST start with their letter identifier (e.g. "A. Option", "B. Option", etc.)
       - "correct_answer": The letter itself (e.g. "A", "B", "C", or "D").
       - "difficulty": Question specific difficulty (Easy, Medium, Hard).
       - "concept": Explanation of the concept.
       - "memory_trick": Mnemonic or trick to remember.
       - "topic": The specific sub-topic this question covers.

    CRITICAL RULES FOR QUESTION GENERATION:
    - LANGUAGE MATCHING: Perform all detection, reasoning, and outputs in the detected language of the study materials. If the materials are in Spanish, all fields must be in Spanish. If French, all fields in French, etc.
    - EXISTING QUESTIONS: If the study materials already contain test questions, review questions, or sample MCQs, extract them verbatim! Preserve their original wording and correct options as closely as possible.
    - INSTRUCTIONAL CONTENT: For study notes, explanations, or facts, generate unique, high-quality MCQs strictly derived from the material.
    - NO HALLUCINATIONS: Do not introduce external facts, outside knowledge, or assumptions. All questions and correct options must be 100% true based ONLY on the provided texts.
    - QUESTION VOLUME: Generate as many questions as the materials naturally support to cover all important points. Do NOT restrict to 10 questions. Generate all possible questions that cover all the key facts in the materials.
    `;

    if (notes) {
        promptText += `\n\nPasted Study Notes:\n${notes}`;
    }

    state.attachedFiles.forEach((file, index) => {
        if (file.type === 'text') {
            promptText += `\n\nAttached Study File [${index + 1}] (${file.name}) Contents:\n${file.textContent}`;
        }
    });

    parts.push({ text: promptText });

    // Append binary files (images or PDFs) as base64 inlineData
    state.attachedFiles.forEach(file => {
        if (file.type !== 'text') {
            parts.push({
                inlineData: {
                    mimeType: file.type,
                    data: file.base64Data
                }
            });
        }
    });

    const payload = {
        contents: [{ parts: parts }],
        generationConfig: { responseMimeType: "application/json" }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.status === 200) {
            const result = await response.json();
            let rawText = result.candidates[0].content.parts[0].text.trim();
            
            // Handle edge case where LLM returns json wrapped in markdown blocks
            if (rawText.startsWith('```')) {
                rawText = rawText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
            }
            
            const quizData = JSON.parse(rawText);
            
            state.allQuestions = quizData.quiz_data || [];
            state.sourceMetadata = quizData.source_metadata || {};
            state.uiConfig = quizData.ui_config || {};
            
            if (state.allQuestions.length === 0) {
                showScreen('setup');
                showStatus('⚠️ Gemini analyzed your materials but could not generate questions. Try pasting more text or uploading different files.', 'error');
                return;
            }
            
            // Trigger pre-quiz overview
            renderSummaryScreen();
            showScreen('summary');
            
        } else if (response.status === 400) {
            showScreen('setup');
            showStatus('⚠️ API Error: Invalid API Key. Please check your key and try again.', 'error');
        } else {
            const errorText = await response.text();
            showScreen('setup');
            showStatus(`⚠️ API Error (${response.status}): ${errorText}`, 'error');
        }
    } catch (err) {
        showScreen('setup');
        showStatus(`⚠️ Connection Error: ${err.message || err}`, 'error');
    }
});

// ==========================================
// 8. PRE-QUIZ SUMMARY DISPLAY
// ==========================================
const statSourceType = document.getElementById('stat-source-type');
const statSourcePages = document.getElementById('stat-source-pages');
const statSourceDepth = document.getElementById('stat-source-depth');
const statSourceTopics = document.getElementById('stat-source-topics');

const statQuizTotal = document.getElementById('stat-quiz-total');
const statQuizDiffMix = document.getElementById('stat-quiz-difficulty-mix');
const statQuizTopicsMix = document.getElementById('stat-quiz-topics-mix');
const startQuizBtn = document.getElementById('start-quiz-btn');

function renderSummaryScreen() {
    // Fill left card: Document details
    statSourceType.textContent = state.sourceMetadata.type || 'Pasted Notes';
    statSourcePages.textContent = state.sourceMetadata.pages || 'N/A';
    statSourceDepth.textContent = state.sourceMetadata.difficulty_of_learning || 'Medium';
    
    // Topics Chips
    statSourceTopics.innerHTML = '';
    const topics = state.sourceMetadata.topics || [];
    if (topics.length === 0) {
        statSourceTopics.innerHTML = `<span class="topic-chip">General Concepts</span>`;
    } else {
        topics.forEach(t => {
            const chip = document.createElement('span');
            chip.className = 'topic-chip';
            chip.textContent = t;
            statSourceTopics.appendChild(chip);
        });
    }

    // Fill right card: Quiz parameters
    statQuizTotal.textContent = state.allQuestions.length;
    
    // Difficulty breakdown counts
    const counts = { Easy: 0, Medium: 0, Hard: 0 };
    state.allQuestions.forEach(q => {
        const d = (q.difficulty || 'Medium').trim();
        const norm = d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
        if (counts.hasOwnProperty(norm)) counts[norm]++;
        else counts.Medium++;
    });
    
    statQuizDiffMix.innerHTML = `
        <div class="stat-mix-item"><span style="color:var(--success);">Easy</span>: ${counts.Easy}</div>
        <div class="stat-mix-item"><span style="color:var(--warning);">Medium</span>: ${counts.Medium}</div>
        <div class="stat-mix-item"><span style="color:var(--error);">Hard</span>: ${counts.Hard}</div>
    `;

    // Topic question count breakdown
    const topicCounts = {};
    state.allQuestions.forEach(q => {
        const t = q.topic || 'General Practice';
        topicCounts[t] = (topicCounts[t] || 0) + 1;
    });

    statQuizTopicsMix.innerHTML = '';
    Object.keys(topicCounts).forEach(topicName => {
        const row = document.createElement('div');
        row.className = 'stat-mix-item';
        row.innerHTML = `<span style="color:var(--text-muted);">${topicName}</span>: ${topicCounts[topicName]} q.`;
        statQuizTopicsMix.appendChild(row);
    });
}

// Click to initiate quiz practice
startQuizBtn.addEventListener('click', () => {
    state.activeQuestions = [...state.allQuestions];
    state.currentIndex = 0;
    state.results = [];
    state.incorrectQuestions = [];
    state.firstAttemptResults = null; // Clear baseline
    
    renderQuestion();
    showScreen('quiz');
});

// ==========================================
// 9. QUIZ PRACTICE INTERACTIVE LOGIC
// ==========================================
const progressLabel = document.getElementById('progress-label');
const difficultyBadge = document.getElementById('difficulty-badge');
const progressBar = document.getElementById('progress-bar');
const questionText = document.getElementById('question-text');
const optionsGrid = document.getElementById('options-grid');

const feedbackContainer = document.getElementById('feedback-container');
const feedbackBanner = document.getElementById('feedback-banner');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackMessage = document.getElementById('feedback-message');
const conceptText = document.getElementById('concept-text');
const memoryText = document.getElementById('memory-text');

const submitBtn = document.getElementById('submit-btn');
const nextBtn = document.getElementById('next-btn');

function renderQuestion() {
    const question = state.activeQuestions[state.currentIndex];
    
    // Set Header Metadata
    progressLabel.textContent = `Question ${state.currentIndex + 1} of ${state.activeQuestions.length}`;
    
    // Style difficulty badge
    const diff = (question.difficulty || 'Medium').trim();
    difficultyBadge.textContent = diff;
    difficultyBadge.className = `difficulty-badge difficulty-${diff.toLowerCase()}`;
    
    // Update progress bar percentage
    const pct = (state.currentIndex / state.activeQuestions.length) * 100;
    progressBar.style.width = `${pct}%`;
    
    // Set Question text
    questionText.textContent = question.question;
    
    // Setup Custom UI configuration labels
    submitBtn.textContent = state.uiConfig.submit_btn || 'Submit Answer';
    nextBtn.textContent = state.uiConfig.next_btn || 'Next Question';
    
    // Clear Options grid and build dynamic radio card widgets
    optionsGrid.innerHTML = '';
    state.selectedOption = null;
    submitBtn.disabled = true;
    
    question.options.forEach(option => {
        // Extract letter identifier (e.g. 'A' from 'A. Option text')
        const letter = option.trim().charAt(0).toUpperCase();
        
        const card = document.createElement('div');
        card.className = 'option-card';
        card.dataset.letter = letter;
        
        card.innerHTML = `
            <div class="option-marker">${letter}</div>
            <div class="option-text">${option}</div>
        `;
        
        // Add click listener to choose option
        card.addEventListener('click', () => {
            if (card.classList.contains('disabled')) return;
            
            // Deselect other cards
            document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
            
            // Select current card
            card.classList.add('selected');
            state.selectedOption = letter;
            submitBtn.disabled = false;
        });
        
        optionsGrid.appendChild(card);
    });
    
    // Reset view buttons & feedback panel
    feedbackContainer.style.display = 'none';
    submitBtn.style.display = 'block';
    submitBtn.disabled = true;
    nextBtn.style.display = 'none';
}

submitBtn.addEventListener('click', () => {
    if (!state.selectedOption) return;
    
    const question = state.activeQuestions[state.currentIndex];
    const correctLetter = question.correct_answer.trim().toUpperCase();
    const isCorrect = (state.selectedOption === correctLetter);
    
    // Save results for stats
    state.results.push({
        isCorrect: isCorrect,
        difficulty: question.difficulty || 'Medium'
    });
    
    // If incorrect, add to retry list
    if (!isCorrect) {
        state.incorrectQuestions.push(question);
    }
    
    // Disable inputs
    document.querySelectorAll('.option-card').forEach(card => {
        card.classList.add('disabled');
        const letter = card.dataset.letter;
        
        // Visual indicator on choices
        if (letter === correctLetter) {
            // Right answer gets styled with success green borders
            card.style.borderColor = 'var(--success)';
            card.style.background = 'var(--success-glow)';
            card.querySelector('.option-marker').style.background = 'var(--success)';
            card.querySelector('.option-marker').style.borderColor = 'var(--success)';
            card.querySelector('.option-marker').style.color = 'white';
        } else if (letter === state.selectedOption && !isCorrect) {
            // Selected wrong answer gets styled with error red
            card.style.borderColor = 'var(--error)';
            card.style.background = 'var(--error-glow)';
            card.querySelector('.option-marker').style.background = 'var(--error)';
            card.querySelector('.option-marker').style.borderColor = 'var(--error)';
            card.querySelector('.option-marker').style.color = 'white';
        }
    });
    
    // Build instant explanation panel text
    if (isCorrect) {
        feedbackBanner.className = 'feedback-banner correct';
        feedbackIcon.textContent = '🟢';
        feedbackMessage.textContent = state.uiConfig.msg_correct || 'CORRECT!';
    } else {
        feedbackBanner.className = 'feedback-banner incorrect';
        feedbackIcon.textContent = '🔴';
        
        // Find correct option string to display in explanation message
        const correctOptString = question.options.find(opt => opt.trim().toUpperCase().startsWith(correctLetter)) || correctLetter;
        feedbackMessage.textContent = `${state.uiConfig.msg_incorrect || 'INCORRECT. The correct answer was:'} ${correctOptString}`;
    }
    
    conceptText.textContent = question.concept || 'Concept explanation not provided.';
    memoryText.textContent = question.memory_trick || 'Memory trick not provided.';
    
    // Swap main navigation buttons
    feedbackContainer.style.display = 'block';
    submitBtn.style.display = 'none';
    nextBtn.style.display = 'block';
});

nextBtn.addEventListener('click', () => {
    state.currentIndex++;
    if (state.currentIndex < state.activeQuestions.length) {
        renderQuestion();
    } else {
        completeRound();
    }
});

// ==========================================
// 10. CHECKPOINT COMPLETE & RETRY FLOW
// ==========================================
const retryDialogMessage = document.getElementById('retry-dialog-message');
const retryNoBtn = document.getElementById('retry-no-btn');
const retryYesBtn = document.getElementById('retry-yes-btn');

function completeRound() {
    // Record baseline score on the very first round completion
    if (state.firstAttemptResults === null) {
        state.firstAttemptResults = [...state.results];
    }
    
    // Check if there are wrongly answered questions to retry
    if (state.incorrectQuestions.length > 0) {
        const correct = state.results.filter(r => r.isCorrect).length;
        const total = state.results.length;
        
        // Use standard labels if translations not fetched yet
        const textCorrect = state.uiConfig.msg_correct || 'correct';
        const textIncorrect = state.uiConfig.msg_incorrect || 'incorrect';
        
        retryDialogMessage.innerHTML = `You answered <span style="color:var(--primary); font-weight:700;">${correct} out of ${total}</span> questions correctly.<br>You have <span style="color:var(--error); font-weight:700;">${state.incorrectQuestions.length}</span> incorrect answers remaining.`;
        
        showScreen('retryDialog');
    } else {
        // Mastered all questions, proceed to final performance score
        finishQuiz();
    }
}

// Yes - Practice wrong ones
retryYesBtn.addEventListener('click', () => {
    state.activeQuestions = [...state.incorrectQuestions];
    state.incorrectQuestions = [];
    state.currentIndex = 0;
    state.results = [];
    
    renderQuestion();
    showScreen('quiz');
});

// No - Skip retry, show stats
retryNoBtn.addEventListener('click', () => {
    finishQuiz();
});

// ==========================================
// 11. RESULTS SCREEN & DIAGNOSTIC STATS
// ==========================================
const scoreCircleProgress = document.getElementById('score-circle-progress');
const scorePercentage = document.getElementById('score-percentage');
const scoreRatio = document.getElementById('score-ratio');
const resultsSubtitle = document.getElementById('results-subtitle');

const statEasy = document.getElementById('stat-easy');
const statMedium = document.getElementById('stat-medium');
const statHard = document.getElementById('stat-hard');

const retakeBtn = document.getElementById('retake-btn');
const restartBtn = document.getElementById('restart-btn');

function finishQuiz() {
    const baselineTotal = state.firstAttemptResults.length;
    const baselineCorrect = state.firstAttemptResults.filter(r => r.isCorrect).length;
    const baselineAccuracy = baselineTotal > 0 ? (baselineCorrect / baselineTotal) * 100 : 0;
    
    // Render Circular Progress Ring with first-attempt score (circumference: 440px)
    const strokeOffset = 440 - (440 * baselineAccuracy) / 100;
    scoreCircleProgress.style.strokeDashoffset = strokeOffset;
    
    scorePercentage.textContent = `${baselineAccuracy.toFixed(0)}%`;
    scoreRatio.textContent = `${baselineCorrect}/${baselineTotal}`;
    
    // Subtitle progress description
    let subtitleHTML = `Initial Baseline Score: <strong>${baselineCorrect}/${baselineTotal}</strong>`;
    
    if (baselineCorrect < baselineTotal) {
        if (state.incorrectQuestions.length === 0) {
            subtitleHTML += ` <span style="color:var(--success);">• Final Mastery achieved: Completed all questions with 100% review!</span>`;
        } else {
            const masteredCount = baselineTotal - state.incorrectQuestions.length;
            subtitleHTML += ` • Mastered so far: <strong>${masteredCount}/${baselineTotal}</strong> (${state.incorrectQuestions.length} remaining)`;
        }
    } else {
        subtitleHTML += ` <span style="color:var(--success);">• Flawless Run!</span>`;
    }
    resultsSubtitle.innerHTML = subtitleHTML;
    
    // Compute stats by difficulty using BASELINE results for diagnostic accuracy
    const diffStats = {
        Easy: { correct: 0, total: 0 },
        Medium: { correct: 0, total: 0 },
        Hard: { correct: 0, total: 0 }
    };
    
    state.firstAttemptResults.forEach((r, idx) => {
        // Safe mapping
        const q = state.allQuestions[idx] || {};
        const d = (q.difficulty || 'Medium').trim();
        const normalized = d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
        
        if (diffStats[normalized]) {
            diffStats[normalized].total++;
            if (r.isCorrect) diffStats[normalized].correct++;
        }
    });
    
    // Display stats helper
    const renderStat = (statObj) => {
        if (statObj.total === 0) return 'N/A';
        const pct = (statObj.correct / statObj.total) * 100;
        return `${statObj.correct}/${statObj.total} (${pct.toFixed(0)}%)`;
    };
    
    statEasy.textContent = renderStat(diffStats.Easy);
    statMedium.textContent = renderStat(diffStats.Medium);
    statHard.textContent = renderStat(diffStats.Hard);
    
    showScreen('results');
    
    // Run Celebration! (Confetti fires for good initial baseline score or total mastery completion)
    if (baselineAccuracy >= 60 || state.incorrectQuestions.length === 0) {
        startConfetti();
    }
}

retakeBtn.addEventListener('click', () => {
    state.currentIndex = 0;
    state.results = [];
    state.incorrectQuestions = [];
    state.firstAttemptResults = null; // Reset baseline
    state.activeQuestions = [...state.allQuestions]; // Reload all
    
    renderQuestion();
    showScreen('quiz');
});

restartBtn.addEventListener('click', () => {
    // Reset inputs, but keep API Key input intact
    notesInput.value = '';
    fileListContainer.innerHTML = '';
    state.attachedFiles = [];
    showScreen('setup');
});

// ==========================================
// 12. CELEBRATION EFFECTS (Confetti Canvas)
// ==========================================
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let animationFrameId = null;
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);

class ConfettiParticle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * -canvas.height - 20;
        this.size = Math.random() * 8 + 6;
        this.color = `hsl(${Math.random() * 360}, 80%, 60%)`;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 3 + 2;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 4 - 2;
    }
    
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

function startConfetti() {
    resizeCanvas();
    particles = [];
    for (let i = 0; i < 120; i++) {
        particles.push(new ConfettiParticle());
    }
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    let timer = 0;
    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let active = false;
        particles.forEach(p => {
            p.update();
            p.draw();
            if (p.y < canvas.height) {
                active = true;
            }
        });
        
        timer++;
        // Limit animation loop length to 5 seconds
        if (active && timer < 300) {
            animationFrameId = requestAnimationFrame(loop);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    loop();
}

// ==========================================
// 13. APP BOOTSTRAP
// ==========================================
initTheme();
initApiKey();
