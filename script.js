document.addEventListener('DOMContentLoaded', () => {
    const filterSelect = document.getElementById('filter-select');
    
    filterSelect.addEventListener('change', () => {
      const filterValue = filterSelect.value;
      const allCards = document.querySelectorAll('.subject-card');
      
      allCards.forEach(card => {
        const subjectText = card.textContent.trim();
        
        if (filterValue === 'all') {
          card.style.display = 'block';
        } else if (filterValue === 'electivas') {
          card.style.display = subjectText.includes('Electiva') ? 'block' : 'none';
        } else if (filterValue === 'whitout-electivas') {
          card.style.display = subjectText.includes('Electiva') ? 'none' : 'block';
        }
      });
    });
  });
  