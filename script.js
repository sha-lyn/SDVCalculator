// script.js

// Helper: check if an artisan product value is valid
function isValidArtisanValue(val) {
    return typeof val === 'number' && val >0;
}

// Global data 
let cropsData = [];
let probabilityData = [];

// track whether distribution UI is active
let state = {
  farmingLevel: 1,
  season: 'spring',
  hasTiller: false,
  hasArtisan: false,
  distributionVisible: false,    // ← NEW
  cropRows: [ { id:1, cropName:'', seedCount:0, cropsSold:0, jarred:0, kegged:0, aged:0 } ]
};

// Fetch JSON and kick things off
async function loadData() {
    try {
        const [cropsRes, probRes] = await Promise.all([
            fetch('SDVCrops.json'),
            fetch('SDVProb.json')
        ]);
        cropsData = await cropsRes.json();
        probabilityData = await probRes.json();
        console.log('Data loaded successfully');
        initializeCalculator();
    } catch (err) {
        console.error('Error loading data:', err);
        const disclaimer = document.querySelector('#disclaimer');
        if (disclaimer) disclaimer.innerHTML = '<b>Error:</b> Could not load crop data.';
    }
}

// Wire up events and initial renders
function initializeCalculator() {
    setupEventListeners();
    updateSeasonCrops();
    updateProbabilityDisplay();
    renderCropRows();
}

// Attach all top-level listeners (runs once)
function setupEventListeners() {
    // Farming level slider
    const lvl = document.getElementById('lvl');
    const lvlOutput = lvl?.nextElementSibling;
    lvl?.addEventListener('input', e => {
        state.farmingLevel = parseInt(e.target.value);
        if (lvlOutput) lvlOutput.textContent = state.farmingLevel;
        updateProbabilityDisplay();
        recalculateAllRows();
    });

    // Season radios
    document.querySelectorAll('input[name="season"]').forEach(radio => {
        radio.addEventListener('change', e => {
            state.season = e.target.value;
            updateSeasonCrops();
            clearCropSelections();
            renderCropRows();
        });
    });

    // Professions
    document.getElementById('tiller')?.addEventListener('change', e => {
        state.hasTiller = e.target.checked;
        recalculateAllRows();
    });
    document.querySelector('input[name="artisan"]')?.addEventListener('change', e => {
        state.hasArtisan = e.target.checked;
        recalculateAllRows();
    });

    // Form submit (final calculate)
    document.getElementById('crop-form')?.addEventListener('submit', e => {
        e.preventDefault();
        calculateAndDisplayResults();
    });

    // Reset
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
    document.querySelector('input[name="artisan"]').checked = false;
    document.getElementById('show-distribution').style.display = 'inline-block';
    document.getElementById('final-calculate').disabled = true;
    updateProbabilityDisplay();
    updateSeasonCrops();
    renderCropRows();
}

document.querySelector('button[type="reset"]').addEventListener('click', resetForm);
    
    
    // Distribute button
    document.getElementById('show-distribution')?.addEventListener('click', handleDistribution);

    // Add-crop button
    document.getElementById('add-crop-button')?.addEventListener('click', addCropRow);
}

// Display quality probabilities
function updateProbabilityDisplay() {
    const current = probabilityData.find(p => p['Farming level'] === state.farmingLevel);
    const lvl = document.getElementById('lvl');
    document.querySelectorAll('.probability-display').forEach(d => d.remove());

    if (current && lvl) {
        const div = document.createElement('div');
        div.className = 'probability-display';
        div.style.marginTop = '10px';
        div.style.fontSize = '14px';
        div.innerHTML = `
            <strong>Crop Quality Chances:</strong>
            Base: ${current.Base}, Silver: ${current.Silver}, Gold: ${current.Gold}
        `;
        lvl.parentElement.appendChild(div);
    }
}

// Helpers for season mapping
function getSeasonName() {
    const map = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };
    return map[state.season];
}
function getSeasonCrops() {
    return cropsData.filter(c => c.Season === getSeasonName());
}

