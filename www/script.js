// ==========================================
// 1. STATE & CONSTANTS
// ==========================================
const state = {
    quizData: [],
    uiConfig: {},
    currentIndex: 0,
    results: [], // Array of { isCorrect: boolean, difficulty: string }
    selectedOption: null, // String (e.g., 'A', 'B', etc.)
    attachedFile: null // Object: { name, size, type, base64Data, textContent }
};

const screens = {
    setup: document.getElementById('setup-screen'),
    loading: document.getElementById('loading-screen'),
    quiz: document.getElementById('quiz-screen'),
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
// 6. MULTIMODAL FILE UPLOAD CONTROLS
// ==========================================
const uploadZone = document.getElementById('upload-zone');
const fileSelector = document.getElementById('file-selector');
const fileDrawer = document.getElementById('file-drawer');
const fileIcon = document.getElementById('file-icon');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const fileRemoveBtn = document.getElementById('file-remove-btn');

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
    handleFileSelection(e.target.files[0]);
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
    handleFileSelection(e.dataTransfer.files[0]);
});

fileRemoveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileSelector.value = '';
    fileDrawer.style.display = 'none';
    state.attachedFile = null;
});

function handleFileSelection(file) {
    if (!file) return;
    hideStatus();

    // 15MB upload sanity check
    if (file.size > 15 * 1024 * 1024) {
        showStatus('⚠️ File size exceeds the 15MB limit. Please upload a smaller file.', 'error');
        return;
    }

    const type = file.type;
    const isText = type === 'text/plain' || type === 'text/markdown' || file.name.endsWith('.txt') || file.name.endsWith('.md');
    const isPDF = type === 'application/pdf';
    const isImage = type.startsWith('image/');

    if (!isText && !isPDF && !isImage) {
        showStatus('⚠️ Unsupported file format. Please upload an Image, PDF, TXT, or Markdown document.', 'error');
        return;
    }

    let itemIcon = '📄';
    if (isImage) itemIcon = '🖼️';
    if (isPDF) itemIcon = '📕';

    const reader = new FileReader();

    reader.onload = (e) => {
        state.attachedFile = {
            name: file.name,
            size: file.size,
            type: isText ? 'text' : type,
            base64Data: null,
            textContent: null
        };

        if (isText) {
            state.attachedFile.textContent = e.target.result;
        } else {
            // Strip data URL scheme (e.g. "data:image/png;base64,") to get raw base64 data
            const dataUrl = e.target.result;
            const base64Index = dataUrl.indexOf(';base64,');
            if (base64Index !== -1) {
                state.attachedFile.base64Data = dataUrl.substring(base64Index + 8);
            }
        }

        // Show attachment status pill
        fileIcon.textContent = itemIcon;
        fileName.textContent = file.name;
        fileSize.textContent = formatBytes(file.size);
        fileDrawer.style.display = 'flex';
    };

    reader.onerror = () => {
        showStatus('⚠️ Failed to read the selected file. Please try again.', 'error');
    };

    if (isText) {
        reader.readAsText(file);
    } else {
        reader.readAsDataURL(file);
    }
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
    if (!notes && !state.attachedFile) {
        showStatus('⚠️ Please enter study notes OR upload a document/image to generate the quiz.', 'error');
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
    if (state.attachedFile) {
        loadingSubtext.textContent = `Analyzing file "${state.attachedFile.name}" and parsing study concepts...`;
    } else {
        loadingSubtext.textContent = 'Structuring notes facts into visual challenges...';
    }

    // Transition to loading view
    showScreen('loading');
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    // Assemble multimodal parts
    const parts = [];
    
    let promptText = `
    Analyze the following study material. Detect the language and use it for ALL output.
    Generate unique MCQs. Tag difficulty (Easy/Medium/Hard).
    Output strictly as JSON with "ui_config" (translating UI buttons) and "quiz_data" (question, options, correct_answer, difficulty, concept, memory_trick).
    
    The options MUST start with their respective letter identifier (e.g. "A. Option description" or "B. Option description") so the letters can be matched cleanly.
    The "correct_answer" field must be the letter itself (e.g. "A", "B", "C", or "D").
    `;

    if (notes) {
        promptText += `\n\nPasted Study Notes:\n${notes}`;
    }

    if (state.attachedFile && state.attachedFile.type === 'text') {
        promptText += `\n\nAttached Study Document Contents:\n${state.attachedFile.textContent}`;
    }

    parts.push({ text: promptText });

    // Append binary file (image or PDF) as base64 inlineData
    if (state.attachedFile && state.attachedFile.type !== 'text') {
        parts.push({
            inlineData: {
                mimeType: state.attachedFile.type,
                data: state.attachedFile.base64Data
            }
        });
    }

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
            
            state.quizData = quizData.quiz_data || [];
            state.uiConfig = quizData.ui_config || {};
            state.currentIndex = 0;
            state.results = [];
            
            if (state.quizData.length === 0) {
                showScreen('setup');
                showStatus('⚠️ Gemini analyzed your materials but could not generate questions. Try pasting more text or uploading a different file.', 'error');
                return;
            }
            
            // Start the quiz
            renderQuestion();
            showScreen('quiz');
            
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
// 8. QUIZ RENDER & INTERACTIVE LOGIC
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
    const question = state.quizData[state.currentIndex];
    
    // Set Header Metadata
    progressLabel.textContent = `Question ${state.currentIndex + 1} of ${state.quizData.length}`;
    
    // Style difficulty badge
    const diff = (question.difficulty || 'Medium').trim();
    difficultyBadge.textContent = diff;
    difficultyBadge.className = `difficulty-badge difficulty-${diff.toLowerCase()}`;
    
    // Update progress bar percentage
    const pct = (state.currentIndex / state.quizData.length) * 100;
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
    
    // Enable/disable option card locks
    optionsGrid.classList.remove('locked');
}

submitBtn.addEventListener('click', () => {
    if (!state.selectedOption) return;
    
    const question = state.quizData[state.currentIndex];
    const correctLetter = question.correct_answer.trim().toUpperCase();
    const isCorrect = (state.selectedOption === correctLetter);
    
    // Save results for stats
    state.results.push({
        isCorrect: isCorrect,
        difficulty: question.difficulty || 'Medium'
    });
    
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
    if (state.currentIndex < state.quizData.length) {
        renderQuestion();
    } else {
        finishQuiz();
    }
});

// ==========================================
// 9. FINISH QUIZ & ACCURACY METRICS
// ==========================================
const scoreCircleProgress = document.getElementById('score-circle-progress');
const scorePercentage = document.getElementById('score-percentage');
const scoreRatio = document.getElementById('score-ratio');

const statEasy = document.getElementById('stat-easy');
const statMedium = document.getElementById('stat-medium');
const statHard = document.getElementById('stat-hard');

const retakeBtn = document.getElementById('retake-btn');
const restartBtn = document.getElementById('restart-btn');

function finishQuiz() {
    const total = state.results.length;
    const correct = state.results.filter(r => r.isCorrect).length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    
    // Render Circular Progress Ring (circumference: 440px)
    const strokeOffset = 440 - (440 * accuracy) / 100;
    scoreCircleProgress.style.strokeDashoffset = strokeOffset;
    
    scorePercentage.textContent = `${accuracy.toFixed(0)}%`;
    scoreRatio.textContent = `${correct}/${total}`;
    
    // Calculate stats by difficulty
    const diffStats = {
        Easy: { correct: 0, total: 0 },
        Medium: { correct: 0, total: 0 },
        Hard: { correct: 0, total: 0 }
    };
    
    state.results.forEach(r => {
        const d = r.difficulty.trim();
        // Normalize casing
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
    
    // Run Celebration!
    if (accuracy >= 60) {
        startConfetti();
    }
}

retakeBtn.addEventListener('click', () => {
    state.currentIndex = 0;
    state.results = [];
    renderQuestion();
    showScreen('quiz');
});

restartBtn.addEventListener('click', () => {
    // Reset inputs, but keep API Key input intact
    notesInput.value = '';
    fileSelector.value = '';
    fileDrawer.style.display = 'none';
    state.attachedFile = null;
    showScreen('setup');
});

// ==========================================
// 10. CELEBRATION EFFECTS (Confetti Canvas)
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
// 11. APP BOOTSTRAP
// ==========================================
initTheme();
initApiKey();
