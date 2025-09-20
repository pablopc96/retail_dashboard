let salesData = [];
let chart;
let useCompact = true;

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
  const select = document.getElementById('productFilter');
  productSet.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.text = p;
    select.add(opt);
  });

  document.getElementById('productFilter').addEventListener('change', updateDashboard);
  document.getElementById('channelFilter').addEventListener('change', updateDashboard);
  document.getElementById('monthsFilter').addEventListener('change', updateDashboard);
  document.getElementById('increaseMonths').addEventListener('click', () => {
    const input = document.getElementById('monthsFilter');
    input.value = parseInt(input.value) + 1;
    updateDashboard();
  });
  document.getElementById('decreaseMonths').addEventListener('click', () => {
    const input = document.getElementById('monthsFilter');
    input.value = Math.max(1, parseInt(input.value) - 1);
    updateDashboard();
  });
  document.getElementById('metricSelector').addEventListener('change', updateDashboard);
}

function formatCompact(value) {
  if (Math.abs(value) >= 1_000_000) return (value/1_000_000).toFixed(1) + " M";
  if (Math.abs(value) >= 1_000) return (value/1_000).toFixed(1) + " K";
  return value.toFixed(0);
}

function setValue(id, value, isCurrency=false) {
  const el = document.getElementById(id);
  if (useCompact) {
    el.innerText = isCurrency ? `$${formatCompact(value)}` : formatCompact(value);
  } else {
    el.innerText = isCurrency ? `$${value.toFixed(2)}` : value.toFixed(0);
  }
}

function setDelta(id, current, previous) {
  const el = document.getElementById(id);
  if (previous === 0) {
    el.innerText = "";
    return;
  }
  const delta = ((current - previous) / previous) * 100;
  el.innerText = `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}%`;
  el.className = delta >= 0 ? "text-green-500" : "text-red-500";
}

function updateCards(filtered) {
  const totalRevenue = filtered.reduce((sum,d)=>sum+d.revenue,0);
  const totalUnits = filtered.reduce((sum,d)=>sum+d.units,0);
  const avgPrice = totalUnits ? totalRevenue/totalUnits : 0;

  setValue('totalRevenue', totalRevenue, true);
  setValue('totalUnits', totalUnits);
  setValue('avgPrice', avgPrice, true);

  const dates = [...new Set(filtered.map(d=>d.date))].sort();
  const lastDate = dates[dates.length-1];
  const prevDate = dates[dates.length-2];

  const lastData = filtered.filter(d=>d.date===lastDate);
  const prevData = filtered.filter(d=>d.date===prevDate);

  const lastRevenue = lastData.reduce((s,d)=>s+d.revenue,0);
  const lastUnits = lastData.reduce((s,d)=>s+d.units,0);
  const lastAvgPrice = lastUnits ? lastRevenue/lastUnits : 0;

  const prevRevenue = prevData.reduce((s,d)=>s+d.revenue,0);
  const prevUnits = prevData.reduce((s,d)=>s+d.units,0);
  const prevAvgPrice = prevUnits ? prevRevenue/prevUnits : 0;

  setValue('lastMonthRevenue', lastRevenue, true);
  setValue('lastMonthUnits', lastUnits);
  setValue('lastMonthAvgPrice', lastAvgPrice, true);

  setDelta('lastMonthRevenueDelta', lastRevenue, prevRevenue);
  setDelta('lastMonthUnitsDelta', lastUnits, prevUnits);
  setDelta('lastMonthAvgPriceDelta', lastAvgPrice, prevAvgPrice);
}

function updateChart(filteredData, metric, months) {
  const grouped = {};
  filteredData.forEach(d => {
    if (!grouped[d.date]) grouped[d.date] = 0;
    grouped[d.date] += (metric === 'revenue' ? d.revenue : d.units);
  });

  const labels = Object.keys(grouped).sort();
  const values = labels.map(l=>grouped[l]);

  const title = `Evolución temporal de ${metric==="revenue" ? "Revenue" : "Units"} entre ${labels[0]} y ${labels[labels.length-1]}`;
  document.getElementById('chartTitle').innerText = title;

  if(chart) chart.destroy();
  const ctx = document.getElementById('salesChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: metric==="revenue" ? "Revenue" : "Units",
        data: values,
        borderColor: 'rgba(59,130,246,1)',
        backgroundColor: 'rgba(59,130,246,0.2)',
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

function updateDashboard() {
  const productFilter = document.getElementById('productFilter').value;
  const channelFilter = document.getElementById('channelFilter').value;
  const months = parseInt(document.getElementById('monthsFilter').value) || 12;
  const metric = document.getElementById('metricSelector').value;

  let filtered = [...salesData];
  if(productFilter !== 'all') filtered = filtered.filter(d=>d.product_name===productFilter);
  if(channelFilter !== 'all') filtered = filtered.filter(d=>d.channel===channelFilter);

  const dates = [...new Set(filtered.map(d=>d.date))].sort();
  const lastDates = dates.slice(-months);
  filtered = filtered.filter(d=>lastDates.includes(d.date));

  updateCards(filtered);
  updateChart(filtered, metric, months);
}

loadCSV();