// Update each crop dropdown
function updateSeasonCrops() {
    const seasonList = getSeasonCrops();
    document.querySelectorAll('.crop-select').forEach(drop => {
        const prev = drop.value;
        drop.innerHTML = '<option value="">— pick a crop —</option>';
        seasonList.forEach(crop => {
            const opt = document.createElement('option');
            opt.value = crop.Crop;
            opt.textContent = crop.Crop;
            drop.appendChild(opt);
        });
        if (seasonList.some(c => c.Crop === prev)) drop.value = prev;
    });
    updateAddButtonState();
}

// Clears out all selections in state
function clearCropSelections() {
    state.cropRows.forEach(r => {
        r.cropName = '';
        r.seedCount = 0;
        r.cropsSold = 0;
        r.jarred = 0;
        r.kegged = 0;
        r.aged = 0;
    });
}

// Renders each row in the DOM or hides extras
function renderCropRows() {
    const container = document.querySelector('.crop-container');
    container.innerHTML = '';

    const seasonCropNames = getSeasonCrops().map(c => c.Crop);
    const chosen = state.cropRows.map(r => r.cropName).filter(Boolean);

    state.cropRows.forEach((r, i) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'crop-row';
        rowEl.innerHTML = `
            <select class="crop-select">
                <option value="">— pick a crop —</option>
                ${seasonCropNames.map(name => `
                    <option value="${name}" ${r.cropName === name ? 'selected' : ''}>${name}</option>
                `).join('')}
            </select>
            <input type="number" class="seed-count" min="0" value="${r.seedCount}" />
        `;
        container.appendChild(rowEl);

        setupRowEventListeners(rowEl, i);
        updateCalculationSection(rowEl, i);
    });

    // Re-enable Add button if we haven't added all seasonal crops
    const addButton = document.createElement('button');
    addButton.id = 'add-crop-button';
    addButton.textContent = 'Add Another Crop';

    const max = seasonCropNames.length;
    if (chosen.length < max) {
        addButton.addEventListener('click', () => {
            state.cropRows.push({
                id: state.cropRows.length + 1,
                cropName: '',
                seedCount: 0,
                cropsSold: 0,
                jarred: 0,
                kegged: 0,
                aged: 0
            });
            renderCropRows();
        });
        container.appendChild(addButton);
    }
}

// Enable/disable the “Add another crop” button
function updateAddButtonState() {
    const addButton = document.getElementById('add-crop-button');
    if (!addButton) return;

    const cropRowElements = document.querySelectorAll('.crop-row');
    const seasonalLimit = getSeasonCrops().length;
    const chosen = state.cropRows.map(r => r.cropName).filter(Boolean);
    const noMoreRows = chosen.length >= seasonalLimit;


    addButton.style.display = noMoreRows ? 'none' : 'inline-block';
}

// Appends a fresh row in state & re-renders
function addCropRow() {
    const limit = getSeasonCrops().length;
    const chosen = state.cropRows.map(r => r.cropName).filter(v => v);
    const maxRows = document.querySelectorAll('.crop-row').length;
    if (chosen.length >= limit) return;


    state.cropRows.push({
        id: state.cropRows.length + 1,
        cropName: '',
        seedCount: 0,
        cropsSold: 0,
        jarred: 0,
        kegged: 0,
        aged: 0
    });
    renderCropRows();
}

// Listen for crop & seed changes on a row
function setupRowEventListeners(rowEl, idx) {
    const sel = rowEl.querySelector('.crop-select');
    const inp = rowEl.querySelector('.seed-count');

    sel.addEventListener('change', e => {
        state.cropRows[idx] = {
            ...state.cropRows[idx],
            cropName: e.target.value,
            seedCount: 0,
            cropsSold: 0,
            jarred: 0,
            kegged: 0,
            aged: 0
        };
        inp.value = '';
        updateCalculationSection(rowEl, idx);
    });

    inp.addEventListener('input', e => {
        const v = Math.max(0, parseInt(e.target.value) || 0);
        state.cropRows[idx].seedCount = v;
        updateCalculationSection(rowEl, idx);
    });
}

