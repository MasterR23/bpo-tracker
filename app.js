const API_URL = '/api';

// DOM Elements
const kpiActiveReqs = document.getElementById('kpi-active-reqs');
const kpiTotalSpots = document.getElementById('kpi-total-spots');

const formRequisition = document.getElementById('form-requisition');
const formCandidate = document.getElementById('form-candidate');

const candReqSelect = document.getElementById('cand-req');
const tableReqBody = document.getElementById('table-req-body');
const tableCandBody = document.getElementById('table-cand-body');
const candErrorMsg = document.getElementById('cand-error');
const toastContainer = document.getElementById('toast-container');

// State
let requisitions = [];
let candidates = [];

// Formatters
const formatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
});

const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES');
};

let activeReqFilterId = null;

// App Global State
let globalActiveWaveId = null;
let globalActiveWaveName = null;

// ==========================================
// Initialization
// ==========================================
async function init() {
    await fetchRequisitions();
    await fetchCandidates();
}

// ==========================================
// Data Fetching
// ==========================================
async function fetchRequisitions() {
    toggleGlobalLoader(true, "Cargando requisiciones...");
    try {
        const res = await apiFetch(`${API_URL}/requisitions`);
        requisitions = await res.json();
        updateReqTable();
        updateKPIs();
        updateReqSelect();
    } catch (e) {
        showToast('Error cargando requisiciones', 'error');
    } finally {
        toggleGlobalLoader(false);
    }
}

async function fetchCandidates() {
    toggleGlobalLoader(true, "Cargando candidatos...");
    try {
        const res = await apiFetch(`${API_URL}/candidates`);
        candidates = await res.json();
        updateCandTable();
    } catch (e) {
        showToast('Error cargando candidatos', 'error');
    } finally {
        toggleGlobalLoader(false);
    }
}

// ==========================================
// UI Updates
// ==========================================
function updateKPIs() {
    kpiActiveReqs.textContent = requisitions.length;

    const totalSpots = requisitions.reduce((sum, req) => sum + req.cupos, 0);
    kpiTotalSpots.textContent = totalSpots;
}

function updateReqSelect() {
    candReqSelect.innerHTML = '<option value="" disabled selected>Seleccione una requisición...</option>';

    requisitions.forEach(req => {
        const option = document.createElement('option');
        option.value = req.id;

        // Logical check for disabled
        const spotsLeft = req.cupos - req.ocupados;

        if (spotsLeft <= 0) {
            option.textContent = `${req.campana} - ${req.perfil_cargo} (CUPOS LLENOS)`;
            option.disabled = true;
        } else {
            option.textContent = `${req.campana} - ${req.perfil_cargo} (Quedan ${spotsLeft} de ${req.cupos})`;
        }

        candReqSelect.appendChild(option);
    });
}

function toggleReqFilter(reqId) {
    if (activeReqFilterId === reqId) {
        // Toggle off if clicking the same row
        activeReqFilterId = null;
    } else {
        // Set new filter
        activeReqFilterId = reqId;
    }

    // Refresh both tables to apply highlights and filters
    updateReqTable();
    updateCandTable();
}

function updateReqTable() {
    tableReqBody.innerHTML = '';

    if (requisitions.length === 0) {
        tableReqBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">No hay requisiciones activas.</td></tr>';
        return;
    }

    requisitions.forEach(req => {
        const tr = document.createElement('tr');

        // Highlight active filter row
        if (activeReqFilterId === req.id) {
            tr.style.background = 'rgba(37, 99, 235, 0.1)';
            tr.style.borderLeft = '4px solid var(--primary)';
        }

        // Add pointer cursor for interactivity
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            // Prevent toggling if user clicks the exact Delete button
            if (!e.target.closest('.btn-danger-sm')) {
                toggleReqFilter(req.id);
            }
        };

        // Progress of spots
        const isFull = req.ocupados >= req.cupos;
        const spotColor = isFull ? 'color: var(--danger); font-weight:bold;' : 'color: var(--success);';

        tr.innerHTML = `
            <td class="p-name">${req.campana}</td>
            <td>${req.perfil_cargo}</td>
            <td style="${spotColor}">${req.ocupados} / ${req.cupos} Ocupados</td>
            <td>${formatter.format(req.salario)}</td>
            <td>${formatDate(req.fecha_ingreso)}</td>
            <td>
                <button type="button" onclick="deleteRequisition(${req.id})" class="btn-danger-sm"><i class="fa-solid fa-trash"></i> Eliminar</button>
            </td>
        `;
        tableReqBody.appendChild(tr);
    });
}

function updateCandTable() {
    tableCandBody.innerHTML = '';

    // Filter candidates logically
    let filteredCands = candidates;

    // For simplicity, we just filter the array
    if (activeReqFilterId !== null) {
        filteredCands = candidates.filter(c => c.requisicion_id === activeReqFilterId);
    }

    if (filteredCands.length === 0) {
        let msg = activeReqFilterId ? 'No hay candidatos para esta requisición.' : 'No hay candidatos registrados.';
        tableCandBody.innerHTML = `<tr><td colspan="5" class="text-center p-4">${msg}</td></tr>`;
        return;
    }

    // Sort by chronological creation (newest first assuming last in array) OR reverse
    const displayCands = [...filteredCands].reverse();

    displayCands.forEach(cand => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: bold; flex-shrink: 0;">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div>
                        <div class="p-name">${cand.nombre_completo}</div>
                        <div class="p-email">${cand.correo_electronico}</div>
                    </div>
                </div>
            </td>
            <td>${cand.documento_id}</td>
            <td>${cand.campana} - ${cand.perfil_cargo}</td>
            <td>
                <span class="badge ${cand.estado === 'in_training' ? 'badge-training' : 'badge-selected'}">
                    ${cand.estado === 'in_training' ? 'En formación' : 'Seleccionado'}
                </span>
            </td>
            <td>
                <button type="button" onclick="deleteCandidate(${cand.id})" class="btn-danger-sm"><i class="fa-solid fa-trash"></i> Eliminar</button>
            </td>
        `;
        tableCandBody.appendChild(tr);
    });
}

// ==========================================
// Event Listeners (Form Submits)
// ==========================================
formRequisition.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newReq = {
        campana: document.getElementById('req-campana').value.trim(),
        perfil_cargo: document.getElementById('req-perfil').value.trim(),
        salario: document.getElementById('req-salario').value,
        cupos: document.getElementById('req-cupos').value,
        fecha_ingreso: document.getElementById('req-fecha').value
    };

    try {
        const res = await apiFetch(`${API_URL}/requisitions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newReq)
        });

        if (res.ok) {
            showToast('Requisición creada con éxito', 'success');
            formRequisition.reset();
            fetchRequisitions();
        } else {
            showToast('Error al crear requisición', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
});

