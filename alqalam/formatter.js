// formatter.js

const mapRasm = {
    'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ؤ': 'و', 'ئ': 'ى', 'ء': '',
    'ب': 'ٮ', 'ت': 'ٮ', 'ث': 'ٮ', 'ن': 'ں', 'ي': 'ى',
    'ف': 'ڡ', 'ق': 'ٯ', 'ش': 'س', 'ض': 'ص', 'ظ': 'ط',
    'غ': 'ع', 'خ': 'ح', 'ج': 'ح', 'ز': 'ر', 'ذ': 'د',
    'ة': 'ه', 'ك': 'ک', 'پ': 'ٮ', 'چ': 'ح', 'ژ': 'ر', 'گ': 'ک'
};

const rasmRegex = new RegExp(`[${Object.keys(mapRasm).join('')}]`, 'g');

export function convertirEnRasm(texte) {
    if (!texte) return "";

    let rasm = texte.replace(/الله/g, 'الل\u200Dه').replace(/لله/g, 'لل\u200Dه').replace(/ﷲ/g, 'الل\u200Dه');
    rasm = rasm.replace(/[\u064B-\u065F\u0670]/g, '');

    return rasm.replace(rasmRegex, char => mapRasm[char] || char);
}

const dictionnaireStandard = [
    { mot: "لعبدك وخليلك وحبيبك وخديم رسولك", classe: "mot-bleu" },
    { mot: "ورضيته", classe: "mot-rouge" },
    { mot: "الرحمن", classe: "mot-rouge" },
    { mot: "الرحيم", classe: "mot-rouge" },
    { mot: "اللهم", classe: "mot-rouge" },
    { mot: "الله", classe: "mot-rouge" },
    { mot: "محمدا", classe: "mot-vert" },
    { mot: "محمد", classe: "mot-vert" },
    { mot: "رب", classe: "mot-rouge" }
];

let dictionnaireRasmCache = null;

export function appliquerCouleursManuscrit(texte, isRasmMode = false) {
    if (!texte) return "";

    let texteTraite = isRasmMode ? convertirEnRasm(texte) : texte;
    let dictionnaireActif = dictionnaireStandard;

    if (isRasmMode) {
        if (!dictionnaireRasmCache) {
            dictionnaireRasmCache = dictionnaireStandard.map(item => ({
                mot: convertirEnRasm(item.mot),
                classe: item.classe
            }));
        }
        dictionnaireActif = dictionnaireRasmCache;
    }

    let textProtege = texteTraite;

    dictionnaireActif.forEach((item, index) => {
        const regex = new RegExp(item.mot, 'g');
        textProtege = textProtege.replace(regex, `__MOT${index}__`);
    });

    dictionnaireActif.forEach((item, index) => {
        const regex = new RegExp(`__MOT${index}__`, 'g');
        textProtege = textProtege.replace(regex, `<span class="${item.classe}">${item.mot}</span>`);
    });

    return textProtege;
}

// Fonction centralisée pour intercaler (DRY)
export function formaterTexteIntercale(texte, phraseIntercalee) {
    if (!phraseIntercalee || !texte.includes(phraseIntercalee)) return texte;
    const parts = texte.split(phraseIntercalee);
    return parts.map(p => `<span class="verset-brun">${p}</span>`).join(phraseIntercalee);
}