// Injects the “distribution” UI for a row
function updateCalculationSection(rowEl, idx) {
    const old = rowEl.parentElement.querySelector('.calculation-section');
    if (old) old.remove();
    if (!state.distributionVisible) return;

    const r = state.cropRows[idx];
    if (!r.cropName || r.seedCount <= 0) return;

    const crop = cropsData.find(c => c.Crop === r.cropName && c.Season === getSeasonName());
    if (!crop) return;

    // Determine total crops this season
    const totalOut = crop.Type === 'Multi' && typeof crop.PerSzn === 'number'
        ? r.seedCount * crop.PerSzn
        : r.seedCount

    // Build the UI block
    let html = `
        <div class="calculation-section active">
            <div class="crop-output">
                <strong>Total Crops Available: ${totalOut}</strong>
                ${crop.Type === 'Multi' ? ` 
                    <div class="crop-note">
                    (This crop produces multiple harvests per seed throughout the season.)
                    </div>` :''}
            </div>
            <h4 class="form-legend" style="font-size:18px; margin-bottom:15px;">
                Distribute Your Crops
            </h4>
            <div class="calc-row">
                <span class="calc-label">Crops Sold:</span>
                <input type="number" 
                       class="calc-input crops-sold" 
                       min="0" 
                       max="${totalOut}" 
                       value="${r.cropsSold || ''}">
            </div>`;

    // Only show Jar option if valid
    if (isValidArtisanValue(crop.Jar)) {
        html += `
            <div class="calc-row">
                <span class="calc-label">Jarred:</span>
                <input type="number" 
                       class="calc-input jarred" 
                       min="0" 
                       max="${totalOut}" 
                       value="${r.jarred || ''}">
            </div>`;
    }

    // Kegged replaces Wine/Juice
    if (isValidArtisanValue(crop.Keg)) {
        html += `
            <div class="calc-row">
                <span class="calc-label">Kegged:</span>
                <input type="number" 
                       class="calc-input kegged" 
                       min="0" 
                       max="${totalOut}" 
                       value="${r.kegged || ''}">
            </div>`;
    }

    // Aged wine
    if (isValidArtisanValue(crop.Aged)) {
        html += `
            <div class="calc-row">
                <span class="calc-label">Aged Wine:</span>
                <input type="number" 
                       class="calc-input aged" 
                       min="0" 
                       max="${totalOut}" 
                       value="${r.aged || ''}">
            </div>`;
    }

    html += `
            <div class="row-summary" 
                 style="margin-top:15px; padding:10px; background-color:var(--color-content-background); border-radius:5px;">
                <strong class="row-profit">Calculating...</strong>
            </div>
        </div>`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    rowEl.parentElement.appendChild(wrapper.firstElementChild);
}

// Computes profit per row and updates the summary
function calculateRowProfit(idx) {
    const rowEl = document.querySelectorAll('.crop-row')[idx];
    const profitEl = rowEl.parentElement.querySelector('.row-profit');
    const r = state.cropRows[idx];
    if (!profitEl || !r.cropName) return;

    const crop = cropsData.find(c => c.Crop === r.cropName && c.Season === getSeasonName());
    if (!crop) return;

    // Seed cost
    const seedCost = r.seedCount * crop.Seed;

    // Expected price per crop
    const prob = probabilityData.find(p => p['Farming level'] === state.farmingLevel);
    const baseP = parseFloat(prob.Base) / 100;
    const silverP = parseFloat(prob.Silver) / 100;
    const goldP = parseFloat(prob.Gold) / 100;

    const basePrice   = state.hasTiller ? crop['Tiller Base']   : crop.Base;
    const silverPrice = state.hasTiller ? crop['Tiller Silver'] : crop.Silver;
    const goldPrice   = state.hasTiller ? crop['Tiller Gold']   : crop.Gold;

    const expPrice = basePrice * baseP + silverPrice * silverP + goldPrice * goldP;

    // Revenues
    const soldRev   = r.cropsSold * expPrice;
    const jarRev    = isValidArtisanValue(crop.Jar) ? r.jarred   * (state.hasArtisan ? crop['Artisan Jar'] : crop.Jar)    : 0;
    const kegRev    = isValidArtisanValue(crop.Keg) ? r.kegged   * (state.hasArtisan ? crop['Artisan Keg'] : crop.Keg)    : 0;
    const agedRev   = isValidArtisanValue(crop.Aged) ? r.aged     * (state.hasArtisan ? crop['Artisan Aged'] : crop.Aged)  : 0;

    const totalRev  = soldRev + jarRev + kegRev + agedRev;
    const profit    = totalRev - seedCost;

    profitEl.innerHTML = `<strong>Row Profit: ${Math.round(profit)}g (Revenue: ${Math.round(totalRev)}g - Seeds: ${seedCost}g)</strong>`;
}

