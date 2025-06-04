function toRoman(num) {
  const romanMap = {
    M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1
  };
  let result = '';
  for (const key in romanMap) {
    while (num >= romanMap[key]) {
      result += key;
      num -= romanMap[key];
    }
  }
  return result;
}


function createColumn(type, semester, subjects = []) {
  const col = document.createElement('div');
  col.classList.add('column', type);

  const title = document.createElement('h3');
  title.classList.add('semestre');
  title.textContent = `Semestre ${toRoman(semester)}`;
  col.appendChild(title);

  subjects.forEach(sub => {
    const card = document.createElement('div');
    card.classList.add('subject-card', 'card');
    card.textContent = `${sub.nombre} | ${sub.creditos} Créditos`;
    col.appendChild(card);
  });

  return col;
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
      const row = document.createElement('div');
      row.classList.add('row');

      row.appendChild(createColumn('admin', i, admin[i]));
      row.appendChild(createColumn('common', i, comunes[i]));
      row.appendChild(createColumn('contabilidad', i, contabilidad[i]));

      container.appendChild(row);
    }
  } catch (e) {
    const error = document.createElement('p');
    error.classList.add('error');
    error.textContent = 'No se pudieron cargar las materias. ' +
      'Asegúrate de abrir el sitio desde un servidor local.';
    container.appendChild(error);
    console.error(e);
  }
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
