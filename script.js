/* script.js - Dashboard funcional */

// Arreglo global donde se almacena la data del CSV
let salesData = [];

// Variable para almacenar la instancia del chart
let chart = null;

// Flag para vista compacta/exacta
let showCompact = true;

// Nombre del campo de sucursal detectado en CSV
let branchFieldName = null;

// Objeto para almacenar la selección actual de filtros
const selection = { product: 'all', channel: 'all', branch: 'all' };

/* ---------- Carga CSV ---------- */
async function loadCSV() {
  try {
    // Fetch del CSV local
    const res = await fetch('data/ventas.csv');
    const text = await res.text();

    // Parseo del CSV
    parseCSV(text);

    // Poblado de filtros (dropdowns)
    populateFilters();

    // Actualización inicial del dashboard
    updateDashboard();
  } catch (err) {
    console.error('Error cargando CSV:', err);
  }
}

/* ---------- Parse CSV ---------- */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n').filter(Boolean);

  // Primer fila como headers
  const headers = lines[0].split(',').map(h => h.trim());

  // Posibles nombres de columna para sucursal
  const possibleBranches = ['branch','sucursal','store','store_name','branch_name'];
  branchFieldName = headers.find(h => possibleBranches.includes(h.toLowerCase())) || null;

  // Transformar cada fila a objeto
  salesData = lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      const key = h.trim();
      const raw = cols[i] !== undefined ? cols[i].trim() : '';
      // Campos numéricos parseados a float
      if (['units','price','revenue'].includes(key)) obj[key] = parseFloat(raw)||0;
      else obj[key] = raw;
    });
    return obj;
  });
}

/* ---------- Populate filters ---------- */
function populateFilters() {
  // Crear sets únicos para cada filtro
  const productSet = Array.from(new Set(salesData.map(d=>d.product_name).filter(Boolean))).sort();
  const channelSet = Array.from(new Set(salesData.map(d=>d.channel).filter(Boolean))).sort();
  const branchSet = branchFieldName ? Array.from(new Set(salesData.map(d=>d[branchFieldName]).filter(Boolean))).sort() : [];

  // Función para renderizar los panels de cada filtro
  function renderPanel(panelEl, items, key){
    panelEl.innerHTML = '';

    // Opción "Todos"
    const allRow = document.createElement('div');
    allRow.className = 'dd-checkbox';
    allRow.innerHTML = `<input type="checkbox" data-val="all" data-key="${key}" id="${key}_all"><label for="${key}_all" class="text-sm">Todos</label>`;
    panelEl.appendChild(allRow);

    // Opciones individuales
    items.forEach(it => {
      const id = `${key}_${slug(it)}`;
      const row = document.createElement('div');
      row.className = 'dd-checkbox';
      row.innerHTML = `<input type="checkbox" data-val="${escapeHtml(it)}" data-key="${key}" id="${id}"><label for="${id}" class="text-sm">${escapeHtml(it)}</label>`;
      panelEl.appendChild(row);
    });

    // Listener de cambio en checkboxes
    panelEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', onCheckboxChange));
  }

  // Renderizado de cada panel
  renderPanel(document.getElementById('productPanel'), productSet, 'product');
  renderPanel(document.getElementById('channelPanel'), channelSet, 'channel');
  renderPanel(document.getElementById('branchPanel'), branchSet, 'branch');

  // Configuración de dropdowns, meses y toggle/reset
  setupDropdowns();
  setupMonthControls();
  setupToggleCollapseReset();

  // Listener selector de métrica del chart
  document.getElementById('metricSelector').addEventListener('change', updateDashboard);
}

/* ---------- Dropdowns ---------- */
function setupDropdowns() {
  // Configurar comportamiento al click en botón de dropdown
  document.querySelectorAll('.dd-btn').forEach(btn=>{
    const panel = btn.nextElementSibling;
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const isHidden = panel.classList.contains('hidden');
      // Cerrar otros panels abiertos
      document.querySelectorAll('.dd-panel').forEach(p=>{ if(p!==panel) p.classList.add('hidden'); });
      // Toggle del panel actual
      panel.classList.toggle('hidden', !isHidden);
      btn.setAttribute('aria-expanded', !isHidden);
    });
  });

  // Cerrar panel si se hace click fuera
  document.addEventListener('click', e=>{
    if(!e.target.closest('.dd-panel') && !e.target.closest('.dd-btn')){
      document.querySelectorAll('.dd-panel').forEach(p=>p.classList.add('hidden'));
    }
  });
}