// Recalculate every row at once
function recalculateAllRows() {
    state.cropRows.forEach((_, i) => calculateRowProfit(i));
}

// Handles the “Distribute Crops” button
    
function handleDistribution() {
    state.distributionVisible = true;

    const panel = document.querySelector('.distribution-panel');
    panel.innerHTML = `
        <div class="distribution-wrapper" style="border: 2px solid var(--color-body-text); padding: 20px; border-radius: var(--border-radius-main); margin-top: 2em;">
            <h1>Distribute Your Crops</h1>
        </div>
    `;

    const wrapper = panel.querySelector('.distribution-wrapper');

    state.cropRows.forEach((r, idx) => {
        if (!r.cropName || r.seedCount <= 0) return;

        const crop = cropsData.find(c => c.Crop === r.cropName && c.Season === getSeasonName());
        if (!crop) return;

        const totalOut = crop.Type === 'Multi' && typeof crop.PerSzn === 'number'
            ? r.seedCount * crop.PerSzn
            : r.seedCount;

        let html = `
            <div class="crop-distribution" style="margin-bottom: 2em;">
                <h2>${r.cropName}</h2>
                <p><strong>Total Crops Available: ${totalOut}</strong></p>
                <div>
                    <label>Crops Sold: <input type="number" class="crops-sold" data-idx="${idx}" min="0" max="${totalOut}" value="${r.cropsSold || ''}" /></label>
                </div>`;

        if (isValidArtisanValue(crop.Jar)) {
            html += `
                <div>
                    <label>Jarred: <input type="number" class="jarred" data-idx="${idx}" min="0" max="${totalOut}" value="${r.jarred || ''}" /></label>
                </div>`;
        }

        if (isValidArtisanValue(crop.Keg)) {
            html += `
                <div>
                    <label>Kegged: <input type="number" class="kegged" data-idx="${idx}" min="0" max="${totalOut}" value="${r.kegged || ''}" /></label>
                </div>`;
        }

        if (isValidArtisanValue(crop.Aged)) {
            html += `
                <div>
                    <label>Aged Wine: <input type="number" class="aged" data-idx="${idx}" min="0" max="${totalOut}" value="${r.aged || ''}" /></label>
                </div>`;
        }

        html += `</div>`;
        wrapper.innerHTML += html;
    });

    // Add input listeners
    wrapper.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', e => {
            const idx = parseInt(e.target.dataset.idx);
            const cls = e.target.className;
            const val = Math.max(0, parseInt(e.target.value) || 0);
            state.cropRows[idx][cls] = val;
            calculateRowProfit(idx);
        });
    });

    document.getElementById('final-calculate').disabled = false;
    document.getElementById('show-distribution').style.display = 'none';
}

