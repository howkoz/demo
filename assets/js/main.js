// main.js - wire up Gridstack, filter bar, ticker, and widget renders.

(async function(){
  // Filter state
  const filter = { days: 365, market: '__ALL__' };

  // Load data
  try {
    await window.PortalData.load();
  } catch (e){
    console.error('Failed to load demo data', e);
    const t = document.getElementById('ticker-track');
    if (t) t.innerHTML = '<span class="ticker-loading">failed to load data: ' + e.message + '</span>';
    return;
  }

  // Populate market dropdown
  const sel = document.getElementById('market-filter');
  const markets = window.PortalData.state.markets.slice().sort((a,b) => a.code.localeCompare(b.code));
  for (const m of markets){
    const opt = document.createElement('option');
    opt.value = m.code;
    opt.textContent = m.code + ' - ' + m.name;
    sel.appendChild(opt);
  }

  // Gridstack init
  const grid = GridStack.init({
    column:12, cellHeight:62, margin:6, float:true,
    animate:false, disableOneColumnMode:true, resizable:{handles:'se,sw,ne,nw,e,w,s,n'}
  });
  grid.on('resizestop', () => {
    // Give Apex a beat to pick up new size
    setTimeout(() => window.PortalWidgets.renderAll(filter), 100);
  });

  // Window label
  function updateWindowLabel(){
    const rows = window.PortalData.state.approval;
    if (!rows.length) return;
    const max = rows.reduce((m, r) => r.date > m ? r.date : m, rows[0].date);
    const cutoff = new Date(max);
    cutoff.setDate(cutoff.getDate() - filter.days + 1);
    const from = cutoff.toISOString().slice(0,10);
    document.getElementById('window-label').textContent = from + ' -> ' + max + ' (' + filter.days + 'd)';
  }

  // Range buttons
  const rangeRow = document.getElementById('range-buttons');
  rangeRow.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    rangeRow.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filter.days = parseInt(btn.dataset.days, 10);
    updateWindowLabel();
    window.PortalWidgets.renderAll(filter);
  });

  sel.addEventListener('change', () => {
    filter.market = sel.value;
    window.PortalWidgets.renderAll(filter);
  });

  document.getElementById('reset-layout').addEventListener('click', () => {
    location.reload();
  });

  // Footer gen date
  const gd = document.getElementById('gen-date');
  if (gd) gd.textContent = (window.PortalData.state.generatedAt || '').slice(0,16).replace('T',' ');

  // First paint
  updateWindowLabel();
  window.PortalTicker.render();
  window.PortalWidgets.renderAll(filter);
})();
