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

        tbody.innerHTML = allProjects.map(p => {
            const img = p.evidencias?.imagenes?.[0] || null;
            const thumbHtml = img
                ? `<img src="${img}" alt="${p.nombre}" class="project-thumb" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="project-thumb-placeholder" style="display:none;">🖼️</span>`
                : `<span class="project-thumb-placeholder">🖼️</span>`;

            return `
            <tr>
                <td>
                    <div class="project-name-cell">
                        <div class="project-thumb-wrap">${thumbHtml}</div>
                        <div class="project-name-text">
                            <span class="project-name" title="${p.nombre}">${p.nombre}</span>
                            <span class="project-desc">${(p.descripcion || '').substring(0, 60)}${(p.descripcion || '').length > 60 ? '…' : ''}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="chip-list" style="flex-wrap: wrap; max-width: 220px;">
                        ${(p.autoresCorreos || []).map(a => `<span class="chip chip-sm">${a}</span>`).join('')}
                    </div>
                </td>
                <td>
                    <span class="badge ${p.estatus.toLowerCase()}">${p.estatus}</span>
                </td>
                <td>
                    <button class="btn btn-ghost btn-sm edit-btn" data-id="${p.id}">✏️ Editar</button>
                </td>
            </tr>
        `}).join('');

        // Bind events
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });
    }

    // ════════════════════════════════════════════════════════
    // MODAL DE EDICIÓN
    // ════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════
    // MODAL DE EDICIÓN Y GESTIÓN DE EVIDENCIAS
    // ════════════════════════════════════════════════════════
    let currentEditImages = [];
    let currentEditDocs = [];
    let currentEditDiapo = null;

    function openEditModal(id) {
        originalProject = allProjects.find(p => p.id === id);
        if (!originalProject) return;

        // Llenar campos básicos
        document.getElementById('editId').value = originalProject.id;
        document.getElementById('editNombre').value = originalProject.nombre;
        document.getElementById('editDescripcion').value = originalProject.descripcion;
        document.getElementById('editRepoGit').value = originalProject.evidencias?.repositorioGit || '';

        // Autores
        currentEditAutores = [...(originalProject.autoresCorreos || [])];
        drawAutores();

        // ── Evidencias ──
        currentEditVideos = [...(originalProject.evidencias?.videos || [])];
        drawVideos();

        currentEditImages = [...(originalProject.evidencias?.imagenes || [])];
        drawImages();

        currentEditDocs = [...(originalProject.evidencias?.documentosPdf || [])];
        drawDocs();

        currentEditDiapo = originalProject.evidencias?.diapositivas || null;
        drawDiapo();

        // Reset video upload state
        window.clearPendingVideo();

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

    // ── Autores ──
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
    }
    editAddAutorBtn.addEventListener('click', addEditAutor);
    editAutorInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addEditAutor(); }});

    function drawAutores() {
        editAutoresList.innerHTML = currentEditAutores.map((item, i) => `
            <div class="chip">
                <span style="cursor: pointer;" onclick="editAutorEdit(${i})" title="Editar">${item}</span>
                <span class="chip-remove" onclick="removeAutorEdit(${i})">&times;</span>
            </div>
        `).join('');
    }
    window.editAutorEdit = (idx) => { editAutorInput.value = currentEditAutores[idx]; currentEditAutores.splice(idx, 1); drawAutores(); editAutorInput.focus(); };
    window.removeAutorEdit = (idx) => { currentEditAutores.splice(idx, 1); drawAutores(); };

    // ── Módulo de Subida Reutilizable ──
    async function apiUploadFile(file, progressCb) {
        const formData = new FormData();
        formData.append('requestFile', file);
        // Simulamos onProgress con fetch (fetch no soporta upload progress nativo, usamos el spinner por ahora)
        if(progressCb) progressCb(50);
        const res = await fetch(`${API_BASE_URL}/api/Uploads`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` },
            body: formData
        });
        if(progressCb) progressCb(100);
        if (!res.ok) throw new Error(`Error al subir ${file.name}`);
        const data = await res.json();
        return data.url;
    }

    function extractFilename(url) {
        try {
            const parts = url.split('/');
            let name = decodeURIComponent(parts[parts.length - 1]);
            return name.substring(0, 35) + (name.length > 35 ? '...' : '');
        } catch { return 'Archivo'; }
    }


    // ════════════════════════════════════════════════════════
    // 1. VIDEOS (Embedded)
    // ════════════════════════════════════════════════════════
    function videoTypeLabel(titulo) {
        const t = (titulo || '').toLowerCase();
        if (t === 'intro') return { emoji: '🎬', label: 'Intro', cls: 'video-badge-intro' };
        if (t === 'pitch') return { emoji: '🎤', label: 'Pitch', cls: 'video-badge-pitch' };
        return { emoji: '📹', label: titulo || 'Otro', cls: 'video-badge-otro' };
    }

    function canAssignType(newType, excludeIndex) {
        const t = newType.toLowerCase();
        if (t !== 'intro' && t !== 'pitch') return true;
        return currentEditVideos.filter((v, i) => i !== excludeIndex && v.titulo.toLowerCase() === t).length === 0;
    }

    function drawVideos() {
        if (currentEditVideos.length === 0) {
            editVideosList.innerHTML = '<p class="video-empty">No hay videos en este proyecto.</p>';
            return;
        }
        editVideosList.innerHTML = currentEditVideos.map((v, i) => {
            const info = videoTypeLabel(v.titulo);
            return `
                <div class="evidencia-card video-card">
                    <div class="video-card-header">
                        <span class="video-badge ${info.cls}">${info.emoji} ${info.label}</span>
                        <div class="video-card-actions">
                            <select class="form-input video-type-select-sm" onchange="changeVideoType(${i}, this.value)">
                                <option value="Intro" ${v.titulo.toLowerCase() === 'intro' ? 'selected' : ''}>🎬 Intro</option>
                                <option value="Pitch" ${v.titulo.toLowerCase() === 'pitch' ? 'selected' : ''}>🎤 Pitch</option>
                                <option value="Otro" ${(v.titulo.toLowerCase() !== 'intro' && v.titulo.toLowerCase() !== 'pitch') ? 'selected' : ''}>📹 Otro</option>
                            </select>
                            <button type="button" class="btn btn-danger btn-sm" onclick="removeVideo(${i})" title="Eliminar">🗑️</button>
                        </div>
                    </div>
                    <div class="video-player-wrap">
                        <video controls preload="metadata" class="embedded-video">
                            <source src="${v.url}#t=0.1" type="video/mp4">
                            Tu navegador no soporta el elemento video.
                        </video>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.changeVideoType = (idx, newType) => {
        if (!canAssignType(newType, idx)) { showToast(`Ya existe un video de tipo "${newType}"`, 'warning'); drawVideos(); return; }
        currentEditVideos[idx].titulo = newType;
        drawVideos();
    };
    window.removeVideo = (idx) => { currentEditVideos.splice(idx, 1); drawVideos(); };

    // Subir Video
    newVideoFile.addEventListener('change', () => {
        if (newVideoFile.files.length > 0) {
            const file = newVideoFile.files[0];
            if (file.size > 50 * 1024 * 1024) { showToast('El video excede 50MB', 'error'); return window.clearPendingVideo(); }
            pendingVideoFile = file;
            addVideoBtn.disabled = false;
            newVideoPreview.innerHTML = `<div class="file-item"><span class="file-item-name">${file.name}</span><span class="file-item-remove" onclick="clearPendingVideo()">✕ Quitar</span></div>`;
        }
    });

    window.clearPendingVideo = function() {
        pendingVideoFile = null; newVideoFile.value = ''; newVideoPreview.innerHTML = ''; addVideoBtn.disabled = true;
    };

    addVideoBtn.addEventListener('click', async () => {
        if (!pendingVideoFile) return;
        const tipo = newVideoType.value;
        if (!canAssignType(tipo, -1)) return showToast(`Ya existe un video de tipo "${tipo}"`, 'warning');
        
        addVideoBtn.disabled = true; addVideoBtn.textContent = 'Subiendo…';
        videoUploadProgress.style.display = 'flex'; videoProgressBar.style.width = '0%';
        videoProgressText.textContent = `Subiendo: ${pendingVideoFile.name}`;

        try {
            const url = await apiUploadFile(pendingVideoFile, (pct) => videoProgressBar.style.width = pct+'%');
            currentEditVideos.push({ titulo: tipo, url });
            drawVideos();
            window.clearPendingVideo();
            showToast(`Video agregado`, 'success');
        } catch (err) { showToast(err.message, 'error'); } 
        finally {
            addVideoBtn.disabled = false; addVideoBtn.textContent = '⬆️ Subir y Agregar Video';
            videoUploadProgress.style.display = 'none';
        }
    });


    // ════════════════════════════════════════════════════════
    // 2. IMÁGENES
    // ════════════════════════════════════════════════════════
    const editImagesList = document.getElementById('editImagesList');
    const newImagesFile = document.getElementById('newImagesFile');
    const newImagesPreview = document.getElementById('newImagesPreview');

    function drawImages() {
        if (currentEditImages.length === 0) {
            editImagesList.innerHTML = '<p class="video-empty">No hay imágenes en este proyecto.</p>';
            return;
        }
        editImagesList.innerHTML = currentEditImages.map((url, i) => `
            <div class="image-thumb-card">
                <img src="${url}" alt="Imagen del Proyecto" class="edit-img-preview" onclick="window.open('${url}','_blank')">
                <button type="button" class="btn btn-danger btn-sm img-delete-btn" onclick="removeImage(${i})">✕</button>
            </div>
        `).join('');
    }
    window.removeImage = (idx) => { currentEditImages.splice(idx, 1); drawImages(); };

    newImagesFile.addEventListener('change', async () => {
        if (!newImagesFile.files.length) return;
        newImagesPreview.innerHTML = '<div class="spinner inline-spinner"></div> Subiendo imágenes...';
        
        try {
            for (const file of Array.from(newImagesFile.files)) {
                const url = await apiUploadFile(file);
                currentEditImages.push(url);
            }
            drawImages();
            showToast('Imágenes agregadas', 'success');
        } catch (err) { showToast(err.message, 'error'); }
        finally { newImagesFile.value = ''; newImagesPreview.innerHTML = ''; }
    });


    // ════════════════════════════════════════════════════════
    // 3. DOCUMENTOS PDF
    // ════════════════════════════════════════════════════════
    const editDocsList = document.getElementById('editDocsList');
    const newDocsFile = document.getElementById('newDocsFile');

    function drawDocs() {
        if (currentEditDocs.length === 0) {
            editDocsList.innerHTML = '<p class="video-empty">No hay documentos PDF.</p>';
            return;
        }
        editDocsList.innerHTML = currentEditDocs.map((url, i) => `
            <div class="doc-card">
                <div class="doc-info">
                    <span class="doc-icon">📄</span>
                    <a href="${url}" target="_blank" class="doc-link">${extractFilename(url)}</a>
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeDoc(${i})">🗑️</button>
            </div>
        `).join('');
    }
    window.removeDoc = (idx) => { currentEditDocs.splice(idx, 1); drawDocs(); };

    newDocsFile.addEventListener('change', async () => {
        if (!newDocsFile.files.length) return;
        try {
            for (const file of Array.from(newDocsFile.files)) {
                if(file.type !== 'application/pdf') { showToast(`${file.name} no es PDF`, 'warning'); continue; }
                const url = await apiUploadFile(file);
                currentEditDocs.push(url);
            }
            drawDocs();
            showToast('Documentos agregados', 'success');
        } catch (err) { showToast(err.message, 'error'); }
        finally { newDocsFile.value = ''; }
    });


    // ════════════════════════════════════════════════════════
    // 4. DIAPOSITIVAS
    // ════════════════════════════════════════════════════════
    const editDiapoWrap = document.getElementById('editDiapoWrap');
    const newDiapoFile = document.getElementById('newDiapoFile');

    function drawDiapo() {
        if (!currentEditDiapo) {
            editDiapoWrap.innerHTML = '<p class="video-empty">No hay diapositivas.</p>';
            return;
        }
        editDiapoWrap.innerHTML = `
            <div class="doc-card">
                <div class="doc-info">
                    <span class="doc-icon">📊</span>
                    <a href="${currentEditDiapo}" target="_blank" class="doc-link">${extractFilename(currentEditDiapo)}</a>
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeDiapo()">🗑️</button>
            </div>
        `;
    }
    window.removeDiapo = () => { currentEditDiapo = null; drawDiapo(); };

    newDiapoFile.addEventListener('change', async () => {
        if (!newDiapoFile.files.length) return;
        try {
            const url = await apiUploadFile(newDiapoFile.files[0]);
            currentEditDiapo = url;
            drawDiapo();
            showToast('Diapositivas actualizadas', 'success');
        } catch (err) { showToast(err.message, 'error'); }
        finally { newDiapoFile.value = ''; }
    });


    // ════════════════════════════════════════════════════════
    // GUARDAR CAMBIOS AL BACKEND
    // ════════════════════════════════════════════════════════
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const updatedProject = { ...originalProject };
        updatedProject.nombre = document.getElementById('editNombre').value.trim();
        updatedProject.descripcion = document.getElementById('editDescripcion').value.trim();
        updatedProject.autoresCorreos = [...currentEditAutores];

        if (!updatedProject.evidencias) updatedProject.evidencias = {};
        updatedProject.evidencias.repositorioGit = document.getElementById('editRepoGit').value.trim() || null;
        
        // Asignar todas las evidencias actualizadas
        updatedProject.evidencias.videos = [...currentEditVideos];
        updatedProject.evidencias.imagenes = [...currentEditImages];
        updatedProject.evidencias.documentosPdf = [...currentEditDocs];
        updatedProject.evidencias.diapositivas = currentEditDiapo;

        saveBtn.disabled = true;
        document.getElementById('saveEditText').textContent = 'Guardando…';
        document.getElementById('saveSpinner').style.display = 'block';

        try {
            const res = await fetch(`${API_BASE_URL}/api/Proyectos/${updatedProject.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify(updatedProject)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.mensaje || `Error ${res.status}`);
            }

            showToast('Proyecto actualizado correctamente', 'success');
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
