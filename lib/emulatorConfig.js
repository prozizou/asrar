export const EMULATOR_PROJECT = 'demo-asrar-test';
export const AUTH_EMULATOR_HOST = '127.0.0.1:9099';
export const DATABASE_EMULATOR_HOST = '127.0.0.1:9000';

// Le mode test n'utilise jamais le projet de production, même si ses
// variables ont été héritées d'un environnement de développeur.
export function emulatorConfig(env) {
  const requested = env.FIREBASE_TEST_MODE === 'true';
  const clientRequested = env.NEXT_PUBLIC_FIREBASE_EMULATORS === 'true';
  if (!requested) {
    if (clientRequested || env.FIREBASE_AUTH_EMULATOR_HOST || env.FIREBASE_DATABASE_EMULATOR_HOST) {
      throw new Error('Les émulateurs exigent FIREBASE_TEST_MODE=true.');
    }
    return null;
  }
  if (env.VERCEL || env.VERCEL_ENV || env.FIREBASE_PROJECT_ID !== EMULATOR_PROJECT ||
      env.FIREBASE_AUTH_EMULATOR_HOST !== AUTH_EMULATOR_HOST ||
      env.FIREBASE_DATABASE_EMULATOR_HOST !== DATABASE_EMULATOR_HOST) {
    throw new Error('Mode Firebase test réservé au projet demo et aux émulateurs locaux.');
  }
  return { projectId: EMULATOR_PROJECT, databaseURL: `https://${EMULATOR_PROJECT}-default-rtdb.firebaseio.com` };
}