// Final results table
function calculateAndDisplayResults() {
    const valid = state.cropRows.filter(r => r.cropName && r.seedCount > 0);
    if (valid.length === 0) {
        alert('Please select at least one crop with a seed count.');
        return;
    }

    let totRev = 0, totCost = 0, totProfit = 0;
    let html = `
        <h2>Calculation Results</h2>
        <h3>Individual Crop Results:</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
            <thead>
                <tr>
                    <th style="border:1px solid var(--color-body-text); padding:8px; text-align:left;">Crop</th>
                    <th style="border:1px solid var(--color-body-text); padding:8px; text-align:left;">Seeds</th>
                    <th style="border:1px solid var(--color-body-text); padding:8px; text-align:left;">Crop Revenue</th>
                    <th style="border:1px solid var(--color-body-text); padding:8px; text-align:left;">Seed Cost</th>
                    <th style="border:1px solid var(--color-body-text); padding:8px; text-align:left;">Profit</th>
                </tr>
            </thead>
            <tbody>`;

    valid.forEach(r => {
        const c = cropsData.find(x => x.Crop === r.cropName && x.Season === getSeasonName());
        const prob = probabilityData.find(p => p['Farming level'] === state.farmingLevel);
        if (!c || !prob) return;

        const seedCost = r.seedCount * c.Seed;
        const baseP  = parseFloat(prob.Base)/100;
        const silverP= parseFloat(prob.Silver)/100;
        const goldP  = parseFloat(prob.Gold)/100;

        const basePr   = state.hasTiller ? c['Tiller Base']   : c.Base;
        const silverPr = state.hasTiller ? c['Tiller Silver'] : c.Silver;
        const goldPr   = state.hasTiller ? c['Tiller Gold']   : c.Gold;

        const expPr = basePr * baseP + silverPr * silverP + goldPr * goldP;

        const soldRev = r.cropsSold * expPr;
        const jarRev  = isValidArtisanValue(c.Jar) ? r.jarred * (state.hasArtisan ? c['Artisan Jar'] : c.Jar) : 0;
        const kegRev  = isValidArtisanValue(c.Keg) ? r.kegged * (state.hasArtisan ? c['Artisan Keg'] : c.Keg) : 0;
        const agedRev = isValidArtisanValue(c.Aged) ? r.aged * (state.hasArtisan ? c['Artisan Aged'] : c.Aged) : 0;

        const rowRev = soldRev + jarRev + kegRev + agedRev;
        const rowProfit = rowRev - seedCost;

        totRev    += rowRev;
        totCost   += seedCost;
        totProfit += rowProfit;

        html += `
            <tr>
                <td style="border:1px solid var(--color-body-text); padding:8px;">
                    <strong>${r.cropName}</strong>
                </td>
                <td style="border:1px solid var(--color-body-text); padding:8px;">
                    ${r.seedCount}
                </td>
                <td style="border:1px solid var(--color-body-text); padding:8px;">
                    ${Math.round(rowRev)}g
                </td>
                <td style="border:1px solid var(--color-body-text); padding:8px;">
                    ${seedCost}g
                </td>
                <td style="border:1px solid var(--color-body-text); padding:8px; color:${rowProfit>0?'var(--color-link)':'#ff4444'};">
                    ${Math.round(rowProfit)}g
                </td>
            </tr>`;
    });

    html += `
            </tbody>
        </table>
        <div style="margin-top:20px; padding:15px; background-color:var(--color-title); color:var(--color-content-background); border-radius:8px;">
            <h4 style="color:var(--color-content-background);">TOTAL SUMMARY</h4>
            <p><strong>Total Revenue: ${Math.round(totRev)}g</strong></p>
            <p><strong>Total Seed Cost: ${Math.round(totCost)}g</strong></p>
            <p><strong>NET PROFIT: ${Math.round(totProfit)}g</strong></p>
        </div>`;

    let resultDiv = document.querySelector('.result-section');
    if (!resultDiv) {
        resultDiv = document.createElement('div');
        resultDiv.className = 'result-section';
        document.querySelector('.container').appendChild(resultDiv);
    }
    resultDiv.innerHTML = html;
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

// Restore initial state
function resetForm() {
    state = {
        farmingLevel: 1,
        season: 'spring',
        hasTiller: false,
        hasArtisan: false,
        cropRows: [{ id:1, cropName:'', seedCount:0, cropsSold:0, jarred:0, kegged:0, aged:0 }]
    };

    // Reset controls
    const lvl = document.getElementById('lvl');
    if (lvl) { lvl.value = 1; lvl.nextElementSibling.textContent = '1'; }
    document.getElementById('spring').checked = true;
    document.getElementById('tiller').checked = false;
    document.querySelector('input[name="artisan"]').checked = false;

    // Clear dynamic UI
    document.querySelectorAll('.crop-select').forEach(s => s.value = '');
    document.querySelectorAll('.seed-count').forEach(i => i.value = '');
    document.querySelectorAll('.calculation-section').forEach(d => d.remove());
    document.querySelector('.result-section')?.remove();

    updateProbabilityDisplay();
    updateSeasonCrops();
    renderCropRows();
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing calculator…');
    loadData().then(() => {
        renderCropRows();
    });
});
