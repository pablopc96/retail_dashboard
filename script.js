let salesData = [];
let chart;
let showCompact = true;
let currentMetric = "revenue";

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
  const channelSet = new Set(salesData.map(d=>d.channel));
  const branchSet = new Set(salesData.map(d=>d.branch));

  const productSelect = document.getElementById('productFilter');
  const channelSelect = document.getElementById('channelFilter');
  const branchSelect = document.getElementById('branchFilter');

  [productSet, channelSet, branchSet].forEach((set, i) => {
    const select = [productSelect, channelSelect, branchSelect][i];
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.text = 'Todos';
    select.add(optAll);
    set.forEach(v=>{
      const opt = document.createElement('option');
      opt.value = v;
      opt.text = v;
      select.add(opt);
    });
  });

  productSelect.addEventListener('change', updateDashboard);
  channelSelect.addEventListener('change', updateDashboard);
  branchSelect.addEventListener('change', updateDashboard);

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

  const toggleNumbers = document.getElementById('toggleNumbers');
  toggleNumbers.addEventListener('change', () => {
    showCompact = toggleNumbers.checked;
    document.getElementById('toggleLabel').textContent =
      showCompact ? "Vista compacta" : "Vista exacta";
    updateCards(); // solo tarjetas
  });

  document.getElementById('resetFilters').addEventListener('click', ()=> {
    productSelect.value = 'all';
    channelSelect.value = 'all';
    branchSelect.value = 'all';
    monthsInput.value = 12;
    toggleNumbers.checked = true;
    showCompact = true;
    document.getElementById('toggleLabel').textContent = "Vista compacta";
    updateDashboard();
  });

  document.getElementById('toggleFilters').addEventListener('click', ()=> {
    const content = document.getElementById('filtersContent');
    const btn = document.getElementById('toggleFilters');
    if(content.style.display === 'none'){
      content.style.display = 'grid';
      btn.textContent = "⯈";
    } else {
      content.style.display = 'none';
      btn.textContent = "⯇";
    }
  });

  document.getElementById('metricSelector').addEventListener('change',(e)=>{
    currentMetric = e.target.value;
    updateDashboard();
  });
}

function formatCompact(num) {
  return Intl.NumberFormat("es-AR", {notation:"compact", maximumFractionDigits:1}).format(num);
}
function formatExact(num) {
  return num.toLocaleString("es-AR");
}

function setValue(id, value, money=false, forceDecimal=false) {
  const el = document.getElementById(id);
  if(forceDecimal){
    el.textContent = (money?"$":"")+value.toFixed(1);
  } else {
    el.textContent = showCompact
      ? (money?"$":"")+formatCompact(value)
      : (money?"$":"")+formatExact(value);
  }
}

function setDelta(id, current, previous) {
  const el = document.getElementById(id);
  if(previous === 0){
    el.textContent = '';
    return;
  }
  const delta = ((current - previous) / previous) * 100;
  const triangle = delta > 0 ? '▲' : delta < 0 ? '▼' : '';
  const color = delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-gray-500';
  el.className = `text-lg mt-1 ${color}`;
  el.textContent = `${triangle} ${Math.abs(delta).toFixed(1)}%`;
}

function updateCards() {
  const productFilter = getSelectedValues('productFilter');
  const channelFilter = getSelectedValues('channelFilter');
  const branchFilter = getSelectedValues('branchFilter');
  const months = parseInt(document.getElementById('monthsFilter').value) || 12;

  let filtered = [...salesData];
  if(!productFilter.includes('all')) filtered = filtered.filter(d=>productFilter.includes(d.product_name));
  if(!channelFilter.includes('all')) filtered = filtered.filter(d=>channelFilter.includes(d.channel));
  if(!branchFilter.includes('all')) filtered = filtered.filter(d=>branchFilter.includes(d.branch));

  const dates = [...new Set(filtered.map(d=>d.date))].sort();
  const lastDates = dates.slice(-months);
  filtered = filtered.filter(d=>lastDates.includes(d.date));

  const totalRevenue = filtered.reduce((sum,d)=>sum+d.revenue,0);
  const totalUnits = filtered.reduce((sum,d)=>sum+d.units,0);
  const avgPrice = totalUnits ? totalRevenue/totalUnits : 0;

  setValue('salesCard', totalRevenue, true);
  setValue('customersCard', totalUnits);
  setValue('ordersCard', avgPrice, true, true); // siempre 1 decimal

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
  setValue('lastMonthAvgPrice', lastAvgPrice, true, true);

  setDelta('lastMonthRevenueDelta', lastRevenue, prevRevenue);
  setDelta('lastMonthUnitsDelta', lastUnits, prevUnits);
  setDelta('lastMonthAvgPriceDelta', lastAvgPrice, prevAvgPrice);
}

function updateChart(filteredData) {
  const grouped = {};
  filteredData.forEach(d => {
    if(!grouped[d.date]) grouped[d.date]=0;
    grouped[d.date]+= d[currentMetric];
  });

  const labels = Object.keys(grouped).sort().map(d=>d.slice(0,7));
  const values = labels.map((l,i)=>Object.values(grouped)[i]);

  if(chart) chart.destroy();
  const ctx = document.getElementById('salesChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data:{
      labels: labels,
      datasets:[{
        label:'',
        data: values,
        borderColor:'rgba(59,130,246,1)',
        backgroundColor:'rgba(59,130,246,0.2)',
        fill:true,
        tension:0.3
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false}},
      scales:{x:{display:true},y:{display:true}}
    }
  });

  const months = parseInt(document.getElementById('monthsFilter').value) || 12;
  const dates = [...new Set(filteredData.map(d=>d.date))].sort();
  const lastDates = dates.slice(-months);
  const firstMonth = lastDates[0]?.slice(0,7) || '';
  const lastMonth = lastDates[lastDates.length-1]?.slice(0,7) || '';
  document.getElementById('chartTitle').textContent =
    `Evolución temporal de ${currentMetric==="revenue"?"Revenue":"Units"} entre ${firstMonth} y ${lastMonth}`;
}

function updateDashboard() {
  const productFilter = getSelectedValues('productFilter');
  const channelFilter = getSelectedValues('channelFilter');
  const branchFilter = getSelectedValues('branchFilter');
  const months = parseInt(document.getElementById('monthsFilter').value) || 12;

  let filtered = [...salesData];
  if(!productFilter.includes('all')) filtered = filtered.filter(d=>productFilter.includes(d.product_name));
  if(!channelFilter.includes('all')) filtered = filtered.filter(d=>channelFilter.includes(d.channel));
  if(!branchFilter.includes('all')) filtered = filtered.filter(d=>branchFilter.includes(d.branch));

  const dates = [...new Set(filtered.map(d=>d.date))].sort();
  const lastDates = dates.slice(-months);
  filtered = filtered.filter(d=>lastDates.includes(d.date));

  updateCards();
  updateChart(filtered);
}

function getSelectedValues(selectId){
  const sel = document.getElementById(selectId);
  return Array.from(sel.selectedOptions).map(o=>o.value);
}

loadCSV();
