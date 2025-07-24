// Stardew Valley Crop Calculator - Complete Implementation
// Global variables
let cropsData = [];
let probabilityData = [];

// Application state
let state = {
    farmingLevel: 1,
    season: 'spring',
    hasTiller: false,
    hasArtisan: false,
    distributionVisible: false,
    cropRows: [{ 
        id: 1, 
        cropName: '', 
        seedCount: 0, 
        cropsSold: 0, 
        jarred: 0, 
        kegged: 0, 
        aged: 0 
    }]
};

// Helper function to check if artisan value is valid
function isValidArtisanValue(val) {
    return typeof val === 'number' && val > 0;
}

// Format currency values
function formatCurrency(value) {
    return `${Math.floor(value).toLocaleString()}g`;
}


/**
 * Renders the "Distribute Your X" inputs into the #distribute-container
 * @param {string} cropName — the name of the crop to distribute
 */
function renderDistributeUI(cropName) {
  const container = document.getElementById('distribute-container');
  if (!container) return;

  // If there's no cropName (e.g. at startup), clear it
  if (!cropName) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="distribute-popup">
      <h4>Distribute your ${cropName} among...</h4>
      <label>
        North Field:
        <input type="number" id="northDist" min="0" value="0">
      </label>
      <label>
        South Field:
        <input type="number" id="southDist" min="0" value="0">
      </label>
      <!-- add more zones as needed -->
    </div>
  `;
}


// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

// Load JSON data files
async function loadData() {
    try {
        showLoading();
        const [cropsRes, probRes] = await Promise.all([
            fetch('SDVCrops.json'),
            fetch('SDVProb.json')
        ]);
        
        if (!cropsRes.ok || !probRes.ok) {
            throw new Error('Failed to load data files');
        }
        
        cropsData = await cropsRes.json();
        probabilityData = await probRes.json();
        
        console.log('Data loaded successfully');
        hideLoading();
        initializeCalculator();
    } catch (err) {
        console.error('Error loading data:', err);
        showError('Could not load crop data. Please refresh the page and try again.');
    }
}

// Show loading state
function showLoading() {
    const disclaimer = document.querySelector('#disclaimer');
    if (disclaimer) {
        disclaimer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading crop data...';
        disclaimer.className = 'disclaimer loading';
    }
}

// Hide loading state
function hideLoading() {
    const disclaimer = document.querySelector('#disclaimer');
    if (disclaimer) {
        disclaimer.innerHTML = '<strong>Disclaimer:</strong> This calculator provides estimates based on Stardew Valley\'s 1.6 update game data. Actual results may vary depending on various in-game factors.';
        disclaimer.className = 'disclaimer';
    }
}

// Show error message
function showError(message) {
    const disclaimer = document.querySelector('#disclaimer');
    if (disclaimer) {
        disclaimer.innerHTML = `<strong>Error:</strong> ${message}`;
        disclaimer.className = 'disclaimer error-message';
    }
}

// Initialize calculator after data is loaded
function initializeCalculator() {
    setupEventListeners();
    updateSeasonCrops();
    updateProbabilityDisplay();
    renderCropRows();
    updateCalculateButtonState();
}

// Set up all event listeners
function setupEventListeners() {
    // Farming level slider
    const lvl = document.getElementById('lvl');
    const lvlOutput = lvl?.nextElementSibling;
    
    lvl?.addEventListener('input', function(e) {
        state.farmingLevel = parseInt(e.target.value);
        if (lvlOutput) lvlOutput.textContent = state.farmingLevel;
        updateProbabilityDisplay();
        recalculateAllRows();
    });

    // Season radio buttons
    document.querySelectorAll('input[name="season"]').forEach(radio => {
        radio.addEventListener('change', function(e) {
            state.season = e.target.value;
            updateSeasonCrops();
            clearCropSelections();
            renderCropRows();
            updateCalculateButtonState();
        });
    });

    // Profession checkboxes
    document.getElementById('tiller')?.addEventListener('change', function(e) {
        state.hasTiller = e.target.checked;
        recalculateAllRows();
    });
    
    document.getElementById('artisan')?.addEventListener('change', function(e) {
        state.hasArtisan = e.target.checked;
        recalculateAllRows();
    });

    // Form submission
    document.getElementById('crop-form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        calculateAndDisplayResults();
    });

    // Reset button
    document.querySelector('button[type="reset"]')?.addEventListener('click', function() {
        resetForm();
    });

    // Distribution button
    document.getElementById('show-distribution')?.addEventListener('click', function() {
        handleDistribution();
    });
}

// Update probability display based on farming level
function updateProbabilityDisplay() {
    const current = probabilityData.find(p => p['Farming level'] === state.farmingLevel);
    const container = document.querySelector('.probability-display-container');
    
    // Remove existing display
    const existing = container?.querySelector('.probability-display');
    if (existing) existing.remove();

    if (current && container) {
        const div = document.createElement('div');
        div.className = 'probability-display';
        div.innerHTML = `
            <strong>Crop Quality Chances at Level ${state.farmingLevel}:</strong><br>
            <i class="fas fa-circle" style="color: #8B4513;"></i> Base Quality: ${current.Base} |
            <i class="fas fa-circle" style="color: #C0C0C0;"></i> Silver: ${current.Silver} |
            <i class="fas fa-circle" style="color: #FFD700;"></i> Gold: ${current.Gold}
        `;
        container.appendChild(div);
    }
}

// Helper functions for season management
function getSeasonName() {
    const seasonMap = { 
        spring: 'Spring', 
        summer: 'Summer', 
        fall: 'Fall', 
        winter: 'Winter' 
    };
    return seasonMap[state.season];
}

function getSeasonCrops() {
    return cropsData.filter(crop => crop.Season === getSeasonName());
}

// Update crop dropdowns when season changes
function updateSeasonCrops() {
    const seasonCrops = getSeasonCrops();
    const selects = document.querySelectorAll('.crop-select');
    
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">— pick a crop —</option>';
        
        seasonCrops.forEach(crop => {
            const option = document.createElement('option');
            option.value = crop.Crop;
            option.textContent = crop.Crop;
            select.appendChild(option);
        });
        
        // Restore selection if still valid for new season
        if (seasonCrops.some(crop => crop.Crop === currentValue)) {
            select.value = currentValue;
        }
    });
}

// Clear all crop selections
function clearCropSelections() {
    state.cropRows.forEach(row => {
        row.cropName = '';
        row.seedCount = 0;
        row.cropsSold = 0;
        row.jarred = 0;
        row.kegged = 0;
        row.aged = 0;
    });
    state.distributionVisible = false;
}

// Render crop rows in the DOM
function renderCropRows() {
    const container = document.querySelector('.crop-container');
    if (!container) return;

    container.innerHTML = '';
    const seasonCrops = getSeasonCrops();

    state.cropRows.forEach((row, index) => {
        const rowElement = createCropRowElement(row, index, seasonCrops);
        container.appendChild(rowElement);
        
        // Add calculation section if distribution is visible and row has data
        if (state.distributionVisible && row.cropName && row.seedCount > 0) {
            const calcSection = createCalculationSection(row, index);
            container.appendChild(calcSection);
        }
    });

    // Add "Add Crop" button if we haven't reached the limit
    const selectedCrops = state.cropRows.filter(row => row.cropName).length;
    if (selectedCrops < seasonCrops.length) {
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'btn btn-add';
        addButton.innerHTML = '<i class="fas fa-plus"></i> Add Another Crop';
        addButton.addEventListener('click', addCropRow);
        container.appendChild(addButton);

        const distributeContainer = document.createElement('div');
        distributeContainer.id = 'distribute-container';
        container.appendChild(distributeContainer);
    }
}

// Create a single crop row element
function createCropRowElement(row, index, seasonCrops) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'crop-row';
    
    const select = document.createElement('select');
    select.className = 'crop-select';
    select.innerHTML = '<option value="">— pick a crop —</option>';
    
    seasonCrops.forEach(crop => {
        const option = document.createElement('option');
        option.value = crop.Crop;
        option.textContent = crop.Crop;
        if (crop.Crop === row.cropName) option.selected = true;
        select.appendChild(option);
    });
    
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'seed-count';
    input.min = '0';
    input.placeholder = 'Seeds';
    input.value = row.seedCount || '';
    
    // Remove button (only show if there's more than one row)
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'crop-remove';
    removeButton.innerHTML = '<i class="fas fa-trash"></i>';
    removeButton.title = 'Remove this crop';
    
    rowDiv.appendChild(select);
    rowDiv.appendChild(input);
    
    if (state.cropRows.length > 1) {
        rowDiv.appendChild(removeButton);
    }
    
    // Event listeners
    setupRowEventListeners(rowDiv, index);
    
    return rowDiv;
}

// Set up event listeners for a crop row
function setupRowEventListeners(rowElement, index) {
    const select = rowElement.querySelector('.crop-select');
    const input = rowElement.querySelector('.seed-count');
    const removeButton = rowElement.querySelector('.crop-remove');
    
    select.addEventListener('change', function(e) {
        state.cropRows[index].cropName = e.target.value;
        state.cropRows[index].seedCount = 0;
        resetRowDistribution(index);
        input.value = '';
        
        // Re-render to update calculation sections
        if (state.distributionVisible) {
            renderCropRows();
        }
        updateCalculateButtonState();
    });
    
    input.addEventListener('input', function(e) {
        const value = Math.max(0, parseInt(e.target.value) || 0);
        state.cropRows[index].seedCount = value;
        
        // Re-render to update calculation sections
        if (state.distributionVisible) {
            renderCropRows();
        }
        updateCalculateButtonState();
    });
    
    if (removeButton) {
        removeButton.addEventListener('click', function() {
            removeCropRow(index);
        });
    }
}

// Create calculation section for a crop row
function createCalculationSection(row, index) {
    const crop = cropsData.find(c => c.Crop === row.cropName && c.Season === getSeasonName());
    if (!crop) return null;
    
    // Calculate total crops for the season
    const totalCrops = crop.Type === 'Multi' && crop.PerSzn ? 
        row.seedCount * crop.PerSzn : row.seedCount;
    
    const calcSection = document.createElement('div');
    calcSection.className = 'calculation-section active';
    calcSection.dataset.rowIndex = index;
    
    let html = `
        <div class="crop-output">
            <strong>Total ${crop.Crop} Available: ${totalCrops}</strong>
            ${crop.Type === 'Multi' ? `
                <div class="crop-note">
                    This crop produces ${crop.PerSzn} harvests per seed throughout the season.
                </div>
            ` : ''}
        </div>
        <h4 class="form-legend">Distribute Your ${crop.Crop}</h4>
        
        <div class="calc-row">
            <span class="calc-label">Crops Sold:</span>
            <input type="number" class="calc-input crops-sold" min="0" max="${totalCrops}" value="${row.cropsSold}">
        </div>
    `;
    
    // Add artisan options based on available products
    if (isValidArtisanValue(crop.Jar)) {
        html += `
            <div class="calc-row">
                <span class="calc-label">Preserves Jar:</span>
                <input type="number" class="calc-input jarred" min="0" max="${totalCrops}" value="${row.jarred}">
            </div>
        `;
    }
    
    if (isValidArtisanValue(crop.Keg)) {
        html += `
            <div class="calc-row">
                <span class="calc-label">Keg:</span>
                <input type="number" class="calc-input kegged" min="0" max="${totalCrops}" value="${row.kegged}">
            </div>
        `;
    }
    
    if (isValidArtisanValue(crop.Aged)) {
        html += `
            <div class="calc-row">
                <span class="calc-label">Aged Wine:</span>
                <input type="number" class="calc-input aged" min="0" max="${totalCrops}" value="${row.aged}">
            </div>
        `;
    }
    
    calcSection.innerHTML = html;
    
    // Set up event listeners for distribution inputs
    setupDistributionListeners(calcSection, index, totalCrops);
    
    return calcSection;
}

// Set up event listeners for distribution inputs
function setupDistributionListeners(calcSection, index, totalCrops) {
    const inputs = calcSection.querySelectorAll('.calc-input');
    
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            updateRowDistribution(index, calcSection, totalCrops);
        });
    });
}

// Update row distribution values from inputs
function updateRowDistribution(index, calcSection, totalCrops) {
    const row = state.cropRows[index];
    
    row.cropsSold = parseInt(calcSection.querySelector('.crops-sold')?.value) || 0;
    row.jarred = parseInt(calcSection.querySelector('.jarred')?.value) || 0;
    row.kegged = parseInt(calcSection.querySelector('.kegged')?.value) || 0;
    row.aged = parseInt(calcSection.querySelector('.aged')?.value) || 0;
    
    // Validate total doesn't exceed available crops
    const total = row.cropsSold + row.jarred + row.kegged + row.aged;
    if (total > totalCrops) {
        // Auto-adjust by reducing the last modified value
        const lastInput = document.activeElement;
        if (lastInput && lastInput.classList.contains('calc-input')) {
            const excess = total - totalCrops;
            const currentValue = parseInt(lastInput.value) || 0;
            lastInput.value = Math.max(0, currentValue - excess);
            
            // Update state
            if (lastInput.classList.contains('crops-sold')) row.cropsSold = parseInt(lastInput.value);
            else if (lastInput.classList.contains('jarred')) row.jarred = parseInt(lastInput.value);
            else if (lastInput.classList.contains('kegged')) row.kegged = parseInt(lastInput.value);
            else if (lastInput.classList.contains('aged')) row.aged = parseInt(lastInput.value);
        }
    }
}

// Add a new crop row
function addCropRow() {
    const seasonCrops = getSeasonCrops();
    const selectedCrops = state.cropRows.filter(row => row.cropName).length;
    
    if (selectedCrops >= seasonCrops.length) return;
    
    state.cropRows.push({
        id: Date.now(), // Use timestamp as unique ID
        cropName: '',
        seedCount: 0,
        cropsSold: 0,
        jarred: 0,
        kegged: 0,
        aged: 0
    });
    
    renderCropRows();
    updateCalculateButtonState();
}

// Remove a crop row
function removeCropRow(index) {
    if (state.cropRows.length <= 1) return;
    
    state.cropRows.splice(index, 1);
    renderCropRows();
    updateCalculateButtonState();
}

// Reset distribution values for a row
function resetRowDistribution(index) {
    state.cropRows[index].cropsSold = 0;
    state.cropRows[index].jarred = 0;
    state.cropRows[index].kegged = 0;
    state.cropRows[index].aged = 0;
}

// Handle distribution button click
function handleDistribution() {
    if (!validateCropSelections()) {
        alert('Please select at least one crop with a seed count before distributing.');
        return;
    }
    
    state.distributionVisible = true;
    renderCropRows();
    
    // Update button states
    document.getElementById('show-distribution').style.display = 'none';
    document.getElementById('final-calculate').disabled = false;
    
    // Scroll to first calculation section
    setTimeout(() => {
        const firstCalcSection = document.querySelector('.calculation-section');
        if (firstCalcSection) {
            firstCalcSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 100);
}

// Validate that we have valid crop selections
function validateCropSelections() {
    return state.cropRows.some(row => row.cropName && row.seedCount > 0);
}

// Validate final calculation readiness
function validateFinalCalculation() {
    return state.cropRows.every(row => {
        if (!row.cropName || row.seedCount <= 0) return true; // Skip empty rows
        const crop = cropsData.find(c => c.Crop === row.cropName && c.Season === getSeasonName());
        if (!crop) return false;
        
        const totalCrops = crop.Type === 'Multi' && crop.PerSzn ? 
            row.seedCount * crop.PerSzn : row.seedCount;
        const distributed = row.cropsSold + row.jarred + row.kegged + row.aged;
        
        return distributed <= totalCrops;
    });
}

// Calculate profit for a specific row
function calculateRowProfit(row) {
    if (!row.cropName) return 0;
    
    const crop = cropsData.find(c => c.Crop === row.cropName && c.Season === getSeasonName());
    if (!crop) return 0;
    
    // Calculate seed cost
    const seedCost = row.seedCount * (crop.Seed || 0);
    
    // Calculate revenue from each source
    const probabilities = probabilityData.find(p => p['Farming level'] === state.farmingLevel);
    const { Base: baseProb, Silver: silverProb, Gold: goldProb } = probabilities;
    
    // Convert percentages to decimals
    const basePct = parseFloat(baseProb.replace('%', '')) / 100;
    const silverPct = parseFloat(silverProb.replace('%', '')) / 100;
    const goldPct = parseFloat(goldProb.replace('%', '')) / 100;
    
    // Calculate weighted average crop value
    const baseValue = state.hasTiller ? crop['Tiller Base'] : crop.Base;
    const silverValue = state.hasTiller ? crop['Tiller Silver'] : crop.Silver;
    const goldValue = state.hasTiller ? crop['Tiller Gold'] : crop.Gold;
    
    const avgCropValue = (baseValue * basePct) + (silverValue * silverPct) + (goldValue * goldPct);
    
    // Calculate revenue from each distribution method
    let totalRevenue = 0;
    
    // Raw crops sold
    totalRevenue += row.cropsSold * avgCropValue;
    
    // Jarred products
    if (row.jarred > 0 && isValidArtisanValue(crop.Jar)) {
        const jarValue = state.hasArtisan ? crop['Artisan Jar'] : crop.Jar;
        totalRevenue += row.jarred * jarValue;
    }
    
    // Kegged products
    if (row.kegged > 0 && isValidArtisanValue(crop.Keg)) {
        const kegValue = state.hasArtisan ? crop['Artisan Keg'] : crop.Keg;
        totalRevenue += row.kegged * kegValue;
    }
    
    // Aged products
    if (row.aged > 0 && isValidArtisanValue(crop.Aged)) {
        const agedValue = state.hasArtisan ? crop['Artisan Aged'] : crop.Aged;
        totalRevenue += row.aged * agedValue;
    }
    
    // Calculate profit
    const profit = totalRevenue - seedCost;
    
    return profit;
}

// Calculate and display final results
function calculateAndDisplayResults() {
    if (!validateFinalCalculation()) {
        alert('Please ensure all crops have valid distributions before calculating final results.');
        return;
    }
    
    const results = {
        totalProfit: 0,
        totalRevenue: 0,
        totalSeedCost: 0,
        cropBreakdowns: []
    };
    
    state.cropRows.forEach((row, index) => {
        if (!row.cropName || row.seedCount <= 0) return;
        
        const crop = cropsData.find(c => c.Crop === row.cropName && c.Season === getSeasonName());
        if (!crop) return;
        
        const profit = calculateRowProfit(row);
        const seedCost = row.seedCount * (crop.Seed || 0);
        const revenue = profit + seedCost;
        
        results.totalProfit += profit;
        results.totalRevenue += revenue;
        results.totalSeedCost += seedCost;
        
        results.cropBreakdowns.push({
            cropName: row.cropName,
            seedCount: row.seedCount,
            profit: profit,
            revenue: revenue,
            seedCost: seedCost,
            distribution: {
                sold: row.cropsSold,
                jarred: row.jarred,
                kegged: row.kegged,
                aged: row.aged
            }
        });
    });
    
    displayResults(results);
}

// Display final results
function displayResults(results) {
  const resultsSection = document.querySelector('.result-section');
  if (!resultsSection) return;

  // 1) Build your HTML (header, summary, table, and chart wrapper)
  resultsSection.innerHTML = `
    <div class="result-header">
      <h2><i class="fas fa-chart-line"></i> Profit Calculation Results</h2>
    </div>

    <div class="result-summary">
      <div class="summary-item"><strong>Total Profit: ${formatCurrency(results.totalProfit)}</strong></div>
      <div class="summary-item">Seed Cost: ${formatCurrency(results.totalSeedCost)}</div>
      <div class="summary-item">Revenue: ${formatCurrency(results.totalRevenue)}</div>
    </div>

    <div class="result-chart">
      <h3>Crop Breakdown Chart</h3>
      <div class="chart-wrapper">
        <canvas id="resultsChart"></canvas>
      </div>
    </div>

    <div class="result-table">
      <h3>Crop Breakdown Data</h3>
      <div class="table-wrapper">
        <table class="crop-table">
          <thead>
            <tr>
              <th>Crop</th>
              <th>Seed Cost</th>
              <th>Revenue</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            ${results.cropBreakdowns.map(crop => `
              <tr>
                <td>${crop.cropName}</td>
                <td>${formatCurrency(crop.seedCost)}</td>
                <td>${formatCurrency(crop.revenue)}</td>
                <td>${formatCurrency(crop.profit)}</td>
              </tr>
            `).join('')}
            <tr class="subtotal-row">
              <td><strong>Subtotals</strong></td>
              <td><strong>${formatCurrency(results.totalSeedCost)}</strong></td>
              <td><strong>${formatCurrency(results.totalRevenue)}</strong></td>
              <td><strong>${formatCurrency(results.totalProfit)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // 2) Un-hide & scroll
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });

  // 3) Now that the canvas is in the DOM, grab it and init Chart.js
  const ctx = document.getElementById('resultsChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',       // or whatever chart type you need
    data: chartData,   // your existing data object
    options: {
      responsive: true,         // redraws on container resize
      maintainAspectRatio: false, // lets CSS control width/height
      // ...any other Chart.js options you already have...
    }
  });
}


