
'use strict';

/* ===========================
   Utilidades y normalización
   =========================== */

function toRoman(num) {
  const romanMap = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
  let result = '';
  for (const key in romanMap) {
    while (num >= romanMap[key]) {
      result += key;
      num -= romanMap[key];
    }
  }
  return result;
}

// Normaliza: minúsculas, sin tildes/diacríticos, espacios compactados
function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Aliases de OCR/errores frecuentes a su forma canónica
const NAME_ALIASES = new Map([
  ['psicolgia en las organizaciones', 'psicologia en las organizaciones'],
  ['emprenderísmo', 'emprenderismo'],
  ['emprenderismo', 'emprenderismo'], // mantener distinto de "emprendimiento"
  ['princpios de contabildiad', 'principios de contabilidad'],
  ['ingles i', 'inglés i'],
  ['ingles ii', 'inglés ii'],
  ['ingles iii', 'inglés iii'],
  ['ingles iv', 'inglés iv'],
]);

function canonicalKey(name) {
  const n = normalizeTitle(name);
  return NAME_ALIASES.get(n) || n;
}

/* ===========================
   Configuración de archivos
   =========================== */

const ADMIN_FILE = 'malla_empresas_struct_with_credits.json';
const CONT_FILE  = 'malla_contabilidad_struct.json';

/* ===========================
   Estado global
   =========================== */

const semesterTotalsEls = {}; // {semester: {header, admin, contabilidad, comunes}}
let adminRawTotal = 0;
let contRawTotal = 0;
let adminProgramTotal = 0;
let contProgramTotal = 0;
const codeMap = new Map(); // code -> [cards]
let selectedCard = null;
const semesterColumns = {}; // {semester: {admin, comunes, contabilidad}}
let maxSemesterGlobal = 0;

const UI = {};
[
  'subject-modal','modal-title','modal-info','btn-prereq','btn-homologada',
  'btn-completada','move-semester','btn-move-semester','progress-admin',
  'progress-cont','admin-total-raw','cont-total-raw','admin-propios',
  'admin-comunes','admin-total','cont-propios','cont-comunes','cont-total',
  'total-comunes','total-global','total-ahorro','admin-progress-text',
  'admin-progress-credits','admin-progress-total','cont-progress-text',
  'cont-progress-credits','cont-progress-total','admin-completed-count',
  'admin-completed-credits','admin-completed-percent','admin-homologated-count',
  'admin-homologated-credits','admin-homologated-percent','cont-completed-count',
  'cont-completed-credits','cont-completed-percent','cont-homologated-count',
  'cont-homologated-credits','cont-homologated-percent'
].forEach(id => {
  UI[id] = document.getElementById(id);
});

const setText = (id, val) => { if (UI[id]) UI[id].textContent = String(val); };

/* ===========================
   Creación de UI (semestres/columnas)
   =========================== */

function createSemesterHeader(num) {
  const header = document.createElement('div');
  header.classList.add('semester-header');
  header.textContent = `Semestre ${toRoman(num)}`;
  return header;
}

function createColumn(program, semester, subjects = [], storeMap) {
  const col = document.createElement('div');
  col.classList.add('column', program);

  subjects.forEach(sub => {
    const card = document.createElement('div');
    card.classList.add('subject-card', 'card');

    const text = sub.source
      ? `${sub.nombre} | ${sub.creditos} Créditos <sup>${sub.source}</sup>`
      : `${sub.nombre} | ${sub.creditos} Créditos`;

    card.innerHTML = `<span class="subject-text">${text}</span><span class="lock hidden">🔒</span>`;

    card.dataset.program = program === 'common' ? 'comunes' : program;
    card.dataset.nombre = sub.nombre;
    card.dataset.creditos = Number(sub.creditos || 0);
    card.dataset.semester = String(semester);
    card.dataset.homologada = 'false';
    card.dataset.completed = 'false';
    card.dataset.electiva = sub.electiva ? 'true' : 'false';

    // Códigos: principal + aliases (para prerrequisitos cruzados)
    const codes = Array.isArray(sub.codes) ? sub.codes.slice() : [];
    if (sub.code && !codes.includes(sub.code)) codes.unshift(sub.code);
    card.dataset.code = codes[0] || '';
    card.dataset.codes = JSON.stringify(codes);

    // Prerrequisitos: JSON array (códigos). Si viene null/string, normalizar a []
    const pre = sub['pre-requisite'];
    const preArr = Array.isArray(pre) ? pre : (pre ? [pre] : []);
    card.dataset.prereq = JSON.stringify(preArr);

    if (storeMap) storeMap[sub.nombre] = card;

    // Registrar todos los códigos que apuntan a esta tarjeta (para resolver locks)
    codes.forEach(code => {
      if (!code) return;
      if (!codeMap.has(code)) codeMap.set(code, []);
      codeMap.get(code).push(card);
    });

    col.appendChild(card);
  });

  const totalEl = document.createElement('div');
  totalEl.classList.add('total-card');
  totalEl.dataset.program = program === 'common' ? 'comunes' : program;
  totalEl.dataset.semester = String(semester);
  totalEl.textContent = 'Total: 0';
  col.appendChild(totalEl);

  return {col, totalEl};
}

