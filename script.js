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

  const collapseBtn = document.getElementById('collapseBtn');
  const resetBtn = document.getElementById('resetFilters');
  const sidebar = document.getElementById('sidebar');
  const collapseIcon = document.getElementById('collapseIcon');

  collapseBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const collapsed = sidebar.classList.contains('collapsed');
    collapseIcon.innerHTML = collapsed
      ? `<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>`
      : `<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>`;
  });

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

function onCheckboxChange(e) {
  const cb = e.target;
  const key = cb.dataset.key;
  const val = cb.dataset.val;
  const panel = document.getElementById(key + 'Panel');
  if (!panel) return;

  if (val === 'all' && cb.checked) {
    panel.querySelectorAll('input[type=checkbox]').forEach(i => { if (i.dataset.val !== 'all') i.checked = false; });
    selection[key] = 'all';
  } else if (val === 'all' && !cb.checked) {
    selection[key] = 'all';
    cb.checked = true;
  } else {
    const allCb = panel.querySelector('input[data-val="all"]');
    if (allCb) allCb.checked = false;
    const chosen = Array.from(panel.querySelectorAll('input[type=checkbox]'))
      .filter(i => i.checked && i.dataset.val !== 'all')
      .map(i => i.dataset.val);
    selection[key] = (chosen.length === 0) ? 'all' : chosen;
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

function compactFormat(n){
  if (isNaN(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n/1_000_000).toFixed(1) + ' M';
  if (abs >= 1_000) return (n/1_000).toFixed(1) + ' K';
  return Math.round(n).toString();
}
function exactFormat(n, decimals=0){
  if (isNaN(n)) return '0';
  if (decimals>0) return n.toLocaleString('es-AR', {minimumFractionDigits:decimals, maximumFractionDigits:decimals});
  return Math.round(n).toLocaleString('es-AR');
}

function setValue(id, value, money=false, options={forceExact:false, decimals:0}) {
  const el = document.getElementById(id);
  if (!el) return;
  if (options.forceExact) { el.textContent = (money ? '$' : '') + exactFormat(value, options.decimals); return; }
  if (showCompact) el.textContent = (money ? '$' : '') + compactFormat(value);
  else el.textContent = (money ? '$' : '') + exactFormat(value, options.decimals);
}
function setDelta(id, current, previous) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!previous || previous === 0) { el.textContent = ''; el.className='text-lg mt-1'; return; }
  const delta = ((current - previous) / previous) * 100;
  const triangle = delta > 0 ? '▲' : delta < 0 ? '▼' : '';
  const color = delta > 0 ? 'text-green-500' : (delta < 0 ? 'text-red-500' : 'text-gray-500');
  el.className = `text-lg mt-1 ${color}`;
  el.textContent = `${triangle} ${Math.abs(delta).toFixed(1)}%`;
}

function getSelectedValuesForFiltering() {
  return { product: selection.product, channel: selection.channel, branch: selection.branch };
}

function updateCards() {
  const sel = getSelectedValuesForFiltering();
  const months = parseInt(document.getElementById('monthsFilter').value) || 12;

  let filtered = salesData.slice();
  if (sel.product !== 'all') filtered = filtered.filter(d => sel.product.includes(d.product_name));
  if (sel.channel !== 'all') filtered = filtered.filter(d => sel.channel.includes(d.channel));
  if (branchFieldName && sel.branch !== 'all') filtered = filtered.filter(d => sel.branch.includes(d[branchFieldName]));

  const dateKeys = Array.from(new Set(filtered.map(d => (d.date||'').slice(0,7)).filter(Boolean))).sort();
  const lastKeys = dateKeys.slice(-months);
  filtered = filtered.filter(d => lastKeys.includes((d.date||'').slice(0,7)));

  const totalRevenue = filtered.reduce((s,d)=>s + (d.revenue || 0), 0);
  const totalUnits = filtered.reduce((s,d)=>s + (d.units || 0), 0);
  const avgPrice = totalUnits ? totalRevenue / totalUnits : 0;

  setValue('salesCard', totalRevenue, true);
  setValue('customersCard', totalUnits, false);
  setValue('ordersCard', avgPrice, true, {forceExact:true, decimals:1});

  const monthsAvailable = Array.from(new Set(filtered.map(d => (d.date||'').slice(0,7)).filter(Boolean))).sort();
  const lastMonth = monthsAvailable[monthsAvailable.length - 1];
  const prevMonth = monthsAvailable[monthsAvailable.length - 2];

  const lastData = filtered.filter(d => (d.date||'').slice(0,7) === lastMonth);
  const prevData = filtered.filter(d => (d.date||'').slice(0,7) === prevMonth);

  const lastRevenue = lastData.reduce((s,d)=>s + (d.revenue||0),0);
  const lastUnits = lastData.reduce((s,d)=>s + (d.units||0),0);
  const lastAvgPrice = lastUnits ? lastRevenue / lastUnits : 0;

  const prevRevenue = prevData.reduce((s,d)=>s + (d.revenue||0),0);
  const prevUnits = prevData.reduce((s,d)=>s + (d.units||0),0);
  const prevAvgPrice = prevUnits ? prevRevenue / prevUnits : 0;

  setValue('lastMonthRevenue', lastRevenue, true);
  setValue('lastMonthUnits', lastUnits, false);
  setValue('lastMonthAvgPrice', lastAvgPrice, true, {forceExact:true, decimals:1});

  setDelta('lastMonthRevenueDelta', lastRevenue, prevRevenue);
  setDelta('lastMonthUnitsDelta', lastUnits, prevUnits);
  setDelta('lastMonthAvgPriceDelta', lastAvgPrice, prevAvgPrice);
}

function updateChart(filteredData) {
  const metric = document.getElementById('metricSelector').value || 'revenue';
  const grouped = {};
  filteredData.forEach(d => {
    const key = (d.date||'').slice(0,7);
    if (!key) return;
    if (!grouped[key]) grouped[key] = 0;
    grouped[key] += (metric === 'revenue' ? (d.revenue||0) : (d.units||0));
  });

  const labels = Object.keys(grouped).sort();
  const values = labels.map(k => grouped[k]);

  let titleText = `Evolución temporal de ${metric === 'revenue' ? 'Revenue' : 'Units'}`;
  if (labels.length >= 1) titleText += ` entre ${labels[0]} y ${labels[labels.length - 1]}`;
  document.getElementById('chartTitle').textContent = titleText;

  if (chart) chart.destroy();
  const ctx = document.getElementById('salesChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: '', data: values, borderColor: 'rgba(59,130,246,1)', backgroundColor: 'rgba(59,130,246,0.12)', fill: true, tension: 0.3, pointRadius: 3 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { display: true }, y: { display: true } } }
  });
}

function updateDashboard() {
  const sel = getSelectedValuesForFiltering();
  const months = parseInt(document.getElementById('monthsFilter').value) || 12;

  let filtered = salesData.slice();
  if (sel.product !== 'all') filtered = filtered.filter(d => sel.product.includes(d.product_name));
  if (sel.channel !== 'all') filtered = filtered.filter(d => sel.channel.includes(d.channel));
  if (branchFieldName && sel.branch !== 'all') filtered = filtered.filter(d => sel.branch.includes(d[branchFieldName]));

  const dateKeys = Array.from(new Set(filtered.map(d => (d.date||'').slice(0,7)).filter(Boolean))).sort();
  const lastKeys = dateKeys.slice(-months);
  filtered = filtered.filter(d => lastKeys.includes((d.date||'').slice(0,7)));

  updateCards();
  updateChart(filtered);
}

/* bootstrap */
loadCSV();