formCandidate.addEventListener('submit', async (e) => {
    e.preventDefault();
    candErrorMsg.textContent = '';

    const newCand = {
        nombre_completo: document.getElementById('cand-nombre').value.trim(),
        documento_id: document.getElementById('cand-doc').value.trim(),
        correo_electronico: document.getElementById('cand-correo').value.trim(),
        requisicion_id: candReqSelect.value
    };

    try {
        const res = await apiFetch(`${API_URL}/candidates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCand)
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Candidato registrado', 'success');
            formCandidate.reset();
            // Refresh both tables because spots changed
            fetchRequisitions();
            fetchCandidates();
        } else {
            candErrorMsg.textContent = data.error || 'Error al registrar candidato';
            showToast('No se pudo registrar', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
});

// ==========================================
// Deletions
// ==========================================
window.deleteRequisition = async (id) => {
    if (!confirm("¿Deseas eliminar esta requisición?")) return;

    try {
        const res = await apiFetch(`${API_URL}/requisitions/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok) {
            showToast('Requisición eliminada', 'success');
            fetchRequisitions();
        } else {
            showToast(data.error || 'Error al eliminar', 'error');
            alert(data.error || 'Error al eliminar');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
};

window.deleteCandidate = async (id) => {
    if (!confirm("¿Deseas eliminar a este candidato?")) return;

    try {
        const res = await apiFetch(`${API_URL}/candidates/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Candidato eliminado', 'success');
            fetchRequisitions();
            fetchCandidates();
        } else {
            showToast('Error al eliminar', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
};

// ==========================================
// Toasts
// ==========================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color:var(--success)"></i>' : '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger)"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// M2: MODULE NAVIGATION (SPA)
// ==========================================
const navM1 = document.getElementById('nav-m1');
const navM2 = document.getElementById('nav-m2');
const navM3 = document.getElementById('nav-m3');
const navM4 = document.getElementById('nav-m4');
const navM5 = document.getElementById('nav-m5');
const navRbac = document.getElementById('nav-rbac');

// Views
const viewM1 = document.getElementById('module-1');
const viewM2 = document.getElementById('module-2');
const viewM3 = document.getElementById('module-3');
const viewM4 = document.getElementById('module-4');
const viewM5 = document.getElementById('module-5');
const viewRbac = document.getElementById('admin-layout');

navM1.addEventListener('click', (e) => {
    e.preventDefault();
    navM2.classList.remove('active');
    if (navM3) navM3.classList.remove('active');
    if (navM4) navM4.classList.remove('active');
    if (navM5) navM5.classList.remove('active');
    if (navRbac) navRbac.classList.remove('active');
    navM1.classList.add('active');
    viewM2.classList.remove('active');
    viewM3.classList.remove('active');
    if (viewM4) viewM4.classList.remove('active');
    if (viewM5) viewM5.classList.remove('active');
    if (viewRbac) viewRbac.classList.remove('active');
    setTimeout(() => {
        viewM2.style.display = 'none';
        viewM3.style.display = 'none';
        if (viewM4) viewM4.style.display = 'none';
        if (viewM5) viewM5.style.display = 'none';
        if (viewRbac) viewRbac.style.display = 'none';
        viewM1.style.display = 'block';
        viewM1.classList.add('active');
    }, 200);
});

navM2.addEventListener('click', (e) => {
    e.preventDefault();
    navM1.classList.remove('active');
    if (navM3) navM3.classList.remove('active');
    if (navM4) navM4.classList.remove('active');
    if (navM5) navM5.classList.remove('active');
    if (navRbac) navRbac.classList.remove('active');
    navM2.classList.add('active');
    viewM1.classList.remove('active');
    viewM3.classList.remove('active');
    if (viewM4) viewM4.classList.remove('active');
    if (viewM5) viewM5.classList.remove('active');
    if (viewRbac) viewRbac.classList.remove('active');
    setTimeout(() => {
        viewM1.style.display = 'none';
        viewM3.style.display = 'none';
        if (viewM4) viewM4.style.display = 'none';
        if (viewM5) viewM5.style.display = 'none';
        if (viewRbac) viewRbac.style.display = 'none';
        viewM2.style.display = 'block';
        viewM2.classList.add('active');
    }, 200);
    loadModule2Data(); // load dependencies for M2
});

if (navM3) {
    navM3.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        navM1.classList.remove('active');
        navM2.classList.remove('active');
        if (navM4) navM4.classList.remove('active');
        if (navM5) navM5.classList.remove('active');
        if (navRbac) navRbac.classList.remove('active');
        navM3.classList.add('active');
        viewM1.classList.remove('active');
        viewM2.classList.remove('active');
        if (viewM4) viewM4.classList.remove('active');
        if (viewM5) viewM5.classList.remove('active');
        if (viewRbac) viewRbac.classList.remove('active');

        setTimeout(() => {
            viewM1.style.display = 'none';
            viewM2.style.display = 'none';
            if (viewM4) viewM4.style.display = 'none';
            if (viewM5) viewM5.style.display = 'none';
            if (viewRbac) viewRbac.style.display = 'none';
            viewM3.style.display = 'block';
            viewM3.classList.add('active');
        }, 200);

        if (globalActiveWaveId && (!currentWaveM3 || currentWaveM3.id !== globalActiveWaveId)) {
            window.openModule3(globalActiveWaveId);
        } else if (currentWaveM3) {
            loadM3Data();
        }
    });
}

if (navM4) {
    navM4.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        navM1.classList.remove('active');
        navM2.classList.remove('active');
        if (navM3) navM3.classList.remove('active');
        if (navM5) navM5.classList.remove('active');
        if (navRbac) navRbac.classList.remove('active');
        navM4.classList.add('active');

        viewM1.style.display = 'none';
        viewM2.style.display = 'none';
        if (viewM3) viewM3.style.display = 'none';
        if (viewM5) viewM5.style.display = 'none';
        if (viewRbac) viewRbac.style.display = 'none';
        if (viewM4) {
            viewM4.style.display = 'block';
            viewM4.classList.add('active');
        }

        if (globalActiveWaveId && (!currentWaveM4 || currentWaveM4.id !== globalActiveWaveId)) {
            window.openModule4(globalActiveWaveId);
        } else if (currentWaveM4) {
            loadM4Data();
        }
    });
}

if (navM5) {
    navM5.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        navM1.classList.remove('active');
        navM2.classList.remove('active');
        if (navM3) navM3.classList.remove('active');
        if (navM4) navM4.classList.remove('active');
        if (navRbac) navRbac.classList.remove('active');
        navM5.classList.add('active');

        viewM1.style.display = 'none';
        viewM2.style.display = 'none';
        if (viewM3) viewM3.style.display = 'none';
        if (viewM4) viewM4.style.display = 'none';
        if (viewRbac) viewRbac.style.display = 'none';
        if (viewM5) {
            viewM5.style.display = 'block';
            viewM5.classList.add('active');
        }

        if (globalActiveWaveId) {
            window.openModule5(globalActiveWaveId, globalActiveWaveName);
        }
    });
}

// ==========================================
// M2: LOGIC & PROJECTIONS
// ==========================================
let waves = [];

// DOM M2 Elements
const kpiActiveWaves = document.getElementById('kpi-active-waves');
const kpiFinishedWaves = document.getElementById('kpi-finished-waves');
const formWave = document.getElementById('form-wave');
const selectCampana = document.getElementById('w-campana');
const reqListContainer = document.getElementById('w-req-list');
const tableWavesBody = document.getElementById('table-waves-body');

// Form inputs to watch for projection
const inputsToWatch = [
    'w-horas', 'w-salario', 'w-tarifa', 'w-agentes', 'w-fecha-inicio', 'w-fecha-fin',
    'w-pct-dom', 'w-pct-fes', 'w-pct-per', 'w-festivos'
];

async function loadModule2Data() {
    // Fill campaign select based on unique campaigns from requisitions
    const uniqueCampanas = [...new Set(requisitions.map(r => r.campana))];
    selectCampana.innerHTML = '<option value="" disabled selected>Seleccione una campaña...</option>';
    uniqueCampanas.forEach(camp => {
        selectCampana.innerHTML += `<option value="${camp}">${camp}</option>`;
    });

    // Populate Formadores (Trainers) from DB
    try {
        const uRes = await apiFetch(`${API_URL}/users`);
        if (uRes.ok) {
            const m2Users = await uRes.json();
            const formadorSelect = document.getElementById('w-formador');
            const formadorCorreo = document.getElementById('w-correo-formador');

            formadorSelect.innerHTML = '<option value="" disabled selected>-- Seleccione Responsable --</option>';

            // Filter only to show users with the role 'Formador'
            const formadores = m2Users.filter(u => u.nombre_rol && u.nombre_rol.toLowerCase() === 'formador');

            formadores.forEach(u => {
                const opt = document.createElement('option');
                // We save the full name as value to align with current DB structure
                opt.value = `${u.nombre} ${u.apellido}`;
                opt.dataset.email = u.correo;
                opt.textContent = `${u.nombre} ${u.apellido}`;
                formadorSelect.appendChild(opt);
            });

            // Bind autofill email logic
            formadorSelect.addEventListener('change', (e) => {
                const selectedOpt = e.target.options[e.target.selectedIndex];
                if (selectedOpt && selectedOpt.dataset.email) {
                    formadorCorreo.value = selectedOpt.dataset.email;
                } else {
                    formadorCorreo.value = '';
                }
            });
        }
    } catch (e) {
        console.error("No se pudo cargar la lista de personal para M2", e);
    }

    // Fill requisitions checkbox list
    reqListContainer.innerHTML = '';
    if (requisitions.length === 0) {
        reqListContainer.innerHTML = '<p class="text-muted text-sm">No hay requisiciones activas en el sistema.</p>';
    } else {
        requisitions.forEach(req => {
            reqListContainer.innerHTML += `
                <label>
                    <input type="checkbox" class="w-req-chk" value="${req.id}" data-cupos="${req.cupos - req.ocupados}"> 
                    ${req.campana} - ${req.perfil_cargo} (Disp: ${req.cupos - req.ocupados})
                </label>
            `;
        });

        // Add listeners to checkboxes for auto-agents feature
        document.querySelectorAll('.w-req-chk').forEach(chk => {
            chk.addEventListener('change', handleAutoAgentsToggle);
        });
    }

    await fetchWaves();
}

async function fetchWaves() {
    try {
        const res = await apiFetch(`${API_URL}/waves`);
        waves = await res.json();
        updateWavesTable();
        updateWavesKPI();
    } catch (e) {
        showToast("Error cargando waves", "error");
    }
}

function updateWavesKPI() {
    const active = waves.filter(w => w.estado === 'en curso').length;
    kpiActiveWaves.textContent = active;
    kpiFinishedWaves.textContent = waves.length - active;
}

function updateWavesTable() {
    tableWavesBody.innerHTML = '';
    if (waves.length === 0) {
        tableWavesBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">No hay waves creadas aún.</td></tr>';
        return;
    }

    waves.forEach(w => {
        const tr = document.createElement('tr');
        const proj = typeof w.recargos === 'string' ? JSON.parse(w.recargos) : (w.recargos || {});

        tr.innerHTML = `
            <td>
                <div class="p-name">${w.campana}</div>
                <div class="p-email">${w.codigo_wave}</div>
            </td>
            <td>${w.formador_responsable}</td>
            <td>${formatDate(w.fecha_inicio)} a ${formatDate(w.fecha_fin)}</td>
            <td>
                <div>${w.cantidad_agentes} agentes</div>
                <small style="color:var(--success); font-weight:bold;">${formatter.format(w.costo_total_proyectado)}</small>
            </td>
            <td><span class="badge ${w.estado === 'en curso' ? 'badge-selected' : (w.estado === 'finalizada' ? 'badge-finished' : '')}">${w.estado.toUpperCase()}</span></td>
            <td>
                <button class="btn-secondary" style="padding: 4px 8px; font-size:0.75rem;" onclick="window.openModule3(${w.id})" title="Asignar Participantes"><i class="fa-solid fa-users"></i></button>
                <button class="btn-primary" style="padding: 4px 8px; font-size:0.75rem;" onclick="window.openModule4(${w.id})" title="Ver Checklist Diario M4"><i class="fa-solid fa-list-check"></i></button>
                <button class="btn-primary" style="padding: 4px 8px; font-size:0.75rem; background: var(--success); border-color: var(--success);" onclick="window.openModule5(${w.id}, '${w.codigo_wave}')" title="Cierre de Wave M5"><i class="fa-solid fa-flag-checkered"></i></button>
                <button class="btn-danger-sm" style="padding: 4px 8px; font-size:0.75rem; margin-top:2px;" onclick="window.deleteWave(${w.id})" title="Eliminar Wave"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableWavesBody.appendChild(tr);
    });
}

// Delete Wave from frontend
window.deleteWave = async (waveId) => {
    if (!confirm("¿Deseas eliminar esta Wave permanentemente? Se perderán sus checklists resultantes y los participantes serán desasignados.")) return;

    try {
        toggleGlobalLoader(true, "Eliminando Wave...");
        const res = await apiFetch(`${API_URL}/waves/${waveId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast("Wave eliminada con éxito", "success");
            fetchWaves();
        } else {
            showToast(data.error || "Error al eliminar la wave", "error");
        }
    } catch (e) {
        showToast("Error de red al intentar eliminar", "error");
    } finally {
        toggleGlobalLoader(false);
    }
};

// ==========================================
// M2: AUTO AGENTS LOGIC
// ==========================================
const autoAgentesChk = document.getElementById('w-auto-agentes');
const agentesInput = document.getElementById('w-agentes');

autoAgentesChk.addEventListener('change', handleAutoAgentsToggle);

function handleAutoAgentsToggle() {
    if (autoAgentesChk.checked) {
        agentesInput.readOnly = true;
        agentesInput.style.opacity = '0.5';

        // Sum checked reqs
        let sum = 0;
        document.querySelectorAll('.w-req-chk:checked').forEach(chk => {
            sum += parseInt(chk.getAttribute('data-cupos') || 0);
        });
        agentesInput.value = sum;
    } else {
        agentesInput.readOnly = false;
        agentesInput.style.opacity = '1';
    }
    calculateProjection();
}

// ==========================================
// M2: LIVE PROJECTION ENGINE
// ==========================================
// Watch for changes on everything that affects payroll
inputsToWatch.forEach(id => {
    document.getElementById(id).addEventListener('input', calculateProjection);
});

// Watch for checkboxes (Days)
document.getElementById('w-dias').addEventListener('change', calculateProjection);

// Global cache for fetched holidays
let holidayCache = {};

async function getHolidaysForYears(startYear, endYear) {
    let holidays = [];
    for (let y = startYear; y <= endYear; y++) {
        if (!holidayCache[y]) {
            try {
                const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/CO`);
                if (res.ok) {
                    const data = await res.json();
                    holidayCache[y] = data.map(h => h.date);
                } else {
                    console.warn(`No se pudieron cargar festivos para ${y}`);
                    holidayCache[y] = [];
                }
            } catch (e) {
                console.error("Error de conexión al buscar festivos:", e);
                holidayCache[y] = [];
            }
        }
        holidays = holidays.concat(holidayCache[y]);
    }
    return holidays;
}

async function calculateProjection() {
    const fInicio = document.getElementById('w-fecha-inicio').value;
    const fFin = document.getElementById('w-fecha-fin').value;
    const horasDia = parseFloat(document.getElementById('w-horas').value) || 0;
    const salRef = parseFloat(document.getElementById('w-salario').value) || 0;
    let tarifa = parseFloat(document.getElementById('w-tarifa').value);
    const agentes = parseFloat(document.getElementById('w-agentes').value) || 0;

    // Recargos
    const pctDom = parseFloat(document.getElementById('w-pct-dom').value) || 0;
    const pctFes = parseFloat(document.getElementById('w-pct-fes').value) || 0;
    const pctPer = parseFloat(document.getElementById('w-pct-per').value) || 0;

    // Toggles
    const incFestivos = document.getElementById('w-festivos').checked;

    // Array of selected days [1=Lun, 2=Mar, ..., 6=Sab, 0=Dom]
    const diasSeleccionados = Array.from(document.querySelectorAll('#w-dias input:checked'))
        .map(chk => parseInt(chk.value));

    // Validations before math
    if (!fInicio || !fFin || !salRef || !agentes || fInicio > fFin) {
        resetProjection();
        return;
    }

    // Auto-calculate tarifa if empty
    if (isNaN(tarifa) || tarifa <= 0) {
        // En Colombia (por reducción de jornada), el promedio legal HR es 220 horas mensuales.
        // Ejemplo: 1.750.905 / 220 = $7.958,65
        const HORAS_MES_COLOMBIA = 220;
        tarifa = salRef / HORAS_MES_COLOMBIA;

        let tarifaVisual = Math.round(tarifa);
        document.getElementById('w-tarifa').placeholder = `Auto (Col): $${tarifaVisual}`;
    }

    let currentProjectedCost = 0;

    // --- DAY COUNTING ALGORITHM ---
    let totalDiasHabiles = 0;
    let totalDomingos = 0;
    let totalFestivos = 0;

    // Fetch dynamic holidays only for the years involved in the span
    const startYear = parseInt(fInicio.split('-')[0]);
    const endYear = parseInt(fFin.split('-')[0]);
    const festivosColombia = await getHolidaysForYears(startYear, endYear);

    let d = new Date(fInicio);
    const endD = new Date(fFin);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset()); // Fix timezone shift
    endD.setMinutes(endD.getMinutes() + endD.getTimezoneOffset());

    while (d <= endD) {
        const dayOfWeek = d.getDay(); // 0-6 (0 is Sunday)
        const dateStr = d.toISOString().split('T')[0];
        const isFestivo = festivosColombia.includes(dateStr);

        // Does the user want this day?
        const isSelectedDayOfWeek = diasSeleccionados.includes(dayOfWeek);

        if (isSelectedDayOfWeek) {
            // Check if it's a holiday and we SHOULD NOT work on holidays
            if (isFestivo && !incFestivos) {
                // Skip it
            } else {
                totalDiasHabiles++;
                if (dayOfWeek === 0 && !isFestivo) totalDomingos++;
                if (isFestivo) totalFestivos++;
            }
        }

        d.setDate(d.getDate() + 1);
    }

    // --- MATH ---
    const horasTotales = totalDiasHabiles * horasDia * agentes;
    const baseEstimada = totalDiasHabiles * horasDia * tarifa * agentes;

    // Recargos Calculation
    const recargoDomTotal = (totalDomingos * horasDia * tarifa * (pctDom / 100) * agentes);
    const recargoFesTotal = (totalFestivos * horasDia * tarifa * (pctFes / 100) * agentes);
    const recargoPersonalizado = (totalDiasHabiles * horasDia * tarifa * (pctPer / 100) * agentes);

    const totalRecargos = recargoDomTotal + recargoFesTotal + recargoPersonalizado;
    const nominaProyectada = baseEstimada + totalRecargos;

    // Save to global state so we can send it on form submit
    window.currentProjectedCost = nominaProyectada;

    // --- RENDER ---
    document.getElementById('pj-dias').textContent = `${totalDiasHabiles} días`;
    document.getElementById('pj-horas').textContent = `${horasTotales} hrs`;
    document.getElementById('pj-base').textContent = formatter.format(baseEstimada);
    document.getElementById('pj-recargo').textContent = formatter.format(totalRecargos);
    document.getElementById('pj-total').textContent = formatter.format(nominaProyectada);

    document.getElementById('pj-hint').textContent = 'Proyección generada calculando costo real por hora y recargos.';
    document.getElementById('pj-hint').style.color = 'var(--success)';
}

