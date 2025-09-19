let salesData = [];
let chart;
let showCompact = true;

async function loadCSV() {
  const res = await fetch('data/ventas.csv');
  const text = await res.text();
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
    headers.forEach((h,i)=>{
      if(['units','price','revenue'].includes(h)){
        obj[h] = parseFloat(cols[i]);
      } else {
        obj[h] = cols[i];
      }
    });
    return obj;
  });
}

function populateFilters() {
  const productSet = new Set(salesData.map(d=>d.product_name));
  const select = document.getElementById('productFilter');
  productSet.forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p;
    opt.text = p;
    select.add(opt);
  });

  document.getElementById('productFilter').addEventListener('change', updateDashboard);
  document.getElementById('channelFilter').addEventListener('change', updateDashboard);

  const monthsInput = document.getElementById('monthsFilter');
  document.getElementById('increaseMonths').addEventListener('click', ()=> {
    monthsInput.value = parseInt(monthsInput.value)+1;
    updateDashboard();
  });
  document.getElementById('decreaseMonths').addEventListener('click', ()=> {
    if(parseInt(monthsInput.value)>1){
      monthsInput.value = parseInt(monthsInput.value)-1;
      updateDashboard();
    }
  });
  monthsInput.addEventListener('change', updateDashboard);

  document.getElementById('toggleNumbers').addEventListener('click', () => {
    showCompact = !showCompact;
    document.getElementById('toggleNumbers').textContent =
      showCompact ? "Mostrar números exactos" : "Mostrar números compactos";
    updateCards(); // solo tarjetas
  });
}

function formatCompact(num) {
  return Intl.NumberFormat("es-AR", {notation:"compact", maximumFractionDigits:1}).format(num);
}
function formatExact(num) {
  return num.toLocaleString("es-AR");
}

function setValue(id, value, money=false) {
  const el = document.getElementById(id);
  el.textContent = showCompact ? formatCompact(value) : (money ? "$"+formatExact(value):formatExact(value));
}

function setDelta(id, current, previous) {
  const el = document.getElementById(id);
  if(previous === 0){
    el.textContent = '';
    return;
  }
  const delta = ((current - previous) / previous) * 100;
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '';
  const color = delta > 0 ? 'text-green-500' : 'text-red-500';
  el.className = `text-lg mt-1 ${color}`;
  el.textContent = `${arrow} ${Math.abs(delta).toFixed(1)}%`;
}

function updateCards() {
  const productFilter = document.getElementById('productFilter').value;
  const channelFilter = document.getElementById('channelFilter').value;
  const months = parseInt(document.getElementById('monthsFilter').value) || 12;

  let filtered = [...salesData];
  if(productFilter !== 'all') filtered = filtered.filter(d=>d.product_name===productFilter);
  if(channelFilter !== 'all') filtered = filtered.filter(d=>d.channel===channelFilter);

  const dates = [...new Set(filtered.map(d=>d.date))].sort();
  const lastDates = dates.slice(-months);
  filtered = filtered.filter(d=>lastDates.includes(d.date));

  // totales históricos
  const totalRevenue = filtered.reduce((sum,d)=>sum+d.revenue,0);
  const totalUnits = filtered.reduce((sum,d)=>sum+d.units,0);
  const avgPrice = totalUnits ? totalRevenue/totalUnits : 0;

  setValue('salesCard', totalRevenue, true);
  setValue('customersCard', totalUnits);
  setValue('ordersCard', avgPrice, true);

  // último mes
  const monthsSet = [...new Set(filtered.map(d=>d.date))].sort();
  const lastMonth = monthsSet[monthsSet.length-1];
  const prevMonth = monthsSet[monthsSet.length-2];

  const lastData = filtered.filter(d=>d.date===lastMonth);
  const prevData = filtered.filter(d=>d.date===prevMonth);

  const lastRevenue = lastData.reduce((sum,d)=>sum+d.revenue,0);
  const lastUnits = lastData.reduce((sum,d)=>sum+d.units,0);
  const lastAvgPrice = lastUnits ? lastRevenue/lastUnits : 0;

  const prevRevenue = prevData.reduce((sum,d)=>sum+d.revenue,0);
  const prevUnits = prevData.reduce((sum,d)=>sum+d.units,0);
  const prevAvgPrice = prevUnits ? prevRevenue/prevUnits : 0;

  setValue('lastMonthRevenue', lastRevenue, true);
  setValue('lastMonthUnits', lastUnits);
  setValue('lastMonthAvgPrice', lastAvgPrice, true);

  setDelta('lastMonthRevenueDelta', lastRevenue, prevRevenue);
  setDelta('lastMonthUnitsDelta', lastUnits, prevUnits);
  setDelta('lastMonthAvgPriceDelta', lastAvgPrice, prevAvgPrice);
}

function updateChart(filteredData) {
  const grouped = {};
  filteredData.forEach(d => {
    if(!grouped[d.date]) grouped[d.date]=0;
    grouped[d.date]+=d.revenue;
  });

  const labels = Object.keys(grouped).sort();
  const values = labels.map(l=>grouped[l]);

  if(chart) chart.destroy();
  const ctx = document.getElementById('salesChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data:{
      labels: labels,
      datasets:[{
        label:'Revenue',
        data: values,
        borderColor:'rgba(59,130,246,1)',
        backgroundColor:'rgba(59,130,246,0.2)',
        fill:true,
        tension:0.3
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:true}},
      scales:{x:{display:true},y:{display:true}}
    }
  });
}

function updateDashboard() {
  const productFilter = document.getElementById('productFilter').value;
  const channelFilter = document.getElementById('channelFilter').value;
  const months = parseInt(document.getElementById('monthsFilter').value) || 12;

  let filtered = [...salesData];
  if(productFilter !== 'all') filtered = filtered.filter(d=>d.product_name===productFilter);
  if(channelFilter !== 'all') filtered = filtered.filter(d=>d.channel===channelFilter);

  const dates = [...new Set(filtered.map(d=>d.date))].sort();
  const lastDates = dates.slice(-months);
  filtered = filtered.filter(d=>lastDates.includes(d.date));

  updateCards();
  updateChart(filtered);
}

loadCSV();
