document.addEventListener('DOMContentLoaded', () => {
    const filterSelect = document.getElementById('filter-select');
    const allCards = document.querySelectorAll('.subject-card');

    filterSelect.addEventListener('change', () => {
        const filterValue = filterSelect.value;

        allCards.forEach(card => {
            const subjectName = card.textContent.trim();

            if (filterValue === 'all') {
                card.style.display = 'block'; // Mostrar todas
            } else if (filterValue === 'electivas') {
                // Mostrar solo las que contienen "Electiva"
                card.style.display = subjectName.includes('Electiva') ? 'block' : 'none';
            } else if (filterValue === 'whitout-electivas') {
                // Mostrar todas menos las que contienen "Electiva"
                card.style.display = subjectName.includes('Electiva') ? 'none' : 'block';
            }
        });
    });
});
