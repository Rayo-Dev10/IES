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

function groupBySemester(data) {
  return data.reduce((acc, item) => {
    const sem = item.semestre;
    acc[sem] = acc[sem] || [];
    acc[sem].push(item);
    return acc;
  }, {});
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
  const [admin, comunes, contabilidad] = await Promise.all([
    fetch('administracion.json').then(r => r.json()),
    fetch('comunes.json').then(r => r.json()),
    fetch('contaduria.json').then(r => r.json())
  ]);

  const adminBy = groupBySemester(admin);
  const comunesBy = groupBySemester(comunes);
  const contBy = groupBySemester(contabilidad);

  const maxSemester = Math.max(
    ...Object.keys(adminBy).map(Number),
    ...Object.keys(comunesBy).map(Number),
    ...Object.keys(contBy).map(Number)
  );

  const container = document.getElementById('rows-container');

  for (let i = 1; i <= maxSemester; i++) {
    const row = document.createElement('div');
    row.classList.add('row');

    row.appendChild(createColumn('admin', i, adminBy[i]));
    row.appendChild(createColumn('common', i, comunesBy[i]));
    row.appendChild(createColumn('contabilidad', i, contBy[i]));

    container.appendChild(row);
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
