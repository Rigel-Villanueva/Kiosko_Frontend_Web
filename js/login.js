// ============================================================
// login.js — Lógica del formulario de inicio de sesión
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Si ya tiene token y es admin, ir directo al dashboard
    if (getToken() && getUserRole() === 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }

    const form = document.getElementById('loginForm');
    const errorBox = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    const spinner = document.getElementById('loginSpinner');
    const btnText = loginBtn.querySelector('.btn-text');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    // Toggle password visibility
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        togglePassword.setAttribute('aria-label', type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.textContent = '';

        const correo = document.getElementById('correo').value.trim();
        const password = document.getElementById('password').value;

        if (!correo || !password) {
            errorBox.textContent = 'Completa todos los campos.';
            return;
        }

        // UI loading state
        loginBtn.disabled = true;
        btnText.textContent = 'Iniciando…';
        spinner.style.display = 'block';

        try {
            const res = await fetch(`${API_BASE_URL}/api/Auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Credenciales incorrectas');
            }

            const token = data.token;
            if (!token) throw new Error('No se recibió token del servidor');

            // Validate admin role
            const payload = parseJwt(token);
            const role = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role;

            if (role !== 'admin') {
                throw new Error('Acceso denegado. Solo administradores pueden ingresar.');
            }

            // Save and redirect
            saveToken(token);
            window.location.href = 'dashboard.html';

        } catch (err) {
            errorBox.textContent = err.message;
        } finally {
            loginBtn.disabled = false;
            btnText.textContent = 'Iniciar Sesión';
            spinner.style.display = 'none';
        }
    });
});
