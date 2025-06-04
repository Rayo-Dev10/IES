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
let adminByName = {};
let contByName = {};

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
    if (sub.source) {
      card.innerHTML = `${sub.nombre} | ${sub.creditos} Créditos <sup>${sub.source}</sup>`;
    } else {
      card.textContent = `${sub.nombre} | ${sub.creditos} Créditos`;
    }
    if (sub.electiva) card.classList.add('electiva');
    card.dataset.program = program === 'common' ? 'comunes' : program;
    card.dataset.nombre = sub.nombre;
    card.dataset.creditos = sub.creditos;
    card.dataset.semester = semester;
    card.dataset.homologada = 'false';
    card.dataset.electiva = sub.electiva ? 'true' : 'false';
    if (storeMap) {
      storeMap[sub.nombre] = card;
    }
    card.addEventListener('mouseenter', handleHover);
    card.addEventListener('click', toggleHomologada);
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

function handleHover(e) {
  const card = e.currentTarget;
  const msg = card.dataset.homologada === 'true' ? '¿Quitar homologación?' : '¿Marcar como homologada?';
  card.setAttribute('title', msg);
}

function toggleHomologada(e) {
  const card = e.currentTarget;
  const isHomologada = card.dataset.homologada === 'true';
  card.dataset.homologada = isHomologada ? 'false' : 'true';
  card.classList.toggle('homologada', !isHomologada);
  updateTotals();
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

    adminByName = {};
    contByName = {};
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
  Object.keys(semesterTotalsEls).forEach(sem => {
    totals[sem] = {admin: 0, contabilidad: 0, comunes: 0};
  });

  let adminPropios = 0;
  let adminComunes = 0;
  let contPropios = 0;
  let contComunes = 0;
  let comunesUnion = 0;

  document.querySelectorAll('.subject-card').forEach(card => {
    const name = card.dataset.nombre;
    const sem = card.dataset.semester;
    if (card.dataset.homologada === 'true') return;

    if (card.dataset.program === 'admin') {
      const cred = Number(card.dataset.creditos);
      adminPropios += cred;
      totals[sem].admin += cred;
    } else if (card.dataset.program === 'contabilidad') {
      const cred = Number(card.dataset.creditos);
      contPropios += cred;
      totals[sem].contabilidad += cred;
    } else if (card.dataset.program === 'comunes') {
      const adminCred = adminByName[name] ? Number(adminByName[name].credits) : 0;
      const contCred = contByName[name] ? Number(contByName[name].credits) : 0;
      const unionCred = Number(card.dataset.creditos);
      adminComunes += adminCred;
      contComunes += contCred;
      comunesUnion += unionCred;
      totals[sem].admin += adminCred;
      totals[sem].contabilidad += contCred;
      totals[sem].comunes += unionCred;
    }
  });

  for (const sem in totals) {
    const t = totals[sem];
    const totalSem = t.admin + t.contabilidad + t.comunes;
    if (semesterTotalsEls[sem]) {
      semesterTotalsEls[sem].admin.textContent = `Total: ${t.admin}`;
      semesterTotalsEls[sem].contabilidad.textContent = `Total: ${t.contabilidad}`;
      semesterTotalsEls[sem].comunes.textContent = `Total: ${t.comunes}`;
      semesterTotalsEls[sem].header.textContent = `Semestre ${toRoman(Number(sem))}: ${totalSem} créditos`;
    }
  }

  const adminTotal = adminPropios + adminComunes;
  const contTotal = contPropios + contComunes;
  const globalTotal = adminPropios + contPropios + comunesUnion;
  const ahorro = adminRawTotal + contRawTotal - globalTotal;

  document.getElementById('admin-total-raw').textContent = adminRawTotal;
  document.getElementById('cont-total-raw').textContent = contRawTotal;

  document.getElementById('admin-propios').textContent = adminPropios;
  document.getElementById('admin-comunes').textContent = adminComunes;
  document.getElementById('admin-total').textContent = adminTotal;

  document.getElementById('cont-propios').textContent = contPropios;
  document.getElementById('cont-comunes').textContent = contComunes;
  document.getElementById('cont-total').textContent = contTotal;

  document.getElementById('total-comunes').textContent = comunesUnion;
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
  setupFilter();
});
