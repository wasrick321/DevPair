// API Configuration
const OCR_API_KEY = 'K84912833388957';
const OPENFDA_API_KEY = 'e7jnQyMAggBulNA9TgGcVvvXyZA1JxwowSNYqnHJ';

// DOM Elements
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const uploadArea = document.getElementById('uploadArea');
const status = document.getElementById('status');
const resultsSection = document.getElementById('results');
const extractedTextEl = document.getElementById('extractedText');
const drugInfoDiv = document.getElementById('drugInfo');
const chatSection = document.getElementById('chatSection');
const chatInput = document.getElementById('chatInput');
const sendChat = document.getElementById('sendChat');
const chatBox = document.getElementById('chatBox');

// Global Variables
let extractedText = '';
let drugsList = [];

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    setupDragAndDrop();
});

// Event Listeners
function initializeEventListeners() {
    processBtn.addEventListener('click', function() {
        fileInput.click();
    });

    fileInput.addEventListener('change', handleFileSelect);
    sendChat.addEventListener('click', handleUserChat);
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleUserChat();
        }
    });
}

// Drag and Drop Setup
function setupDragAndDrop() {
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#667eea';
        uploadArea.style.background = '#f0f4ff';
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#ddd';
        uploadArea.style.background = '#f8f9fa';
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#ddd';
        uploadArea.style.background = '#f8f9fa';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    });
}

// File Selection Handler
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

// Main File Processing Function
async function processFile(file) {
    try {
        // Validate file
        if (!validateFile(file)) return;

        // Show loading status
        showStatus('Processing your prescription...', 'loading');
        hideResults();
        processBtn.disabled = true;

        // Step 1: Extract text using OCR
        const text = await callOCRSpace(file);
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw new Error('No text could be extracted from the image. Please ensure the image is clear and contains readable text.');
        }

        extractedText = text;
        extractedTextEl.textContent = text;

        // Step 2: Identify medications
        const drugs = identifyDrugs(text);
        drugsList = drugs;

        if (drugs.length === 0) {
            showStatus('No medications identified in the text. Please ensure your prescription contains medication names.', 'error');
            showResults();
            return;
        }

        // Step 3: Get drug information from OpenFDA
        showStatus('Getting detailed information about your medications...', 'loading');
        await decodeDrugsInfo(drugs);

        // Step 4: Show results and enable chat
        showStatus('Prescription processed successfully!', 'success');
        showResults();
        enableChat();

    } catch (error) {
        console.error('Processing error:', error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        processBtn.disabled = false;
    }
}

// File Validation
function validateFile(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];

    if (!allowedTypes.includes(file.type)) {
        showStatus('Please upload an image file (JPG, PNG, GIF) or PDF.', 'error');
        return false;
    }

    if (file.size > maxSize) {
        showStatus('File size must be less than 10MB.', 'error');
        return false;
    }

    return true;
}

// OCR Text Extraction - FIXED VERSION
async function callOCRSpace(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('apikey', OCR_API_KEY);
    formData.append('language', 'eng');
    formData.append('OCREngine', '2');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');

    try {
        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.IsErroredOnProcessing) {
            const errorMsg = data.ErrorMessage && data.ErrorMessage.length > 0 
                ? data.ErrorMessage.join(', ')
                : 'OCR processing failed';
            throw new Error(errorMsg);
        }

        if (!data.ParsedResults || data.ParsedResults.length === 0) {
            throw new Error('No text could be extracted from the image');
        }

        // FIX: Properly access the ParsedText from the first result
        return data.ParsedResults[0].ParsedText || '';

    } catch (error) {
        if (error.message.includes('fetch')) {
            throw new Error('Network error. Please check your internet connection.');
        }
        throw error;
    }
}

