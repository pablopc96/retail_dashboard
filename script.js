/* script.js - filtros con dropdowns de checkboxes + mejoras visuales */
let salesData = [];
let chart = null;
let showCompact = true;
let branchFieldName = null;

// selection state (arrays or 'all')
const selection = {
  product: 'all',
  channel: 'all',
  branch: 'all'
};

async function loadCSV() {
  try {
    const res = await fetch('data/ventas.csv');
    if (!res.ok) throw new Error('No se pudo cargar data/ventas.csv');
    const text = await res.text();
    parseCSV(text);
    populateFilters();
    updateDashboard();
    attachGlobalClicks();
  } catch (e) {
    console.error(e);
    alert('Error cargando el CSV. Revisa consola.');
  }
}

/* ---------- parse CSV ---------- */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n').filter(Boolean);
  if (lines.length < 1) { salesData = []; return; }
  const headers = lines[0].split(',').map(h => h.trim());
  const possibleBranches = ['branch','sucursal','store','store_name','branch_name'];
  branchFieldName = headers.find(h => possibleBranches.includes(h.toLowerCase())) || null;

  salesData = lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h,i)=>{
      const key = h.trim();
      const raw = cols[i] !== undefined ? cols[i].trim() : '';
      if (['units','price','revenue'].includes(key)) {
        obj[key] = parseFloat(raw) || 0;
      } else {
        obj[key] = raw;
      }
    });
    return obj;
  });
}

/* ---------- populate dropdowns as checkbox panels ---------- */
function populateFilters() {
  const productSet = Array.from(new Set(salesData.map(d => d.product_name).filter(Boolean))).sort();
  const channelSet = Array.from(new Set(salesData.map(d => d.channel).filter(Boolean))).sort();
  const branchSet = branchFieldName ? Array.from(new Set(salesData.map(d => d[branchFieldName]).filter(Boolean))).sort() : [];

  const productPanel = document.getElementById('productPanel');
  const channelPanel = document.getElementById('channelPanel');
  const branchPanel = document.getElementById('branchPanel');

  function renderPanel(panelEl, items, key) {
    panelEl.innerHTML = '';
    const allRow = document.createElement('div');
    allRow.className = 'dd-checkbox';
    allRow.innerHTML = `<input type="checkbox" data-val="all" data-key="${key}" id="${key}_all"><label for="${key}_all" class="text-sm">Todos</label>`;
    panelEl.appendChild(allRow);

    items.forEach(it => {
      const id = `${key}_${slug(it)}`;
      const row = document.createElement('div');
      row.className = 'dd-checkbox';
      row.innerHTML = `<input type="checkbox" data-val="${escapeHtml(it)}" data-key="${key}" id="${id}"><label for="${id}" class="text-sm">${escapeHtml(it)}</label>`;
      panelEl.appendChild(row);
    });

    panelEl.querySelectorAll('input[type=checkbox]').forEach(cb=>{
      cb.addEventListener('change', onCheckboxChange);
    });
  }

  renderPanel(productPanel, productSet, 'product');
  renderPanel(channelPanel, channelSet, 'channel');
  renderPanel(branchPanel, branchSet, 'branch');

  setupDropdown('productBtn','productPanel','productBtnLabel');
  setupDropdown('channelBtn','channelPanel','channelBtnLabel');
  setupDropdown('branchBtn','branchPanel','branchBtnLabel');

  document.getElementById('increaseMonths').addEventListener('click', ()=> {
    const el = document.getElementById('monthsFilter');
    el.value = Math.max(1, parseInt(el.value||12) + 1);
    updateDashboard();
  });
  document.getElementById('decreaseMonths').addEventListener('click', ()=> {
    const el = document.getElementById('monthsFilter');
    el.value = Math.max(1, parseInt(el.value||12) - 1);
    updateDashboard();
  });
  document.getElementById('monthsFilter').addEventListener('change', updateDashboard);

  const toggle = document.getElementById('toggleSwitch');
  toggle.addEventListener('click', () => {
    showCompact = !showCompact;
    toggle.classList.toggle('on', showCompact);
    toggle.classList.toggle('off', !showCompact);
    toggle.setAttribute('aria-pressed', String(showCompact));
    updateCards();
  });
  toggle.classList.add('on'); toggle.classList.remove('off');

  // 🔹 Elimino el collapseBtn: sidebar siempre fija
  const resetBtn = document.getElementById('resetFilters');
  resetBtn.addEventListener('click', () => {
    document.getElementById('monthsFilter').value = 12;
    ['product','channel','branch'].forEach(k => {
      const panel = document.getElementById(k + 'Panel');
      if (!panel) return;
      panel.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = (cb.dataset.val === 'all'));
      selection[k] = 'all';
      updateBtnLabel(k);
    });
    showCompact = true;
    const toggleBtn = document.getElementById('toggleSwitch');
    toggleBtn.classList.add('on'); toggleBtn.classList.remove('off');
    updateDashboard();
  });

  document.getElementById('metricSelector').addEventListener('change', updateDashboard);
}

/* ---------- helpers ---------- */
function slug(s) { return String(s).toLowerCase().replace(/\s+/g,'_').replace(/[^\w\-]+/g,''); }
function escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function setupDropdown(buttonId, panelId, labelId) {
  const btn = document.getElementById(buttonId);
  const panel = document.getElementById(panelId);
  const label = document.getElementById(labelId);
  if (!btn || !panel) return;

  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const isHidden = panel.classList.contains('hidden');
    document.querySelectorAll('.dd-panel').forEach(p => { if (p !== panel) p.classList.add('hidden'); });
    if (isHidden) {
      panel.classList.remove('hidden');
      btn.setAttribute('aria-expanded','true');
    } else {
      panel.classList.add('hidden');
      btn.setAttribute('aria-expanded','false');
    }
  });
}

function attachGlobalClicks() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dd-panel') && !e.target.closest('.dd-btn')) {
      document.querySelectorAll('.dd-panel').forEach(p => p.classList.add('hidden'));
    }
  });
}

/* ---------- CHECKBOXES: con manejo de "Todos" ---------- */
function onCheckboxChange(e) {
  const cb = e.target;
  const key = cb.dataset.key;
  const val = cb.dataset.val;
  const panel = document.getElementById(key + 'Panel');
  if (!panel) return;

  if (val === 'all') {
    // Si clickeo "Todos"
    panel.querySelectorAll('input[type=checkbox]').forEach(i => i.checked = cb.checked);
    selection[key] = cb.checked ? 'all' : 'all'; // siempre vuelve a 'all'
  } else {
    const items = Array.from(panel.querySelectorAll('input[type=checkbox]')).filter(i => i.dataset.val !== 'all');
    const chosen = items.filter(i => i.checked).map(i => i.dataset.val);
    selection[key] = chosen.length === 0 ? 'all' : chosen;

    // Actualizo "Todos" según corresponda
    const allCb = panel.querySelector('input[data-val="all"]');
    if (allCb) allCb.checked = (chosen.length === items.length);
  }

  updateBtnLabel(key);
  updateDashboard();
}

function updateBtnLabel(key) {
  const label = document.getElementById(key + 'BtnLabel');
  const sel = selection[key];
  if (!label) return;
  if (sel === 'all') { label.textContent = 'Todos'; }
  else if (Array.isArray(sel)) { label.textContent = sel.length===1? sel[0]:`${sel.length} seleccionados`; }
  else { label.textContent = 'Todos'; }
}

/* ... el resto del código (compactFormat, updateCards, updateChart, updateDashboard) queda igual ... */

/* bootstrap */
loadCSV();
