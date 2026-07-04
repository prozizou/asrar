// ==================== TABLES DE RÉFÉRENCE ====================
const ABJAD_TABLE = Object.freeze([
    { char: "ا", name: "ألف", value: 1 }, { char: "ب", name: "باء", value: 2 },
    { char: "ج", name: "جيم", value: 3 }, { char: "د", name: "دال", value: 4 },
    { char: "ه", name: "هاء", value: 5 }, { char: "و", name: "واو", value: 6 },
    { char: "ز", name: "زاي", value: 7 }, { char: "ح", name: "حاء", value: 8 },
    { char: "ط", name: "طاء", value: 9 }, { char: "ي", name: "ياء", value: 10 },
    { char: "ك", name: "كاف", value: 20 }, { char: "ل", name: "لام", value: 30 },
    { char: "م", name: "ميم", value: 40 }, { char: "ن", name: "نون", value: 50 },
    { char: "ص", name: "صاد", value: 60 }, { char: "ع", name: "عين", value: 70 },
    { char: "ف", name: "فاء", value: 80 }, { char: "ض", name: "ضاد", value: 90 },
    { char: "ق", name: "قاف", value: 100 }, { char: "ر", name: "راء", value: 200 },
    { char: "س", name: "سين", value: 300 }, { char: "ت", name: "تاء", value: 400 },
    { char: "ث", name: "ثاء", value: 500 }, { char: "خ", name: "خاء", value: 600 },
    { char: "ذ", name: "ذال", value: 700 }, { char: "ظ", name: "ظاء", value: 800 },
    { char: "غ", name: "غين", value: 900 }, { char: "ش", name: "شين", value: 1000 },
    { char: "ٱ", name: "ألف", value: 1 }, { char: "إ", name: "ألف", value: 1 },
    { char: "أ", name: "ألف", value: 1 }, { char: "آ", name: "ألف", value: 1 },
    { char: "ء", name: "ألف", value: 1 }, { char: "ى", name: "ياء", value: 10 },
    { char: "ة", name: "هاء", value: 5 }, { char: "ئ", name: "ياء", value: 1 }
]);

const NUMBER_NAMES = {
    1: "واحد", 2: "اثنان", 3: "ثلاثة", 4: "أربعة", 5: "خمسة",
    6: "ستة", 7: "سبعة", 8: "ثمانية", 9: "تسعة", 10: "عشرة",
    20: "عشرون", 30: "ثلاثون", 40: "أربعون", 50: "خمسون",
    60: "ستون", 70: "سبعون", 80: "ثمانون", 90: "تسعون",
    100: "مئة", 200: "مئتان", 300: "ثلاثمئة", 400: "أربعمئة",
    500: "خمسمئة", 600: "ستمئة", 700: "سبعمئة", 800: "ثمانيمئة",
    900: "تسعمئة", 1000: "ألف"
};

const TRANSCRIPTION = {
    "ا": "a", "ب": "b", "ج": "dj", "د": "d", "ه": "h", "و": "w",
    "ز": "j", "ح": "h", "ط": "t", "ي": "y", "ك": "k", "ل": "l",
    "م": "m", "ن": "n", "ص": "s", "ع": "'a", "ف": "f", "ض": "d",
    "ق": "q", "ر": "r", "س": "s", "ت": "t", "ث": "s", "خ": "h",
    "ذ": "j", "ظ": "j", "غ": "a", "ش": "ch"
};

// Map phonétique normal (avec voyelle "A")
const VOWEL_MAP = {
    "ا": "a", "ب": "Ba", "ج": "Dia", "د": "Da", "ه": "Ha", "و": "Wa",
    "ز": "Ja", "ح": "Ha", "ط": "Ta", "ي": "Ya", "ك": "Ka", "ل": "La",
    "م": "Ma", "ن": "Na", "ص": "Sa", "ع": "a", "ف": "Fa", "ض": "Da",
    "ق": "Qa", "ر": "Ra", "س": "Sa", "ت": "Ta", "ث": "Sa", "خ": "Ha",
    "ذ": "Ja", "ظ": "Za", "غ": "A", "ش": "Cha"
};

