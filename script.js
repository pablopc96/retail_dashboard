let salesData = [];
let chart;

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
      if (h === 'units' || h === 'price' || h === 'revenue' || h === 'product_id') {
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
}

function updateDashboard() {
  const productFilter = document.getElementById('filterProduct').value;
  const channelFilter = document.getElementById('filterChannel').value;

  let filtered = salesData;
  if (productFilter !== 'All') filtered = filtered.filter(d => d.product_name === productFilter);
  if (channelFilter !== 'All') filtered = filtered.filter(d => d.channel === channelFilter);

  // Totales históricos
  const totalRevenue = filtered.reduce((sum,d) => sum + d.revenue, 0);
  const totalUnits = filtered.reduce((sum,d) => sum + d.units, 0);
  const avgPrice = totalUnits ? (totalRevenue / totalUnits).toFixed(2) : 0;

  document.getElementById('totalRevenue').innerText = `$${totalRevenue.toFixed(2)}`;
  document.getElementById('totalUnits').innerText = `${totalUnits}`;
  document.getElementById('avgPrice').innerText = `$${avgPrice}`;

  // Último mes cerrado
  const months = [...new Set(filtered.map(d => d.date))].sort();
  if (months.length >= 2) {
    const lastMonth = months[months.length - 1];
    const prevMonth = months[months.length - 2];

    const lastData = filtered.filter(d => d.date === lastMonth);
    const prevData = filtered.filter(d => d.date === prevMonth);

    const lastRevenue = lastData.reduce((sum,d) => sum + d.revenue, 0);
    const lastUnits = lastData.reduce((sum,d) => sum + d.units, 0);
    const lastAvgPrice = lastUnits ? (lastRevenue / lastUnits) : 0;

    const prevRevenue = prevData.reduce((sum,d) => sum + d.revenue, 0);
    const prevUnits = prevData.reduce((sum,d) => sum + d.units, 0);
    const prevAvgPrice = prevUnits ? (prevRevenue / prevUnits) : 0;

    // Actualizamos valores
    document.getElementById('lastMonthRevenue').innerText = `$${lastRevenue.toFixed(2)}`;
    document.getElementById('lastMonthUnits').innerText = `${lastUnits}`;
    document.getElementById('lastMonthAvgPrice').innerText = `$${lastAvgPrice.toFixed(2)}`;

    // Indicadores de variación
    document.getElementById('lastMonthRevenueDelta').innerHTML = deltaHTML(lastRevenue, prevRevenue);
    document.getElementById('lastMonthUnitsDelta').innerHTML = deltaHTML(lastUnits, prevUnits);
    document.getElementById('lastMonthAvgPriceDelta').innerHTML = deltaHTML(lastAvgPrice, prevAvgPrice);
  }

  drawChart(filtered);
}

function deltaHTML(current, previous) {
  if(previous === 0) return ''; // evitar división por cero
  const pct = ((current - previous) / previous * 100).toFixed(1);
  if(pct >= 0) return `<span class="text-green-600 font-semibold">▲ ${pct}%</span>`;
  else return `<span class="text-red-600 font-semibold">▼ ${Math.abs(pct)}%</span>`;
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
      scales: { x: { display: true
