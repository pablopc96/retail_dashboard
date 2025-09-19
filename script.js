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

  const totalRevenue = filtered.reduce((sum,d) => sum + d.revenue, 0);
  const totalUnits = filtered.reduce((sum,d) => sum + d.units, 0);
  const avgPrice = totalUnits ? (totalRevenue / totalUnits).toFixed(2) : 0;

  document.getElementById('totalRevenue').innerText = `$${totalRevenue.toFixed(2)}`;
  document.getElementById('totalUnits').innerText = `${totalUnits}`;
  document.getElementById('avgPrice').innerText = `$${avgPrice}`;

  drawChart(filtered);
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
