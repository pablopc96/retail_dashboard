/* script.js - reemplazar completamente por este */
let salesData = [];
let chart = null;
let showCompact = true; // compact on by default
let branchFieldName = null;

async function loadCSV() {
  try {
    const res = await fetch('data/ventas.csv');
    if (!res.ok) throw new Error('No se pudo cargar data/ventas.csv');
    const text = await res.text();
    parseCSV(text);
    populateFilters();
    updateDashboard();
  } catch (e) {
    console.error(e);
    alert('Error cargando el CSV. Revisa consola.');
  }
}

/* parse CSV - minimal, robust */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n').filter(Boolean);
  if (lines.length < 1) { salesData = []; return; }
  const headers = lines[0].split(',').map(h => h.trim());
  // detect branch column names common
  const possibleBranches = ['branch','sucursal','store','store_name','branch_name'];
  branchFieldName = headers.find(h => possibleBranches.includes(h.toLowerCase())) || null;

  salesData = lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
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

/* populate filters: multiselects */
function populateFilters() {
  const productSet = Array.from(new Set(salesData.map(d => d.product_name).filter(Boolean))).sort();
  const channelSet = Array.from(new Set(salesData.map(d => d.channel).filter(Boolean))).sort();
  const branchSet = branchFieldName ? Array.from(new Set(salesData.map(d => d[branchFieldName]).filter(Boolean))).sort() : [];

  const productSel = document.getElementById('productFilter');
  const channelSel = document.getElementById('channelFilter');
  const branchSel = document.getElementById('branchFilter');

  // clear existing (keep the first "all" option)
  // remove all options except the first one (value all)
  [productSel, channelSel, branchSel].forEach(sel => {
    // remove all non-initial options
    for (let i = sel.options.length - 1; i >= 1; i--) sel.remove(i);
  });

  productSet.forEach(p => {
    const opt = document.createElement('option'); opt.value = p; opt.text = p; productSel.add(opt);
  });
  channelSet.forEach(c => {
    const opt = document.createElement('option'); opt.value = c; opt.text = c; channelSel.add(opt);
  });
  branchSet.forEach(b => {
    const opt = document.createElement('option'); opt.value = b; opt.text = b; branchSel.add(opt);
  });

  // event listeners
  productSel.addEventListener('change', updateDashboard);
  channelSel.addEventListener('change', updateDashboard);
  branchSel.addEventListener('change', updateDashboard);

  document.getElementById('increaseMonths').addEventListener('click', () => {
    const el = document.getElementById('monthsFilter');
    el.value = Math.max(1, parseInt(el.value || 12) + 1);
    updateDashboard();
  });
  document.getElementById('decreaseMonths').addEventListener('click', () => {
    const el = document.getElementById('monthsFilter');
    el.value = Math.max(1, parseInt(el.value || 12) - 1);
    updateDashboard();
  });
  document.getElementById('monthsFilter').addEventListener('change', updateDashboard);

  // toggle switch
  const toggle = document.getElementById('toggleSwitch');
  const collapseBtn = document.getElementById('collapseBtn');
  const resetBtn = document.getElementById('resetFilters');

  // switch behaviour: click toggles
  toggle.addEventListener('click', () => {
    showCompact = !showCompact;
    toggle.classList.toggle('on', showCompact);
    toggle.classList.toggle('off', !showCompact);
    toggle.setAttribute('aria-pressed', String(showCompact));
    updateCards(); // only cards need reformat
  });

  // init classes
  toggle.classList.add('on'); toggle.classList.remove('off');

  // reset filters
  resetBtn.addEventListener('click', () => {
    // months
    document.getElementById('monthsFilter').value = 12;
    // selects: keep 'all' selected, deselect others
    ['productFilter', 'channelFilter', 'branchFilter'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      for (let i = 0; i < sel.options.length; i++) {
        sel.options[i].selected = sel.options[i].value === 'all';
      }
    });
    // reset compact on
    showCompact = true;
    toggle.classList.add('on'); toggle.classList.remove('off');
    updateDashboard();
  });

  // collapse sidebar
  const sidebar = document.getElementById('sidebar');
  const collapseIcon = document.getElementById('collapseIcon');
  collapseBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const collapsed = sidebar.classList.contains('collapsed');
    collapseIcon.textContent = collapsed ? '▶' : '◀';
  });

  // metric selector
  document.getElementById('metricSelector').addEventListener('change', updateDashboard);
}

/* formatting helpers */
function compactFormat(n) {
  if (isNaN(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n/1_000_000).toFixed(1) + ' M';
  if (abs >= 1_000) return (n/1_000).toFixed(1) + ' K';
  return Math.round(n).toString();
}
function exactFormat(n, decimals = 0) {
  if (isNaN(n)) return '0';
  if (decimals > 0) {
    return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return Math.round(n).toLocaleString('es-AR');
}

/* set value respecting formats. avgPrice uses forceExact with 1 decimal */
function setValue(id, num, money=false, options={forceExact:false, decimals:0}) {
  const el = document.getElementById(id);
  if (!el) return;
  if (options.forceExact) {
    el.textContent = (money ? '$' : '') + exactFormat(num, options.decimals);
    return;
  }
  if (showCompact) {
    el.textContent = (money ? '$' : '') + compactFormat(num);
  } else {
    el.textContent = (money ? '$' : '') + exactFormat(num, options.decimals);
  }
}

/* delta uses triangles ▲ ▼ */
function setDelta(id, current, previous) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!previous || previous === 0) {
    el.textContent = '';
    el.className = 'text-lg mt-1';
    return;
  }
  const delta = ((current - previous) / previous) * 100;
  const triangle = delta > 0 ? '▲' : delta < 0 ? '▼' : '';
  const colorClass = delta > 0 ? 'text-green-500' : (delta < 0 ? 'text-red-500' : 'text-gray-500');
  el.className = `text-lg mt-1 ${colorClass}`;
  el.textContent = `${triangle} ${Math.abs(delta).toFixed(1)}%`;
}