/* ---------- Checkbox ---------- */
function onCheckboxChange(e){
  const cb = e.target, key = cb.dataset.key, val = cb.dataset.val;
  const panel = document.getElementById(key+'Panel');
  if(!panel) return;

  if(val==='all' && cb.checked){
    // Selecciona "Todos", desmarca los demás
    panel.querySelectorAll('input[type=checkbox]').forEach(i=>{if(i.dataset.val!=='all') i.checked=false;});
    selection[key]='all';
  } else if(val==='all' && !cb.checked){
    // Evitar desmarcar "Todos"
    selection[key]='all'; cb.checked=true;
  } else {
    // Desmarcar "Todos" si se selecciona otro
    panel.querySelector('input[data-val="all"]').checked=false;
    const chosen = Array.from(panel.querySelectorAll('input[type=checkbox]')).filter(i=>i.checked && i.dataset.val!=='all').map(i=>i.dataset.val);
    selection[key] = chosen.length ? chosen : 'all';
  }
  updateBtnLabel(key);
  updateDashboard();
}

// Actualiza texto del botón con selección
function updateBtnLabel(key){
  const label = document.getElementById(key+'BtnLabel');
  const sel = selection[key];
  if(!label) return;
  label.textContent = (sel==='all') ? 'Todos' : Array.isArray(sel) ? (sel.length===1 ? sel[0] : `${sel.length} seleccionados`) : 'Todos';
}

/* ---------- Dashboard ---------- */
function updateDashboard() {
  updateCards();
  updateLastMonthCards();
}

/* ---------- Tarjetas principales ---------- */
function updateCards(){
  const sel = {...selection};
  const months = parseInt(document.getElementById('monthsFilter').value)||12;
  let filtered = salesData.slice();

  // Filtrado por producto, canal y sucursal
  if(sel.product!=='all') filtered=filtered.filter(d=>sel.product.includes(d.product_name));
  if(sel.channel!=='all') filtered=filtered.filter(d=>sel.channel.includes(d.channel));
  if(branchFieldName && sel.branch!=='all') filtered=filtered.filter(d=>sel.branch.includes(d[branchFieldName]));

  // Filtrado por últimos N meses
  const dateKeys = Array.from(new Set(filtered.map(d=>(d.date||'').slice(0,7)))).sort();
  const lastKeys = dateKeys.slice(-months);
  filtered = filtered.filter(d=>lastKeys.includes((d.date||'').slice(0,7)));

  // Cálculo totales
  const totalRevenue = filtered.reduce((s,d)=>s+(d.revenue||0),0);
  const totalUnits = filtered.reduce((s,d)=>s+(d.units||0),0);
  const avgPrice = totalUnits ? totalRevenue/totalUnits : 0;

  setValue('salesCard', totalRevenue,true);
  setValue('customersCard', totalUnits,false);
  setValue('ordersCard', avgPrice,true,{forceExact:true,decimals:1});

  // Actualiza chart
  updateChart(filtered);
}

/* ---------- Último mes y delta ---------- */
function updateLastMonthCards() {
  const sel = {...selection};
  let filtered = salesData.slice();
  if(sel.product!=='all') filtered = filtered.filter(d=>sel.product.includes(d.product_name));
  if(sel.channel!=='all') filtered = filtered.filter(d=>sel.channel.includes(d.channel));
  if(branchFieldName && sel.branch!=='all') filtered = filtered.filter(d=>sel.branch.includes(d[branchFieldName]));

  const monthsSorted = Array.from(new Set(filtered.map(d=>(d.date||'').slice(0,7)))).sort();
  if(monthsSorted.length===0) return;

  const lastMonth = monthsSorted[monthsSorted.length-1];
  const prevMonth = monthsSorted.length>1 ? monthsSorted[monthsSorted.length-2] : null;

  const lastData = filtered.filter(d=>(d.date||'').slice(0,7)===lastMonth);
  const prevData = prevMonth ? filtered.filter(d=>(d.date||'').slice(0,7)===prevMonth) : [];

  const revLast = lastData.reduce((s,d)=>s+(d.revenue||0),0);
  const unitsLast = lastData.reduce((s,d)=>s+(d.units||0),0);
  const priceLast = unitsLast ? revLast/unitsLast : 0;

  const revPrev = prevData.reduce((s,d)=>s+(d.revenue||0),0);
  const unitsPrev = prevData.reduce((s,d)=>s+(d.units||0),0);
  const pricePrev = unitsPrev ? revPrev/unitsPrev : 0;

  setValue('lastMonthRevenue', revLast,true);
  setValue('lastMonthUnits', unitsLast,false);
  setValue('lastMonthAvgPrice', priceLast,true,{forceExact:true,decimals:1});

  setDelta('lastMonthRevenueDelta', revLast, revPrev);
  setDelta('lastMonthUnitsDelta', unitsLast, unitsPrev);
  setDelta('lastMonthAvgPriceDelta', priceLast, pricePrev);
}