function resetProjection() {
    document.getElementById('pj-dias').textContent = '0 días';
    document.getElementById('pj-horas').textContent = '0 hrs';
    document.getElementById('pj-base').textContent = '$0';
    document.getElementById('pj-recargo').textContent = '$0';
    document.getElementById('pj-total').textContent = '$0';
    document.getElementById('pj-hint').textContent = 'Llene Fechas, Salario y Agentes para simular.';
    document.getElementById('pj-hint').style.color = '#f59e0b';
}

// ==========================================
// M2: SAVE WAVE
// ==========================================
formWave.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Gather requirements
    let reqsSeleccionadas = [];
    document.querySelectorAll('.w-req-chk:checked').forEach(c => reqsSeleccionadas.push(parseInt(c.value)));

    let diasLab = [];
    document.querySelectorAll('#w-dias input:checked').forEach(c => diasLab.push(parseInt(c.value)));

    const newWave = {
        campana: document.getElementById('w-campana').value,
        codigo_wave: document.getElementById('w-codigo').value.trim(),
        formador_responsable: document.getElementById('w-formador').value.trim(),
        correo_responsable: document.getElementById('w-correo-formador').value.trim(),
        correo_area_encargada: document.getElementById('w-correo-area').value.trim(),

        horas_planeadas_dia: parseInt(document.getElementById('w-horas').value),
        umbral_dia_completo: parseInt(document.getElementById('w-umbral').value),
        salario_mensual_referencia: parseFloat(document.getElementById('w-salario').value),
        tarifa_hora: parseFloat(document.getElementById('w-tarifa').value) || (parseFloat(document.getElementById('w-salario').value) / 220),
        cantidad_agentes: parseInt(document.getElementById('w-agentes').value),

        fecha_inicio: document.getElementById('w-fecha-inicio').value,
        fecha_fin: document.getElementById('w-fecha-fin').value,
        dias_laborales: diasLab,
        incluir_festivos: document.getElementById('w-festivos').checked,

        requisiciones_asociadas: reqsSeleccionadas,
        recargos: {
            domingo_pct: parseInt(document.getElementById('w-pct-dom').value),
            festivo_pct: parseInt(document.getElementById('w-pct-fes').value),
            personalizado_pct: parseInt(document.getElementById('w-pct-per').value),
            etiqueta: document.getElementById('w-lbl-per').value
        },
        costo_total_proyectado: window.currentProjectedCost || 0,
        generar_checklist: document.getElementById('w-gen-checklist').checked
    };

    try {
        const res = await apiFetch(`${API_URL}/waves`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newWave)
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`Wave ${newWave.codigo_wave} creada con éxito`, 'success');
            formWave.reset();
            resetProjection();
            fetchWaves(); // Refresh table
        } else {
            showToast(data.error || 'Error al crear la wave', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
});

// ==========================================
// M3: PARTICIPANT ASSIGNMENT
// ==========================================
let currentWaveM3 = null;
let m3AvailableCandidates = [];
let m3AssignedCandidates = [];

