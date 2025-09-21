/* script.js - Dashboard funcional */
let salesData = [];
let chart = null;
let showCompact = true;
let branchFieldName = null;
const selection = { product: 'all', channel: 'all', branch: 'all' };

async function loadCSV() {
  try {
    const res = await fetch('data/ventas.csv');
    const text = await res.text();
    parseCSV(text);
    populateFilters();
    updateDashboard();
    attachGlobalClicks();
    setupMonthButtons();
  } catch (err) {
    console.error('Error cargando CSV:', err);
  }
}

/* ---------- parse CSV ---------- */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n').filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
  const possibleBranches = ['branch','sucursal','store','store_name','branch_name'];
  branchFieldName = headers.find(h => possibleBranches.includes(h.toLowerCase())) || null;

  salesData = lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      const key = h.trim();
      const raw = cols[i] !== undefined ? cols[i].trim() : '';
      if (['units','price','revenue'].includes(key)) obj[key] = parseFloat(raw) || 0;
      else obj[key] = raw;
    });
    return obj;
  });
}

/* ---------- populate filters ---------- */
function populateFilters() {
  const productSet = Array.from(new Set(salesData.map(d => d.product_name).filter(Boolean))).sort();
  const channelSet = Array.from(new Set(salesData.map(d => d.channel).filter(Boolean))).sort();
  const branchSet = branchFieldName ? Array.from(new Set(salesData.map(d => d[branchFieldName]).filter(Boolean))).sort() : [];

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

    panelEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', onCheckboxChange));
  }

  renderPanel(document.getElementById('productPanel'), productSet, 'product');
  renderPanel(document.getElementById('channelPanel'), channelSet, 'channel');
  renderPanel(document.getElementById('branchPanel'), branchSet, 'branch');

  setupDropdown('productBtn','productPanel','productBtnLabel');
  setupDropdown('channelBtn','channelPanel','channelBtnLabel');
  setupDropdown('branchBtn','branchPanel','branchBtnLabel');

  const monthsEl = document.getElementById('monthsFilter');
  monthsEl.addEventListener('change', updateDashboard);

  const toggle = document.getElementById('toggleSwitch');
  toggle.addEventListener('click', () => {
    showCompact = !showCompact;
    toggle.classList.toggle('on', showCompact);
    toggle.classList.toggle('off', !showCompact);
    toggle.setAttribute('aria-pressed', String(showCompact));
    updateCards();
  });

  const collapseBtn = document.getElementById('collapseBtn');
  const resetBtn = document.getElementById('resetFilters');
  const sidebar = document.getElementById('sidebar');
  const collapseIcon = document.getElementById('collapseIcon');

  collapseBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    document.querySelectorAll('.hide-when-collapsed').forEach(el => el.style.display = sidebar.classList.contains('collapsed') ? 'none':'block');
    collapseIcon.innerHTML = sidebar.classList.contains('collapsed')
      ? `<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>`
      : `<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>`;
  });

  resetBtn.addEventListener('click', () => {
    monthsEl.value = 12;
    ['product','channel','branch'].forEach(k=>{
      const panel = document.getElementById(k+'Panel');
      panel.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked=(cb.dataset.val==='all'));
      selection[k]='all';
      updateBtnLabel(k);
    });
    showCompact = true;
    toggle.classList.add('on'); toggle.classList.remove('off');
    updateDashboard();
  });

  document.getElementById('metricSelector').addEventListener('change', updateDashboard);
}

