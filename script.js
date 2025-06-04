document.addEventListener('DOMContentLoaded', () => {
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
});
