// ============================================================
// dashboard.js — Lógica de subida de archivos y creación de proyecto
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // ── Guard: require admin ──
    requireAdmin();
    document.getElementById('userName').textContent = getUserName();

    // ── State ──
    const autores = [];
    const selectedFiles = {
        videoIntro: null,
        videoPitch: null,
        imagenes: [],
        documentosPdf: [],
        diapositivas: null
    };

    // ── DOM References ──
    const form = document.getElementById('projectForm');
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const submitSpinner = document.getElementById('submitSpinner');
    const progressWrapper = document.getElementById('progressWrapper');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');

    // ── Logout ──
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // ════════════════════════════════════════════════════════
    // AUTORES — Agregar / Quitar chips
    // ════════════════════════════════════════════════════════
    const autorInput = document.getElementById('autorInput');
    const autoresList = document.getElementById('autoresList');
    const addAutorBtn = document.getElementById('addAutorBtn');

    addAutorBtn.addEventListener('click', addAutor);
    autorInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addAutor(); }
    });

    function addAutor() {
        const email = autorInput.value.trim().toLowerCase();
        if (!email) return;
        if (!email.includes('@')) { showToast('Ingresa un correo válido', 'warning'); return; }
        if (autores.includes(email)) { showToast('Ese correo ya está agregado', 'warning'); return; }
        autores.push(email);
        renderAutores();
        autorInput.value = '';
        autorInput.focus();
    }

    function removeAutor(email) {
        const idx = autores.indexOf(email);
        if (idx !== -1) autores.splice(idx, 1);
        renderAutores();
    }

    function renderAutores() {
        autoresList.innerHTML = autores.map(email => `
            <div class="chip">
                <span>${email}</span>
                <span class="chip-remove" data-email="${email}">&times;</span>
            </div>
        `).join('');
        autoresList.querySelectorAll('.chip-remove').forEach(btn => {
            btn.addEventListener('click', () => removeAutor(btn.dataset.email));
        });
    }

    // ════════════════════════════════════════════════════════
    // FILE INPUTS — Capturar archivos seleccionados
    // ════════════════════════════════════════════════════════
    setupSingleFile('videoIntro', 'fileListIntro', 'videoIntro');
    setupSingleFile('videoPitch', 'fileListPitch', 'videoPitch');
    setupMultipleFiles('imagenes', 'fileListImages', 'imagenes');
    setupMultipleFiles('documentosPdf', 'fileListPdf', 'documentosPdf');
    setupSingleFile('diapositivas', 'fileListDiapo', 'diapositivas');

    function setupSingleFile(inputId, listId, stateKey) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
        input.addEventListener('change', () => {
            if (input.files.length > 0) {
                selectedFiles[stateKey] = input.files[0];
                renderFileList(list, [input.files[0]], (idx) => {
                    selectedFiles[stateKey] = null;
                    input.value = '';
                    list.innerHTML = '';
                });
            }
        });
    }

    function setupMultipleFiles(inputId, listId, stateKey) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
        input.addEventListener('change', () => {
            const newFiles = Array.from(input.files);
            selectedFiles[stateKey] = [...selectedFiles[stateKey], ...newFiles];
            renderFileList(list, selectedFiles[stateKey], (idx) => {
                selectedFiles[stateKey].splice(idx, 1);
                renderFileList(list, selectedFiles[stateKey], arguments.callee);
            });
        });
    }

    function renderFileList(container, files, onRemove) {
        container.innerHTML = files.map((f, i) => `
            <div class="file-item">
                <span class="file-item-name" title="${f.name}">${f.name}</span>
                <span class="file-item-remove" data-idx="${i}">✕ Quitar</span>
            </div>
        `).join('');
        container.querySelectorAll('.file-item-remove').forEach(btn => {
            btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.idx)));
        });
    }

    // ── Drag & Drop zones ──
    document.querySelectorAll('.upload-zone').forEach(zone => {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            const input = zone.querySelector('input[type="file"]');
            if (input && e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                input.dispatchEvent(new Event('change'));
            }
        });
    });

    // ════════════════════════════════════════════════════════
    // SUBMIT — Subir archivos y crear proyecto
    // ════════════════════════════════════════════════════════
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('nombre').value.trim();
        const descripcion = document.getElementById('descripcion').value.trim();
        const repoGit = document.getElementById('repoGit').value.trim();

        // Validaciones
        if (!nombre) { showToast('El nombre del proyecto es requerido', 'error'); return; }
        if (!descripcion) { showToast('La descripción es requerida', 'error'); return; }

        // Preparar lista de archivos a subir
        const uploadTasks = [];

        if (selectedFiles.videoIntro) uploadTasks.push({ file: selectedFiles.videoIntro, key: 'videoIntro' });
        if (selectedFiles.videoPitch) uploadTasks.push({ file: selectedFiles.videoPitch, key: 'videoPitch' });
        selectedFiles.imagenes.forEach((f, i) => uploadTasks.push({ file: f, key: `imagen_${i}` }));
        selectedFiles.documentosPdf.forEach((f, i) => uploadTasks.push({ file: f, key: `pdf_${i}` }));
        if (selectedFiles.diapositivas) uploadTasks.push({ file: selectedFiles.diapositivas, key: 'diapositivas' });

        // UI: loading state
        submitBtn.disabled = true;
        submitText.textContent = 'Subiendo…';
        submitSpinner.style.display = 'block';

        const uploadedUrls = {};
        let uploadedCount = 0;
        const totalUploads = uploadTasks.length;

        if (totalUploads > 0) {
            progressWrapper.style.display = 'block';
            updateProgress(0, totalUploads);
        }

        try {
            // Subir cada archivo secuencialmente (evitar saturar la API)
            for (const task of uploadTasks) {
                progressText.textContent = `Subiendo: ${task.file.name}`;
                const url = await uploadFile(task.file);
                uploadedUrls[task.key] = url;
                uploadedCount++;
                updateProgress(uploadedCount, totalUploads);
            }

            // Construir JSON del proyecto
            const videos = [];
            if (uploadedUrls['videoIntro']) videos.push({ titulo: 'Intro', url: uploadedUrls['videoIntro'] });
            if (uploadedUrls['videoPitch']) videos.push({ titulo: 'Pitch', url: uploadedUrls['videoPitch'] });

            const imagenesUrls = Object.keys(uploadedUrls)
                .filter(k => k.startsWith('imagen_'))
                .map(k => uploadedUrls[k]);

            const pdfsUrls = Object.keys(uploadedUrls)
                .filter(k => k.startsWith('pdf_'))
                .map(k => uploadedUrls[k]);

            const proyecto = {
                nombre,
                descripcion,
                autoresCorreos: [...autores],
                evidencias: {
                    repositorioGit: repoGit || null,
                    videos,
                    imagenes: imagenesUrls,
                    documentosPdf: pdfsUrls,
                    diapositivas: uploadedUrls['diapositivas'] || null
                }
            };

            // Crear proyecto vía endpoint admin
            progressText.textContent = 'Creando proyecto…';
            const res = await fetch(`${API_BASE_URL}/api/Proyectos/admin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(proyecto)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.mensaje || `Error ${res.status}`);
            }

            showToast('🎉 Proyecto publicado exitosamente', 'success');
            resetForm();

        } catch (err) {
            showToast(`Error: ${err.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitText.textContent = '🚀 Publicar Proyecto';
            submitSpinner.style.display = 'none';
            progressWrapper.style.display = 'none';
        }
    });

    // ════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════

    /** Sube un archivo via POST /api/Uploads y retorna la URL pública */
    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('requestFile', file);

        const res = await fetch(`${API_BASE_URL}/api/Uploads`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
            body: formData
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.mensaje || `Error al subir ${file.name}`);
        }

        const data = await res.json();
        return data.url;
    }

    /** Actualiza la barra de progreso */
    function updateProgress(current, total) {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        progressBar.style.width = `${pct}%`;
        progressPercent.textContent = `${pct}%`;
    }

    /** Limpia el formulario después de un envío exitoso */
    function resetForm() {
        form.reset();
        autores.length = 0;
        renderAutores();
        selectedFiles.videoIntro = null;
        selectedFiles.videoPitch = null;
        selectedFiles.imagenes = [];
        selectedFiles.documentosPdf = [];
        selectedFiles.diapositivas = null;
        document.querySelectorAll('.file-list').forEach(el => el.innerHTML = '');
        progressBar.style.width = '0%';
    }

    /** Muestra un toast de notificación */
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