/* ===========================
   Modal
   =========================== */

function openModal(card) {
  selectedCard = card;
  const modal = UI['subject-modal'];
  setText('modal-title', selectedCard.dataset.nombre);
  setText('modal-info', '');

  // Mostrar/ocultar botón de prerrequisitos según lista
  let list = [];
  try { list = JSON.parse(selectedCard.dataset.prereq || '[]'); } catch(e) { list = []; }
  const prereqBtn = UI['btn-prereq'];
  if (prereqBtn) prereqBtn.classList.toggle('hidden', !list.length);

  const homBtn = UI['btn-homologada'];
  if (homBtn) homBtn.textContent = selectedCard.dataset.homologada === 'true'
    ? 'Quitar homologada'
    : 'Marcar como homologada';

  const compBtn = UI['btn-completada'];
  if (compBtn) compBtn.textContent = selectedCard.dataset.completed === 'true'
    ? 'Quitar completada'
    : 'Marcar como completada';

  const select = UI['move-semester'];
  if (select) {
    select.innerHTML = '';
    for (let i = 1; i <= maxSemesterGlobal; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = toRoman(i);
      select.appendChild(opt);
    }
    select.value = selectedCard.dataset.semester;
  }
  if (modal) modal.classList.remove('hidden');
}

function closeModal() {
  const modal = UI['subject-modal'];
  if (modal) modal.classList.add('hidden');
}

function setupModal() {
  const modal = UI['subject-modal'];
  const info = UI['modal-info'];

  if (UI['btn-prereq']) {
    UI['btn-prereq'].addEventListener('click', () => {
      let list = [];
      try { list = JSON.parse(selectedCard.dataset.prereq || '[]'); } catch(e) { list = []; }
      if (!list.length) {
        if (info) info.textContent = 'Esta materia no tiene prerrequisito.';
        return;
      }
      const partes = list.map(code => {
        const cards = codeMap.get(code) || [];
        const names = [...new Set(cards.map(c => c.dataset.nombre))];
        return `${code}${names.length ? ` (${names.join(' / ')})` : ''}`;
      });
      if (info) info.textContent = `Prerrequisito(s): ${partes.join(', ')}`;
    });
  }

  if (UI['btn-homologada']) {
    UI['btn-homologada'].addEventListener('click', () => {
      const val = selectedCard.dataset.homologada === 'true';
      selectedCard.dataset.homologada = val ? 'false' : 'true';
      if (!val) {
        selectedCard.dataset.completed = 'false';
        selectedCard.classList.remove('completada');
      }
      selectedCard.classList.toggle('homologada', !val);
      closeModal();
      updateTotals();
      updateLocks();
    });
  }

  if (UI['btn-completada']) {
    UI['btn-completada'].addEventListener('click', () => {
      const val = selectedCard.dataset.completed === 'true';
      selectedCard.dataset.completed = val ? 'false' : 'true';
      if (!val) {
        selectedCard.dataset.homologada = 'false';
        selectedCard.classList.remove('homologada');
      }
      selectedCard.classList.toggle('completada', !val);
      closeModal();
      updateTotals();
      updateLocks();
    });
  }

  if (UI['btn-move-semester']) {
    UI['btn-move-semester'].addEventListener('click', () => {
      const select = UI['move-semester'];
      if (!select) return;
      const target = select.value;
      if (!semesterColumns[target]) { closeModal(); return; }
      if (target === selectedCard.dataset.semester) { closeModal(); return; }
      const prog = selectedCard.dataset.program;
      const col = semesterColumns[target][prog];
      const total = col.querySelector('.total-card');
      col.insertBefore(selectedCard, total);
      selectedCard.dataset.semester = String(target);
      closeModal();
      updateTotals();
    });
  }

  if (modal) {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  }
}