// Map phonétique contracté (Soukoun - sans voyelle)
const CONS_MAP = {
    "ا": "a", "ب": "b", "ج": "dj", "د": "d", "ه": "h", "و": "w",
    "ز": "j", "ح": "h", "ط": "th", "ي": "y", "ك": "k", "ل": "l",
    "م": "m", "ن": "n", "ص": "s", "ع": "a", "ف": "f", "ض": "d",
    "ق": "q", "ر": "r", "س": "s", "ت": "t", "ث": "s", "خ": "h",
    "ذ": "j", "ظ": "z", "غ": "h", "ش": "ch"
};

// ==================== CHAMP LEXICAL (SYNONYMES) ====================
const LEXICAL_FIELD = {
    "amour": ["aimer", "affection", "tendresse", "passion", "cœur", "mariage", "union", "compagnon"],
    "richesse": ["argent", "fortune", "prospérité", "abondance", "gain", "réussite", "finance", "business", "commerce"],
    "santé": ["guérison", "médecine", "bien-être", "force", "vitalité", "maladie", "soin", "hôpital"],
    "protection": ["sécurité", "défense", "abri", "garde", "sauvegarde", "préserver", "bouclier"],
    "travail": ["emploi", "métier", "carrière", "réussite professionnelle", "boulot", "job", "entreprise"],
    "savoir": ["connaissance", "science", "étude", "apprentissage", "intelligence", "sagesse", "éducation"],
    "paix": ["sérénité", "calme", "tranquillité", "harmonie", "réconciliation"],
    "force": ["puissance", "courage", "énergie", "détermination", "volonté"],
    "famille": ["parents", "enfants", "mère", "père", "foyer", "maison", "descendance"],
    "spiritualité": ["foi", "croyance", "prière", "méditation", "cheminement", "lumière", "guidance"]
};

const LEXICAL_INDEX = {};
for (const [theme, synonyms] of Object.entries(LEXICAL_FIELD)) {
    LEXICAL_INDEX[theme] = synonyms;
    for (const word of synonyms) {
        if (!LEXICAL_INDEX[word]) LEXICAL_INDEX[word] = [];
        LEXICAL_INDEX[word] = [...new Set([...LEXICAL_INDEX[word], ...synonyms, theme])];
    }
}

// ==================== CONNEXION FIREBASE ====================
// Lectures via le SDK compat (initialisé dans access.js) : le jeton d'auth est
// joint automatiquement → les règles `auth != null` sont satisfaites. On attend
// que l'état d'auth soit résolu (session du hub) avant de lire.
let firebaseAsmaData = [];

function _waitAuth() {
    return new Promise((resolve) => {
        try {
            const a = firebase.auth();
            const off = a.onAuthStateChanged((u) => { off(); resolve(u); });
        } catch (e) { resolve(null); }
    });
}

async function fetchAsmaUlHusnaFromFirebase() {
    try {
        await _waitAuth();
        const snap = await firebase.database().ref('data/appData/asmaUlHusna').once('value');
        const raw = snap.val();
        // RTDB peut renvoyer un objet (clés) au lieu d'un tableau → on normalise.
        firebaseAsmaData = Array.isArray(raw) ? raw.filter(Boolean)
                         : (raw && typeof raw === 'object') ? Object.values(raw).filter(Boolean)
                         : [];
        console.log("✅ Noms d'Allah chargés:", firebaseAsmaData.length);
    } catch (error) {
        console.error("❌ Erreur Firebase:", error);
        firebaseAsmaData = [];
    }
}
fetchAsmaUlHusnaFromFirebase();

// ==================== CHARGEMENT DES VERSETS ====================
let firebaseVerses = [];