/* helper to get selected values from multiselects
   returns 'all' if all option selected, or array of values */
function getSelected(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return null;
  const values = Array.from(sel.selectedOptions).map(o => o.value);
  if (values.includes('all') || values.length === 0) return 'all';
  return values;
}

/* update cards - core logic */
function updateCards() {
  const productFilter = getSelected('productFilter');
  const channelFilter = getSelected('channelFilter');
  const branchFilter = getSelected('branchFilter');
  const months = parseInt(document.getElementById('monthsFilter').value) || 12;

  let filtered = salesData.slice();

  if (productFilter !== 'all') filtered = filtered.filter(d => productFilter.includes(d.product_name));
  if (channelFilter !== 'all') filtered = filtered.filter(d => channelFilter.includes(d.channel));
  if (branchFieldName && branchFilter !== 'all') filtered = filtered.filter(d => branchFilter.includes(d[branchFieldName]));

  // treat dates as YYYY-MM grouping (truncate)
  const dateKeys = Array.from(new Set(filtered.map(d => (d.date || '').slice(0,7)).filter(Boolean))).sort();
  const lastKeys = dateKeys.slice(-months);
  filtered = filtered.filter(d => lastKeys.includes((d.date||'').slice(0,7)));

  const totalRevenue = filtered.reduce((s,d)=>s + (d.revenue||0), 0);
  const totalUnits = filtered.reduce((s,d)=>s + (d.units||0), 0);
  const avgPrice = totalUnits ? totalRevenue / totalUnits : 0;

  setValue('salesCard', totalRevenue, true);
  setValue('customersCard', totalUnits, false);
  // ordersCard (average price) always 1 decimal exact
  setValue('ordersCard', avgPrice, true, { forceExact: true, decimals: 1 });

  // last month computations
  const monthsAvailable = Array.from(new Set(filtered.map(d => (d.date||'').slice(0,7)).filter(Boolean))).sort();
  const lastMonth = monthsAvailable[monthsAvailable.length - 1];
  const prevMonth = monthsAvailable[monthsAvailable.length - 2];

  const lastData = filtered.filter(d => (d.date||'').slice(0,7) === lastMonth);
  const prevData = filtered.filter(d => (d.date||'').slice(0,7) === prevMonth);

  const lastRevenue = lastData.reduce((s,d)=>s + (d.revenue||0), 0);
  const lastUnits = lastData.reduce((s,d)=>s + (d.units||0), 0);
  const lastAvgPrice = lastUnits ? lastRevenue / lastUnits : 0;

  const prevRevenue = prevData.reduce((s,d)=>s + (d.revenue||0), 0);
  const prevUnits = prevData.reduce((s,d)=>s + (d.units||0), 0);
  const prevAvgPrice = prevUnits ? prevRevenue / prevUnits : 0;

  setValue('lastMonthRevenue', lastRevenue, true);
  setValue('lastMonthUnits', lastUnits, false);
  setValue('lastMonthAvgPrice', lastAvgPrice, true, { forceExact: true, decimals: 1 });

  setDelta('lastMonthRevenueDelta', lastRevenue, prevRevenue);
  setDelta('lastMonthUnitsDelta', lastUnits, prevUnits);
  setDelta('lastMonthAvgPriceDelta', lastAvgPrice, prevAvgPrice);
}

/* update chart */
function updateChart(filteredData) {
  const metric = document.getElementById('metricSelector').value || 'revenue';
  const grouped = {};
  filteredData.forEach(d => {
    const key = (d.date || '').slice(0,7);
    if (!key) return;
    if (!grouped[key]) grouped[key] = 0;
    grouped[key] += (metric === 'revenue' ? (d.revenue || 0) : (d.units || 0));
  });

  const labels = Object.keys(grouped).sort();
  const values = labels.map(k => grouped[k]);

  // chart title: trunc dates YYYY-MM
  let titleText = `Evolución temporal de ${metric === 'revenue' ? 'Revenue' : 'Units'}`;
  if (labels.length >= 1) titleText += ` entre ${labels[0]} y ${labels[labels.length - 1]}`;
  document.getElementById('chartTitle').textContent = titleText;

  if (chart) chart.destroy();
  const ctx = document.getElementById('salesChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '', // no legend
        data: values,
        borderColor: 'rgba(59,130,246,1)',
        backgroundColor: 'rgba(59,130,246,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { display: true }, y: { display: true } }
    }
  });
}

/* main dashboard update */
function updateDashboard() {
  const productFilter = getSelected('productFilter');
  const channelFilter = getSelected('channelFilter');
  const branchFilter = getSelected('branchFilter');
  const months = parseInt(document.getElementById('monthsFilter').value) || 12;

  let filtered = salesData.slice();
  if (productFilter !== 'all') filtered = filtered.filter(d => productFilter.includes(d.product_name));
  if (channelFilter !== 'all') filtered = filtered.filter(d => channelFilter.includes(d.channel));
  if (branchFieldName && branchFilter !== 'all') filtered = filtered.filter(d => branchFilter.includes(d[branchFieldName]));

  // use truncated months to pick last N months
  const dateKeys = Array.from(new Set(filtered.map(d => (d.date || '').slice(0,7)).filter(Boolean))).sort();
  const lastKeys = dateKeys.slice(-months);
  filtered = filtered.filter(d => lastKeys.includes((d.date||'').slice(0,7)));

  updateCards();
  updateChart(filtered);
}

/* bootstrap */
loadCSV();