// Recalculate all rows when global settings change
function recalculateAllRows() {
    // This function would update displays if we had live calculation displays
    // For now, it's a placeholder for future enhancements
}

// Update calculate button state
function updateCalculateButtonState() {
    const calculateButton = document.getElementById('final-calculate');
    const distributeButton = document.getElementById('show-distribution');
    
    const hasValidCrops = validateCropSelections();
    
    if (calculateButton) {
        calculateButton.disabled = !state.distributionVisible;
    }
    
    if (distributeButton) {
        distributeButton.style.display = state.distributionVisible ? 'none' : 'inline-flex';
    }
}

// Reset form to initial state
function resetForm() {
    state = {
        farmingLevel: 1,
        season: 'spring',
        hasTiller: false,
        hasArtisan: false,
        distributionVisible: false,
        cropRows: [{ id: 1, cropName: '', seedCount: 0, cropsSold: 0, jarred: 0, kegged: 0, aged: 0 }]
    };
    
    document.getElementById('lvl').value = state.farmingLevel;
    const lvlOutput = document.getElementById('lvl')?.nextElementSibling;
    if (lvlOutput) lvlOutput.textContent = state.farmingLevel;
    
    document.getElementById('spring').checked = true;
    document.getElementById('tiller').checked = false;
    document.getElementById('artisan').checked = false;
    
    document.querySelector('.result-section').innerHTML = '';
    
    updateProbabilityDisplay();
    updateSeasonCrops();
    renderCropRows();
    updateCalculateButtonState();
}