// session-guard SIMULADO (banco local): la sesión ya la fijó la página en window.__sgmSession (rol con ?rol=).
// Debe exportar lo mismo que assets/js/auth/session-guard.js.
export function getSession() { return window.__sgmSession || null; }
export function isAdmin() { const s = getSession(); return !!(s && s.role === 'admin'); }
export function ensureSession() { return Promise.resolve(window.__sgmSession); }
export async function logout() {}
