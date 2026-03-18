// ============================================================
// projects.js — Lógica para listar y editar proyectos (Admin)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // ── Require admin ──
    requireAdmin();
    document.getElementById('userName').textContent = getUserName();
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // ── State ──
    let allProjects = [];
    let currentEditAutores = [];
    let originalProject = null;

    // ── DOM References ──
    const tableWrapper = document.getElementById('tableWrapper');
    const projectsTable = document.getElementById('projectsTable');
    const tbody = document.getElementById('projectsBody');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');

    // Modal
    const modal = document.getElementById('editModal');
    const form = document.getElementById('editForm');
    const saveBtn = document.getElementById('saveEditBtn');

    // ── Cargar Proyectos ──
    loadProjects();

    async function loadProjects() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/Proyectos/todos`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });

            if (!res.ok) {
                if(res.status === 401 || res.status === 403) logout();
                throw new Error('No se pudieron cargar los proyectos');
            }

            allProjects = await res.json();
            renderTable();
        } catch (err) {
            showToast(err.message, 'error');
            loadingState.style.display = 'none';
        }
    }

    function renderTable() {
        loadingState.style.display = 'none';

        if (allProjects.length === 0) {
            emptyState.style.display = 'flex';
            tableWrapper.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        tableWrapper.style.display = 'block';

        tbody.innerHTML = allProjects.map(p => `
            <tr>
                <td style="font-weight: 500;">
                    <div style="max-width:300px; overflow:hidden; text-overflow:ellipsis;" title="${p.nombre}">
                        ${p.nombre}
                    </div>
                </td>
                <td>
                    <div class="chip-list" style="flex-wrap: nowrap; max-width: 200px; overflow:hidden;">
                        ${(p.autoresCorreos || []).map(a => `<span class="chip" style="font-size:0.7rem; padding: 2px 6px;">${a}</span>`).join('')}
                    </div>
                </td>
                <td>
                    <span class="badge ${p.estatus.toLowerCase()}">${p.estatus}</span>
                </td>
                <td>
                    <button class="btn btn-ghost btn-sm edit-btn" data-id="${p.id}">✏️ Editar</button>
                </td>
            </tr>
        `).join('');

        // Bind events
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });
    }

    // ════════════════════════════════════════════════════════
    // MODAL DE EDICIÓN
    // ════════════════════════════════════════════════════════
    function openEditModal(id) {
        originalProject = allProjects.find(p => p.id === id);
        if (!originalProject) return;

        // Llenar campos
        document.getElementById('editId').value = originalProject.id;
        document.getElementById('editNombre').value = originalProject.nombre;
        document.getElementById('editDescripcion').value = originalProject.descripcion;
        document.getElementById('editRepoGit').value = originalProject.evidencias?.repositorioGit || '';

        // Listas (Autores) clonan para no mutar el estado original aún
        currentEditAutores.length = 0;
        if (originalProject.autoresCorreos) {
            currentEditAutores.push(...originalProject.autoresCorreos);
        }

        renderChips('editAutoresList', currentEditAutores, (idx) => {
            currentEditAutores.splice(idx, 1);
            renderChips('editAutoresList', currentEditAutores, arguments.callee);
        });

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Cerrar modal
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelEdit').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        originalProject = null;
    }

    // ── Add Autores / Tech to edit list ──
    const setupAdder = (inputId, btnId, list, listContainerId) => {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);

        const addAction = () => {
            const val = input.value.trim();
            if (!val) return;
            if (list.includes(val)) { showToast('Ya está agregado', 'warning'); return; }
            
            list.push(val);
            renderChips(listContainerId, list, (idx) => {
                list.splice(idx, 1);
                renderChips(listContainerId, list, arguments.callee);
            });
            input.value = '';
            input.focus();
        };

        btn.addEventListener('click', addAction);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addAction(); } });
    };

    setupAdder('editAutorInput', 'editAddAutor', currentEditAutores, 'editAutoresList');

    function renderChips(containerId, list, onRemove) {
        const container = document.getElementById(containerId);
        container.innerHTML = list.map((item, i) => `
            <div class="chip">
                <span>${item}</span>
                <span class="chip-remove" data-idx="${i}">&times;</span>
            </div>
        `).join('');
        container.querySelectorAll('.chip-remove').forEach(btn => {
            btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.idx)));
        });
    }

    // ── Guardar Cambios ──
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Tomamos el proyecto original entero
        const updatedProject = { ...originalProject };

        // 2. Sobrescribimos lo que modificó el admin
        updatedProject.nombre = document.getElementById('editNombre').value.trim();
        updatedProject.descripcion = document.getElementById('editDescripcion').value.trim();
        updatedProject.autoresCorreos = currentEditAutores;

        // Asegurar que exista evidencias antes de mutarla
        if (!updatedProject.evidencias) updatedProject.evidencias = {};
        const repoGit = document.getElementById('editRepoGit').value.trim();
        updatedProject.evidencias.repositorioGit = repoGit || null;

        // UI state
        saveBtn.disabled = true;
        document.getElementById('saveEditText').textContent = 'Guardando…';
        document.getElementById('saveSpinner').style.display = 'block';

        try {
            const res = await fetch(`${API_BASE_URL}/api/Proyectos/${updatedProject.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(updatedProject)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.mensaje || `Error ${res.status}`);
            }

            showToast('Proyecto actualizado correctamente', 'success');
            
            // Actualizar tabla local en memoria para no repetición de fetch
            const idx = allProjects.findIndex(p => p.id === updatedProject.id);
            if (idx !== -1) allProjects[idx] = updatedProject;
            renderTable();

            closeModal();
        } catch (err) {
            showToast(`Error: ${err.message}`, 'error');
        } finally {
            saveBtn.disabled = false;
            document.getElementById('saveEditText').textContent = '💾 Guardar Cambios';
            document.getElementById('saveSpinner').style.display = 'none';
        }
    });

    // ── Helper ──
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 350);
        }, 4000);
    }
});