/* ===========================
   Locks (prerrequisitos)
   =========================== */

function updateLocks() {
  document.querySelectorAll('.subject-card').forEach(card => {
    const lock = card.querySelector('.lock');
    if (!lock) return;

    let prereqList = [];
    try { prereqList = JSON.parse(card.dataset.prereq || '[]'); } catch(e) { prereqList = []; }

    if (!prereqList.length) { lock.classList.add('hidden'); return; }

    // Considera satisfecho si TODOS los prerequisitos están cumplidos
    const satisfied = prereqList.every(code => {
      const targets = codeMap.get(code);
      if (!targets || !targets.length) return true; // tolerante: si no se encuentra el código, no bloquea
      return targets.some(c => c.dataset.homologada === 'true' || c.dataset.completed === 'true');
    });

    lock.classList.toggle('hidden', satisfied);
  });
}

/* ===========================
   Carga y fusión de mallas
   =========================== */

async function cargarMaterias() {
  const container = document.querySelector('.grid-container');
  try {
    const [adminRaw, contRaw] = await Promise.all([
      fetch(ADMIN_FILE).then(r => r.json()),
      fetch(CONT_FILE).then(r => r.json())
    ]);

    const commons = {};
    const adminFiltered = {};
    const contFiltered = {};

    const adminByKey = {};
    const contByKey = {};
    adminRawTotal = 0;
    contRawTotal = 0;

    // Acumular totales y agrupar por key canónica
    for (const [sem, list] of Object.entries(adminRaw)) {
      list.forEach(sub => {
        adminRawTotal += Number(sub.creditos || 0);
        const key = canonicalKey(sub.nombre);
        const prev = adminByKey[key];
        if (!prev || Number(sub.creditos||0) > Number(prev.creditos||0)) {
          adminByKey[key] = { ...sub, semester: Number(sem) };
        }
      });
    }
    for (const [sem, list] of Object.entries(contRaw)) {
      list.forEach(sub => {
        contRawTotal += Number(sub.creditos || 0);
        const key = canonicalKey(sub.nombre);
        const prev = contByKey[key];
        if (!prev || Number(sub.creditos||0) > Number(prev.creditos||0)) {
          contByKey[key] = { ...sub, semester: Number(sem) };
        }
      });
    }

    const removeAdmin = {};
    const removeCont = {};

    for (const key in adminByKey) {
      if (!contByKey[key]) continue;

      // No marcar Electivas como comunes automáticamente
      if (/^electiva\b/.test(key)) continue;

      const a = adminByKey[key];
      const c = contByKey[key];
      const aCred = Number(a.creditos||0), cCred = Number(c.creditos||0);

      // Empate: elige semestre más temprano; sino mayor crédito
      const chosen = (aCred === cCred)
        ? (a.semester <= c.semester ? a : c)
        : (aCred > cCred ? a : c);

      // Tarjeta común con códigos equivalentes (para prerrequisitos cruzados)
      const allCodes = [a.code, c.code].filter(Boolean);
      const chosenProg = (chosen === a) ? 'Administración' : 'Contabilidad';
      if (!commons[chosen.semester]) commons[chosen.semester] = [];
      commons[chosen.semester].push({
        nombre: chosen.nombre,
        creditos: Number(chosen.creditos || 0),
        electiva: !!chosen.electiva,
        code: chosen.code,
        codes: allCodes,
        "pre-requisite": chosen["pre-requisite"] ?? null,
        source: (aCred === cCred) ? null : chosenProg
      });

      // marcar para eliminar por nombre literal en listas originales
      removeAdmin[a.semester] = removeAdmin[a.semester] || new Set();
      removeAdmin[a.semester].add(a.nombre);
      removeCont[c.semester]  = removeCont[c.semester]  || new Set();
      removeCont[c.semester].add(c.nombre);
    }

    // Filtrar fuera las comunes
    for (const [sem, list] of Object.entries(adminRaw)) {
      const rm = removeAdmin[sem];
      adminFiltered[sem] = rm ? list.filter(s => !rm.has(s.nombre)) : list.slice();
    }
    for (const [sem, list] of Object.entries(contRaw)) {
      const rm = removeCont[sem];
      contFiltered[sem] = rm ? list.filter(s => !rm.has(s.nombre)) : list.slice();
    }

    // Totales de programa (para progreso)
    adminProgramTotal = adminRawTotal;
    contProgramTotal = contRawTotal;
    if (UI['progress-admin']) UI['progress-admin'].max = adminProgramTotal;
    if (UI['progress-cont'])  UI['progress-cont'].max  = contProgramTotal;

    const maxSemester = Math.max(
      ...Object.keys(adminFiltered).map(Number),
      ...Object.keys(contFiltered).map(Number),
      ...Object.keys(commons).map(Number)
    );
    maxSemesterGlobal = maxSemester;

    for (let i = 1; i <= maxSemester; i++) {
      const header = createSemesterHeader(i);
      container.appendChild(header);

      const row = document.createElement('div');
      row.classList.add('row');

      const adminMap = {};
      const contaMap = {};

      const adminCol  = createColumn('admin', i, adminFiltered[i] || [], adminMap);
      const commonCol = createColumn('common', i, commons[i] || []);
      const contaCol  = createColumn('contabilidad', i, contFiltered[i] || [], contaMap);

      row.appendChild(adminCol.col);
      row.appendChild(commonCol.col);
      row.appendChild(contaCol.col);

      container.appendChild(row);

      semesterTotalsEls[i] = {
        header,
        admin: adminCol.totalEl,
        comunes: commonCol.totalEl,
        contabilidad: contaCol.totalEl
      };
      semesterColumns[i] = {
        admin: adminCol.col,
        comunes: commonCol.col,
        contabilidad: contaCol.col
      };
    }

    updateTotals();
    updateLocks();
  } catch (e) {
    const error = document.createElement('p');
    error.classList.add('error');
    error.textContent = 'No se pudieron cargar las materias. ' +
      'Asegúrate de abrir el sitio desde un servidor local y que los JSON existan.';
    const container = document.querySelector('.grid-container');
    if (container) container.appendChild(error);
    console.error(e);
  }
}

