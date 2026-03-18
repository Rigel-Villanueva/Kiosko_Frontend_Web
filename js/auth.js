// ============================================================
// auth.js — Utilidades de autenticación JWT
// ============================================================

/** Guarda el token en localStorage */
function saveToken(token) {
    localStorage.setItem('kiosko_token', token);
}

/** Obtiene el token guardado */
function getToken() {
    return localStorage.getItem('kiosko_token');
}

/** Elimina el token y redirige al login */
function logout() {
    localStorage.removeItem('kiosko_token');
    window.location.href = 'login.html';
}

/**
 * Decodifica el payload de un JWT (sin verificar firma).
 * @param {string} token 
 * @returns {object|null}
 */
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

/**
 * Extrae el rol del token almacenado.
 * El claim de rol en ASP.NET es:
 * "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
 */
function getUserRole() {
    const token = getToken();
    if (!token) return null;
    const payload = parseJwt(token);
    if (!payload) return null;
    return payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role || null;
}

/** Extrae el nombre del usuario del token */
function getUserName() {
    const token = getToken();
    if (!token) return null;
    const payload = parseJwt(token);
    if (!payload) return null;
    return payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload.unique_name || 'Admin';
}

/** Verifica que el usuario sea admin; si no, redirige al login */
function requireAdmin() {
    const role = getUserRole();
    if (role !== 'admin') {
        logout();
    }
}
