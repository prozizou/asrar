// firebase_db.js
// Utilise l'app Firebase GLOBALE de ASRAR PRO (SDK compat chargé par index.html,
// AVANT main.js). Plus d'app modulaire « alqalam-app » séparée → fin des conflits
// d'initialisation nommée, une seule session d'auth, une seule connexion RTDB.

import { elements, souratesData, versetsData } from './store.js';
import { showToast } from './ui_tools.js';

// firebase-config.js (script classique) a déjà appelé firebase.initializeApp(...).
const db = firebase.database();

export async function chargerSourates() {
    try {
        const snapshot = await db.ref('sourate').once('value');
        if (snapshot.exists()) {
            const cacheData = {};
            elements.interSourateSelect.innerHTML = '<option value="">Sélectionnez une sourate</option>';

            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                souratesData.set(childSnapshot.key, data.contenu);
                cacheData[childSnapshot.key] = data;

                const option = document.createElement('option');
                option.value = childSnapshot.key;
                option.textContent = data.sourate;
                elements.interSourateSelect.appendChild(option);
            });

            try {
                localStorage.setItem('cali_sourates_cache', JSON.stringify(cacheData));
            } catch (storageError) {
                console.warn("Espace de stockage insuffisant pour le cache des sourates");
            }
        }
    } catch (error) {
        console.warn("Réseau indisponible, tentative de chargement local des sourates...");
        const cachedSourates = localStorage.getItem('cali_sourates_cache');

        if (cachedSourates) {
            const parsedCache = JSON.parse(cachedSourates);
            elements.interSourateSelect.innerHTML = '<option value="">Sélectionnez une sourate (Hors-ligne)</option>';

            for (const key in parsedCache) {
                souratesData.set(key, parsedCache[key].contenu);
                const option = document.createElement('option');
                option.value = key;
                option.textContent = parsedCache[key].sourate;
                elements.interSourateSelect.appendChild(option);
            }
            showToast("Mode hors-ligne : Sourates chargées depuis le cache", "info");
        } else {
            showToast("Échec de connexion : Aucune donnée hors-ligne disponible", "error");
        }
    }
}

export async function chargerVersets() {
    try {
        const snapshot = await db.ref('versetRef').once('value');
        if (snapshot.exists()) {
            const versetsArray = [];
            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data && data.verset) {
                    versetsArray.push(data.verset);
                }
            });
            versetsData.set(versetsArray);
            try {
                localStorage.setItem('cali_versets_cache', JSON.stringify(versetsArray));
            } catch (e) {
                console.warn("Impossible de sauvegarder le cache des versets");
            }
        }
    } catch (error) {
        console.warn("Réseau indisponible, tentative de chargement local des suggestions...");
        const cachedVersets = localStorage.getItem('cali_versets_cache');

        if (cachedVersets) {
            const parsedVersets = JSON.parse(cachedVersets);
            versetsData.set(parsedVersets);
        }
    }
}
