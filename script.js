document.addEventListener('DOMContentLoaded', () => {
    
    // Find our new button and the Phase 2 container
    const chooseSeedsBtn = document.getElementById('choose-seeds-btn');
    const phase2Container = document.getElementById('phase2-planting');
    const phase1Controls = document.getElementById('phase1-controls');

    // When the button is clicked...
    chooseSeedsBtn.addEventListener('click', () => {
        // 1. Reveal the Planting Table
        phase2Container.style.display = 'block';
        
        // 2. Hide the "Choose Seeds" button so they don't click it twice
        phase1Controls.style.display = 'none';
        
        // 3. Smoothly scroll the screen down to the new table
        phase2Container.scrollIntoView({ behavior: 'smooth' });
    });

});
