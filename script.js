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

const duplicatesMap = {}; // {"sem-name": {type, adminCard, contCard, adminCredits, contCredits}}
const semesterTotalsEls = {}; // {semester: {admin, cont, common, total}}

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
    card.textContent = `${sub.nombre} | ${sub.creditos} Créditos`;
    card.dataset.program = program === 'common' ? 'comunes' : program;
    card.dataset.nombre = sub.nombre;
    card.dataset.creditos = sub.creditos;
    card.dataset.semester = semester;
    card.dataset.homologada = 'false';
    if (storeMap) {
      storeMap[sub.nombre] = card;
    }
    card.addEventListener('mouseenter', handleHover);
    card.addEventListener('click', toggleHomologada);
    col.appendChild(card);
  });

  return col;
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
    const [admin, comunes, contabilidad] = await Promise.all([
      fetch('administracion.json').then(r => r.json()),
      fetch('comunes.json').then(r => r.json()),
      fetch('contaduria.json').then(r => r.json())
    ]);

    const maxSemester = Math.max(
      ...Object.keys(admin).map(Number),
      ...Object.keys(comunes).map(Number),
      ...Object.keys(contabilidad).map(Number)
    );

    for (let i = 1; i <= maxSemester; i++) {
      const header = createSemesterHeader(i);
      container.appendChild(header);

      const row = document.createElement('div');
      row.classList.add('row');

      const adminMap = {};
      const contaMap = {};

      row.appendChild(createColumn('admin', i, admin[i] || [], adminMap));
      row.appendChild(createColumn('common', i, comunes[i] || []));
      row.appendChild(createColumn('contabilidad', i, contabilidad[i] || [], contaMap));

      container.appendChild(row);

      // analizar duplicados para este semestre
      for (const name in adminMap) {
        if (contaMap[name]) {
          const cardA = adminMap[name];
          const cardC = contaMap[name];
          const creditA = Number(cardA.dataset.creditos);
          const creditC = Number(cardC.dataset.creditos);
          const type = creditA === creditC ? 'exact' : 'name';
          cardA.classList.add(type === 'exact' ? 'duplicate-exact' : 'duplicate-name');
          cardC.classList.add(type === 'exact' ? 'duplicate-exact' : 'duplicate-name');
          cardA.dataset.duplicate = type;
          cardC.dataset.duplicate = type;
          cardA.dataset.pairId = `${i}-${name}`;
          cardC.dataset.pairId = `${i}-${name}`;
          duplicatesMap[`${i}-${name}`] = {
            type,
            semester: i,
            adminCard: cardA,
            contCard: cardC,
            adminCredits: creditA,
            contCredits: creditC
          };
        }
      }

      // footer para créditos por semestre
      const footer = document.createElement('div');
      footer.classList.add('semester-credits');
      footer.innerHTML =
        `<span id="s${i}-admin">0</span>`+
        `<span id="s${i}-comunes">0</span>`+
        `<span id="s${i}-conta">0</span>`+
        `<span id="s${i}-total">0</span>`;
      semesterTotalsEls[i] = {
        admin: footer.querySelector(`#s${i}-admin`),
        comunes: footer.querySelector(`#s${i}-comunes`),
        contabilidad: footer.querySelector(`#s${i}-conta`),
        total: footer.querySelector(`#s${i}-total`)
      };
      container.appendChild(footer);
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
  const global = {admin:0, contabilidad:0, comunes:0, duplicateAdjust:0};
  document.querySelectorAll('.subject-card').forEach(card => {
    if(card.dataset.homologada === 'true') return;
    const sem = card.dataset.semester;
    if(!totals[sem]) totals[sem] = {admin:0, contabilidad:0, comunes:0, duplicateAdjust:0};
    const prog = card.dataset.program;
    const cred = Number(card.dataset.creditos);
    totals[sem][prog] += cred;
    global[prog] += cred;
  });

  for (const key in duplicatesMap) {
    const info = duplicatesMap[key];
    const aHom = info.adminCard.dataset.homologada === 'true';
    const cHom = info.contCard.dataset.homologada === 'true';
    if (aHom || cHom) continue;
    const adjust = Math.min(info.adminCredits, info.contCredits);
    totals[info.semester].duplicateAdjust += adjust;
    global.duplicateAdjust += adjust;
  }

  for(const sem in totals){
    const t = totals[sem];
    const totalSem = t.admin + t.contabilidad + t.comunes - t.duplicateAdjust;
    if(semesterTotalsEls[sem]){
      semesterTotalsEls[sem].admin.textContent = `Adm: ${t.admin}`;
      semesterTotalsEls[sem].comunes.textContent = `Com: ${t.comunes}`;
      semesterTotalsEls[sem].contabilidad.textContent = `Cont: ${t.contabilidad}`;
      semesterTotalsEls[sem].total.textContent = `Total: ${totalSem}`;
    }
  }

  const globalTotal = global.admin + global.contabilidad + global.comunes - global.duplicateAdjust;
  document.getElementById('total-admin').textContent = global.admin;
  document.getElementById('total-comunes').textContent = global.comunes;
  document.getElementById('total-contabilidad').textContent = global.contabilidad;
  document.getElementById('total-global').textContent = globalTotal;
}

function setupFilter() {
  const radios = document.querySelectorAll('input[name="filter"]');
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      const filterValue = document.querySelector('input[name="filter"]:checked').value;
      const allCards = document.querySelectorAll('.subject-card');
      allCards.forEach(card => {
        const subjectText = card.textContent.trim().toLowerCase();
        if (filterValue === 'all') {
          card.style.display = 'block';
        } else if (filterValue === 'electivas') {
          card.style.display = subjectText.includes('electiva') ? 'block' : 'none';
        } else if (filterValue === 'obligatorias') {
          card.style.display = subjectText.includes('electiva') ? 'none' : 'block';
        }
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await cargarMaterias();
  setupFilter();
});