// Calcula delta y porcentaje
function setDelta(elId, current, previous){
  const el=document.getElementById(elId);
  if(!el) return;
  if(previous===0||previous===null){ el.textContent=''; return; }
  const diff = current - previous;
  const pct = (diff/previous)*100;
  el.textContent = `${diff>=0?'+':''}${diff.toLocaleString('es-AR')} (${pct.toFixed(1)}%)`;
  el.style.color = diff>=0 ? 'green' : 'red';
}

/* ---------- Chart ---------- */
function updateChart(filteredData){
  const metric=document.getElementById('metricSelector').value||'revenue';
  const grouped={};
  filteredData.forEach(d=>{
    const key=(d.date||'').slice(0,7); if(!key)return;
    if(!grouped[key]) grouped[key]=0;
    grouped[key]+=metric==='revenue'? (d.revenue||0):(d.units||0);
  });
  const labels=Object.keys(grouped).sort();
  const values=labels.map(k=>grouped[k]);

  if(chart) chart.destroy();
  const ctx=document.getElementById('salesChart').getContext('2d');
  const gradient = ctx.createLinearGradient(0,0,0,ctx.canvas.height);
  gradient.addColorStop(0,'rgba(59,130,246,0.3)');
  gradient.addColorStop(1,'rgba(59,130,246,0.05)');

  chart=new Chart(ctx,{
    type:'line',
    data:{ labels, datasets:[{ label: metric==='revenue'?'Revenue':'Units', data: values, fill:true, backgroundColor:gradient, borderColor:'#3b82f6', tension:0.2 }] },
    options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
  });
}

/* ---------- Utils ---------- */
function setValue(id,val,isCurrency=false,opts={}){
  const el=document.getElementById(id); if(!el) return;
  if(opts.forceExact) val=Number(val.toFixed(opts.decimals||0));
  el.textContent=isCurrency? `$${val.toLocaleString('es-AR')}` : val.toLocaleString('es-AR');
}

function slug(str){ return str.toLowerCase().replace(/\s+/g,'_'); }
function escapeHtml(str){ return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* ---------- Meses ---------- */
function setupMonthControls(){
  const inc=document.getElementById('increaseMonths'), dec=document.getElementById('decreaseMonths'), input=document.getElementById('monthsFilter');
  inc.addEventListener('click',()=>{ input.value=parseInt(input.value)+1; updateDashboard(); });
  dec.addEventListener('click',()=>{ input.value=Math.max(1,parseInt(input.value)-1); updateDashboard(); });
  input.addEventListener('change',()=>{ if(parseInt(input.value)<1) input.value=1; updateDashboard(); });
}

/* ---------- Collapse, toggle y reset ---------- */
function setupToggleCollapseReset(){
  const sidebar=document.getElementById('sidebar');
  const collapseBtn=document.getElementById('collapseBtn');
  collapseBtn.addEventListener('click',()=>{
    sidebar.classList.toggle('collapsed');
  });

  const toggleBtn=document.getElementById('toggleSwitch');
  toggleBtn.addEventListener('click',()=>{ 
    showCompact=!showCompact;
    toggleBtn.classList.toggle('on',showCompact);
    toggleBtn.classList.toggle('off',!showCompact);
  });

  document.getElementById('resetFilters').addEventListener('click',()=>{
    ['product','channel','branch'].forEach(k=>{
      selection[k]='all';
      updateBtnLabel(k);
      const panel=document.getElementById(k+'Panel');
      if(panel){
        panel.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=cb.dataset.val==='all');
      }
    });
    document.getElementById('monthsFilter').value=12;
    updateDashboard();
  });
}
