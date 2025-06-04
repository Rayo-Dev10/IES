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
const codeMap = new Map();
let selectedCard = null;

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
    card.dataset.code = sub.code;
    card.dataset.prereq = sub["pre-requisite"];
    card.dataset.completed = 'false';
    card.dataset.electiva = sub.electiva ? 'true' : 'false';
    if (storeMap) {
      storeMap[sub.nombre] = card;
    }
    card.addEventListener('click', openModal);
    if(!codeMap.has(sub.code)) codeMap.set(sub.code, []);
    codeMap.get(sub.code).push(card);
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

function openModal(e) {
  selectedCard = e.currentTarget;
  const modal = document.getElementById('subject-modal');
  document.getElementById('modal-title').textContent = selectedCard.dataset.nombre;
  document.getElementById('modal-info').textContent = '';
  const prereqBtn = document.getElementById('btn-prereq');
  if (!selectedCard.dataset.prereq || selectedCard.dataset.prereq === 'null') {
    prereqBtn.classList.add('hidden');
  } else {
    prereqBtn.classList.remove('hidden');
  }
  const homBtn = document.getElementById('btn-homologada');
  homBtn.textContent = selectedCard.dataset.homologada === 'true'
    ? 'Quitar homologada'
    : 'Marcar como homologada';
  const compBtn = document.getElementById('btn-completada');
  compBtn.textContent = selectedCard.dataset.completed === 'true'
    ? 'Quitar completada'
    : 'Marcar como completada';
  modal.classList.remove('hidden');
}

function updateLocks() {
  document.querySelectorAll('.subject-card').forEach(card => {
    const lock = card.querySelector('.lock');
    const prereq = card.dataset.prereq;
    if (!prereq || prereq === 'null') {
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
  document.getElementById('subject-modal').classList.add('hidden');
}

function setupModal() {
  const modal = document.getElementById('subject-modal');
  const info = document.getElementById('modal-info');
  document.getElementById('btn-prereq').addEventListener('click', () => {
    const code = selectedCard.dataset.prereq;
    if (!code || code === 'null') {
      info.textContent = 'Esta materia no tiene pre requisito';
    } else if (!codeMap.has(code)) {
      info.textContent = 'pre requisito desocnocido, el código de pre requisito establecido no corresponde a ninguna materia del plan de estudios';
    } else {
      const names = [...new Set(codeMap.get(code).map(c => c.dataset.nombre))].join(', ');
      info.textContent = `Prerrequisito: ${code} (${names})`;
    }
  });
  document.getElementById('btn-homologada').addEventListener('click', () => {
    const val = selectedCard.dataset.homologada === 'true';
    selectedCard.dataset.homologada = val ? 'false' : 'true';
    selectedCard.classList.toggle('homologada', !val);
    closeModal();
    updateTotals();
    updateLocks();
  });
  document.getElementById('btn-completada').addEventListener('click', () => {
    const val = selectedCard.dataset.completed === 'true';
    selectedCard.dataset.completed = val ? 'false' : 'true';
    selectedCard.classList.toggle('completada', !val);
    closeModal();
    updateTotals();
    updateLocks();
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
        adminByName[sub.nombre] = {credits: sub.creditos, semester: Number(sem), electiva: sub.electiva};
      });
    }
    for (const [sem, list] of Object.entries(contRaw)) {
      list.forEach(sub => {
        contRawTotal += Number(sub.creditos);
        contByName[sub.nombre] = {credits: sub.creditos, semester: Number(sem), electiva: sub.electiva};
      });
    }

    const removeAdmin = {};
    const removeCont = {};

    for (const name in adminByName) {
      if (contByName[name]) {
        const a = adminByName[name];
        const c = contByName[name];
        const useAdmin = a.credits >= c.credits;
        const chosen = useAdmin ? a : c;
        const prog = useAdmin ? 'Administración' : 'Contabilidad';
        if (!commons[chosen.semester]) commons[chosen.semester] = [];
        commons[chosen.semester].push({nombre: name, creditos: chosen.credits, source: a.credits === c.credits ? null : prog, electiva: chosen.electiva});
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

    const maxSemester = Math.max(
      ...Object.keys(adminFiltered).map(Number),
      ...Object.keys(contFiltered).map(Number),
      ...Object.keys(commons).map(Number)
    );

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
  document.querySelectorAll('.subject-card').forEach(card => {
    if (card.dataset.homologada === 'true' || card.dataset.completed === 'true') return;
    const sem = card.dataset.semester;
    const prog = card.dataset.program;
    const cred = Number(card.dataset.creditos);
    totals[sem][prog] += cred;
    global[prog] += cred;
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
  document.getElementById('admin-total-raw').textContent = adminRawTotal;
  document.getElementById('cont-total-raw').textContent = contRawTotal;

  document.getElementById('admin-propios').textContent = global.admin;
  document.getElementById('admin-comunes').textContent = global.comunes;
  document.getElementById('admin-total').textContent = adminTotal;

  document.getElementById('cont-propios').textContent = global.contabilidad;
  document.getElementById('cont-comunes').textContent = global.comunes;
  document.getElementById('cont-total').textContent = contTotal;

  document.getElementById('total-comunes').textContent = global.comunes;
  document.getElementById('total-global').textContent = globalTotal;
  document.getElementById('total-ahorro').textContent = ahorro;
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
  setupFilter();
});
