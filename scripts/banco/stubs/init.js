// firebase-init SIMULADO (banco local): una «db» cualquiera para el Firestore en memoria; la sesión la fija la página
// (window.__sgmSession, la pone scripts/banco/server.mjs). Debe exportar lo mismo que assets/js/firebase-init.js.
export function getDbSafe() { return { banco: true }; }
export function getAuthSafe() { return { currentUser: { uid: 'u-banco', getIdToken: async () => 'banco' } }; }
export function getStorageSafe() { return null; }
export async function getFunctionsSafe() { return null; }
export function getApp() { return null; }
export const isFirebaseConfigured = true;   // en el sitio es una constante (firebase-config.js), no una función
