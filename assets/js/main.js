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
    animate:false, disableOneColumnMode:true, resizable:{handles:'se,sw,ne,nw,e,w,s,n'},
    handle:'.widget-head'
  });
  grid.on('resizestop', () => {
    // Give Apex a beat to pick up new size
    setTimeout(() => window.PortalWidgets.renderAll(filter), 100);
  });

  // ------- Layout persistence -------
  // Bump the vN suffix whenever index.html default positions change so saved
  // layouts don't shadow the new arrangement.
  const LS_LAYOUT = 'portal9094.layout.v2';
  const LS_HIDDEN = 'portal9094.hidden.v1';
  // One-time cleanup of the v1 key from earlier visits
  try { localStorage.removeItem('portal9094.layout.v1'); } catch(e){}

  function saveLayout(){
    try {
      const data = grid.save(false);
      localStorage.setItem(LS_LAYOUT, JSON.stringify(data));
    } catch(e){ /* ignore */ }
  }
  function restoreLayout(){
    try {
      const raw = localStorage.getItem(LS_LAYOUT);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved) || !saved.length) return;
      // Match saved items by widget id (data-widget) to current DOM nodes
      grid.batchUpdate();
      for (const row of saved){
        if (!row.id) continue;
        const el = document.querySelector('[data-widget="'+row.id+'"]');
        if (!el) continue;
        const item = el.closest('.grid-stack-item');
        if (!item) continue;
        grid.update(item, {x:row.x, y:row.y, w:row.w, h:row.h});
      }
      grid.commit();
    } catch(e){ /* ignore */ }
  }
  // Tag each grid-stack-item with gs-id = its data-widget so save/load can match by id
  document.querySelectorAll('.grid-stack-item').forEach(item => {
    const w = item.querySelector('[data-widget]');
    if (w) item.setAttribute('gs-id', w.getAttribute('data-widget'));
  });

  grid.on('change', () => { saveLayout(); });
  restoreLayout();

  // ------- Hidden widgets -------
  function getHidden(){
    try { return new Set(JSON.parse(localStorage.getItem(LS_HIDDEN) || '[]')); }
    catch(e){ return new Set(); }
  }
  function setHidden(set){
    localStorage.setItem(LS_HIDDEN, JSON.stringify(Array.from(set)));
  }
  function applyHidden(){
    const hidden = getHidden();
    document.querySelectorAll('[data-widget]').forEach(w => {
      const key = w.getAttribute('data-widget');
      const item = w.closest('.grid-stack-item');
      if (!item) return;
      item.style.display = hidden.has(key) ? 'none' : '';
    });
  }
  applyHidden();

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
    localStorage.removeItem(LS_LAYOUT);
    localStorage.removeItem(LS_HIDDEN);
    location.reload();
  });

  // Footer gen date
  const gd = document.getElementById('gen-date');
  if (gd) gd.textContent = (window.PortalData.state.generatedAt || '').slice(0,16).replace('T',' ');

  // First paint
  updateWindowLabel();
  window.PortalTicker.render();
  window.PortalWidgets.renderAll(filter);

  // ------- Widget drill links (explicit button, keeps head as drag handle) -------
  const WIDGET_META = {
    'ai-chat':           {title:'Ask the Portal',                     link:null},
    'approval-trend':    {title:'Approval Rate Trend',                link:'pages/widgets/approval-trend.html'},
    'rates':             {title:'Processing / Refund / CB Rates',     link:'pages/widgets/rates.html'},
    'activity-feed':     {title:'Activity Feed',                      link:'pages/widgets/activity-feed.html'},
    'processing-fees':   {title:'Processing Fees',                    link:'pages/widgets/processing-fees.html'},
    'cb-health':         {title:'Chargeback Health',                  link:'pages/widgets/cb-health.html'},
    'retry-ladder':      {title:'Retry Ladder',                       link:'pages/widgets/retry-ladder.html'},
    'volume-by-market':  {title:'Volume by Market',                   link:'pages/widgets/volume-by-market.html'},
    'top-declines':      {title:'Top Declines',                       link:'pages/widgets/top-declines.html'},
    'commissions':       {title:'Commissions',                        link:'pages/widgets/commissions.html'},
    'fraud':             {title:'Fraud & Abuse',                      link:'pages/widgets/fraud.html'},
    'globe':             {title:'Global Distribution',                link:'pages/widgets/globe.html'},
    'provider-directory':{title:'Provider Directory',                 link:null}
  };

  // Inject drill anchor + hide button into each widget head.
  // The anchor stops mousedown so Gridstack drag doesn't fire.
  document.querySelectorAll('.widget[data-widget]').forEach(w => {
    const key = w.getAttribute('data-widget');
    const meta = WIDGET_META[key] || {};
    const head = w.querySelector('.widget-head');
    if (!head) return;

    // Hide button (x)
    const hide = document.createElement('button');
    hide.className = 'widget-hide';
    hide.innerHTML = '&times;';
    hide.title = 'Hide widget';
    hide.addEventListener('mousedown', e => e.stopPropagation());
    hide.addEventListener('click', e => {
      e.stopPropagation();
      const h = getHidden(); h.add(key); setHidden(h); applyHidden();
      refreshCustomizeList();
    });

    // Drill link (only if the widget has a backup page)
    if (meta.link){
      const a = document.createElement('a');
      a.className = 'widget-drill';
      a.href = meta.link;
      a.innerHTML = 'OPEN &#8599;';
      a.title = 'Open widget detail page';
      a.addEventListener('mousedown', e => e.stopPropagation());
      head.appendChild(a);
    }
    head.appendChild(hide);
  });

  // ------- Customize panel -------
  const panel = document.getElementById('customize-panel');
  const panelBody = document.getElementById('customize-body');
  const customizeBtn = document.getElementById('customize-btn');
  const closeBtn = document.getElementById('customize-close');

  // Curated preset sets. Each lists the widgets that should be VISIBLE in that view.
  const VIEW_MODES = {
    'ops':     ['ai-chat','activity-feed','approval-trend','rates','cb-health','top-declines','retry-ladder'],
    'revenue': ['ai-chat','activity-feed','volume-by-market','processing-fees','commissions','globe','provider-directory'],
    'risk':    ['ai-chat','activity-feed','cb-health','top-declines','fraud','retry-ladder','approval-trend'],
    'all':     Object.keys(WIDGET_META)
  };
  function applyViewMode(mode){
    const visible = new Set(VIEW_MODES[mode] || VIEW_MODES.all);
    const hidden = new Set();
    for (const key of Object.keys(WIDGET_META)){
      if (!visible.has(key)) hidden.add(key);
    }
    setHidden(hidden);
    applyHidden();
    refreshCustomizeList();
  }

  function refreshCustomizeList(){
    const hidden = getHidden();
    const presets =
      '<div class="view-modes">' +
        '<div class="view-modes-label">QUICK VIEWS</div>' +
        '<div class="view-modes-row">' +
          '<button class="view-mode-btn" data-mode="ops">Ops</button>' +
          '<button class="view-mode-btn" data-mode="revenue">Revenue</button>' +
          '<button class="view-mode-btn" data-mode="risk">Risk</button>' +
          '<button class="view-mode-btn" data-mode="all">All</button>' +
        '</div>' +
      '</div>';
    const rows = Object.keys(WIDGET_META).map(key => {
      const meta = WIDGET_META[key];
      const checked = !hidden.has(key);
      return '<label class="customize-row">' +
        '<input type="checkbox" data-widget-key="' + key + '"' + (checked ? ' checked' : '') + '>' +
        '<span>' + meta.title + '</span>' +
      '</label>';
    }).join('');
    panelBody.innerHTML = presets + rows;
    panelBody.querySelectorAll('input[data-widget-key]').forEach(cb => {
      cb.addEventListener('change', () => {
        const key = cb.getAttribute('data-widget-key');
        const h = getHidden();
        if (cb.checked) h.delete(key); else h.add(key);
        setHidden(h);
        applyHidden();
      });
    });
    panelBody.querySelectorAll('.view-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => applyViewMode(btn.dataset.mode));
    });
  }
  refreshCustomizeList();

  customizeBtn.addEventListener('click', () => { panel.classList.toggle('open'); });
  closeBtn.addEventListener('click', () => { panel.classList.remove('open'); });
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('open')) return;
    if (panel.contains(e.target) || customizeBtn.contains(e.target)) return;
    panel.classList.remove('open');
  });
})();