// DOM Elements
const m3Title = document.getElementById('m3-wave-title');
const m3Subtitle = document.getElementById('m3-wave-subtitle');
const m3CountAvail = document.getElementById('m3-count-avail');
const m3CountAssigned = document.getElementById('m3-count-assigned');
const m3ListAvail = document.getElementById('m3-list-available');
const m3ListAssigned = document.getElementById('m3-list-assigned');
const m3Search = document.getElementById('m3-search');
const btnGoChecklist = document.getElementById('btn-go-checklist');

// ==========================================
// API FETCH WRAPPER (JWT INJECTOR)
// ==========================================
async function apiFetch(url, options = {}) {
    // Determine headers
    const headers = options.headers || {};

    // Add default Content-Type if a body is present and not explicitly set
    if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    // Inject CSRF mitigation configuration: Always send secure cookies
    options.credentials = 'include';

    options.headers = headers;

    const response = await fetch(url, options);

    // If server responds with 401 Unauthorized, user must log back in
    if (response.status === 401) {
        // Only force logout if the user was supposedly authenticated
        if (localStorage.getItem('bpo_user') || currentUser) {
            showToast('Sesión caducada. Por favor, inicia sesión nuevamente.', 'error');
            if (typeof forceVisualLogout === 'function') {
                forceVisualLogout();
            } else {
                loginView.style.display = 'flex';
                mainLayout.style.display = 'none';
            }
            throw new Error('JWT Token Expirado');
        }
    }

    // If server responds with 403 Forbidden, user lacks permissions
    if (response.status === 403) {
        showToast('Acceso denegado: No tienes permisos para esta acción.', 'error');
        throw new Error('Permisos Insuficientes');
    }

    return response;
}

// Navigation Button Back to M2
const btnBackM2 = document.getElementById('btn-back-m2');
btnBackM2.addEventListener('click', () => {
    viewM3.classList.remove('active');
    if (navM3) navM3.classList.remove('active');
    navM2.classList.add('active');
    setTimeout(() => { viewM3.style.display = 'none'; viewM2.style.display = 'block'; viewM2.classList.add('active'); }, 200);
    fetchWaves(); // Refresh M2 table to show new icon counts if any
});

if (btnGoChecklist) {
    btnGoChecklist.addEventListener('click', () => {
        if (currentWaveM3) {
            window.openModule4(currentWaveM3.id);
        }
    });
}