// Enhanced Medication Identification
function identifyDrugs(text) {
    if (typeof text !== "string") return [];

    // Enhanced drug identification with common medication patterns
    const medicationPatterns = [
        // Pattern: Medication name followed by dosage
        /\b([A-Z][a-z]+(?:in|ol|ide|ine|ate|one|zole|pril|tan|statin|cillin|mycin|cycline|floxacin))\s*\d+(?:\.\d+)?\s*mg\b/gi,
        // Common medication names (case insensitive)
        /\b(Amoxicillin|Ibuprofen|Acetaminophen|Aspirin|Metformin|Lisinopril|Atorvastatin|Simvastatin|Omeprazole|Losartan|Amlodipine|Hydrochlorothiazide|Gabapentin|Sertraline|Fluoxetine|Trazodone|Alprazolam|Lorazepam|Clonazepam|Warfarin|Prednisone|Furosemide|Spironolactone|Digoxin|Carvedilol|Propranolol|Albuterol|Montelukast|Fluticasone|Insulin|Glipizide|Pioglitazone|Levothyroxine|Synthroid|Nexium|Prilosec|Zoloft|Prozac|Xanax|Ativan|Lasix|Norvasc|Crestor|Lipitor|Zocor|Plavix|Coumadin|Advair|Ventolin|Singular)\b/gi,
        // Capitalized words that might be medications (3+ letters)
        /\b[A-Z][a-z]{2,}(?:in|ol|ide|ine|ate|one|zole|pril|tan|statin|cillin|mycin|cycline|floxacin)\b/g
    ];

    let identifiedMeds = new Set();

    // Apply each pattern
    medicationPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            matches.forEach(match => {
                // Clean up the match (remove dosage info if present)
                let medName = match.replace(/\s*\d+(?:\.\d+)?\s*mg\b/i, '').trim();
                if (medName.length >= 3) {
                    identifiedMeds.add(medName);
                }
            });
        }
    });

    // Filter out common words that aren't medications
    const commonWords = new Set([
        'Take', 'With', 'Food', 'Days', 'Patient', 'After', 'Before', 'And', 'The', 'Or',
        'Morning', 'Evening', 'Night', 'Daily', 'Twice', 'Three', 'Times', 'Hour', 'Hours',
        'Doctor', 'Prescription', 'Medicine', 'Medication', 'Tablet', 'Capsule', 'Pill',
        'Instructions', 'Directions', 'Warning', 'Side', 'Effects', 'Duration', 'Course'
    ]);

    return Array.from(identifiedMeds).filter(med => !commonWords.has(med));
}