/* ---------- helpers ---------- */
function slug(s){ return String(s).toLowerCase().replace(/\s+/g,'_').replace(/[^\w\-]+/g,''); }
function escapeHtml(s){ if(!s)return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function setupDropdown(buttonId, panelId, labelId){
  const btn=document.getElementById(buttonId);
  const panel=document.getElementById(panelId);
  if(!btn||!panel)return;
  btn.addEventListener('click',(e)=>{
    e.stopPropagation();
    const isHidden = panel.classList.contains('hidden');
    document.querySelectorAll('.dd-panel').forEach(p=>{if(p!==panel)p.classList.add('hidden');});
    panel.classList.toggle('hidden', !isHidden);
    btn.setAttribute('aria-expanded', !isHidden);
  });
}

function attachGlobalClicks(){
  document.addEventListener('click', e=>{
    if(!e.target.closest('.dd-panel') && !e.target.closest('.dd-btn')){
      document.querySelectorAll('.dd-panel').forEach(p=>p.classList.add('hidden'));
    }
  });
}

function onCheckboxChange(e){
  const cb=e.target; const key=cb.dataset.key; const val=cb.dataset.val;
  const panel=document.getElementById(key+'Panel');
  if(!panel)return;

  if(val==='all'&&cb.checked){
    panel.querySelectorAll('input[type=checkbox]').forEach(i=>{if(i.dataset.val!=='all')i.checked=false;});
    selection[key]='all';
  } else if(val==='all'&&!cb.checked){
    selection[key]='all'; cb.checked=true;
  } else {
    panel.querySelector('input[data-val="all"]').checked=false;
    const chosen = Array.from(panel.querySelectorAll('input[type=checkbox]')).filter(i=>i.checked && i.dataset.val!=='all').map(i=>i.dataset.val);
    selection[key] = chosen.length ? chosen : 'all';
  }
  updateBtnLabel(key);
  updateDashboard();
}

function updateBtnLabel(key){
  const label=document.getElementById(key+'BtnLabel'); if(!label)return;
  const sel=selection[key];
  label.textContent=(sel==='all')?'Todos':Array.isArray(sel)?(sel.length===1?sel[0]:`${sel.length} seleccionados`):'Todos';
}

/* ---------- Dashboard ---------- */
function updateDashboard() {
  updateCards();
}

function updateCards(){
  const sel={...selection};
  const months=parseInt(document.getElementById('monthsFilter').value)||12;
  let filtered=salesData.slice();
  if(sel.product!=='all') filtered=filtered.filter(d=>sel.product.includes(d.product_name));
  if(sel.channel!=='all') filtered=filtered.filter(d=>sel.channel.includes(d.channel));
  if(branchFieldName && sel.branch!=='all') filtered=filtered.filter(d=>sel.branch.includes(d[branchFieldName]));

  const dateKeys=Array.from(new Set(filtered.map(d=>(d.date||'').slice(0,7)))).sort();
  const lastKeys=dateKeys.slice(-months);
  filtered=filtered.filter(d=>lastKeys.includes((d.date||'').slice(0,7)));

  const totalRevenue=filtered.reduce((s,d)=>s+(d.revenue||0),0);
  const totalUnits=filtered.reduce((s,d)=>s+(d.units||0),0);
  const avgPrice=totalUnits? totalRevenue/totalUnits : 0;

  setValue('salesCard', totalRevenue,true);
  setValue('customersCard', totalUnits,false);
  setValue('ordersCard', avgPrice,true,{forceExact:true,decimals:1});

  updateChart(filtered);
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
    data:{ labels, datasets:[{ label:'', data:values, borderColor:'rgba(59,130,246,1)', backgroundColor:gradient, fill:true, tension:0.3, pointRadius:3 }] },
    options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ display:true }, y:{ display:true } } }
  });
}

/* ---------- Util ---------- */
function setValue(id,value,money=false,options={forceExact:false,decimals:0}){
  const el=document.getElementById(id); if(!el)return;
  if(options.forceExact){ el.textContent=(money?'$':'')+value.toFixed(options.decimals); return; }
  el.textContent=(money?'$':'')+Math.round(value).toLocaleString('es-AR');
}

/* ---------- Mes buttons + / - ---------- */
function setupMonthButtons() {
  const monthsEl = document.getElementById('monthsFilter');
  document.getElementById('increaseMonths').addEventListener('click', () => { monthsEl.value = parseInt(monthsEl.value||12)+1; updateDashboard(); });
  document.getElementById('decreaseMonths').addEventListener('click', () => { monthsEl.value = Math.max(1,parseInt(monthsEl.value||12)-1); updateDashboard(); });
}
