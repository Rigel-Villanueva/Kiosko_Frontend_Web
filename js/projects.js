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
    let currentEditVideos = [];
    let originalProject = null;
    let pendingVideoFile = null;

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

    // Video DOM refs
    const editVideosList = document.getElementById('editVideosList');
    const newVideoType = document.getElementById('newVideoType');
    const newVideoFile = document.getElementById('newVideoFile');
    const newVideoPreview = document.getElementById('newVideoPreview');
    const addVideoBtn = document.getElementById('addVideoBtn');
    const videoUploadProgress = document.getElementById('videoUploadProgress');
    const videoProgressBar = document.getElementById('videoProgressBar');
    const videoProgressText = document.getElementById('videoProgressText');

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

        currentEditAutores = [];
        if (originalProject.autoresCorreos) {
            currentEditAutores = [...originalProject.autoresCorreos];
        }
        drawAutores();

        // Cargar videos existentes
        currentEditVideos = [];
        if (originalProject.evidencias?.videos) {
            currentEditVideos = originalProject.evidencias.videos.map(v => ({ ...v }));
        }
        drawVideos();

        // Reset video upload state
        pendingVideoFile = null;
        newVideoFile.value = '';
        newVideoPreview.innerHTML = '';
        addVideoBtn.disabled = true;
        videoUploadProgress.style.display = 'none';

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

    // ── Add Autores ──
    const editAutorInput = document.getElementById('editAutorInput');
    const editAddAutorBtn = document.getElementById('editAddAutor');
    const editAutoresList = document.getElementById('editAutoresList');

    function addEditAutor() {
        const val = editAutorInput.value.trim();
        if (!val) return;
        if (currentEditAutores.includes(val)) { showToast('Ya está agregado', 'warning'); return; }
        
        currentEditAutores.push(val);
        drawAutores();
        editAutorInput.value = '';
        editAutorInput.focus();
    }

    editAddAutorBtn.addEventListener('click', addEditAutor);
    editAutorInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addEditAutor(); }
    });

    function drawAutores() {
        editAutoresList.innerHTML = currentEditAutores.map((item, i) => `
            <div class="chip">
                <span style="cursor: pointer;" onclick="editAutorEdit(${i})" title="Clic para editar nombre">${item}</span>
                <span class="chip-remove" onclick="removeAutorEdit(${i})">&times;</span>
            </div>
        `).join('');
    }

    window.editAutorEdit = function(idx) {
        editAutorInput.value = currentEditAutores[idx];
        currentEditAutores.splice(idx, 1);
        drawAutores();
        editAutorInput.focus();
    };

    window.removeAutorEdit = function(idx) {
        currentEditAutores.splice(idx, 1);
        drawAutores();
    };

    // ════════════════════════════════════════════════════════
    // GESTIÓN DE VIDEOS
    // ════════════════════════════════════════════════════════

    /** Retorna el emoji + label para un tipo de video */
    function videoTypeLabel(titulo) {
        const t = (titulo || '').toLowerCase();
        if (t === 'intro') return { emoji: '🎬', label: 'Intro', cls: 'video-badge-intro' };
        if (t === 'pitch') return { emoji: '🎤', label: 'Pitch', cls: 'video-badge-pitch' };
        return { emoji: '📹', label: titulo || 'Otro', cls: 'video-badge-otro' };
    }

    /** Valida si se puede asignar un tipo (max 1 Intro, max 1 Pitch) */
    function canAssignType(newType, excludeIndex) {
        const t = newType.toLowerCase();
        if (t !== 'intro' && t !== 'pitch') return true;
        const count = currentEditVideos.filter((v, i) => i !== excludeIndex && v.titulo.toLowerCase() === t).length;
        return count === 0;
    }

    /** Renderiza la lista de videos existentes */
    function drawVideos() {
        if (currentEditVideos.length === 0) {
            editVideosList.innerHTML = '<p class="video-empty">No hay videos en este proyecto.</p>';
            return;
        }

        editVideosList.innerHTML = currentEditVideos.map((v, i) => {
            const info = videoTypeLabel(v.titulo);
            // Extraer nombre del archivo de la URL
            let fileName = 'Video';
            try {
                const urlParts = v.url.split('/');
                fileName = decodeURIComponent(urlParts[urlParts.length - 1]).substring(0, 40);
            } catch { }

            return `
                <div class="video-card">
                    <div class="video-card-info">
                        <span class="video-badge ${info.cls}">${info.emoji} ${info.label}</span>
                        <a href="${v.url}" target="_blank" class="video-link" title="${v.url}">
                            🔗 ${fileName}
                        </a>
                    </div>
                    <div class="video-card-actions">
                        <select class="form-input video-type-select-sm" data-idx="${i}" onchange="changeVideoType(${i}, this.value)">
                            <option value="Intro" ${v.titulo.toLowerCase() === 'intro' ? 'selected' : ''}>🎬 Intro</option>
                            <option value="Pitch" ${v.titulo.toLowerCase() === 'pitch' ? 'selected' : ''}>🎤 Pitch</option>
                            <option value="Otro" ${(v.titulo.toLowerCase() !== 'intro' && v.titulo.toLowerCase() !== 'pitch') ? 'selected' : ''}>📹 Otro</option>
                        </select>
                        <button type="button" class="btn btn-danger btn-sm" onclick="removeVideo(${i})" title="Eliminar video">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /** Cambiar tipo de un video */
    window.changeVideoType = function(idx, newType) {
        if (!canAssignType(newType, idx)) {
            showToast(`Ya existe un video de tipo "${newType}". Solo se permite 1.`, 'warning');
            drawVideos(); // re-render to reset the select
            return;
        }
        currentEditVideos[idx].titulo = newType;
        drawVideos();
        showToast(`Tipo cambiado a "${newType}"`, 'success');
    };

    /** Eliminar un video de la lista local */
    window.removeVideo = function(idx) {
        const video = currentEditVideos[idx];
        const info = videoTypeLabel(video.titulo);
        currentEditVideos.splice(idx, 1);
        drawVideos();
        showToast(`Video "${info.label}" eliminado`, 'success');
    };

    // ── Agregar nuevo video ──
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

    newVideoFile.addEventListener('change', () => {
        if (newVideoFile.files.length > 0) {
            const file = newVideoFile.files[0];
            if (file.size > MAX_VIDEO_SIZE) {
                showToast(`"${file.name}" excede 50 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`, 'error');
                newVideoFile.value = '';
                pendingVideoFile = null;
                addVideoBtn.disabled = true;
                newVideoPreview.innerHTML = '';
                return;
            }
            pendingVideoFile = file;
            addVideoBtn.disabled = false;
            newVideoPreview.innerHTML = `
                <div class="file-item">
                    <span class="file-item-name" title="${file.name}">${file.name}</span>
                    <span class="file-item-remove" onclick="clearPendingVideo()">✕ Quitar</span>
                </div>
            `;
        }
    });

    window.clearPendingVideo = function() {
        pendingVideoFile = null;
        newVideoFile.value = '';
        newVideoPreview.innerHTML = '';
        addVideoBtn.disabled = true;
    };

    addVideoBtn.addEventListener('click', async () => {
        if (!pendingVideoFile) return;

        const tipo = newVideoType.value;

        // Validar tipo
        if (!canAssignType(tipo, -1)) {
            showToast(`Ya existe un video de tipo "${tipo}". Solo se permite 1.`, 'warning');
            return;
        }

        // UI: uploading state
        addVideoBtn.disabled = true;
        addVideoBtn.textContent = 'Subiendo…';
        videoUploadProgress.style.display = 'flex';
        videoProgressBar.style.width = '0%';
        videoProgressText.textContent = `Subiendo: ${pendingVideoFile.name}`;

        try {
            const formData = new FormData();
            formData.append('requestFile', pendingVideoFile);

            const res = await fetch(`${API_BASE_URL}/api/Uploads`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formData
            });

            videoProgressBar.style.width = '100%';

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.mensaje || `Error al subir ${pendingVideoFile.name}`);
            }

            const data = await res.json();
            
            // Agregar al array local
            currentEditVideos.push({ titulo: tipo, url: data.url });
            drawVideos();
            showToast(`Video "${tipo}" agregado exitosamente`, 'success');

            // Reset
            window.clearPendingVideo();

        } catch (err) {
            showToast(`Error: ${err.message}`, 'error');
        } finally {
            addVideoBtn.disabled = false;
            addVideoBtn.textContent = '⬆️ Subir y Agregar Video';
            videoUploadProgress.style.display = 'none';
        }
    });

    // Drag & drop for video upload zone
    const videoUploadZone = document.getElementById('videoUploadZone');
    videoUploadZone.addEventListener('dragover', (e) => { e.preventDefault(); videoUploadZone.classList.add('dragover'); });
    videoUploadZone.addEventListener('dragleave', () => videoUploadZone.classList.remove('dragover'));
    videoUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        videoUploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            newVideoFile.files = e.dataTransfer.files;
            newVideoFile.dispatchEvent(new Event('change'));
        }
    });

    // ── Guardar Cambios ──
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Tomamos el proyecto original entero
        const updatedProject = { ...originalProject };

        // 2. Sobrescribimos lo que modificó el admin
        updatedProject.nombre = document.getElementById('editNombre').value.trim();
        updatedProject.descripcion = document.getElementById('editDescripcion').value.trim();
        updatedProject.autoresCorreos = [...currentEditAutores];

        // Asegurar que exista evidencias antes de mutarla
        if (!updatedProject.evidencias) updatedProject.evidencias = {};
        const repoGit = document.getElementById('editRepoGit').value.trim();
        updatedProject.evidencias.repositorioGit = repoGit || null;

        // 3. Actualizar videos
        updatedProject.evidencias.videos = [...currentEditVideos];

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
