// Ce fichier est injecté uniquement par Playwright, jamais importé par app/.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, indexedDBLocalPersistence, setPersistence, signInWithEmailAndPassword } from 'firebase/auth';

const app = initializeApp({ apiKey: 'emulator-only', projectId: 'demo-asrar-test', authDomain: '127.0.0.1' }, 'asrar-emulator');
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
window.asrarEmulatorSignIn = async (email, password) => {
  await setPersistence(auth, indexedDBLocalPersistence);
  await signInWithEmailAndPassword(auth, email, password);
};