async function fetchVersetsFromFirebase() {
    try {
        await _waitAuth();
        const snap = await firebase.database().ref('versetRef').once('value');
        const data = snap.val() || {};
        firebaseVerses = [];
        for (const [id, item] of Object.entries(data)) {
            if (item && item.verset) {
                firebaseVerses.push({
                    id: id,
                    key: item.key || '',
                    verset: item.verset.trim()
                });
            }
        }
        console.log(`✅ Versets chargés : ${firebaseVerses.length}`);
    } catch (error) {
        console.error("❌ Erreur chargement versets:", error);
        firebaseVerses = [];
    }
}
fetchVersetsFromFirebase();

function findAllahNameByLetter(char, userWish) {
    if (!firebaseAsmaData || firebaseAsmaData.length === 0) return null;

    const normChar = char.replace(/[أإآ]/g, 'ا');

    let matchingNames = firebaseAsmaData.filter(item => {
        if (!item || !item.name) return false;
        let normName = item.name.replace(/[أإآ]/g, 'ا');
        if (normName === "الله") return normChar === "ا";
        let nameWithoutAl = normName;
        if (normName.startsWith("ال")) nameWithoutAl = normName.substring(2);
        return nameWithoutAl.startsWith(normChar) || normName.startsWith(normChar);
    });

    if (matchingNames.length === 0) return null;

    const wishText = (userWish || '').toLowerCase();
    let rawKeywords = wishText.match(/[a-zà-ÿ]+/gi) || [];
    let expandedKeywords = new Set();

    for (let word of rawKeywords) {
        word = word.toLowerCase();
        expandedKeywords.add(word);
        if (LEXICAL_INDEX[word]) {
            LEXICAL_INDEX[word].forEach(syn => expandedKeywords.add(syn));
        }
    }

    const keywords = Array.from(expandedKeywords).filter(w => w.length >= 4 || ['or','paix','foi','vie','mal','bien'].includes(w));

    // Seuil minimum de score pour accepter un nom
    const MIN_SCORE = 1;  // Au moins une correspondance

    let bestMatch = null;
    let maxScore = -1;

    for (let nameObj of matchingNames) {
        let score = 0;
        if (keywords.length > 0) {
            const dynamicRegex = new RegExp(keywords.join('|'), 'gi');
            if (nameObj.intent) {
                const intentMatches = nameObj.intent.match(dynamicRegex);
                if (intentMatches) score += intentMatches.length * 3;
            }
            if (nameObj.meaning) {
                const meaningMatches = nameObj.meaning.match(dynamicRegex);
                if (meaningMatches) score += meaningMatches.length * 2;
            }
            if (nameObj.benefit) {
                const benefitMatches = nameObj.benefit.match(dynamicRegex);
                if (benefitMatches) score += benefitMatches.length * 1;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestMatch = nameObj;
        }
    }

    // Si aucun nom n'a atteint le score minimum, on renvoie null (pas de suggestion)
    if (maxScore < MIN_SCORE) {
        return null;
    }

    return bestMatch;
}
// ==================== DOM & ÉTAT ====================
const ELS = {
    editor: document.getElementById('editor'),
    pmTotal: document.getElementById('pmTotal'),
    workIntent: document.getElementById('workIntent'),
    btnExtract: document.getElementById('btnExtract'),
    textView1: document.getElementById('textView1'),
    textView2: document.getElementById('textView2'),
    totalV1: document.getElementById('totalV1'),
    totalV2: document.getElementById('totalV2'),
    formula1: document.getElementById('formula1'),
    formula1bis: document.getElementById('formula1bis'),
    formula2: document.getElementById('formula2'),
    formula2bis: document.getElementById('formula2bis'),
    formula3: document.getElementById('formula3'),
    formula3bis: document.getElementById('formula3bis'),
    totalFinal: document.getElementById('totalFinal'),
    btnAngelNames: document.getElementById('btnAngelNames'),
    angelNamesContainer: document.getElementById('angelNamesContainer'),
    angelNamesList: document.getElementById('angelNamesList'),
    allahNamesContainer: document.getElementById('allahNamesContainer'),
    allahNamesList: document.getElementById('allahNamesList')
};

let stock = 0, secondLength = 0, trois = 0;
let results = { v1m1: 0, v1m2: 0, v2m1: 0, v2m2: 0, v3m1: 0, v3m2: 0, total: 0 };
let isRunning = false;

// ==================== UTILITAIRES ====================
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatMixedText(text) {
    if (!text) return '';
    const lines = text.split(/\n|<br>/i);
    let html = '';
    lines.forEach(line => {
        let trimLine = line.trim();
        if (trimLine.length === 0) return;
        let sentences = trimLine.split('.');
        sentences.forEach((sentence, index) => {
            let trimSentence = sentence.trim();
            if (trimSentence.length === 0) return;
            if (index < sentences.length - 1 || trimLine.endsWith('.')) {
                trimSentence += '.';
            }
            if (/[\u0600-\u06FF]/.test(trimSentence)) {
                html += `<div dir="rtl" style="text-align: right; line-height: 1.6; margin-bottom: 8px;">${trimSentence}</div>`;
            } else {
                html += `<div dir="ltr" style="text-align: left; line-height: 1.6; margin-bottom: 8px;">${trimSentence}</div>`;
            }
        });
    });
    return html;
}

function countChar(text, char) {
    let count = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === char) count++;
    }
    return count;
}

