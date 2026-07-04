// pdf.js
import { formules, config } from './config.js';
import { appliquerCouleursManuscrit } from './formatter.js';
import { showToast } from './ui_tools.js';

const pauseMainThread = () => new Promise(resolve => setTimeout(resolve, 0));

export async function generateVectorPDF(useOuv, useFerm, blocks, docName) {
    const popupMenu = document.getElementById('popup-menu');
    const printArea = document.getElementById('print-area');
    const progressOverlay = document.getElementById('progress-overlay');
    const progressBar = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-text');
    const appContainer = document.querySelector('.app-container'); 
    const fontSizeSlider = document.getElementById('font-size-slider');

    popupMenu.style.display = 'none';

    let globalTotalMultiplier = blocks.reduce((acc, b) => acc + b.totalMultiplier, 0);
    if (globalTotalMultiplier > config.MAX_TOTAL_REPEAT) {
        showToast(`Attention : Volume important (${globalTotalMultiplier}). La génération peut prendre du temps.`, "info");
    }

    progressOverlay.style.display = 'flex';
    printArea.innerHTML = ""; 

    const fontSizePx = fontSizeSlider ? fontSizeSlider.value : 28;
    printArea.style.fontSize = fontSizePx + "px";

    progressBar.style.width = '10%';
    progressText.innerText = "Démarrage...";
    await pauseMainThread();

    try {
        const fragment = document.createDocumentFragment();

        if (useOuv) {
            const firstBlockRasm = blocks[0] ? blocks[0].isRasmMode : false;
            const spanOuv = document.createElement('span');
            let rawHTML = appliquerCouleursManuscrit(formules.ouverture, firstBlockRasm);
            if (typeof DOMPurify !== 'undefined') rawHTML = DOMPurify.sanitize(rawHTML);
            spanOuv.innerHTML = rawHTML;
            fragment.appendChild(spanOuv);
        }

        progressBar.style.width = '20%';
        progressText.innerText = "Préparation du contenu...";
        await pauseMainThread();

        const CHUNK = config.PDF_CHUNK_SIZE || 100;
        let totalChunksToProcess = blocks.reduce((acc, b) => acc + Math.floor(b.totalMultiplier / CHUNK), 0) || 1;
        let chunksProcessed = 0;

        for (const block of blocks) {
            // OPTIMISATION MAJEURE : On nettoie et sécurise le texte UNE SEULE FOIS,
            // AVANT de le multiplier. Cela évite les crashs mémoire sur mobile.
            let texteDeBaseColore = appliquerCouleursManuscrit(block.texte, block.isRasmMode) + " ";
            if (typeof DOMPurify !== 'undefined') {
                texteDeBaseColore = DOMPurify.sanitize(texteDeBaseColore);
            }

            const fullChunks = Math.floor(block.totalMultiplier / CHUNK);
            const remainder = block.totalMultiplier % CHUNK;

            // La duplication du texte déjà sécurisé est instantanée
            const blocPrecalcule = texteDeBaseColore.repeat(CHUNK);

            for (let i = 0; i < fullChunks; i++) {
                const spanChunk = document.createElement('span');
                spanChunk.innerHTML = blocPrecalcule;
                fragment.appendChild(spanChunk);
                
                chunksProcessed++;
                if (chunksProcessed % 20 === 0) {
                    const pct = 20 + Math.floor((chunksProcessed / totalChunksToProcess) * 50);
                    progressBar.style.width = `${pct}%`;
                    await pauseMainThread();
                }
            }
            
            if (remainder > 0) {
                const spanRem = document.createElement('span');
                spanRem.innerHTML = texteDeBaseColore.repeat(remainder);
                fragment.appendChild(spanRem);
            }
        }

        if (useFerm) {
            const lastBlockRasm = blocks[blocks.length - 1] ? blocks[blocks.length - 1].isRasmMode : false;
            const spanFerm = document.createElement('span');
            let rawHTMLFerm = appliquerCouleursManuscrit(formules.fermeture, lastBlockRasm);
            if (typeof DOMPurify !== 'undefined') rawHTMLFerm = DOMPurify.sanitize(rawHTMLFerm);
            spanFerm.innerHTML = rawHTMLFerm;
            fragment.appendChild(spanFerm);
        }

        progressBar.style.width = '80%';
        progressText.innerText = "Mise en page...";
        await pauseMainThread();
        
        printArea.appendChild(fragment);

        progressBar.style.width = '100%';
        progressText.innerText = "Préparation finale...";
        await pauseMainThread();

        const originalTitle = document.title;
        document.title = docName;

        if (appContainer) appContainer.style.display = 'none';
        printArea.style.display = 'block';
        printArea.setAttribute('aria-hidden', 'false');
        void printArea.offsetHeight; // Force le navigateur à recalculer l'affichage
        window.scrollTo(0, 0);

        // FIX DU BUG DE PDF VIDE :
        // Création d'un bouton de retour manuel pour empêcher le navigateur 
        // de vider la page trop tôt (remplace l'événement capricieux 'afterprint').
        let returnContainer = document.getElementById('print-return-container');
        if (!returnContainer) {
            returnContainer = document.createElement('div');
            returnContainer.id = 'print-return-container';
            returnContainer.className = 'no-print'; // Caché lors de l'impression physique
            returnContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 99999; text-align: center;';
            
            const btn = document.createElement('button');
            btn.innerText = "❌ Retour à l'application";
            btn.className = "btn-glass";
            btn.style.cssText = "background: linear-gradient(135deg, #870000, #190a05); padding: 15px 25px; font-size: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);";
            
            btn.onclick = () => {
                document.title = originalTitle;
                if (appContainer) appContainer.style.display = '';
                printArea.style.display = ''; // Retour à l'état géré par CSS (display: none)
                printArea.setAttribute('aria-hidden', 'true');
                printArea.innerHTML = "";
                returnContainer.style.display = 'none';
            };
            
            returnContainer.appendChild(btn);
            document.body.appendChild(returnContainer);
        } else {
            returnContainer.style.display = 'block';
        }

        setTimeout(() => {
            progressOverlay.style.display = 'none';
            window.print();
        }, 1000); // 1 seconde de répit pour assurer que le DOM est complètement injecté

    } catch (error) { 
        console.error("Erreur PDF:", error);
        showToast("Échec de la génération.", "error");
        progressOverlay.style.display = 'none';
        if (appContainer) appContainer.style.display = '';
        printArea.style.display = '';
        printArea.innerHTML = "";
    }
}
