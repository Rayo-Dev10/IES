// Utilidades
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

const semesterTotalsEls = {}; // {semester: {header, admin, contabilidad, comunes}}
let adminRawTotal = 0;
let contRawTotal = 0;
let adminProgramTotal = 0;
let contProgramTotal = 0;
const codeMap = new Map();
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

const setText = (id, val) => { UI[id].textContent = val; };

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
    const text = sub.source ? `${sub.nombre} | ${sub.creditos} Créditos <sup>${sub.source}</sup>` : `${sub.nombre} | ${sub.creditos} Créditos`;
    card.innerHTML = `<span class="subject-text">${text}</span><span class="lock hidden">🔒</span>`;
    if (sub.electiva) card.classList.add('electiva');
    card.dataset.program = program === 'common' ? 'comunes' : program;
    card.dataset.nombre = sub.nombre;
    card.dataset.creditos = sub.creditos;
    card.dataset.semester = semester;
    card.dataset.homologada = 'false';
    card.dataset.code = sub.code || '';
    const prereqValue = sub["pre-requisite"];
    card.dataset.prereq =
      prereqValue === undefined || prereqValue === null ? 'null' : prereqValue;
    card.dataset.completed = 'false';
    card.dataset.electiva = sub.electiva ? 'true' : 'false';
    if (storeMap) {
      storeMap[sub.nombre] = card;
    }
    if (sub.code) {
      if (!codeMap.has(sub.code)) codeMap.set(sub.code, []);
      codeMap.get(sub.code).push(card);
    }
    col.appendChild(card);
  });

  const totalEl = document.createElement('div');
  totalEl.classList.add('total-card');
  totalEl.dataset.program = program === 'common' ? 'comunes' : program;
  totalEl.dataset.semester = semester;
  totalEl.textContent = 'Total: 0';
  col.appendChild(totalEl);

  return {col, totalEl};
}

function openModal(card) {
  selectedCard = card;
  const modal = UI['subject-modal'];
  setText('modal-title', selectedCard.dataset.nombre);
  setText('modal-info', '');
  const prereqBtn = UI['btn-prereq'];
  if (selectedCard.dataset.prereq === 'null') {
    prereqBtn.classList.add('hidden');
  } else {
    prereqBtn.classList.remove('hidden');
  }
  const homBtn = UI['btn-homologada'];
  homBtn.textContent = selectedCard.dataset.homologada === 'true'
    ? 'Quitar homologada'
    : 'Marcar como homologada';
  const compBtn = UI['btn-completada'];
  compBtn.textContent = selectedCard.dataset.completed === 'true'
    ? 'Quitar completada'
    : 'Marcar como completada';
  const select = UI['move-semester'];
  select.innerHTML = '';
  for (let i = 1; i <= maxSemesterGlobal; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = toRoman(i);
    select.appendChild(opt);
  }
  select.value = selectedCard.dataset.semester;
  modal.classList.remove('hidden');
}

function updateLocks() {
  document.querySelectorAll('.subject-card').forEach(card => {
    const lock = card.querySelector('.lock');
    const prereq = card.dataset.prereq;
    if (prereq === 'null') {
      lock.classList.add('hidden');
      return;
    }
    const prereqCards = codeMap.get(prereq);
    if (!prereqCards) {
      lock.classList.add('hidden');
      return;
    }
    const satisfied = prereqCards.some(c => c.dataset.homologada === 'true' || c.dataset.completed === 'true');
    lock.classList.toggle('hidden', satisfied);
  });
}

function closeModal() {
  UI['subject-modal'].classList.add('hidden');
}

