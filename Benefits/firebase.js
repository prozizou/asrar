// firebase.js — v2.1 (utilise l'app partagée firebase-init.js, plus de double init)
import { db, ref, onValue } from './firebase-init.js';

const CACHE_KEY    = 'asma_cache';
const CACHE_EXPIRY = 3_600_000; // 1 heure

function validateName(item) {
    return item && typeof item.name === 'string' && item.name.trim() !== '';
}

function normalizeName(key, value) {
    return {
        id:      key,
        name:    value.name    || key,
        translit:value.translit || '',
        meaning: value.meaning  || '',
        benefit: value.benefits || value.benefit || '',
        number:  value.number  || parseInt(key) || 999
    };
}

const FALLBACK_NAMES = [
    { id:"0", name:"الرَّحْمَنُ", translit:"Ar-Rahman", meaning:"Le Tout Miséricordieux", benefit:"Invoquer la miséricorde divine", number:1 },
    { id:"1", name:"الرَّحِيمُ",  translit:"Ar-Rahim",  meaning:"Le Très Miséricordieux", benefit:"Protection et douceur", number:2 },
    { id:"2", name:"الْمَلِكُ",   translit:"Al-Malik",  meaning:"Le Souverain Absolu",     benefit:"Force et autorité spirituelle", number:3 }
];

function useFallback(callback) {
    const sorted = [...FALLBACK_NAMES].sort((a, b) => (a.number || 999) - (b.number || 999));
    callback(sorted);
}

export async function loadNames(callback, errorCallback) {
    // 1. Essai depuis le cache local
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
                callback(data);
                return; // Cache valide → pas besoin de Firebase
            }
        } catch(e) {
            localStorage.removeItem(CACHE_KEY);
        }
    }

    // 2. Chargement Firebase avec timeout de sécurité (app partagée : firebase-init.js)
    try {
        const dbRef = ref(db, 'data/appData/asmaUlHusna');

        const timeout = setTimeout(() => {
            console.warn('Firebase: délai dépassé, utilisation du fallback');
            useFallback(callback);
        }, 6000);

        onValue(dbRef, (snapshot) => {
            clearTimeout(timeout);
            const val = snapshot.val();
            if (!val) { useFallback(callback); return; }

            const names = Object.entries(val)
                .filter(([, v]) => validateName(v))
                .map(([k, v]) => normalizeName(k, v))
                .sort((a, b) => (a.number || 999) - (b.number || 999));

            if (names.length === 0) { useFallback(callback); return; }

            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: names, timestamp: Date.now() }));
            callback(names);

        }, (err) => {
            clearTimeout(timeout);
            errorCallback?.(`Erreur Firebase : ${err.message}`);
            useFallback(callback);
        });

    } catch(error) {
        console.warn('Firebase inaccessible, données de secours utilisées');
        useFallback(callback);
    }
}