function calculateWeight(text) {
    let w = 0;
    for (const ch of text) {
        const entry = ABJAD_TABLE.find(e => e.char === ch);
        if (entry) w += entry.value;
    }
    return w;
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ==================== CALCULS ====================
async function runV1() {
    const text = ELS.editor.textContent.trim();
    if (!text) return;
    stock = 0;
    ELS.pmTotal.textContent = '0';
    ELS.formula1.textContent = '0 × 0 = 0'; ELS.formula1bis.textContent = '0 × 0 = 0';
    const cleanText = text.replace(/\s/g, '');
    const textLen = cleanText.length;
    for (const entry of ABJAD_TABLE) {
        const count = countChar(text, entry.char);
        if (count > 0) {
            stock += count * entry.value;
            ELS.pmTotal.textContent = formatNumber(stock);
            const calc1 = stock * textLen;
            const calc2 = calc1 * textLen;
            ELS.formula1.textContent = `${stock} × ${textLen} = ${calc1}`;
            ELS.formula1bis.textContent = `${calc1} × ${textLen} = ${calc2}`;
            await delay(50);
        }
    }
    results.v1m1 = stock * textLen;
    results.v1m2 = results.v1m1 * textLen;
}

async function runV2() {
    const text = ELS.editor.textContent.trim();
    if (!text) return;
    secondLength = 0;
    ELS.textView1.textContent = '';
    ELS.totalV1.textContent = '0';
    ELS.formula2.textContent = '0 × 0 = 0'; ELS.formula2bis.textContent = '0 × 0 = 0';
    let expanded = '';
    for (const entry of ABJAD_TABLE) {
        const count = countChar(text, entry.char);
        for (let i = 0; i < count; i++) expanded += entry.name + ' ';
    }
    expanded = expanded.trim();
    ELS.textView1.textContent = expanded;
    const expandedClean = expanded.replace(/\s/g, '');
    secondLength = calculateWeight(expanded);
    ELS.totalV1.textContent = formatNumber(secondLength);
    const len = expandedClean.length;
    const calc1 = secondLength * len;
    const calc2 = calc1 * len;
    ELS.formula2.textContent = `${secondLength} × ${len} = ${calc1}`;
    ELS.formula2bis.textContent = `${calc1} × ${len} = ${calc2}`;
    results.v2m1 = calc1; results.v2m2 = calc2;
}

async function runV3() {
    const text = ELS.editor.textContent.trim();
    if (!text) return;
    trois = 0;
    ELS.textView2.textContent = '';
    ELS.totalV2.textContent = '0';
    ELS.formula3.textContent = '0 × 0 = 0'; ELS.formula3bis.textContent = '0 × 0 = 0';
    let expanded = '';
    for (const entry of ABJAD_TABLE) {
        const count = countChar(text, entry.char);
        const numName = NUMBER_NAMES[entry.value] || entry.name;
        for (let i = 0; i < count; i++) expanded += numName + ' ';
    }
    expanded = expanded.trim();
    ELS.textView2.textContent = expanded;
    const expandedClean = expanded.replace(/\s/g, '');
    trois = calculateWeight(expanded);
    ELS.totalV2.textContent = formatNumber(trois);
    const len = expandedClean.length;
    const calc1 = trois * len;
    const calc2 = calc1 * len;
    ELS.formula3.textContent = `${trois} × ${len} = ${calc1}`;
    ELS.formula3bis.textContent = `${calc1} × ${len} = ${calc2}`;
    results.v3m1 = calc1; results.v3m2 = calc2;
    updateFinalTotal();
}

function updateFinalTotal() {
    const total = stock + secondLength + trois;
    results.total = total;
    ELS.totalFinal.innerHTML = `المجموع: <bdi dir="ltr">${formatNumber(total)}</bdi>`;
}

function checkEnableAngelButton() {
    ELS.btnAngelNames.disabled = (stock === 0);
}

async function runAll() {
    if (isRunning) return;
    const text = ELS.editor.textContent.trim();
    if (!text) { alert('يرجى إدخال نص للتحليل'); return; }
    isRunning = true;
    ELS.btnExtract.disabled = true;
    ELS.btnExtract.textContent = 'جارٍ...';
    await runV1();
    await runV2();
    await runV3();
    ELS.btnExtract.disabled = false;
    ELS.btnExtract.textContent = 'Calculer';
    isRunning = false;
    checkEnableAngelButton();
}

// ==================== GÉNÉRATION ====================
function reduceNumber(n) {
    while (n >= 1000000) n = (n % 10000) + Math.floor(n / 10000);
    return n;
}

function convertToLetters(value) {
    if (value === 0) return '';
    let letters = '';
    const hundreds = Math.floor(value / 100) * 100;
    const tens = Math.floor((value % 100) / 10) * 10;
    const units = value % 10;
    const map = {
        1: 'ا', 2: 'ب', 3: 'ج', 4: 'د', 5: 'ه', 6: 'و', 7: 'ز', 8: 'ح', 9: 'ط',
        10: 'ي', 20: 'ك', 30: 'ل', 40: 'م', 50: 'ن', 60: 'ص', 70: 'ع', 80: 'ف', 90: 'ض',
        100: 'ق', 200: 'ر', 300: 'س', 400: 'ت', 500: 'ث', 600: 'خ', 700: 'ذ', 800: 'ظ', 900: 'غ'
    };
    if (hundreds > 0) letters += map[hundreds];
    if (tens > 0) letters += map[tens];
    if (units > 0) letters += map[units];
    return letters;
}

function numberToAngelName(n) {
    const reduced = reduceNumber(n);
    const t = Math.floor(reduced / 1000);
    const r = reduced % 1000;
    let letters = '';
    if (t > 0) {
        if (t === 1) letters += 'ش';
        else letters += convertToLetters(t) + 'ش';
    }
    letters += convertToLetters(r);
    const arabicName = letters + 'ائيل';
    let transcriptParts = [];
    if (letters.length === 1) {
        transcriptParts.push(VOWEL_MAP[letters[0]] || letters[0]);
    } else if (letters.length >= 2) {
        let first = VOWEL_MAP[letters[0]] || letters[0];
        let second = CONS_MAP[letters[1]] || letters[1];
        transcriptParts.push(first + second);
        for (let i = 2; i < letters.length; i++) {
            transcriptParts.push(VOWEL_MAP[letters[i]] || letters[i]);
        }
    }
    let transcript = transcriptParts.join("-") + "-ilou";
    transcript = transcript.charAt(0).toUpperCase() + transcript.slice(1);
    return { arabic: arabicName, transcript: transcript };
}

function generateAngelNames() {
    const numbers = [
        results.v1m1, results.v1m2, results.v2m1, results.v2m2,
        results.v3m1, results.v3m2, results.total
    ];
    let html = '';
    let seventhNameArabic = '';
    numbers.forEach((num, index) => {
        if (num === 0) return;
        const { arabic, transcript } = numberToAngelName(num);
        html += `
            <div class="angel-row">
                <span class="angel-number" dir="ltr">${formatNumber(num)}</span>
                <span class="angel-arabic">${arabic}</span>
                <span class="angel-transcript">${transcript}</span>
            </div>`;
        if (index === 6) seventhNameArabic = arabic;
    });
    ELS.angelNamesList.innerHTML = html;
    ELS.angelNamesContainer.style.display = 'block';
    if (seventhNameArabic) generateAllahNames(seventhNameArabic);
}

function generateAllahNames(fullAngelName) {
    let html = '';
    let rootName = fullAngelName.endsWith('ائيل') ? fullAngelName.slice(0, -4) : fullAngelName;
    const currentIntent = ELS.workIntent.value;

    if (firebaseAsmaData.length === 0) {
        ELS.allahNamesList.innerHTML = "<p style='text-align:center; color:red; padding: 10px;'>جاري تحميل البيانات...</p>";
        ELS.allahNamesContainer.style.display = 'block';
        return;
    }

    for (const char of rootName) {
        // Utilise la fonction de recherche intelligente (avec seuil)
        const divineData = findAllahNameByLetter(char, currentIntent);

        if (divineData) {
            // Un nom pertinent a été trouvé
            html += `
                <div style="flex-direction: column; align-items: center; margin-bottom: 20px; background: var(--card-bg); padding: 20px 15px; border-radius: 12px; border: 1px solid var(--card-border); box-shadow: var(--glass-shadow);">
                    <div style="display: flex; flex-direction: column; align-items: center; width: 100%; margin-bottom: 15px;">
                        <span style="color: var(--card-title); font-weight: bold; font-size: 28px;">${divineData.name}</span>
                        <span style="font-size: 16px; color: var(--text-secondary); background: rgba(255,255,255,0.2); border: 1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-radius: 50%; width: 35px; height: 35px; display: inline-flex; justify-content: center; align-items: center; margin-top: 8px;">${char}</span>
                    </div>
                    <div style="width: 100%; border-top: 1px dashed var(--card-border); padding-top: 15px;">
                        <div style="text-align: left; color: var(--text-secondary); font-family: 'Segoe UI', sans-serif; margin-bottom: 15px; font-weight: bold;" dir="ltr">${divineData.translit || ''}</div>
                        <div style="margin-bottom: 15px; width: 100%;">
                            <div style="text-align: center; color: var(--card-text); font-weight: bold; margin-bottom: 8px; background: var(--card-accent); border-radius: 8px; padding: 6px;">المعنى / Sens</div>
                            ${formatMixedText(divineData.meaning)}
                        </div>
                        <div style="width: 100%;">
                            <div style="text-align: center; color: var(--card-green-text); font-weight: bold; margin-bottom: 8px; background: var(--card-green-bg); border-radius: 8px; padding: 6px;">السر / Secret</div>
                            ${formatMixedText(divineData.benefit)}
                        </div>
                    </div>
                </div>`;
        } else {
            // Aucun nom n'a atteint le score minimum → message discret
            html += `
                <div style="flex-direction: column; align-items: center; padding: 15px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--card-border); margin-bottom: 20px;">
                    <span style="color: var(--text-secondary); font-size: 18px;">لا يوجد اسم مناسب لهذا الحرف</span>
                    <span style="font-size: 16px; color: var(--text-secondary); background: rgba(255,255,255,0.2); border: 1px solid var(--border-color); border-radius: 50%; width: 35px; height: 35px; display: inline-flex; justify-content: center; align-items: center; margin-top: 8px;">${char}</span>
                </div>`;
        }
    }

    ELS.allahNamesList.innerHTML = html;
    ELS.allahNamesContainer.style.display = 'block';
}
// ==================== SUGGESTIONS DE VERSETS (sur l'éditeur) ====================
let suggestionsContainer = null;

function createSuggestionsContainer() {
    if (suggestionsContainer) return;
    suggestionsContainer = document.createElement('ul');
    suggestionsContainer.id = 'versesSuggestions';
    suggestionsContainer.style.cssText = `
        display: none;
        position: absolute;
        z-index: 1000;
        background: var(--glass-bg);
        backdrop-filter: blur(12px);
        border: 1px solid var(--glass-border);
        border-radius: 8px;
        max-height: 200px;
        overflow-y: auto;
        list-style: none;
        padding: 0;
        margin: 5px 0 0 0;
        width: 100%;
        box-shadow: var(--glass-shadow);
        font-family: 'Arial', sans-serif;
        direction: rtl;
        text-align: right;
        color: var(--text-primary);
    `;
    const editorContainer = ELS.editor.parentNode;
    editorContainer.style.position = 'relative';
    editorContainer.appendChild(suggestionsContainer);
}

function showSuggestions(searchText) {
    if (!suggestionsContainer) createSuggestionsContainer();
    const query = searchText.trim();
    if (query.length < 2) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    const filtered = firebaseVerses.filter(item => item.verset.includes(query));
    if (filtered.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    let html = '';
    filtered.forEach((item, index) => {
        html += `
            <li data-index="${index}" data-verset="${item.verset.replace(/"/g, '&quot;')}"
                style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 16px; transition: 0.2s;">
                ${item.verset}
            </li>`;
    });
    suggestionsContainer.innerHTML = html;
    suggestionsContainer.style.display = 'block';

    const items = suggestionsContainer.querySelectorAll('li');
    items.forEach(li => {
        li.addEventListener('click', function () {
            const verset = this.getAttribute('data-verset');
            ELS.editor.textContent = verset;
            suggestionsContainer.style.display = 'none';
        });
        li.addEventListener('mouseenter', function () {
            this.style.backgroundColor = 'rgba(255,255,255,0.2)';
        });
        li.addEventListener('mouseleave', function () {
            this.style.backgroundColor = 'transparent';
        });
    });
}

function attachSuggestionsListener() {
    if (!ELS.editor) return;
    ELS.editor.addEventListener('input', function (e) {
        const text = ELS.editor.textContent || '';
        showSuggestions(text.trim());
    });
    document.addEventListener('click', function (e) {
        if (suggestionsContainer && !suggestionsContainer.contains(e.target) && e.target !== ELS.editor) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

// ==================== MODE SOMBRE / CLAIR ====================
function createThemeToggle() {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'themeToggle';
    toggleBtn.innerHTML = '🌙';
    toggleBtn.title = 'Basculer mode sombre';
    document.body.appendChild(toggleBtn);

    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'enabled') {
        document.body.classList.add('dark-mode');
        toggleBtn.innerHTML = '☀️';
    }

    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
        toggleBtn.innerHTML = isDark ? '☀️' : '🌙';

        if (suggestionsContainer) {
            suggestionsContainer.style.background = isDark ? 'rgba(30,30,50,0.8)' : 'rgba(255,255,255,0.8)';
        }
    });
}

// ==================== INITIALISATION ====================
window.addEventListener('DOMContentLoaded', () => {
    attachSuggestionsListener();
    createThemeToggle();

    ELS.btnExtract.addEventListener('click', runAll);
    ELS.btnAngelNames.addEventListener('click', generateAngelNames);
});