// Get Drug Information from OpenFDA - FIXED VERSION
async function getDrugInfoFromOpenFDA(drugName) {
    const searchQueries = [
        `openfda.brand_name:"${drugName}"`,
        `openfda.generic_name:"${drugName}"`,
        `openfda.substance_name:"${drugName}"`
    ];

    for (const query of searchQueries) {
        try {
            const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(query)}&limit=1`;

            // FIX: OpenFDA API typically doesn't require the api_key in headers for basic requests
            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    return data.results[0];
                }
            }
        } catch (error) {
            console.warn(`Failed to fetch info for ${drugName} with query ${query}:`, error);
        }
    }

    return null;
}

// Display Drug Information - FIXED VERSION
async function decodeDrugsInfo(drugs) {
    if (drugs.length === 0) {
        drugInfoDiv.innerHTML = '<p>No drugs found in the prescription text.</p>';
        return;
    }

    drugInfoDiv.innerHTML = '';

    for (const drug of drugs) {
        const drugCard = document.createElement('div');
        drugCard.className = 'drug-card';
        drugCard.innerHTML = `
            <div class="drug-name">${drug}</div>
            <div class="loading-info">
                <div class="loading-spinner"></div> Getting information...
            </div>
        `;
        drugInfoDiv.appendChild(drugCard);

        try {
            const info = await getDrugInfoFromOpenFDA(drug);
            updateDrugCard(drugCard, drug, info);
        } catch (error) {
            console.error(`Error fetching info for ${drug}:`, error);
            updateDrugCard(drugCard, drug, null, 'Failed to fetch information');
        }
    }
}

// Update Drug Card with Information
function updateDrugCard(card, drugName, drugInfo, errorMsg = null) {
    const loadingDiv = card.querySelector('.loading-info');

    if (errorMsg) {
        loadingDiv.innerHTML = `<p style="color: #c62828;">${errorMsg}</p>`;
        return;
    }

    if (!drugInfo) {
        loadingDiv.innerHTML = '<p>No detailed information available in FDA database.</p>';
        return;
    }

    let infoHTML = '';

    // Purpose/Indication
    if (drugInfo.purpose && drugInfo.purpose.length > 0) {
        infoHTML += `
            <div class="drug-info">
                <strong>Purpose:</strong> ${cleanText(drugInfo.purpose[0])}
            </div>
        `;
    } else if (drugInfo.indications_and_usage && drugInfo.indications_and_usage.length > 0) {
        infoHTML += `
            <div class="drug-info">
                <strong>Used for:</strong> ${cleanText(drugInfo.indications_and_usage[0])}
            </div>
        `;
    }

    // Dosage and Administration
    if (drugInfo.dosage_and_administration && drugInfo.dosage_and_administration.length > 0) {
        infoHTML += `
            <div class="drug-info">
                <strong>How to take:</strong> ${cleanText(drugInfo.dosage_and_administration[0])}
            </div>
        `;
    }

    // Side Effects
    if (drugInfo.adverse_reactions && drugInfo.adverse_reactions.length > 0) {
        infoHTML += `
            <div class="drug-info" style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-top: 10px;">
                <strong>Possible Side Effects:</strong><br>
                ${cleanText(drugInfo.adverse_reactions[0])}
            </div>
        `;
    }

    // Warnings
    if (drugInfo.warnings && drugInfo.warnings.length > 0) {
        infoHTML += `
            <div class="drug-info" style="background: #f8d7da; padding: 10px; border-radius: 5px; margin-top: 10px;">
                <strong>⚠️ Important Warnings:</strong><br>
                ${cleanText(drugInfo.warnings[0])}
            </div>
        `;
    }

    loadingDiv.innerHTML = infoHTML || '<p>Limited information available.</p>';
}

// Clean and truncate text
function cleanText(text) {
    if (!text) return 'Not specified';

    // Remove excessive whitespace and newlines
    let cleaned = text.replace(/\s+/g, ' ').trim();

    // Truncate if too long
    if (cleaned.length > 500) {
        cleaned = cleaned.substring(0, 500) + '...';
    }

    return cleaned;
}

// Chat Functionality
function enableChat() {
    chatSection.style.display = 'block';

    // Add initial bot message
    appendChatMessage('bot', 'Hi! I can help answer questions about the medications in your prescription. You can ask about side effects, dosage, warnings, or interactions.');
}

async function handleUserChat() {
    const question = chatInput.value.trim();
    if (!question) return;

    appendChatMessage('user', question);
    chatInput.value = '';
    appendChatMessage('bot', 'Searching for info...');

    const lowerQ = question.toLowerCase();
    const matchedDrugs = drugsList.filter(d => lowerQ.includes(d.toLowerCase()));

    if (matchedDrugs.length === 0) {
        removeLastBotMessage();
        appendChatMessage('bot', "Sorry, I couldn't identify the drug in your question. Please ask about a drug listed above: " + drugsList.join(', '));
        return;
    }

    const drug = matchedDrugs[0];
    const info = await getDrugInfoFromOpenFDA(drug);
    removeLastBotMessage();

    if (!info) {
        appendChatMessage('bot', `Sorry, no detailed info found for ${drug}.`);
        return;
    }

    let answer = '';
    if (lowerQ.includes('side effect')) {
        answer = `Possible side effects of ${drug}: ${info.adverse_reactions ? cleanText(info.adverse_reactions[0]) : 'No info available.'}`;
    } else if (lowerQ.includes('usage') || lowerQ.includes('take')) {
        answer = `Usage info for ${drug}: ${info.indications_and_usage ? cleanText(info.indications_and_usage[0]) : 'No info available.'}`;
    } else if (lowerQ.includes('warning') || lowerQ.includes('precaution')) {
        answer = `Warnings and precautions for ${drug}: ${info.warnings ? cleanText(info.warnings[0]) : 'No info available.'}`;
    } else {
        answer = `${drug} info: ${info.purpose ? cleanText(info.purpose[0]) : 'No info available.'}`;
    }

    appendChatMessage('bot', answer + '\n\nNote: For personalized advice, always consult your healthcare provider.');
}

// Chat UI Functions
function appendChatMessage(sender, text) {
    const div = document.createElement('div');
    div.classList.add('chat-message');
    div.classList.add(sender === 'bot' ? 'bot-message' : 'user-message');

    const senderDiv = document.createElement('div');
    senderDiv.className = 'sender';
    senderDiv.textContent = sender === 'bot' ? 'Doctor Speak Decoder' : 'You';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = text.replace(/\n/g, '<br>');

    div.appendChild(senderDiv);
    div.appendChild(contentDiv);

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function removeLastBotMessage() {
    const botMessages = chatBox.querySelectorAll('.bot-message');
    if (botMessages.length) {
        botMessages[botMessages.length - 1].remove();
    }
}

// UI Helper Functions
function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
}

function showResults() {
    resultsSection.style.display = 'block';
}

function hideResults() {
    resultsSection.style.display = 'none';
    chatSection.style.display = 'none';
}

// Error Handling
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
    showStatus('An unexpected error occurred. Please refresh the page and try again.', 'error');
});

console.log('Doctor Speak Decoder initialized successfully!');