// Entry Point from M2 Table
window.openModule3 = async (waveId) => {
    try {
        // Fetch Wave Info
        const res = await apiFetch(`${API_URL}/waves/${waveId}`);
        if (!res.ok) throw new Error('No se pudo cargar la wave');
        currentWaveM3 = await res.json();

        globalActiveWaveId = currentWaveM3.id;
        globalActiveWaveName = currentWaveM3.codigo_wave;

        // Update Header
        m3Title.textContent = `Wave: ${currentWaveM3.codigo_wave}`;
        m3Subtitle.textContent = `Campaña: ${currentWaveM3.campana} | Formador: ${currentWaveM3.formador_responsable}`;

        // Switch View
        navM1.classList.remove('active');
        navM2.classList.remove('active');
        if (navM3) navM3.classList.add('active');
        viewM1.classList.remove('active');
        viewM2.classList.remove('active');

        setTimeout(() => {
            viewM1.style.display = 'none';
            viewM2.style.display = 'none';
            viewM3.style.display = 'block';
            viewM3.classList.add('active');
        }, 200);

        // Enable Checklist button
        if (btnGoChecklist) {
            btnGoChecklist.removeAttribute('disabled');
        }

        // Load Data
        loadM3Data();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// Load both lists
async function loadM3Data() {
    if (!currentWaveM3) return;
    try {
        console.log("Loading M3 data for wave:", currentWaveM3.id);
        // 1. Fetch Available (Candidates with status='selected' and wave_id IS NULL)
        const resAvail = await apiFetch(`${API_URL}/candidates/available`);
        if (!resAvail.ok) throw new Error("Failed fetching available candidates");

        const allAvailable = await resAvail.json();

        // 1.1 Cross-reference filtering: Only keep candidates matching the wave's requisitions
        let allowedReqIds = [];
        try {
            if (typeof currentWaveM3.requisiciones_asociadas === 'string') {
                allowedReqIds = JSON.parse(currentWaveM3.requisiciones_asociadas);
            } else if (Array.isArray(currentWaveM3.requisiciones_asociadas)) {
                allowedReqIds = currentWaveM3.requisiciones_asociadas;
            }
        } catch (e) { console.error("Could not parse requisiciones_asociadas"); }

        m3AvailableCandidates = allAvailable.filter(cand => allowedReqIds.includes(cand.requisicion_id));

        // 2. Fetch Assigned (Candidates with wave_id = currentWaveId)
        const resAssigned = await apiFetch(`${API_URL}/waves/${currentWaveM3.id}/candidates`);
        if (!resAssigned.ok) throw new Error("Failed fetching assigned candidates");
        m3AssignedCandidates = await resAssigned.json();

        // Check if full to warn/block M1 inputs if needed, though here we just render
        renderM3Lists();
    } catch (e) {
        console.error("loadM3Data Error:", e);
        showToast('Error cargando candidatos M3: ' + e.message, 'error');
    }
}

// Render Lists
function renderM3Lists(searchTerm = '') {
    // ---- Render Available ----
    m3ListAvail.innerHTML = '';
    const filteredAvail = m3AvailableCandidates.filter(c =>
        c.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.documento_id.includes(searchTerm)
    );

    m3CountAvail.textContent = `${filteredAvail.length} Disponibles`;

    if (filteredAvail.length === 0) {
        m3ListAvail.innerHTML = `<div class="text-center text-muted p-4">No hay candidatos disponibles${searchTerm ? ' para tu búsqueda' : ''}.</div>`;
    } else {
        filteredAvail.forEach(c => {
            const div = document.createElement('div');
            div.className = 'list-item p-3 border-bottom';
            div.style.background = 'var(--bg-main)';
            div.style.borderRadius = '6px';
            div.style.border = '1px solid var(--border)';
            div.style.display = 'flex';
            div.style.flexWrap = 'nowrap';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'space-between';
            div.style.gap = '10px';

            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: bold; flex-shrink: 0;">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div style="line-height: 1.2; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                        <strong style="font-size: 1.05rem;">${c.nombre_completo}</strong><br>
                        <small style="color: var(--text-muted); font-size: 0.85rem;"><i class="fa-regular fa-envelope"></i> ${c.correo_electronico}</small>
                </div>
                ${currentWaveM3.estado !== 'finalizada' ? `
                <button class="btn btn-outline" style="border-color:var(--primary); color:var(--primary); padding: 5px 12px; font-weight: 500; white-space: nowrap; flex-shrink: 0;" onclick="assignCandidateM3(${c.id})">
                    Agregar <i class="fa-solid fa-arrow-right" style="margin-left: 5px;"></i>
                </button>
                ` : ''}
            `;
            m3ListAvail.appendChild(div);
        });
    }

    // ---- Render Assigned ----
    m3ListAssigned.innerHTML = '';
    m3CountAssigned.textContent = `${m3AssignedCandidates.length} / ${currentWaveM3.cantidad_agentes}`;

    // Highlight overcapacity Warning
    if (currentWaveM3.estado === 'finalizada') {
        m3CountAssigned.style.background = 'var(--bg-main)';
        m3CountAssigned.style.color = 'var(--text-muted)';
        m3CountAssigned.style.border = '1px solid var(--border)';
        m3CountAssigned.textContent = `🔒 Wave Cerrada (${m3AssignedCandidates.length} / ${currentWaveM3.cantidad_agentes})`;
    } else if (m3AssignedCandidates.length > currentWaveM3.cantidad_agentes) {
        m3CountAssigned.style.background = 'var(--danger)';
        m3CountAssigned.style.color = 'white';
        m3CountAssigned.style.border = 'none';
    } else if (m3AssignedCandidates.length === currentWaveM3.cantidad_agentes) {
        m3CountAssigned.style.background = 'var(--success)';
        m3CountAssigned.style.color = 'white';
        m3CountAssigned.style.border = 'none';
    } else {
        m3CountAssigned.style.background = '';
        m3CountAssigned.style.color = '';
        m3CountAssigned.style.border = '';
    }

    if (m3AssignedCandidates.length === 0) {
        m3ListAssigned.innerHTML = `<div class="text-center text-muted p-4">La wave está vacía. Selecciona candidatos de la izquierda.</div>`;
    } else {
        m3AssignedCandidates.forEach(c => {
            const div = document.createElement('div');
            div.className = 'list-item p-3 border-bottom';
            div.style.background = 'var(--bg-main)';
            div.style.borderRadius = '6px';
            div.style.border = '1px solid var(--border)';
            div.style.display = 'flex';
            div.style.flexWrap = 'nowrap';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'space-between';
            div.style.gap = '10px';

            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(37, 99, 235, 0.2); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: bold; border: 1px solid var(--primary); flex-shrink: 0;">
                        <i class="fa-solid fa-user-check"></i>
                    </div>
                    <div style="line-height: 1.2; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                        <strong style="font-size: 1.05rem;">${c.nombre_completo}</strong><br>
                        <small style="color: var(--text-muted); font-size: 0.85rem;"><i class="fa-regular fa-id-card"></i> Doc: ${c.documento_id}</small>
                </div>
                ${currentWaveM3.estado !== 'finalizada' ? `
                <button class="btn btn-outline" style="border-color:var(--danger); color:var(--danger); padding: 5px 12px; font-weight: 500; white-space: nowrap; flex-shrink: 0;" onclick="unassignCandidateM3(${c.id})">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 5px;"></i> Remover
                </button>
                ` : ''}
            `;
            m3ListAssigned.appendChild(div);
        });
    }

    // Manage Next Button
    btnGoChecklist.disabled = m3AssignedCandidates.length === 0;
}

// Assignment Actions
window.assignCandidateM3 = async (candId) => {
    if (!currentWaveM3) return;

    // CAPACITY VALIDATION (OVER-BOOKING ALERT)
    if (m3AssignedCandidates.length >= currentWaveM3.cantidad_agentes) {
        showToast(`Cuidado: La wave presupuestó solo ${currentWaveM3.cantidad_agentes} agentes.`, "error");
        // User could technically proceed or we can strict block it. Let's strict block it based on the prompt.
        if (!confirm(`Atención: La wave ya llegó a su cupo proyectado (${currentWaveM3.cantidad_agentes}). ¿Estás SEGURO de querer sobre-asignar y descuadrar la nómina proyectada?`)) {
            return;
        }
    }

    try {
        const res = await apiFetch(`${API_URL}/candidates/${candId}/assign`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wave_id: currentWaveM3.id })
        });
        if (res.ok) {
            // instant ui feedback if desired, or just reload data
            loadM3Data();
            // Also refresh M1 candidates so 'Disponible' counts stay true globally
            fetchCandidates();
        } else {
            showToast('Error asignando', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

window.unassignCandidateM3 = async (candId) => {
    try {
        const res = await apiFetch(`${API_URL}/candidates/${candId}/unassign`, {
            method: 'PUT'
        });
        if (res.ok) {
            loadM3Data();
            fetchCandidates(); // Update global context
        } else {
            showToast('Error removiendo', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

// Search Filter
m3Search.addEventListener('input', (e) => {
    renderM3Lists(e.target.value.trim());
});

// ==========================================
// M4: CHECKLIST & PAYROLL
// ==========================================
let currentWaveM4 = null;
let m4ChecklistData = [];

// DOM Elements M4
const m4Title = document.getElementById('m4-title');
const m4Subtitle = document.getElementById('m4-subtitle');
const m4BadgeHoras = document.getElementById('m4-badge-horas');
const m4BadgeAgentes = document.getElementById('m4-badge-agentes');
const m4BadgeTarifa = document.getElementById('m4-badge-tarifa');
const m4BadgeDias = document.getElementById('m4-badge-dias');
const m4FechaReporte = document.getElementById('m4-fecha-reporte');
const btnM4SendReport = document.getElementById('btn-m4-send-report');
const btnM4Recalc = document.getElementById('btn-m4-recalc');
const m4KpiProyectada = document.getElementById('m4-kpi-proyectada');
const m4ProjBase = document.getElementById('m4-proj-base');
const m4ProjRecargos = document.getElementById('m4-proj-recargos');
const m4KpiReal = document.getElementById('m4-kpi-real');
const m4RealParticipants = document.getElementById('m4-real-participants');
const m4RealDays = document.getElementById('m4-real-days');
const m4DeviationBadge = document.getElementById('m4-deviation-badge');
const btnM4Save = document.getElementById('btn-m4-save');

window.openModule4 = async (waveId) => {
    toggleGlobalLoader(true, "Iniciando Módulo de Nómina M4...");
    try {
        const res = await apiFetch(`${API_URL}/waves/${waveId}`);
        if (!res.ok) throw new Error('Error cargando wave');
        currentWaveM4 = await res.json();

        globalActiveWaveId = currentWaveM4.id;
        globalActiveWaveName = currentWaveM4.codigo_wave;

        // Navigation visual update
        if (navM4) navM4.click();

        await loadM4Data();
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        toggleGlobalLoader(false);
    }
};

async function loadM4Data() {
    if (!currentWaveM4) return;

    // UI Header
    m4Title.innerHTML = `Checklist de Nómina: <span style="color:white;">${currentWaveM4.codigo_wave}</span>`;
    m4Subtitle.textContent = `${currentWaveM4.campana} • ${formatDate(currentWaveM4.fecha_inicio)} a ${formatDate(currentWaveM4.fecha_fin)}`;
    const tarifaCalculada = parseFloat(currentWaveM4.salario_mensual_referencia) / 220;
    const tarifaFinalUI = parseFloat(currentWaveM4.tarifa_hora) || tarifaCalculada || 0;

    m4BadgeHoras.textContent = `Horas plan: ${currentWaveM4.horas_planeadas_dia} h`;
    m4BadgeAgentes.textContent = `Agentes: ${currentWaveM4.cantidad_agentes}`;
    m4BadgeTarifa.textContent = `Tarifa: ${formatter.format(tarifaFinalUI)}/h`;

    // Set Days badge
    const diasSeleccionados = typeof currentWaveM4.dias_laborales === 'string' ? JSON.parse(currentWaveM4.dias_laborales) : currentWaveM4.dias_laborales;
    const dayNamesAbbr = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const diasText = diasSeleccionados.map(d => dayNamesAbbr[d]).join(', ');
    m4BadgeDias.textContent = `Días: ${diasText}`;

    // Set Report Date to today by default
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    m4FechaReporte.value = today.toISOString().split('T')[0];

    // Projections Breakdown
    const recargosStr = currentWaveM4.recargos;
    const rData = typeof recargosStr === 'string' ? JSON.parse(recargosStr) : recargosStr;
    m4KpiProyectada.textContent = formatter.format(currentWaveM4.costo_total_proyectado);

    // Approximate Split for visual (In a real scenario, we'd save the precise breakdown in DB to retrieve it here)
    m4ProjBase.textContent = "Calculado según M2";
    m4ProjRecargos.textContent = `Mix % (${rData.domingo_pct}% dom, ${rData.festivo_pct}% fes)`;

    try {
        // Fetch actual real participants assigned in M3
        try {
            const pRes = await apiFetch(`${API_URL}/waves/${currentWaveM4.id}/candidates`);
            const participants = await pRes.json();
            currentWaveM4.real_agentes = participants ? participants.length : currentWaveM4.cantidad_agentes;
        } catch (err) {
            currentWaveM4.real_agentes = currentWaveM4.cantidad_agentes; // Fallback to M2 planeado
        }

        const res = await apiFetch(`${API_URL}/waves/${currentWaveM4.id}/checklist`);
        m4ChecklistData = await res.json();

        if (m4ChecklistData.length === 0) {
            // Auto-generate days
            await generateChecklistDays();
        } else {
            recalculateM4Financials(); // Initial calc logic check
            renderM4Table();
        }
    } catch (e) {
        showToast("Error cargando checklist", 'error');
    }
}

async function getHolidaysForYears(startYear, endYear) {
    const festivos = [];
    for (let y = startYear; y <= endYear; y++) {
        try {
            const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/CO`);
            if (res.ok) {
                const data = await res.json();
                festivos.push(...data.map(h => h.date));
            }
        } catch (e) {
            console.warn(`No se pudieron obtener festivos de ${y}:`, e);
        }
    }
    return festivos;
}

async function generateChecklistDays() {
    let d = new Date(currentWaveM4.fecha_inicio);
    const endD = new Date(currentWaveM4.fecha_fin);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    endD.setMinutes(endD.getMinutes() + endD.getTimezoneOffset());

    const diasSeleccionados = typeof currentWaveM4.dias_laborales === 'string' ? JSON.parse(currentWaveM4.dias_laborales) : currentWaveM4.dias_laborales;

    // Fetch Holidays from global cache logic already in app.js
    const fInicio = currentWaveM4.fecha_inicio.split('T')[0];
    const fFin = currentWaveM4.fecha_fin.split('T')[0];
    const startYear = parseInt(fInicio.split('-')[0]);
    const endYear = parseInt(fFin.split('-')[0]);
    const festivosColombia = await getHolidaysForYears(startYear, endYear);

    m4ChecklistData = [];

    while (d <= endD) {
        const dayOfWeek = d.getDay();
        const dateStr = d.toISOString().split('T')[0];
        const isFestivo = festivosColombia.includes(dateStr);

        if (diasSeleccionados.includes(dayOfWeek)) {
            // Skip festivos if the wave was created with incluir_festivos = false
            if (isFestivo && !currentWaveM4.incluir_festivos) {
                // Do not insert
            } else {
                m4ChecklistData.push({
                    id: null,
                    fecha: dateStr,
                    trabajo: false,
                    horas_plan: currentWaveM4.horas_planeadas_dia,
                    horas_trabajadas: 0,
                    ausencias: 0,
                    quiz_realizado: false,
                    score: 0,
                    notas: '',
                    total_dia: 0
                });
            }
        }
        d.setDate(d.getDate() + 1);
    }

    // Initial Calc
    m4ChecklistData.forEach((row, idx) => recalculateM4RowSilent(idx));
    recalculateM4Financials();
    renderM4Table();
}

function recalculateM4RowSilent(index) {
    const row = m4ChecklistData[index];
    if (!row.trabajo) {
        row.total_dia = 0;
    } else {
        const tarifaCalculada = parseFloat(currentWaveM4.salario_mensual_referencia) / 220;
        const tarifa = parseFloat(currentWaveM4.tarifa_hora) || tarifaCalculada || 0;
        const totalAgentes = parseInt(currentWaveM4.real_agentes !== undefined ? currentWaveM4.real_agentes : currentWaveM4.cantidad_agentes) || 0;

        // Corrected Formula: Ausencias are whole absent agents, not hours.
        // Total_Dia = (TotalAgentes - AusenciasPersonas) * HorasTrabajadas * TarifaHora
        const horasTrab = parseFloat(row.horas_trabajadas) || 0;
        const ausenciasPersonas = parseFloat(row.ausencias) || 0;

        let costoBase = (totalAgentes - ausenciasPersonas) * horasTrab * tarifa;

        // --- Added Value: Automatic Surcharges per-row logic based on date ----
        let rData = { domingo_pct: 0, festivo_pct: 0 };
        try { rData = typeof currentWaveM4.recargos === 'string' ? JSON.parse(currentWaveM4.recargos) : currentWaveM4.recargos || rData; } catch (e) { }

        const dObj = new Date(row.fecha);
        dObj.setMinutes(dObj.getMinutes() + dObj.getTimezoneOffset());
        const dayOfWeek = dObj.getDay();

        if (dayOfWeek === 0 && rData.domingo_pct > 0) {
            costoBase += (costoBase * (parseFloat(rData.domingo_pct) / 100));
        }

        row.total_dia = Math.max(0, costoBase); // Prevent negative cost if absence > hours
    }
}

function recalculateM4Row(index) {
    recalculateM4RowSilent(index);
    recalculateM4Financials();

    // Direct DOM update to avoid focus loss and input lag
    const row = m4ChecklistData[index];
    const tdTotal = document.getElementById(`m4-td-total-${index}`);
    if (tdTotal) {
        tdTotal.textContent = formatter.format(row.total_dia);
        tdTotal.style.color = parseFloat(row.total_dia) > 0 ? 'var(--success)' : 'var(--text-muted)';
    }

    // Toggle disabled states (Respecting the general Wave Closure Lock)
    const inpHoras = document.getElementById(`m4-inp-horas-${index}`);
    const inpAusencias = document.getElementById(`m4-inp-ausencias-${index}`);
    const inpScore = document.getElementById(`m4-inp-score-${index}`);
    const isClosed = currentWaveM4.estado === 'finalizada';

    if (inpHoras) inpHoras.disabled = !row.trabajo || isClosed;
    if (inpAusencias) inpAusencias.disabled = !row.trabajo || isClosed;
    if (inpScore) inpScore.disabled = !row.quiz_realizado || isClosed;
}

btnM4Recalc.addEventListener('click', () => {
    m4ChecklistData.forEach((row, idx) => recalculateM4RowSilent(idx));
    recalculateM4Financials();
    renderM4Table();
    showToast('Nómina Recalculada Temporalmente', 'success');
});

function recalculateM4Financials() {
    const totalReal = m4ChecklistData.reduce((sum, item) => sum + parseFloat(item.total_dia), 0);
    const proyectado = parseFloat(currentWaveM4.costo_total_proyectado);

    m4KpiReal.textContent = formatter.format(totalReal);
    if (totalReal < proyectado) {
        m4DeviationBadge.textContent = `Ahorro: ${formatter.format(proyectado - totalReal)}`;
        m4DeviationBadge.style.background = 'var(--success)';
        m4DeviationBadge.style.color = 'white';
    } else {
        m4DeviationBadge.textContent = `Sobrecosto: ${formatter.format(totalReal - proyectado)}`;
        m4DeviationBadge.style.background = 'var(--danger)';
        m4DeviationBadge.style.color = 'white';
    }

    m4RealDays.textContent = `${m4ChecklistData.filter(row => row.trabajo).length} activados`;
    m4RealParticipants.textContent = currentWaveM4.real_agentes !== undefined ? currentWaveM4.real_agentes : currentWaveM4.cantidad_agentes;
}

function renderM4Table() {
    // Relying on global tableM4Checklist declared at top
    tableM4Checklist = document.getElementById('m4-checklist-body');
    if (!tableM4Checklist) return;

    tableM4Checklist.innerHTML = '';

    // Wave Lockdown UI Logic
    const isClosed = currentWaveM4.estado === 'finalizada';
    if (btnM4Save) btnM4Save.style.display = isClosed ? 'none' : 'flex';
    if (btnM4Recalc) btnM4Recalc.style.display = isClosed ? 'none' : 'flex';
    if (btnM4SendReport) btnM4SendReport.style.display = isClosed ? 'none' : 'flex';

    m4ChecklistData.forEach((row, idx) => {
        const tr = document.createElement('tr');

        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const dObj = new Date(row.fecha);
        dObj.setMinutes(dObj.getMinutes() + dObj.getTimezoneOffset());
        const isSunday = dObj.getDay() === 0;

        // MySQL returns full ISO strings for DATE columns, so we slice it to get only YYYY-MM-DD
        const displayFecha = typeof row.fecha === 'string' ? row.fecha.split('T')[0] : row.fecha;

        tr.innerHTML = `
            <td>
                <div style="font-weight:bold; ${isSunday ? 'color: var(--danger);' : ''}">${displayFecha}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">${dayNames[dObj.getDay()]}</div>
            </td>
            <td style="text-align:center;">
                <label class="switch" style="margin:0 auto; display:block;">
                    <input type="checkbox" id="m4-chk-trabajo-${idx}" ${row.trabajo ? 'checked' : ''} ${isClosed ? 'disabled' : ''} onchange="updateM4Row(${idx}, 'trabajo', this.checked)">
                    <span class="slider round"></span>
                </label>
            </td>
            <td style="text-align:center;">
                <input class="form-control text-center" style="width:60px; display:inline-block;" value="${row.horas_plan}" disabled>
            </td>
            <td style="text-align:center;">
                <input type="number" id="m4-inp-horas-${idx}" class="form-control text-center highlight-input" style="width:70px; display:inline-block;" value="${row.horas_trabajadas}" ${!row.trabajo || isClosed ? 'disabled' : ''} oninput="updateM4Row(${idx}, 'horas_trabajadas', this.value)">
            </td>
            <td style="text-align:center;">
                <input type="number" id="m4-inp-ausencias-${idx}" class="form-control text-center" style="width:60px; display:inline-block; border-color:${row.ausencias > 0 ? 'var(--danger)' : ''};" value="${row.ausencias}" ${!row.trabajo || isClosed ? 'disabled' : ''} oninput="updateM4Row(${idx}, 'ausencias', this.value)">
            </td>
            <td>
                <input type="text" id="m4-inp-notas-${idx}" class="form-control" style="width:100%;" value="${row.notas || ''}" placeholder="Observaciones..." ${isClosed ? 'disabled' : ''} oninput="updateM4Row(${idx}, 'notas', this.value)">
            </td>
            <td style="text-align:center;">
                <label class="switch" style="margin:0 auto; display:block;">
                    <input type="checkbox" id="m4-chk-quiz-${idx}" ${row.quiz_realizado ? 'checked' : ''} ${isClosed ? 'disabled' : ''} onchange="updateM4Row(${idx}, 'quiz_realizado', this.checked)">
                    <span class="slider round"></span>
                </label>
            </td>
            <td style="text-align:center;">
                <input type="number" id="m4-inp-score-${idx}" class="form-control text-center" style="width:70px; display:inline-block;" value="${row.score}" ${!row.quiz_realizado || isClosed ? 'disabled' : ''} oninput="updateM4Row(${idx}, 'score', this.value)">
            </td>
            <td id="m4-td-total-${idx}" style="text-align:right; font-weight:bold; color:${parseFloat(row.total_dia) > 0 ? 'var(--success)' : 'var(--text-muted)'}; white-space:nowrap;">
                ${formatter.format(row.total_dia)}
            </td>
        `;
        tableM4Checklist.appendChild(tr);
    });
}

window.updateM4Row = (index, field, value) => {
    // Sanitize input
    if (field === 'horas_trabajadas' || field === 'ausencias' || field === 'score') {
        value = value === '' || isNaN(value) ? 0 : parseFloat(value);
    }

    // Absence Limiter Lock
    if (field === 'ausencias') {
        const topAgents = currentWaveM4.real_agentes !== undefined ? currentWaveM4.real_agentes : currentWaveM4.cantidad_agentes;
        if (value > topAgents) {
            value = topAgents;
            showToast(`Las ausencias no pueden superar el total de agentes matriculados (${topAgents})`, 'error');
            const domInp = document.getElementById(`m4-inp-ausencias-${index}`);
            if (domInp) domInp.value = value;
        }
    }

    m4ChecklistData[index][field] = value;

    // Reactively calculate and update DOM directly without full table re-render
    recalculateM4Row(index);
};

// Removed duplicate M4 Elements declarations

btnM4Save.addEventListener('click', async () => {
    try {
        const res = await apiFetch(`${API_URL}/waves/${currentWaveM4.id}/checklist`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: m4ChecklistData })
        });
        if (res.ok) {
            showToast('Checklist guardado en la base de datos', 'success');
            loadM4Data(); // reload ID mappings from DB
        } else {
            showToast('Error al guardar reporte', 'error');
        }
    } catch (e) {
        showToast('Error de conexión con la base', 'error');
    }
});

if (btnM4SendReport) {
    btnM4SendReport.addEventListener('click', () => {
        showToast(`Reporte Diario de la fecha ${m4FechaReporte.value} enviado a Administración`, 'success');
    });
}

// ==========================================
// M5: CIERRE Y RESULTADOS
// ==========================================
let m5ResultsData = [];

// DOM M5 Elements
const m5Title = document.getElementById('m5-title');
const m5Subtitle = document.getElementById('m5-subtitle');
const tableM5Results = document.getElementById('m5-results-body');
const btnM5Close = document.getElementById('btn-m5-close');

window.openModule5 = async (waveId, waveName) => {
    // Rely on global state
    globalActiveWaveId = waveId;
    globalActiveWaveName = waveName;

    if (navM5) navM5.click();
    await loadM5Data();
};

async function loadM5Data() {
    if (!globalActiveWaveId) return;

    m5Title.innerHTML = `Cierre de Wave: <span style="color:white;">${globalActiveWaveName}</span>`;
    m5Subtitle.textContent = "Preparación para facturación y estado final";

    try {
        const res = await apiFetch(`${API_URL}/waves/${globalActiveWaveId}/results`);
        m5ResultsData = await res.json();

        // Disable "Finalizar Wave" Button if it's already finished
        const waveReq = await apiFetch(`${API_URL}/waves/${globalActiveWaveId}`);
        const waveData = await waveReq.json();

        if (waveData.estado === 'finalizada') {
            if (btnM5Close) {
                btnM5Close.style.display = 'none';
            }
            window.m5WaveIsClosed = true;
        } else {
            if (btnM5Close) {
                btnM5Close.style.display = 'flex';
            }
            window.m5WaveIsClosed = false;
        }

        renderM5Table();
    } catch (e) {
        showToast("Error cargando resultados M5", 'error');
    }
}

function renderM5Table() {
    tableM5Results.innerHTML = '';

    if (m5ResultsData.length === 0) {
        tableM5Results.innerHTML = '<tr><td colspan="4" class="text-center p-4">No hay participantes en esta Wave</td></tr>';
        return;
    }

    m5ResultsData.forEach((row, idx) => {
        const tr = document.createElement('tr');

        let selectHtml = `
            <select class="form-control" style="background:#0f172a; color:white; width:100%; border-color:${row.estado_final.includes('Aprobado') ? 'var(--success)' : (row.estado_final !== 'En curso (Activo)' ? 'var(--danger)' : 'var(--border)')};" onchange="updateM5Row(${idx}, this.value)" ${window.m5WaveIsClosed ? 'disabled' : ''}>
                <option value="En curso (Activo)" ${row.estado_final === 'En curso (Activo)' ? 'selected' : ''}>En curso (Activo)</option>
                <option value="Aprobado/Contratado" ${row.estado_final === 'Aprobado/Contratado' ? 'selected' : ''}>Aprobado/Contratado</option>
                <option value="Deserción" ${row.estado_final === 'Deserción' ? 'selected' : ''}>Deserción</option>
                <option value="No cumple perfil" ${row.estado_final === 'No cumple perfil' ? 'selected' : ''}>No cumple perfil</option>
                <option value="Reprobado" ${row.estado_final === 'Reprobado' ? 'selected' : ''}>Reprobado</option>
            </select>
        `;

        tr.innerHTML = `
            <td>
                <div style="font-weight:bold;">${row.nombre}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">CC: ${row.cedula}</div>
            </td>
            <td>${selectHtml}</td>
            <td style="text-align:center;">
                <input type="number" class="form-control text-center" style="width: 80px; display:inline-block; font-weight:bold; color:var(--primary);" value="${parseFloat(row.dynamic_score).toFixed(1)}" disabled>
            </td>
            <td style="text-align:center;">
                <button class="btn btn-secondary btn-danger-sm" style="background:transparent; color:var(--secondary); border:none;"><i class="fa-solid fa-file-invoice-dollar"></i> Ver Pre-Nómina</button>
            </td>
        `;
        tableM5Results.appendChild(tr);
    });
}

window.updateM5Row = (idx, newState) => {
    m5ResultsData[idx].estado_final = newState;
};

if (btnM5Close) {
    btnM5Close.addEventListener('click', async () => {
        if (!globalActiveWaveId) return;

        if (!confirm('¿Estás SEGURO de finalizar esta Wave? Esta acción blindará los resultados y bloquea la nómina pre-aprobada.')) return;

        const payload = m5ResultsData.map(r => ({
            wp_id: r.wp_id,
            estado_final: r.estado_final,
            score_promedio: r.dynamic_score
        }));

        try {
            const res = await apiFetch(`${API_URL}/waves/${globalActiveWaveId}/close`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participantes: payload })
            });

            if (res.ok) {
                showToast('Wave CERRADA exitosamente. Audit log grabado.', 'success');
                loadM5Data();
            } else {
                showToast('No se pudo cerrar la Wave', 'error');
            }
        } catch (e) {
            showToast('Error de conexión', 'error');
        }
    });
}

// ==========================================
// AUTHENTICATION & RBAC
// ==========================================
const loginView = document.getElementById('login-view');
const mainLayout = document.getElementById('main-layout');
const formLogin = document.getElementById('form-login');
const loginCedula = document.getElementById('login-cedula');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

const sidebarUserName = document.getElementById('sidebar-user-name');

// User State
let currentUser = null;

// ==========================================
// AUTO-LOGOUT (INACTIVITY TIMEOUT)
// ==========================================
let inactivityTimer;
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutos en milisegundos

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);

    // Solo contar el tiempo si hay un usuario logueado
    if (currentUser) {
        inactivityTimer = setTimeout(forceLogout, INACTIVITY_LIMIT_MS);
    }
}

function forceLogout() {
    if (currentUser) {
        showToast('Tu sesión ha expirado por inactividad. Ingresa nuevamente.', 'error');
        btnLogout.click(); // Re-usa la lógica del botón de salir
    }
}

// Escuchar movimiento del usuario
['mousemove', 'keydown', 'scroll', 'click'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, true);
});

// ==========================================
// GLOBAL LOADING SPINNER
// ==========================================
function toggleGlobalLoader(show, message = "Cargando...") {
    let loader = document.getElementById('global-loader');
    if (!loader && show) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="spinner"></div>
                <div id="loader-message" style="margin-top:15px; font-weight:bold;">${message}</div>
            </div>
        `;
        document.body.appendChild(loader);
    }

    if (loader) {
        if (show) {
            document.getElementById('loader-message').textContent = message;
            loader.style.display = 'flex';
        } else {
            loader.style.display = 'none';
        }
    }
}

async function checkAuth() {
    const hasPastSession = localStorage.getItem('bpo_user');
    if (hasPastSession) {
        toggleGlobalLoader(true, "Verificando credenciales seguras...");
    }

    try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            localStorage.setItem('bpo_user', JSON.stringify(currentUser)); // Store UX basic data

            // Security check: Force password change on first login
            if (currentUser.must_change_password) {
                loginView.style.display = 'none';
                mainLayout.style.display = 'none';
                if (typeof adminLayout !== 'undefined' && adminLayout) adminLayout.style.display = 'none';

                const modalForce = document.getElementById('modal-force-password');
                if (modalForce) modalForce.style.display = 'flex';
                return;
            }

            resetInactivityTimer();
            loginView.style.display = 'none';
            mainLayout.style.display = 'flex';
            applyPermissions();
            init();
        } else {
            forceVisualLogout();
        }
    } catch (e) {
        forceVisualLogout();
    } finally {
        toggleGlobalLoader(false);
    }
}

function forceVisualLogout() {
    localStorage.removeItem('bpo_user');
    currentUser = null;
    clearTimeout(inactivityTimer);
    loginView.style.display = 'flex';
    mainLayout.style.display = 'none';

    const modalForce = document.getElementById('modal-force-password');
    if (modalForce) modalForce.style.display = 'none';
}

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';

    try {
        const res = await apiFetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cedula: loginCedula.value.trim(),
                password: loginPassword.value
            })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('bpo_user', JSON.stringify(data.user));
            currentUser = data.user;
            loginCedula.value = '';
            loginPassword.value = '';
            checkAuth();
        } else {
            loginError.textContent = data.error || 'Autenticación fallida';
        }
    } catch (err) {
        loginError.textContent = 'Error de conexión con el servidor';
    }
});

btnLogout.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        await fetch(`${API_URL}/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) { }
    forceVisualLogout();
});

// Force Password Change Form Logic
const formForcePassword = document.getElementById('form-force-password');
if (formForcePassword) {
    formForcePassword.addEventListener('submit', async (e) => {
        e.preventDefault();

        const pwd1 = document.getElementById('force-new-password').value;
        const pwd2 = document.getElementById('force-confirm-password').value;

        if (pwd1 !== pwd2) {
            showToast('Las contraseñas no coinciden', 'warning');
            return;
        }

        if (pwd1.length < 6) {
            showToast('La contraseña debe tener al menos 6 caracteres', 'warning');
            return;
        }

        try {
            const res = await apiFetch(`${API_URL}/users/change-password`, {
                method: 'PUT',
                body: JSON.stringify({
                    id: currentUser.id,
                    newPassword: pwd1
                })
            });

            if (res.ok) {
                showToast('Contraseña actualizada correctamente', 'success');
                // Update local storage so we don't trip the checkAuth alarm again
                currentUser.must_change_password = 0; // or false
                localStorage.setItem('bpo_user', JSON.stringify(currentUser));

                document.getElementById('modal-force-password').style.display = 'none';
                document.getElementById('force-new-password').value = '';
                document.getElementById('force-confirm-password').value = '';

                // Finally, let them into the app!
                checkAuth();
            } else {
                showToast('Error al actualizar contraseña', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        }
    });
}

function applyPermissions() {
    if (!currentUser) return;

    // Set text
    sidebarUserName.textContent = `${currentUser.nombre} ${currentUser.apellido}`;

    const p = currentUser.permisos || [];

    // Sidebar Tabs Enforcer
    navM1.style.display = p.includes('m1_view') ? 'flex' : 'none';
    navM2.style.display = p.includes('m2_view') ? 'flex' : 'none';
    if (navM3) navM3.style.display = p.includes('m3_view') ? 'flex' : 'none';
    if (navM4) navM4.style.display = p.includes('m4_view') ? 'flex' : 'none';
    if (navM5) navM5.style.display = p.includes('m5_view') ? 'flex' : 'none';
    navRbac.style.display = p.includes('admin_panel') ? 'flex' : 'none';

    // Content Permissions
    // M1 Add Form
    if (!p.includes('m1_edit')) {
        if (formRequisition) formRequisition.parentElement.parentElement.style.display = 'none';
        if (formCandidate) formCandidate.parentElement.parentElement.style.display = 'none';
    } else {
        if (formRequisition) formRequisition.parentElement.parentElement.style.display = 'block';
        if (formCandidate) formCandidate.parentElement.parentElement.style.display = 'block';
    }

    // M2 Edit
    const waveBlocks = document.querySelectorAll('.module-block');
    waveBlocks.forEach(b => {
        if (!p.includes('m2_edit')) {
            // Very simple hiding for non-editors (just see history)
            if (b.querySelector('form')) b.style.display = 'none';
        } else {
            if (b.querySelector('form')) b.style.display = 'block';
        }
    });

    // M4 Edit Button Logic (Force visible if Admin to bypass cache issues)
    if (btnM4Save) {
        if (currentUser.rol_id === 1 || p.includes('m4_edit') || p.includes('admin_panel')) {
            btnM4Save.style.display = 'inline-block';
        } else {
            btnM4Save.style.display = 'none';
        }
    }

    // Default route logic -> if user doesn't have M1 but it's active by default, switch to whatever they have
    if (!p.includes('m1_view')) {
        navM1.classList.remove('active');
        viewM1.classList.remove('active');
        viewM1.style.display = 'none';

        if (p.includes('m2_view')) {
            navM2.classList.add('active');
            viewM2.style.display = 'block';
            viewM2.classList.add('active');
            loadModule2Data(); // Fixes the perpetual 'Cargando waves...' for non-M1 users
        } else if (p.includes('admin_panel')) {
            navRbac.click();
        }
    }
}

// ==========================================
// MÓDULO RBAC / ADMIN
// ==========================================
const formUser = document.getElementById('form-user');
const tableUsersBody = document.getElementById('table-users-body');
const rolesContainer = document.getElementById('roles-container');
const uRolSelect = document.getElementById('u-rol');

const adminLayout = document.getElementById('admin-layout');
const btnBackPlatform = document.getElementById('btn-back-platform');

navRbac.addEventListener('click', (e) => {
    e.preventDefault();
    navM1.classList.remove('active');
    navM2.classList.remove('active');
    if (navM3) navM3.classList.remove('active');
    if (navM4) navM4.classList.remove('active');
    navRbac.classList.add('active');

    // Hide Main App Layout
    mainLayout.style.display = 'none';

    // Show new Admin Layout
    viewRbac.style.display = 'block';
    adminLayout.style.display = 'block';

    loadRbacData();
});

if (btnBackPlatform) {
    btnBackPlatform.addEventListener('click', (e) => {
        e.preventDefault();
        // Hide Admin Layout
        adminLayout.style.display = 'none';
        navRbac.classList.remove('active');

        // Show Main App Layout
        mainLayout.style.display = 'flex';

        // Return to first available module
        if (navM1.style.display !== 'none') {
            navM1.click();
        } else if (navM2.style.display !== 'none') {
            navM2.click();
        }
    });
}

let systemRoles = [];
let systemUsers = [];

async function loadRbacData() {
    try {
        const [resUsers, resRoles] = await Promise.all([
            apiFetch(`${API_URL}/users`),
            apiFetch(`${API_URL}/roles`)
        ]);

        systemUsers = await resUsers.json();
        systemRoles = await resRoles.json();

        renderUsersTable(systemUsers);
        renderRolesSelect();
        renderRolesMatrix();
    } catch (e) {
        showToast('Error cargando módulo de seguridad', 'error');
    }
}

function renderUsersTable(users) {
    tableUsersBody.innerHTML = '';
    users.forEach(u => {
        const tr = document.createElement('tr');

        let roleBadgeClass = 'badge-training'; // fallback
        if (u.nombre_rol === 'Admin') roleBadgeClass = 'badge-selected';
        if (u.nombre_rol === 'Formador') roleBadgeClass = 'badge-training';
        if (u.nombre_rol === 'Analista') roleBadgeClass = 'badge-completed'; // Assume this class exists or it will default to a nice color

        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 38px; height: 38px; border-radius: 50%; background: var(--card-bg); border: 1px solid var(--border); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: bold; flex-shrink: 0;">
                        <i class="fa-solid fa-user-shield"></i>
                    </div>
                    <div>
                        <div class="p-name" style="font-weight: 600; color: var(--text-light);">${u.nombre} ${u.apellido}</div>
                        <div class="p-email" style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-envelope"></i> ${u.correo}</div>
                        <div class="p-email" style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-id-card"></i> ${u.cedula}</div>
                    </div>
                </div>
            </td>
            <td style="vertical-align: middle;"><span class="badge ${roleBadgeClass}">${u.nombre_rol}</span></td>
            <td style="vertical-align: middle;">
                ${u.id === 1 ? '<span class="badge badge-training" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted);"><i class="fa-solid fa-lock"></i> Sistema</span>' : `<button type="button" class="btn-danger-sm" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash"></i> Eliminar</button>`}
            </td>
        `;
        tableUsersBody.appendChild(tr);
    });
}

// Search Filter for Admin Users
const adminSearchUsers = document.getElementById('admin-search-users');
if (adminSearchUsers) {
    adminSearchUsers.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) {
            renderUsersTable(systemUsers);
            return;
        }

        const filtered = systemUsers.filter(u =>
            u.nombre.toLowerCase().includes(term) ||
            u.apellido.toLowerCase().includes(term) ||
            u.cedula.toLowerCase().includes(term) ||
            u.correo.toLowerCase().includes(term) ||
            (u.nombre_rol && u.nombre_rol.toLowerCase().includes(term))
        );
        renderUsersTable(filtered);
    });
}

function renderRolesSelect() {
    uRolSelect.innerHTML = '<option value="" disabled selected>-- Seleccione un Rol --</option>';
    systemRoles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.nombre_rol;
        uRolSelect.appendChild(opt);
    });
}

formUser.addEventListener('submit', async (e) => {
    e.preventDefault();

    const uData = {
        nombre: document.getElementById('u-nombre').value.trim(),
        apellido: document.getElementById('u-apellido').value.trim(),
        cedula: document.getElementById('u-cedula').value.trim(),
        correo: document.getElementById('u-correo').value.trim(),
        password: document.getElementById('u-password').value,
        rol_id: parseInt(document.getElementById('u-rol').value)
    };

    try {
        const res = await apiFetch(`${API_URL}/users`, {
            method: 'POST',
            body: JSON.stringify(uData)
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Usuario creado correctamente', 'success');
            formUser.reset();
            loadRbacData();
        } else {
            showToast(data.error || 'Error creando usuario', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
});

window.deleteUser = async (id) => {
    if (!confirm('¿Estás seguro de eliminar permanentemente este usuario?')) return;
    try {
        const res = await apiFetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Usuario eliminado', 'success');
            loadRbacData();
        } else {
            showToast('Error eliminando usuario', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
};

// --- Roles Permissions Matrix ---
const availablePermissions = [
    { id: 'm1_view', label: 'M1: Ver Requisiciones' },
    { id: 'm1_edit', label: 'M1: Crear / Editar Requisiciones' },
    { id: 'm1_delete', label: 'M1: Borrar Requisiciones' },
    { id: 'm2_view', label: 'M2: Ver Waves (Histórico)' },
    { id: 'm2_edit', label: 'M2: Simular / Crear Waves' },
    { id: 'm3_view', label: 'M3: Menú Asignación' },
    { id: 'm4_view', label: 'M4: Ver Checklist Diario' },
    { id: 'm4_edit', label: 'M4: Editar / Guardar Nominas' },
    { id: 'm5_view', label: 'M5: Ver Cierre de Waves (Resultados)' },
    { id: 'm5_edit', label: 'M5: Modificar Estados y Finalizar Waves' },
    { id: 'admin_panel', label: 'Admin: Panel de Seguridad' }
];

function renderRolesMatrix() {
    rolesContainer.innerHTML = '';

    systemRoles.forEach(rol => {
        const perms = rol.permisos || [];

        // Check if this is the super admin role
        const isAdminRole = rol.id === 1;

        // VISUALLY HIDE ADMIN ROLE ENTIRELY FROM CONFIGURATION MATRIX
        if (isAdminRole) return;

        let checksHTML = availablePermissions.map(ap => {
            const checked = perms.includes(ap.id) ? 'checked' : '';
            // Disable interactions for the Admin role visually
            const disabledAttr = isAdminRole ? 'disabled' : '';
            return `
                <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:0.9rem; cursor:${isAdminRole ? 'not-allowed' : 'pointer'}; opacity: ${isAdminRole ? '0.7' : '1'};">
                    <input type="checkbox" class="cb-perm-${rol.id}" value="${ap.id}" ${checked} ${disabledAttr}>
                    ${ap.label}
                </label>
            `;
        }).join('');

        const card = document.createElement('div');
        card.style.background = 'var(--bg-main)';
        card.style.border = '1px solid var(--border)';
        card.style.borderRadius = '8px';
        card.style.padding = '20px';

        card.innerHTML = `
            <h4 style="color:var(--text-light); margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                <i class="fa-solid fa-user-tag text-muted"></i> Rol: ${rol.nombre_rol}
            </h4>
            <div style="margin-bottom: 20px;">
                ${checksHTML}
            </div>
            ${isAdminRole ? '<div class="text-muted text-sm text-center">🔐 Rol del Sistema Protegido</div>' : `<button class="btn btn-outline w-100" onclick="saveRolePermissions(${rol.id}, '${rol.nombre_rol}')">
                <i class="fa-solid fa-floppy-disk"></i> Guardar Permisos
            </button>`}
        `;

        rolesContainer.appendChild(card);
    });
}

window.saveRolePermissions = async (rolId, rolNombre) => {
    // Collect all checked boxes for this role
    const checkboxes = document.querySelectorAll(`.cb-perm-${rolId}:checked`);
    const finalPerms = Array.from(checkboxes).map(cb => cb.value);

    try {
        const res = await apiFetch(`${API_URL}/roles/${rolId}`, {
            method: 'PUT',
            body: JSON.stringify({ permisos: finalPerms })
        });

        if (res.ok) {
            showToast(`Permisos de ${rolNombre} actualizados`, 'success');

            // If the user modified their own role, warn them
            if (currentUser && currentUser.rol_id === rolId) {
                showToast('Tus propios permisos cambiaron. Reiniciando sesión en 3...2...', 'warning');
                setTimeout(() => {
                    localStorage.removeItem('bpo_user');
                    window.location.reload();
                }, 3000);
            }
        } else {
            showToast('Error al guardar permisos', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
};

// BOOT APPLICATION
checkAuth();
