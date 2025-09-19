let salesData = [];
let chart;
let compactView = true; // por defecto compacta

async function loadCSV() {
  const response = await fetch('data/ventas.csv');
  const text = await response.text();
  parseCSV(text);
  populateFilters();
  updateDashboard();
}

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  salesData = lines.slice(1).map(line => {
    const cols = line.split(',');
    let obj = {};
    headers.forEach((h, i) => {
      if (['units','price','revenue','product_id'].includes(h)) {
        obj[h] = parseFloat(cols[i]);
      } else {
        obj[h] = cols[i];
      }
    });
    return obj;
  });
}

function populateFilters() {
  const productSet = new Set(salesData.map(d => d.product_name));
  const select = document.getElementById('filterProduct');
  productSet.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.text = p;
    select.add(opt);
  });

  document.getElementById('filterProduct').addEventListener('change', updateDashboard);
  document.getElementById('filterChannel').addEventListener('change', updateDashboard);

  // Control de meses
  document.getElementById('monthsIncr').addEventListener('click', () => {
    monthsInput.value = Math.max(1, parseInt(monthsInput.value) + 1);
    updateDashboard();
  });
  document.getElementById('monthsDecr').addEventListener('click', () => {
    monthsInput.value = Math.max(1, parseInt(monthsInput.value) - 1);
    updateDashboard();
  });
  document.getElementById('monthsInput').addEventListener('change', updateDashboard);

  // Botón toggle
  document.getElementById('toggleFormat').addEventListener('click', () => {
    compactView = !compactView;
    document.getElementById('toggleFormat').textContent =
      compactView ? 'Vista: Compacta' : 'Vista: Exacta';
    updateDashboard();
  });
}

function updateDashboard() {
  const productFilter = document.getElementById('filterProduct').value;
  const channelFilter = document.getElementById('filterChannel').value;
  const months = parseInt(document.getElementById('monthsInput').value) || 12;

  let filtered = salesData;
  if (productFilter !== 'All') filtered = filtered.filter(d => d.product_name === productFilter);
  if (channelFilter !== 'All') filtered = filtered.filter(d => d.channel === channelFilter);

  // Filtrar últimos N meses (suponiendo fecha en formato YYYY-MM-DD)
  const dates = [...new Set(filtered.map(d => d.date))].sort();
  const lastDates = dates.slice(-months);
  filtered = filtered.filter(d => lastDates.includes(d.date));

  const totalRevenue = filtered.reduce((sum,d) => sum + d.revenue, 0);
  const totalUnits = filtered.reduce((sum,d) => sum + d.units, 0);
  const avgPrice = totalUnits ? (totalRevenue / totalUnits) : 0;

  setValue('totalRevenue', totalRevenue, true);
  setValue('totalUnits', totalUnits, false);
  setValue('avgPrice', avgPrice, true);

  drawChart(filtered);
}

// Helpers de formato
function formatCompact(num) {
  const n = Number(num);
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n/1e9).toFixed(1).replace('.', ',') + ' B';
  if (abs >= 1e6) return (n/1e6).toFixed(1).replace('.', ',') + ' M';
  if (abs >= 1e3) return (n/1e3).toFixed(1).replace('.', ',') + ' K';
  return n.toLocaleString('es-AR');
}

function formatExact(num, money=false) {
  let opts = {maximumFractionDigits: 2};
  let formatted = Number(num).toLocaleString('es-AR', opts);
  return money ? `$${formatted}` : formatted;
}

function setValue(id, value, money=false) {
  const el = document.getElementById(id);
  el.dataset.value = value;
  el.textContent = compactView ? formatCompact(value) : formatExact(value, money);
}

function drawChart(data) {
  const grouped = {};
  data.forEach(d => {
    if (!grouped[d.date]) grouped[d.date] = 0;
    grouped[d.date] += d.revenue;
  });

  const labels = Object.keys(grouped).sort();
  const values = labels.map(l => grouped[l]);

  if (chart) chart.destroy();
  const ctx = document.getElementById('salesChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Revenue',
        data: values,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { x: { display: true }, y: { display: true } }
    }
  });
}

loadCSV();