/* ===========================
   Totales y progreso
   =========================== */

function updateTotals() {
  const totals = {};
  for (const sem in semesterTotalsEls) {
    totals[sem] = { admin: 0, contabilidad: 0, comunes: 0 };
  }
  const global = {admin:0, contabilidad:0, comunes:0};

  let adminCompCred = 0, adminHomCred = 0, adminCompCount = 0, adminHomCount = 0;
  let contCompCred = 0, contHomCred = 0, contCompCount = 0, contHomCount = 0;

  document.querySelectorAll('.subject-card').forEach(card => {
    const sem = card.dataset.semester;
    const prog = card.dataset.program;
    const cred = Number(card.dataset.creditos || 0);
    const isComp = card.dataset.completed === 'true';
    const isHom = card.dataset.homologada === 'true';

    if (!isComp && !isHom) {
      totals[sem][prog] += cred;
      global[prog] += cred;
    } else {
      // Comunes cuentan para ambos avances
      if (prog === 'admin' || prog === 'comunes') {
        if (isComp) { adminCompCred += cred; adminCompCount++; }
        if (isHom) { adminHomCred += cred; adminHomCount++; }
      }
      if (prog === 'contabilidad' || prog === 'comunes') {
        if (isComp) { contCompCred += cred; contCompCount++; }
        if (isHom) { contHomCred += cred; contHomCount++; }
      }
    }
  });

  for (const sem in semesterTotalsEls) {
    const t = totals[sem] || {admin: 0, contabilidad: 0, comunes: 0};
    const totalSem = t.admin + t.contabilidad + t.comunes;
    semesterTotalsEls[sem].admin.textContent = `Total: ${t.admin}`;
    semesterTotalsEls[sem].contabilidad.textContent = `Total: ${t.contabilidad}`;
    semesterTotalsEls[sem].comunes.textContent = `Total: ${t.comunes}`;
    semesterTotalsEls[sem].header.textContent = `Semestre ${toRoman(Number(sem))}: ${totalSem} créditos`;
  }

  const adminTotal = global.admin + global.comunes;
  const contTotal = global.contabilidad + global.comunes;
  const globalTotal = global.admin + global.contabilidad + global.comunes;
  const ahorro = adminRawTotal + contRawTotal - globalTotal;

  setText('admin-total-raw', adminRawTotal);
  setText('cont-total-raw', contRawTotal);

  setText('admin-propios', global.admin);
  setText('admin-comunes', global.comunes);
  setText('admin-total', adminTotal);

  setText('cont-propios', global.contabilidad);
  setText('cont-comunes', global.comunes);
  setText('cont-total', contTotal);

  setText('total-comunes', global.comunes);
  setText('total-global', globalTotal);
  setText('total-ahorro', ahorro);

  const progAdminTotal = adminCompCred + adminHomCred;
  const progContTotal  = contCompCred  + contHomCred;
  const adminPerc = adminProgramTotal ? (progAdminTotal / adminProgramTotal * 100) : 0;
  const contPerc  = contProgramTotal  ? (progContTotal  / contProgramTotal  * 100) : 0;

  if (UI['progress-admin']) UI['progress-admin'].value = progAdminTotal;
  if (UI['progress-cont'])  UI['progress-cont'].value  = progContTotal;

  setText('admin-progress-text', adminPerc.toFixed(1));
  setText('admin-progress-credits', progAdminTotal);
  setText('admin-progress-total', adminProgramTotal);

  setText('cont-progress-text', contPerc.toFixed(1));
  setText('cont-progress-credits', progContTotal);
  setText('cont-progress-total', contProgramTotal);

  setText('admin-completed-count', adminCompCount);
  setText('admin-completed-credits', adminCompCred);
  setText('admin-completed-percent', adminProgramTotal ? (adminCompCred / adminProgramTotal * 100).toFixed(1) : 0);
  setText('admin-homologated-count', adminHomCount);
  setText('admin-homologated-credits', adminHomCred);
  setText('admin-homologated-percent', adminProgramTotal ? (adminHomCred / adminProgramTotal * 100).toFixed(1) : 0);

  setText('cont-completed-count', contCompCount);
  setText('cont-completed-credits', contCompCred);
  setText('cont-completed-percent', contProgramTotal ? (contCompCred / contProgramTotal * 100).toFixed(1) : 0);
  setText('cont-homologated-count', contHomCount);
  setText('cont-homologated-credits', contHomCred);
  setText('cont-homologated-percent', contProgramTotal ? (contHomCred / contProgramTotal * 100).toFixed(1) : 0);
}

/* ===========================
   Eventos
   =========================== */

function setupCardEvents() {
  const grid = document.querySelector('.grid-container');
  if (!grid) return;
  grid.addEventListener('click', e => {
    const card = e.target.closest('.subject-card');
    if (card) openModal(card);
  });
}

function setupFilter() {
  const radios = document.querySelectorAll('input[name="filter"]');
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      const filterValue = document.querySelector('input[name="filter"]:checked').value;
      const allCards = document.querySelectorAll('.subject-card');
      allCards.forEach(card => {
        const isElectiva = card.dataset.electiva === 'true';
        if (filterValue === 'all') {
          card.style.display = 'block';
        } else if (filterValue === 'electivas') {
          card.style.display = isElectiva ? 'block' : 'none';
        } else if (filterValue === 'obligatorias') {
          card.style.display = isElectiva ? 'none' : 'block';
        }
      });
    });
  });
}

/* ===========================
   Inicio
   =========================== */

document.addEventListener('DOMContentLoaded', async () => {
  await cargarMaterias();
  setupModal();
  setupCardEvents();
  setupFilter();
});