function setupModal() {
  const modal = UI['subject-modal'];
  const info = UI['modal-info'];
  UI['btn-prereq'].addEventListener('click', () => {
    const code = selectedCard.dataset.prereq;
    if (code === 'null') {
      info.textContent = 'Esta materia no tiene pre requisito';
    } else if (!codeMap.has(code)) {
      info.textContent = 'pre requisito desocnocido, el código de pre requisito establecido no corresponde a ninguna materia del plan de estudios';
    } else {
      const names = [...new Set(codeMap.get(code).map(c => c.dataset.nombre))].join(', ');
      info.textContent = `Prerrequisito: ${code} (${names})`;
    }
  });
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
  UI['btn-move-semester'].addEventListener('click', () => {
    const target = UI['move-semester'].value;
    if (!semesterColumns[target]) return;
    if (target === selectedCard.dataset.semester) { closeModal(); return; }
    const prog = selectedCard.dataset.program;
    const col = semesterColumns[target][prog];
    const total = col.querySelector('.total-card');
    col.insertBefore(selectedCard, total);
    selectedCard.dataset.semester = target;
    closeModal();
    updateTotals();
  });
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}
async function cargarMaterias() {
  const container = document.querySelector('.grid-container');

  try {
    const [adminRaw, contRaw] = await Promise.all([
      fetch('administracion.json').then(r => r.json()),
      fetch('contaduria.json').then(r => r.json())
    ]);

    const commons = {};
    const adminFiltered = {};
    const contFiltered = {};

    const adminByName = {};
    const contByName = {};
    adminRawTotal = 0;
    contRawTotal = 0;

    for (const [sem, list] of Object.entries(adminRaw)) {
      list.forEach(sub => {
        adminRawTotal += Number(sub.creditos);
        adminByName[sub.nombre] = { ...sub, semester: Number(sem) };
      });
    }
    for (const [sem, list] of Object.entries(contRaw)) {
      list.forEach(sub => {
        contRawTotal += Number(sub.creditos);
        contByName[sub.nombre] = { ...sub, semester: Number(sem) };
      });
    }

    const removeAdmin = {};
    const removeCont = {};

    for (const name in adminByName) {
      if (contByName[name]) {
        const a = adminByName[name];
        const c = contByName[name];
        const useAdmin = a.creditos >= c.creditos;
        const chosen = useAdmin ? a : c;
        const prog = useAdmin ? 'Administración' : 'Contabilidad';
        if (!commons[chosen.semester]) commons[chosen.semester] = [];
        commons[chosen.semester].push({
          nombre: name,
          creditos: chosen.creditos,
          electiva: chosen.electiva,
          code: chosen.code,
          "pre-requisite": chosen["pre-requisite"] ?? null,
          source: a.creditos === c.creditos ? null : prog
        });
        removeAdmin[a.semester] = removeAdmin[a.semester] || new Set();
        removeAdmin[a.semester].add(name);
        removeCont[c.semester] = removeCont[c.semester] || new Set();
        removeCont[c.semester].add(name);
      }
    }

    for (const [sem, list] of Object.entries(adminRaw)) {
      const rm = removeAdmin[sem];
      adminFiltered[sem] = rm ? list.filter(s => !rm.has(s.nombre)) : list.slice();
    }
    for (const [sem, list] of Object.entries(contRaw)) {
      const rm = removeCont[sem];
      contFiltered[sem] = rm ? list.filter(s => !rm.has(s.nombre)) : list.slice();
    }

    // Use the global totals from each program for progress calculations
    adminProgramTotal = adminRawTotal;
    contProgramTotal = contRawTotal;
    UI['progress-admin'].max = adminProgramTotal;
    UI['progress-cont'].max = contProgramTotal;

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

      const adminCol = createColumn('admin', i, adminFiltered[i] || [], adminMap);
      const commonCol = createColumn('common', i, commons[i] || []);
      const contaCol = createColumn('contabilidad', i, contFiltered[i] || [], contaMap);

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
      'Asegúrate de abrir el sitio desde un servidor local.';
    container.appendChild(error);
    console.error(e);
  }
}

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
    const cred = Number(card.dataset.creditos);
    const isComp = card.dataset.completed === 'true';
    const isHom = card.dataset.homologada === 'true';
    if (!isComp && !isHom) {
      totals[sem][prog] += cred;
      global[prog] += cred;
    } else {
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
  const progContTotal = contCompCred + contHomCred;
  const adminPerc = adminProgramTotal ? (progAdminTotal / adminProgramTotal * 100) : 0;
  const contPerc = contProgramTotal ? (progContTotal / contProgramTotal * 100) : 0;

  UI['progress-admin'].value = progAdminTotal;
  UI['progress-cont'].value = progContTotal;
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

function setupCardEvents() {
  document.querySelector('.grid-container').addEventListener('click', e => {
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

document.addEventListener('DOMContentLoaded', async () => {
  await cargarMaterias();
  setupModal();
  setupCardEvents();
  setupFilter();
});
