const API_URL = 'http://localhost:3000/api';

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
    try {
        const res = await fetch(`${API_URL}/requisitions`);
        requisitions = await res.json();
        updateReqTable();
        updateKPIs();
        updateReqSelect();
    } catch (e) {
        showToast('Error cargando requisiciones', 'error');
    }
}

async function fetchCandidates() {
    try {
        const res = await fetch(`${API_URL}/candidates`);
        candidates = await res.json();
        updateCandTable();
    } catch (e) {
        showToast('Error cargando candidatos', 'error');
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
                <button onclick="deleteRequisition(${req.id})" class="btn-danger-sm"><i class="fa-solid fa-trash"></i> Eliminar</button>
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
                <button onclick="deleteCandidate(${cand.id})" class="btn-danger-sm"><i class="fa-solid fa-trash"></i> Eliminar</button>
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
        const res = await fetch(`${API_URL}/requisitions`, {
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
        const res = await fetch(`${API_URL}/candidates`, {
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
        const res = await fetch(`${API_URL}/requisitions/${id}`, { method: 'DELETE' });
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
        const res = await fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE' });
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

// Start
init();
// ==========================================
// M2: MODULE NAVIGATION (SPA)
// ==========================================
const navM1 = document.getElementById('nav-m1');
const navM2 = document.getElementById('nav-m2');
const navM3 = document.getElementById('nav-m3');
const viewM1 = document.getElementById('module-1');
const viewM2 = document.getElementById('module-2');
const viewM3 = document.getElementById('module-3');

navM1.addEventListener('click', (e) => {
    e.preventDefault();
    navM2.classList.remove('active');
    if (navM3) navM3.classList.remove('active');
    navM1.classList.add('active');
    viewM2.classList.remove('active');
    viewM3.classList.remove('active');
    setTimeout(() => {
        viewM2.style.display = 'none';
        viewM3.style.display = 'none';
        viewM1.style.display = 'block';
        viewM1.classList.add('active');
    }, 200);
});

navM2.addEventListener('click', (e) => {
    e.preventDefault();
    navM1.classList.remove('active');
    if (navM3) navM3.classList.remove('active');
    navM2.classList.add('active');
    viewM1.classList.remove('active');
    viewM3.classList.remove('active');
    setTimeout(() => {
        viewM1.style.display = 'none';
        viewM3.style.display = 'none';
        viewM2.style.display = 'block';
        viewM2.classList.add('active');
    }, 200);
    loadModule2Data(); // load dependencies for M2
});

if (navM3) {
    navM3.addEventListener('click', () => {
        navM1.classList.remove('active');
        navM2.classList.remove('active');
        navM3.classList.add('active');
        viewM1.classList.remove('active');
        viewM2.classList.remove('active');

        // Load dropdown options just in case they added new ones
        loadM3Dropdown();

        setTimeout(() => {
            viewM1.style.display = 'none';
            viewM2.style.display = 'none';
            viewM3.style.display = 'block';
            viewM3.classList.add('active');
        }, 200);

        // We only load data if there's a current wave selected. Otherwise it shows the empty state.
        if (currentWaveM3) {
            loadM3Data();
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
        const res = await fetch(`${API_URL}/waves`);
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
        const proj = JSON.parse(w.recargos); // Just parsing to show something, ideally stored differently

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
            <td><span class="badge ${w.estado === 'en curso' ? 'badge-selected' : ''}">${w.estado.toUpperCase()}</span></td>
            <td>
                <button class="btn-secondary" style="padding: 4px 8px; font-size:0.75rem;" onclick="openModule3(${w.id})" title="Asignar Participantes"><i class="fa-solid fa-users"></i></button>
                <button class="btn-primary" style="padding: 4px 8px; font-size:0.75rem;" title="Ver Checklist"><i class="fa-solid fa-list-check"></i></button>
            </td>
        `;
        tableWavesBody.appendChild(tr);
    });
}

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
        // formula: (Mensual / 30) / horas_dia
        tarifa = (salRef / 30) / horasDia;
        document.getElementById('w-tarifa').placeholder = `Auto-calculada: $${Math.round(tarifa)}`;
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
        tarifa_hora: parseFloat(document.getElementById('w-tarifa').value) || null,
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
        const res = await fetch(`${API_URL}/waves`, {
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
// DOM Elements
const m3Title = document.getElementById('m3-wave-title');
const m3Subtitle = document.getElementById('m3-wave-subtitle');
const m3CountAvail = document.getElementById('m3-count-avail');
const m3CountAssigned = document.getElementById('m3-count-assigned');
const m3ListAvail = document.getElementById('m3-list-available');
const m3ListAssigned = document.getElementById('m3-list-assigned');
const m3Search = document.getElementById('m3-search');
const btnGoChecklist = document.getElementById('btn-go-checklist');
const m3WaveSelector = document.getElementById('m3-wave-selector');

// Navigation Button Back to M2
const btnBackM2 = document.getElementById('btn-back-m2');
btnBackM2.addEventListener('click', () => {
    viewM3.classList.remove('active');
    if (navM3) navM3.classList.remove('active');
    navM2.classList.add('active');
    setTimeout(() => { viewM3.style.display = 'none'; viewM2.style.display = 'block'; viewM2.classList.add('active'); }, 200);
    fetchWaves(); // Refresh M2 table to show new icon counts if any
});

// Entry Point from M2 Table
window.openModule3 = async (waveId) => {
    try {
        if (m3WaveSelector) m3WaveSelector.value = waveId;

        // Fetch Wave Info
        const res = await fetch(`${API_URL}/waves/${waveId}`);
        if (!res.ok) throw new Error('No se pudo cargar la wave');
        currentWaveM3 = await res.json();

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

        // Load Data
        loadM3Data();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// Load dropdown for direct M3 sidebar access
async function loadM3Dropdown() {
    if (!m3WaveSelector) return;
    try {
        const res = await fetch(`${API_URL}/waves`);
        const allWaves = await res.json();

        m3WaveSelector.innerHTML = '<option value="" disabled selected>-- Selecciona de la lista --</option>';
        allWaves.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = `${w.codigo_wave} - ${w.campana} (${w.estado})`;
            m3WaveSelector.appendChild(opt);
        });

        // If one is already active, keep it selected
        if (currentWaveM3) {
            m3WaveSelector.value = currentWaveM3.id;
        }
    } catch (err) {
        console.error("Error loading M3 dropdown");
    }
}

if (m3WaveSelector) {
    m3WaveSelector.addEventListener('change', (e) => {
        if (e.target.value) {
            window.openModule3(e.target.value);
        }
    });
}

// Load both lists
async function loadM3Data() {
    if (!currentWaveM3) return;
    try {
        console.log("Loading M3 data for wave:", currentWaveM3.id);
        // 1. Fetch Available (Candidates with status='selected' and wave_id IS NULL)
        const resAvail = await fetch(`${API_URL}/candidates/available`);
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
        const resAssigned = await fetch(`${API_URL}/waves/${currentWaveM3.id}/candidates`);
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
                </div>
                <button class="btn btn-outline" style="border-color:var(--primary); color:var(--primary); padding: 5px 12px; font-weight: 500; white-space: nowrap; flex-shrink: 0;" onclick="assignCandidateM3(${c.id})">
                    Agregar <i class="fa-solid fa-arrow-right" style="margin-left: 5px;"></i>
                </button>
            `;
            m3ListAvail.appendChild(div);
        });
    }

    // ---- Render Assigned ----
    m3ListAssigned.innerHTML = '';
    m3CountAssigned.textContent = `${m3AssignedCandidates.length} / ${currentWaveM3.cantidad_agentes}`;

    // Highlight overcapacity Warning
    if (m3AssignedCandidates.length > currentWaveM3.cantidad_agentes) {
        m3CountAssigned.style.background = 'var(--danger)';
        m3CountAssigned.style.color = 'white';
    } else if (m3AssignedCandidates.length === currentWaveM3.cantidad_agentes) {
        m3CountAssigned.style.background = 'var(--success)';
        m3CountAssigned.style.color = 'white';
    } else {
        m3CountAssigned.style.background = '';
        m3CountAssigned.style.color = '';
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
                </div>
                <button class="btn btn-outline" style="border-color:var(--danger); color:var(--danger); padding: 5px 12px; font-weight: 500; white-space: nowrap; flex-shrink: 0;" onclick="unassignCandidateM3(${c.id})">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 5px;"></i> Remover
                </button>
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
        const res = await fetch(`${API_URL}/candidates/${candId}/assign`, {
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
        const res = await fetch(`${API_URL}/candidates/${candId}/unassign`, {
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
const navRbac = document.getElementById('nav-rbac');

// User State
let currentUser = null;

function checkAuth() {
    const saved = localStorage.getItem('bpo_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        loginView.style.display = 'none';
        mainLayout.style.display = 'flex';
        applyPermissions();
        init(); // Starts loading M1 default view
    } else {
        loginView.style.display = 'flex';
        mainLayout.style.display = 'none';
    }
}

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';

    try {
        const res = await fetch(`${API_URL}/login`, {
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

btnLogout.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('bpo_user');
    currentUser = null;
    checkAuth();
});

function applyPermissions() {
    if (!currentUser) return;

    // Set text
    sidebarUserName.textContent = `${currentUser.nombre} ${currentUser.apellido}`;

    const p = currentUser.permisos || [];

    // Sidebar Tabs Enforcer
    navM1.style.display = p.includes('m1_view') ? 'flex' : 'none';
    navM2.style.display = p.includes('m2_view') ? 'flex' : 'none';
    if (navM3) navM3.style.display = p.includes('m3_view') ? 'flex' : 'none';
    navRbac.style.display = p.includes('admin_panel') ? 'flex' : 'none';

    // Content Permissions
    // M1 Add Form
    if (!p.includes('m1_edit')) {
        if (formRequisition) formRequisition.parentElement.style.display = 'none';
        if (formCandidate) formCandidate.parentElement.style.display = 'none';
    } else {
        if (formRequisition) formRequisition.parentElement.style.display = 'block';
        if (formCandidate) formCandidate.parentElement.style.display = 'block';
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

    // Default route logic -> if user doesn't have M1 but it's active by default, switch to whatever they have
    if (!p.includes('m1_view')) {
        navM1.classList.remove('active');
        viewM1.classList.remove('active');
        viewM1.style.display = 'none';

        if (p.includes('m2_view')) {
            navM2.classList.add('active');
            viewM2.style.display = 'block';
            viewM2.classList.add('active');
        } else if (p.includes('admin_panel')) {
            navRbac.classList.add('active');
            viewRbac.style.display = 'block';
            viewRbac.classList.add('active');
            loadRbacData();
        }
    }
}

// ==========================================
// MÓDULO RBAC / ADMIN
// ==========================================
const viewRbac = document.getElementById('module-rbac');
const formUser = document.getElementById('form-user');
const tableUsersBody = document.getElementById('table-users-body');
const rolesContainer = document.getElementById('roles-container');
const uRolSelect = document.getElementById('u-rol');

navRbac.addEventListener('click', (e) => {
    e.preventDefault();
    navM1.classList.remove('active');
    navM2.classList.remove('active');
    if (navM3) navM3.classList.remove('active');
    navRbac.classList.add('active');

    viewM1.classList.remove('active');
    viewM2.classList.remove('active');
    if (viewM3) viewM3.classList.remove('active');
    viewRbac.classList.add('active');

    setTimeout(() => {
        viewM1.style.display = 'none';
        viewM2.style.display = 'none';
        if (viewM3) viewM3.style.display = 'none';
        viewRbac.style.display = 'block';
    }, 200);

    loadRbacData();
});

let systemRoles = [];

async function loadRbacData() {
    try {
        const [resUsers, resRoles] = await Promise.all([
            fetch(`${API_URL}/users`),
            fetch(`${API_URL}/roles`)
        ]);

        const users = await resUsers.json();
        systemRoles = await resRoles.json();

        renderUsersTable(users);
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
        tr.innerHTML = `
            <td>
                <strong>${u.nombre} ${u.apellido}</strong><br>
                <small class="text-muted"><i class="fa-regular fa-envelope"></i> ${u.correo}</small><br>
                <small class="text-muted"><i class="fa-regular fa-id-card"></i> ${u.cedula}</small>
            </td>
            <td><span class="badge badge-selected">${u.nombre_rol}</span></td>
            <td>
                ${u.id === 1 ? '<small class="text-muted">Protegido</small>' : `<button class="btn btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash"></i></button>`}
            </td>
        `;
        tableUsersBody.appendChild(tr);
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
        const res = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(uData)
        });

        const result = await res.json();
        if (res.ok) {
            showToast('Usuario creado correctamente', 'success');
            formUser.reset();
            loadRbacData();
        } else {
            showToast(result.error || 'Error creando usuario', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
});

window.deleteUser = async (id) => {
    if (!confirm('¿Estás seguro de eliminar permanentemente este usuario?')) return;
    try {
        const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
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
    { id: 'm4_view', label: 'M4: Checklist Diario' },
    { id: 'admin_panel', label: 'Admin: Panel de Seguridad' }
];

function renderRolesMatrix() {
    rolesContainer.innerHTML = '';

    systemRoles.forEach(rol => {
        const perms = rol.permisos || [];

        let checksHTML = availablePermissions.map(ap => {
            const checked = perms.includes(ap.id) ? 'checked' : '';
            return `
                <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:0.9rem; cursor:pointer;">
                    <input type="checkbox" class="cb-perm-${rol.id}" value="${ap.id}" ${checked}>
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
            <button class="btn btn-outline w-100" onclick="saveRolePermissions(${rol.id}, '${rol.nombre_rol}')">
                <i class="fa-solid fa-floppy-disk"></i> Guardar Permisos
            </button>
        `;

        rolesContainer.appendChild(card);
    });
}

window.saveRolePermissions = async (rolId, rolNombre) => {
    // Collect all checked boxes for this role
    const checkboxes = document.querySelectorAll(`.cb-perm-${rolId}:checked`);
    const finalPerms = Array.from(checkboxes).map(cb => cb.value);

    try {
        const res = await fetch(`${API_URL}/roles/${rolId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
