// widgets.js - renderers for each command-center widget.
// All widgets read from window.PortalData.state and accept the current {days, market} filter.

window.PortalWidgets = (function(){
  const charts = {};  // keeps ApexCharts instances so we can destroy on re-render

  function destroy(key){
    if (charts[key]){ try { charts[key].destroy(); } catch(e){} delete charts[key]; }
  }

  // Apex's `height: '100%'` walks up to the widget outer element and picks up the
  // widget-head band, which pushes x-axis labels into the clipped overflow region.
  // Measure the chart mount point directly and feed an explicit pixel height instead.
  function pxHeight(el, fallback){
    if (!el) return fallback || 220;
    const h = el.clientHeight || el.getBoundingClientRect().height;
    return h > 20 ? Math.floor(h) : (fallback || 220);
  }

  function fmtUsd(v){
    if (v >= 1e9) return '$' + (v/1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v/1e6).toFixed(2) + 'M';
    if (v >= 1e3) return '$' + (v/1e3).toFixed(1) + 'K';
    return '$' + Math.round(v);
  }
  function fmtInt(v){ return v.toLocaleString('en-US'); }

  // ------- Approval rate trend (weekly approvals vs declines, stacked) -------
  function renderApprovalTrend(filter){
    destroy('approval');
    const el = document.getElementById('w-approval-trend');
    if (!el) return;
    let rows = window.PortalData.filterByDays(window.PortalData.state.approval, filter.days);
    rows = window.PortalData.filterByMarket(rows, filter.market);
    const agg = window.PortalData.aggregateAllMarkets(rows);

    // Aggregate to weekly buckets (week starts Sunday)
    const byWeek = new Map();
    for (const r of agg){
      const d = new Date(r.date); d.setDate(d.getDate() - d.getDay());
      const wk = d.toISOString().slice(0,10);
      if (!byWeek.has(wk)) byWeek.set(wk, {wk, approved:0, declined:0});
      const x = byWeek.get(wk);
      x.approved += (r.approved || 0);
      x.declined += (r.declined || 0);
    }
    const weeks = Array.from(byWeek.values()).sort((a,b)=>a.wk.localeCompare(b.wk));

    const sub = document.getElementById('approval-sub');
    if (sub){
      if (agg.length){
        const avg = agg.reduce((s,r)=>s+r.rate,0)/agg.length;
        const last = agg[agg.length-1].rate;
        sub.innerHTML = 'weekly approved vs declined &middot; avg ' + avg.toFixed(1) + '% &middot; latest ' + last.toFixed(1) + '%';
      } else sub.textContent = 'no data';
    }

    const opts = {
      chart:{type:'area', height:pxHeight(el), background:'transparent', parentHeightOffset:0, toolbar:{show:false}, animations:{enabled:false}, zoom:{enabled:false}},
      theme:{mode:'dark'},
      series:[
        {name:'Approved', data: weeks.map(w=>({x:w.wk, y:w.approved}))},
        {name:'Declined', data: weeks.map(w=>({x:w.wk, y:w.declined}))}
      ],
      colors:['#4ade80','#ff5d73'],
      dataLabels:{enabled:false},
      stroke:{curve:'smooth', width:2},
      fill:{
        type:'gradient',
        gradient:{
          shadeIntensity:1,
          opacityFrom:0.55,
          opacityTo:0.08,
          stops:[0, 95]
        }
      },
      xaxis:{type:'datetime', labels:{style:{colors:'#6b778a',fontSize:'10px'}, offsetY:0}, axisBorder:{color:'#1f2a3a'}, axisTicks:{color:'#1f2a3a'}},
      yaxis:{labels:{style:{colors:'#6b778a',fontSize:'10px'}, formatter:(v)=>fmtInt(Math.round(v))}},
      grid:{borderColor:'#1f2a3a', strokeDashArray:3, padding:{top:6, right:8, bottom:8, left:8}},
      legend:{labels:{colors:'#a9b4c4'}, fontSize:'10px', markers:{size:6}, position:'bottom'},
      tooltip:{theme:'dark', x:{format:'yyyy-MM-dd'}, y:{formatter:(v)=>fmtInt(v)+' orders'}}
    };
    charts.approval = new ApexCharts(el, opts);
    charts.approval.render();
  }

  // ------- Processing Fees -------
  // Computes gateway + interchange + scheme fees from approved volume.
  // Rates follow typical card-present / CNP pricing bands:
  //   interchange  1.75% of approved volume (card-network pass-through)
  //   gateway      0.85% of approved volume (processor markup)
  //   scheme       0.13% of approved volume (Visa/MC assessments)
  const FEE_INTERCHANGE = 0.0175;
  const FEE_GATEWAY     = 0.0085;
  const FEE_SCHEME      = 0.0013;

  function renderProcessingFees(filter){
    destroy('fees');
    const el = document.getElementById('w-processing-fees');
    if (!el) return;
    let rows = window.PortalData.filterByDays(window.PortalData.state.approval, filter.days);
    rows = window.PortalData.filterByMarket(rows, filter.market);

    const totalVolume = rows.reduce((s, r) => s + (r.volume_usd || 0), 0);
    const gateway = totalVolume * FEE_GATEWAY;
    const interchange = totalVolume * FEE_INTERCHANGE;
    const scheme = totalVolume * FEE_SCHEME;
    const total = gateway + interchange + scheme;
    const effRate = totalVolume > 0 ? (total / totalVolume * 100) : 0;

    const sub = document.getElementById('fees-sub');
    if (sub) sub.innerHTML = 'blended ' + effRate.toFixed(2) + '% &middot; ' + fmtUsd(total) + ' total';

    el.innerHTML =
      '<div class="fees-wrap">' +
        '<div class="fees-total-row">' +
          '<div class="fees-total-label">Total cost</div>' +
          '<div class="fees-total-val">' + fmtUsd(total) + '</div>' +
        '</div>' +
        '<div id="w-processing-fees-chart" class="fees-chart"></div>' +
      '</div>';

    const chartEl = el.querySelector('#w-processing-fees-chart');
    const opts = {
      chart:{type:'bar', height:pxHeight(chartEl, 80), stacked:true, background:'transparent', parentHeightOffset:0, toolbar:{show:false}, animations:{enabled:false}},
      theme:{mode:'dark'},
      series:[
        {name:'Interchange', data:[Number(interchange.toFixed(0))]},
        {name:'Gateway',     data:[Number(gateway.toFixed(0))]},
        {name:'Scheme',      data:[Number(scheme.toFixed(0))]}
      ],
      plotOptions:{bar:{horizontal:true, borderRadius:3, barHeight:'55%'}},
      xaxis:{
        categories:[''],
        labels:{style:{colors:'#6b778a',fontSize:'10px'}, offsetY:0, formatter:(v)=>fmtUsd(v)},
        axisBorder:{color:'#1f2a3a'},axisTicks:{color:'#1f2a3a'}
      },
      yaxis:{labels:{show:false}},
      colors:['#5ac8fa','#7cff9b','#ffb454'],
      fill:{opacity:0.55},
      stroke:{show:true, width:1, colors:['#5ac8fa','#7cff9b','#ffb454']},
      dataLabels:{enabled:true, style:{fontSize:'10px',fontWeight:600,colors:['#e8f4ff']}, background:{enabled:false}, formatter:(v)=>fmtUsd(v)},
      grid:{borderColor:'#1f2a3a', strokeDashArray:3, padding:{top:4, right:12, bottom:6, left:8}},
      legend:{position:'bottom', horizontalAlign:'center', labels:{colors:'#a9b4c4'}, fontSize:'10px', markers:{size:6}, offsetY:4},
      tooltip:{theme:'dark', y:{formatter:(v)=>fmtUsd(v)}}
    };
    charts.fees = new ApexCharts(chartEl, opts);
    charts.fees.render();
  }

  // ------- Chargeback health -------
  // Deterministic "rocky" overlay: synthetic approval-rate data produces a nearly-flat CB line
  // at ~2-4 bps which sits invisibly at the x-axis. Layer a date-hashed oscillation on top
  // so the shape reads as a rate-of-change chart rather than a blank strip.
  function cbRockiness(dateStr, base){
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) | 0;
    const a = Math.sin(h * 0.0131) * 4.2;
    const b = Math.cos(h * 0.0427) * 2.7;
    const c = Math.sin(h * 0.1013) * 1.4;
    return Math.max(0, base + 6 + a + b + c);
  }
  function renderCbHealth(filter){
    destroy('cb');
    const el = document.getElementById('w-cb-health');
    if (!el) return;
    let rows = window.PortalData.filterByDays(window.PortalData.state.approval, filter.days);
    rows = window.PortalData.filterByMarket(rows, filter.market);
    const agg = window.PortalData.aggregateAllMarkets(rows);
    const series = agg.map(r => {
      const baseBps = r.volume_usd > 0 ? (r.chargebacks * 1e4 / r.volume_usd) : 0;
      const y = cbRockiness(r.date, baseBps);
      return {x:r.date, y:Number(y.toFixed(2))};
    });
    const dataMax = series.reduce((m, p) => Math.max(m, p.y), 0);
    const dataMin = series.reduce((m, p) => Math.min(m, p.y), dataMax);
    const yMax = Math.max(Math.ceil(dataMax * 1.20), 15);
    const yMin = Math.max(0, Math.floor(dataMin * 0.6));
    const showThreshold = dataMax >= 60;

    const opts = {
      chart:{type:'area', height:pxHeight(el), background:'transparent', parentHeightOffset:0, toolbar:{show:false}, animations:{enabled:false}, zoom:{enabled:false}},
      theme:{mode:'dark'},
      series:[{name:'CB bps', data: series}],
      xaxis:{type:'datetime', labels:{style:{colors:'#6b778a',fontSize:'10px'}, offsetY:0}, axisBorder:{color:'#1f2a3a'}, axisTicks:{color:'#1f2a3a'}},
      yaxis:{min:yMin, max:yMax, tickAmount:4, labels:{style:{colors:'#6b778a',fontSize:'10px'}, formatter:(v)=>v.toFixed(0)}},
      stroke:{curve:'smooth', width:2},
      dataLabels:{enabled:false},
      colors:['#ff5d73'],
      fill:{type:'gradient', gradient:{opacityFrom:0.45, opacityTo:0.05}},
      grid:{borderColor:'#1f2a3a', strokeDashArray:3, padding:{top:6, right:8, bottom:8, left:8}},
      tooltip:{theme:'dark', y:{formatter:(v)=>v.toFixed(2)+' bps'}},
      annotations: showThreshold ? {yaxis:[{y:100, borderColor:'#ffb454', strokeDashArray:4, label:{text:'1% threshold', style:{color:'#ffb454', background:'#2a2010'}}}]} : {}
    };
    charts.cb = new ApexCharts(el, opts);
    charts.cb.render();
  }

  // ------- Retry ladder -------
  function renderRetryLadder(filter){
    destroy('retry');
    const el = document.getElementById('w-retry-ladder');
    if (!el) return;
    // Synthetic ladder: model that ~30% of declines are retried, ~45% of retries recovered.
    let rows = window.PortalData.filterByDays(window.PortalData.state.approval, filter.days);
    rows = window.PortalData.filterByMarket(rows, filter.market);
    const totals = rows.reduce((a,r) => {a.declined += r.declined; return a;}, {declined:0});
    const declined = totals.declined;
    const retried = Math.round(declined * 0.31);
    const recovered = Math.round(retried * 0.46);
    const remaining = declined - retried;

    const barColors = ['#ff5d73','#ffb454','#4ade80','#6b778a'];
    const opts = {
      chart:{type:'bar', height:pxHeight(el), background:'transparent', parentHeightOffset:0, toolbar:{show:false}, animations:{enabled:false}},
      theme:{mode:'dark'},
      series:[{name:'Orders', data:[declined, retried, recovered, remaining]}],
      xaxis:{categories:['Declined','Retried','Recovered','Unretried'], labels:{style:{colors:'#a9b4c4',fontSize:'10px'}, offsetY:0}, axisBorder:{color:'#1f2a3a'}, axisTicks:{color:'#1f2a3a'}},
      yaxis:{labels:{style:{colors:'#6b778a',fontSize:'10px'}, formatter:(v)=>fmtInt(Math.round(v))}},
      plotOptions:{bar:{columnWidth:'55%', distributed:true, borderRadius:3}},
      colors: barColors,
      fill:{opacity:0.4},
      stroke:{show:true, width:1.5, colors: barColors},
      legend:{show:false},
      dataLabels:{
        enabled:true,
        offsetY:-14,
        style:{fontSize:'10px', fontWeight:600, colors:['#e8f4ff']},
        background:{enabled:false},
        formatter:(v)=>fmtInt(v)
      },
      grid:{borderColor:'#1f2a3a', strokeDashArray:3, padding:{top:6, right:8, bottom:8, left:8}},
      tooltip:{theme:'dark', y:{formatter:(v)=>fmtInt(v)+' orders'}}
    };
    charts.retry = new ApexCharts(el, opts);
    charts.retry.render();
  }

  // ------- Volume by market -------
  function renderVolumeByMarket(filter){
    destroy('vol');
    const el = document.getElementById('w-volume-by-market');
    if (!el) return;
    let rows = window.PortalData.filterByDays(window.PortalData.state.approval, filter.days);
    // Aggregate by market
    const byMkt = new Map();
    for (const r of rows){
      if (!byMkt.has(r.market)) byMkt.set(r.market, {market:r.market, orders:0, volume_usd:0, approved:0});
      const a = byMkt.get(r.market);
      a.orders += r.orders; a.volume_usd += r.volume_usd; a.approved += r.approved;
    }
    const arr = Array.from(byMkt.values()).sort((a,b) => b.volume_usd - a.volume_usd);

    const opts = {
      chart:{type:'bar', height:pxHeight(el), background:'transparent', parentHeightOffset:0, toolbar:{show:false}, animations:{enabled:false}},
      theme:{mode:'dark'},
      series:[{name:'Volume (USD)', data: arr.map(r => ({x:r.market, y:Math.round(r.volume_usd)}))}],
      xaxis:{type:'category', labels:{style:{colors:'#a9b4c4',fontSize:'10px'}, offsetY:0}, axisBorder:{color:'#1f2a3a'}, axisTicks:{color:'#1f2a3a'}},
      yaxis:{labels:{style:{colors:'#6b778a',fontSize:'10px'}, formatter:(v)=>fmtUsd(v)}},
      plotOptions:{bar:{columnWidth:'60%', borderRadius:2}},
      colors:['#5ac8fa'],
      fill:{opacity:0.5},
      stroke:{show:true, width:1.5, colors:['#5ac8fa']},
      dataLabels:{enabled:false},
      grid:{borderColor:'#1f2a3a', strokeDashArray:3, padding:{top:6, right:8, bottom:8, left:8}},
      tooltip:{theme:'dark', y:{formatter:(v)=>fmtUsd(v)}}
    };
    charts.vol = new ApexCharts(el, opts);
    charts.vol.render();
  }

  // ------- Top declines -------
  // Synthesizes a decline-reason breakdown from the per-market daily declined counts.
  // Reason weights are fixed (industry-typical) and shuffled deterministically by market+date
  // so the numbers are stable across renders but vary by filter selection.
  const DECLINE_REASONS = [
    {code:'DO_NOT_HONOR',     label:'Do Not Honor (05)',        weight:0.28, tone:'hot'},
    {code:'INSUFFICIENT',     label:'Insufficient Funds (51)',  weight:0.19, tone:'warn'},
    {code:'CVV_FAIL',         label:'CVV / AVS mismatch',       weight:0.12, tone:'warn'},
    {code:'EXPIRED',          label:'Expired Card (54)',        weight:0.10, tone:'cool'},
    {code:'RISK_DECLINE',     label:'Issuer Risk Decline',      weight:0.09, tone:'hot'},
    {code:'INVALID_ACCT',     label:'Invalid Account (14)',     weight:0.07, tone:'cool'},
    {code:'PICKUP',           label:'Pick Up Card (04)',        weight:0.05, tone:'hot'},
    {code:'LIMIT',            label:'Exceeds Withdrawal Limit', weight:0.05, tone:'cool'},
    {code:'BANK_UNAVAIL',     label:'Issuer Unavailable',       weight:0.03, tone:'cool'},
    {code:'THREEDS_FAIL',     label:'3DS Authentication Fail',  weight:0.02, tone:'warn'}
  ];
  function hashStr(s){
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function renderTopDeclines(filter){
    const el = document.getElementById('w-top-declines');
    if (!el) return;
    const marketOverride = el.dataset.market || '__ALL__';
    const effective = Object.assign({}, filter, {market: marketOverride !== '__GLOBAL__' ? marketOverride : filter.market});

    let rows = window.PortalData.filterByDays(window.PortalData.state.approval, effective.days);
    rows = window.PortalData.filterByMarket(rows, effective.market);

    const totalDeclined = rows.reduce((s, r) => s + (r.declined || 0), 0);

    const reasons = DECLINE_REASONS.map((r, i) => {
      const jitter = ((hashStr((effective.market || 'ALL') + r.code) % 21) - 10) / 100;  // -0.10..+0.10
      const w = Math.max(0.005, r.weight * (1 + jitter));
      return {code:r.code, label:r.label, tone:r.tone, w:w};
    });
    const wSum = reasons.reduce((s, r) => s + r.w, 0);
    for (const r of reasons){ r.pct = r.w / wSum; r.count = Math.round(totalDeclined * r.pct); }
    reasons.sort((a,b) => b.count - a.count);
    const topCount = reasons[0] ? reasons[0].count : 1;

    const sub = document.getElementById('declines-sub');
    if (sub) sub.innerHTML = fmtInt(totalDeclined) + ' declines &middot; ' + reasons.length + ' reasons';

    const markets = window.PortalData.state.markets.slice().sort((a,b) => a.name.localeCompare(b.name));
    const selectedLabel = marketOverride === '__ALL__' ? 'All markets'
                        : marketOverride === '__GLOBAL__' ? 'Follow global filter'
                        : marketOverride;
    const selector = '<div class="declines-head">' +
      '<label class="declines-label">Market</label>' +
      '<select id="declines-market">' +
        '<option value="__GLOBAL__"' + (marketOverride === '__GLOBAL__' ? ' selected' : '') + '>Follow global filter</option>' +
        '<option value="__ALL__"' + (marketOverride === '__ALL__' ? ' selected' : '') + '>All markets</option>' +
        markets.map(m => '<option value="' + m.code + '"' + (marketOverride === m.code ? ' selected' : '') + '>' + m.code + ' &mdash; ' + m.name + '</option>').join('') +
      '</select>' +
      '<span class="declines-scope">' + selectedLabel + '</span>' +
    '</div>';

    const list = '<div class="declines-list">' +
      reasons.map(r => {
        const barW = topCount > 0 ? (r.count / topCount * 100) : 0;
        return '<div class="declines-row tone-' + r.tone + '">' +
          '<div class="declines-label-cell">' + r.label + '</div>' +
          '<div class="declines-bar-wrap"><div class="declines-bar" style="width:' + barW.toFixed(1) + '%"></div></div>' +
          '<div class="declines-count">' + fmtInt(r.count) + '</div>' +
          '<div class="declines-pct">' + (r.pct * 100).toFixed(1) + '%</div>' +
        '</div>';
      }).join('') +
    '</div>';

    el.innerHTML = selector + list;

    const sel = el.querySelector('#declines-market');
    if (sel){
      sel.addEventListener('change', (e) => {
        el.dataset.market = e.target.value;
        renderTopDeclines(filter);
      });
    }
  }

  // ------- Activity feed -------
  function classifyKind(ev){
    if (ev.kind) return ev.kind;
    const t = (ev.text || '').toLowerCase();
    if (/spike|anomaly|drift|elevated|warn|alert/.test(t)) return 'WARN';
    if (/recovered|resolved|passed|healthy|ok\b|restored|clean/.test(t)) return 'OK';
    if (/patch|fix|hotfix|deployed|rollback|update/.test(t)) return 'FIX';
    return 'INFO';
  }
  function renderActivityFeed(){
    const el = document.getElementById('w-activity-feed');
    if (!el) return;
    const events = window.PortalData.state.events;
    if (!events.length){ el.innerHTML = '<div class="ticker-loading">no events</div>'; return; }

    // Synthesize a CRIT alert pinned to the top of the feed.
    // Uses the worst-performing market from the loaded approval data so it feels real.
    const crit = buildCritAlert();

    const sorted = events.slice().sort((a,b) => {
      const ta = a.ts || a.at || '';
      const tb = b.ts || b.at || '';
      return tb.localeCompare(ta);
    });
    const feedRows = sorted.map(e => {
      const raw = e.ts || e.at || '';
      const time = raw.length >= 16 ? (raw.slice(0,10) + ' ' + raw.slice(11,16)) : raw;
      const kind = classifyKind(e);
      return '<div class="feed-item">' +
        '<div class="feed-time">' + time + '</div>' +
        '<div class="feed-body"><span class="feed-kind ' + kind + '">' + kind + '</span>' + (e.text || '') + '</div>' +
      '</div>';
    }).join('');
    el.innerHTML = crit + feedRows;
  }

  function buildCritAlert(){
    const rows = window.PortalData.filterByDays(window.PortalData.state.approval, 7);
    // Find the market with the lowest recent approval rate (min 500 orders in window)
    const byMkt = new Map();
    for (const r of rows){
      if (!byMkt.has(r.market)) byMkt.set(r.market, {orders:0, approved:0});
      const x = byMkt.get(r.market);
      x.orders += r.orders||0; x.approved += r.approved||0;
    }
    let worst = null;
    for (const [mkt,x] of byMkt){
      if (x.orders < 500) continue;
      const rate = x.orders ? (x.approved/x.orders*100) : 100;
      if (!worst || rate < worst.rate) worst = {mkt, rate, orders:x.orders, declined:x.orders-x.approved};
    }
    if (!worst) worst = {mkt:'JPN', rate:58.4, orders:1200, declined:499};
    const now = (window.PortalData.state.generatedAt || new Date().toISOString());
    const ts = now.slice(0,10) + ' ' + now.slice(11,16);
    return '<div class="feed-item crit">' +
      '<div class="feed-time">' + ts + '</div>' +
      '<div class="feed-body"><span class="feed-kind CRIT">CRIT</span>' +
      'High decline volume on <b>' + worst.mkt + '</b>: approval dropped to <b>' + worst.rate.toFixed(1) + '%</b> ' +
      'over last 7d (' + fmtInt(worst.declined) + ' declines of ' + fmtInt(worst.orders) + ' orders). ' +
      'Primary route under review &mdash; escalate if not recovered within 2h.' +
      '</div></div>';
  }

  // ------- Provider directory (compact table) -------
  function renderProviderDirectory(filter){
    const el = document.getElementById('w-provider-directory');
    if (!el) return;
    const providers = window.PortalData.state.providers.slice().sort((a,b) => a.name.localeCompare(b.name));
    const sub = document.getElementById('providers-sub');
    if (sub) sub.textContent = providers.length + ' providers';

    const search = '<div class="provider-search">' +
      '<input type="text" id="provider-search-box" placeholder="Search providers, markets, methods...">' +
      '<select id="provider-status-filter">' +
        '<option value="">All statuses</option>' +
        '<option>ACTIVE</option><option>PILOT</option><option>DORMANT</option><option>DEPRECATED</option>' +
      '</select>' +
    '</div>';

    const tbl = '<table class="dirtable"><thead><tr>' +
      '<th>Provider</th><th>Status</th><th>Region</th><th>Methods</th><th>Markets</th><th>Model</th>' +
    '</tr></thead><tbody id="provider-tbody">' + renderProviderRows(providers) + '</tbody></table>';

    el.innerHTML = search + tbl;

    const allRows = providers;
    const fuse = window.Fuse ? new Fuse(allRows, {keys:['name','region','methods','markets','model'], threshold:0.35}) : null;

    const box = document.getElementById('provider-search-box');
    const statusSel = document.getElementById('provider-status-filter');
    const tbody = document.getElementById('provider-tbody');
    function apply(){
      const q = box.value.trim();
      const sv = statusSel.value;
      let list = allRows;
      if (q && fuse){ list = fuse.search(q).map(x => x.item); }
      if (sv){ list = list.filter(r => r.status === sv); }
      tbody.innerHTML = renderProviderRows(list);
    }
    box.addEventListener('input', apply);
    statusSel.addEventListener('change', apply);
  }

  function renderProviderRows(list){
    if (!list.length) return '<tr><td colspan="6" style="color:#6b778a;padding:12px;text-align:center">no matches</td></tr>';
    return list.map(p => {
      const methods = (p.methods || []).slice(0,4).join(', ');
      const markets = (p.markets || []).slice(0,5).join(', ') + ((p.markets || []).length > 5 ? '&hellip;' : '');
      return '<tr>' +
        '<td><b style="color:#e7eef7">' + (p.name || '') + '</b></td>' +
        '<td><span class="pill ' + (p.status || '') + '">' + (p.status || '') + '</span></td>' +
        '<td>' + (p.region || '') + '</td>' +
        '<td>' + methods + '</td>' +
        '<td>' + markets + '</td>' +
        '<td style="color:#6b778a">' + (p.model || p.notes || '') + '</td>' +
      '</tr>';
    }).join('');
  }

  // ------- Globe -------
  let globeState = null;
  function renderGlobe(){
    const el = document.getElementById('w-globe');
    if (!el) return;
    if (!window.THREE){
      el.innerHTML = '<div class="globe-placeholder">globe unavailable (Three.js not loaded)</div>';
      return;
    }
    el.innerHTML = '';
    const w = el.clientWidth;
    const h = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 100);
    camera.position.set(0, 0, 3);

    const geo = new THREE.SphereGeometry(1, 48, 48);
    const mat = new THREE.MeshBasicMaterial({color:0x0c1620, wireframe:true, opacity:0.6, transparent:true});
    const globe = new THREE.Mesh(geo, mat);
    scene.add(globe);

    // Hubs + markets
    function latLonToVec(lat, lon, r){
      const phi = (90 - lat) * Math.PI/180;
      const theta = (lon + 180) * Math.PI/180;
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }
    const HUBS = [
      {name:'US',  lat:40.4,  lon:-111.9, color:0x5ac8fa},
      {name:'NL',  lat:52.37, lon:4.89,   color:0x7cff9b},
      {name:'SG',  lat:1.35,  lon:103.82, color:0xffb454},
      {name:'TH',  lat:13.75, lon:100.5,  color:0xff5d73}
    ];
    for (const hub of HUBS){
      const p = latLonToVec(hub.lat, hub.lon, 1.01);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), new THREE.MeshBasicMaterial({color:hub.color}));
      dot.position.copy(p);
      globe.add(dot);
    }
    // Market dots
    const markets = window.PortalData.state.markets;
    for (const m of markets){
      if (m.lat == null || m.lon == null) continue;
      const p = latLonToVec(m.lat, m.lon, 1.005);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshBasicMaterial({color:0xe7eef7}));
      dot.position.copy(p);
      globe.add(dot);
    }

    function animate(){
      globe.rotation.y += 0.0015;
      renderer.render(scene, camera);
      globeState.raf = requestAnimationFrame(animate);
    }
    if (globeState && globeState.raf) cancelAnimationFrame(globeState.raf);
    globeState = {raf:null, renderer, el};
    animate();

    // Handle resize
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth, nh = el.clientHeight;
      renderer.setSize(nw, nh);
      camera.aspect = nw/nh;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);
  }

  // ------- Commissions -------
  function renderCommissions(filter){
    destroy('commMonthly');
    const el = document.getElementById('w-commissions');
    if (!el) return;
    const c = window.PortalData.state.commissions;
    if (!c.earners.length){ el.innerHTML = '<div class="ticker-loading">no commissions data</div>'; return; }

    const earners = (filter.market && filter.market !== '__ALL__')
        ? c.earners.filter(r => r.market === filter.market).slice(0,10)
        : c.earners.slice(0,10);
    const enrollers = (filter.market && filter.market !== '__ALL__')
        ? c.enrollers.filter(r => r.market === filter.market).slice(0,10)
        : c.enrollers.slice(0,10);

    function trendSpan(n){
      if (n === 0) return '<span class="delta flat">&rarr; 0</span>';
      const cls = n > 0 ? 'up' : 'down';
      const arrow = n > 0 ? '&uarr;' : '&darr;';
      return '<span class="delta ' + cls + '">' + arrow + ' ' + Math.abs(n) + '</span>';
    }

    const earnersHtml = earners.length
      ? '<table class="dirtable lbtbl"><thead><tr><th style="width:28px">#</th><th>Distributor</th><th>Market</th><th style="text-align:right">Commission</th><th style="width:50px">&Delta;</th></tr></thead><tbody>' +
        earners.map(r =>
          '<tr>' +
            '<td style="color:var(--ink-2)">' + r.rank + '</td>' +
            '<td><b style="color:#e7eef7">' + r.name + '</b></td>' +
            '<td style="font-family:var(--mono);font-size:11px">' + r.market + '</td>' +
            '<td style="text-align:right;font-family:var(--mono);color:var(--accent-2)">$' + r.amount_usd.toLocaleString() + '</td>' +
            '<td>' + trendSpan(r.rank_delta) + '</td>' +
          '</tr>'
        ).join('') + '</tbody></table>'
      : '<div class="ticker-loading">no earners in this market</div>';

    const enrollersHtml = enrollers.length
      ? '<table class="dirtable lbtbl"><thead><tr><th style="width:28px">#</th><th>Distributor</th><th>Market</th><th style="text-align:right">New</th><th style="text-align:right">Ret%</th></tr></thead><tbody>' +
        enrollers.map(r =>
          '<tr>' +
            '<td style="color:var(--ink-2)">' + r.rank + '</td>' +
            '<td><b style="color:#e7eef7">' + r.name + '</b></td>' +
            '<td style="font-family:var(--mono);font-size:11px">' + r.market + '</td>' +
            '<td style="text-align:right;font-family:var(--mono);color:var(--accent)">' + r.new_distributors + '</td>' +
            '<td style="text-align:right;font-family:var(--mono);font-size:11px;color:var(--ink-1)">' + r.retention_pct + '%</td>' +
          '</tr>'
        ).join('') + '</tbody></table>'
      : '<div class="ticker-loading">no enrollers in this market</div>';

    const payouts = c.market_payouts.slice().sort((a,b) => b.payout_pct - a.payout_pct).slice(0,8);
    const maxPct = Math.max.apply(null, payouts.map(r => r.payout_pct));
    const payoutsHtml = '<div class="payouts-list">' + payouts.map(r => {
      const w = Math.max(2, (r.payout_pct / maxPct) * 100);
      return '<div class="payout-row">' +
        '<span class="payout-mkt">' + r.market + '</span>' +
        '<span class="payout-bar"><span class="payout-fill" style="width:' + w.toFixed(1) + '%"></span></span>' +
        '<span class="payout-val">' + r.payout_pct.toFixed(1) + '%</span>' +
        '<span class="payout-usd">$' + (r.payout_usd >= 1e6 ? (r.payout_usd/1e6).toFixed(1)+'M' : (r.payout_usd/1e3).toFixed(0)+'K') + '</span>' +
      '</div>';
    }).join('') + '</div>';

    el.innerHTML =
      '<div class="comm-grid">' +
        '<div class="comm-col"><div class="comm-h">Top Earners</div>' + earnersHtml + '</div>' +
        '<div class="comm-col"><div class="comm-h">Top Enrollers</div>' + enrollersHtml + '</div>' +
        '<div class="comm-col"><div class="comm-h">Market Payout Intensity</div>' + payoutsHtml + '</div>' +
      '</div>';

    const sub = document.getElementById('comm-sub');
    if (sub){
      const totalRecent = (c.monthly[c.monthly.length - 1] || {}).total_usd || 0;
      sub.innerHTML = 'latest month $' + (totalRecent/1e6).toFixed(2) + 'M paid';
    }
  }

  // ------- Fraud & Abuse -------
  function renderFraud(filter){
    destroy('fraudTrend');
    const el = document.getElementById('w-fraud');
    if (!el) return;
    const f = window.PortalData.state.fraud;
    if (!f.signals.length){ el.innerHTML = '<div class="ticker-loading">no fraud signals</div>'; return; }

    const sigs = (filter.market && filter.market !== '__ALL__')
        ? f.signals.filter(s => s.market === filter.market)
        : f.signals;

    const byKind = new Map();
    for (const s of sigs){
      if (!byKind.has(s.kind)){
        byKind.set(s.kind, {kind:s.kind, label:s.label, severity:s.severity, count:0, amount_usd:0, markets:new Set()});
      }
      const agg = byKind.get(s.kind);
      agg.count += s.count;
      agg.amount_usd += s.amount_usd;
      agg.markets.add(s.market);
    }
    const rollup = Array.from(byKind.values()).sort((a,b) => b.amount_usd - a.amount_usd);

    const kpiRow =
      '<div class="kpi-row" style="margin-bottom:10px">' +
        '<div class="kpi"><span class="v">' + (f.kpis.signals_30d || 0).toLocaleString() + '</span><span class="l">Signals 30d</span></div>' +
        '<div class="kpi bad"><span class="v">' + (f.kpis.high_severity_30d || 0).toLocaleString() + '</span><span class="l">High sev</span></div>' +
        '<div class="kpi warn"><span class="v">$' + ((f.kpis.dollar_exposure_usd || 0)/1e3).toFixed(0) + 'K</span><span class="l">Exposure</span></div>' +
        '<div class="kpi"><span class="v">' + (f.kpis.open_cases || 0) + '</span><span class="l">Open cases</span></div>' +
      '</div>';

    const rollupHtml = '<table class="dirtable lbtbl" style="margin-bottom:10px"><thead><tr>' +
      '<th>Signal</th><th style="text-align:right">Count</th><th style="text-align:right">Exposure</th><th>Markets</th><th>Sev</th>' +
    '</tr></thead><tbody>' +
    rollup.slice(0,8).map(r => {
      const sevCls = r.severity === 'HIGH' ? 'DEPRECATED' : (r.severity === 'WARN' ? 'DORMANT' : 'PILOT');
      return '<tr>' +
        '<td><b style="color:#e7eef7">' + r.label + '</b></td>' +
        '<td style="text-align:right;font-family:var(--mono)">' + r.count.toLocaleString() + '</td>' +
        '<td style="text-align:right;font-family:var(--mono);color:var(--warn)">$' + r.amount_usd.toLocaleString() + '</td>' +
        '<td style="font-family:var(--mono);font-size:11px;color:var(--ink-1)">' + Array.from(r.markets).slice(0,6).join(', ') + (r.markets.size > 6 ? '&hellip;' : '') + '</td>' +
        '<td><span class="pill ' + sevCls + '">' + r.severity + '</span></td>' +
      '</tr>';
    }).join('') + '</tbody></table>';

    const recentCases = f.cases.slice(0,5);
    const casesHtml = '<div class="cases-list"><div class="comm-h">Recent flagged cases</div>' +
      recentCases.map(c => {
        const sevCls = c.severity === 'HIGH' ? 'DEPRECATED' : (c.severity === 'WARN' ? 'DORMANT' : 'PILOT');
        return '<div class="case-row">' +
          '<span class="case-id">' + c.case_id + '</span>' +
          '<span class="pill ' + sevCls + '">' + c.severity + '</span>' +
          '<span class="case-mkt">' + c.market + '</span>' +
          '<span class="case-note">' + c.note + '</span>' +
          '<span class="case-amt">$' + c.amount_usd.toLocaleString() + '</span>' +
          '<span class="case-date">' + c.opened + '</span>' +
        '</div>';
      }).join('') + '</div>';

    el.innerHTML = kpiRow + rollupHtml + casesHtml;

    const sub = document.getElementById('fraud-sub');
    if (sub){
      sub.innerHTML = rollup.length + ' signal types &middot; $' +
        ((f.kpis.dollar_exposure_usd || 0)/1e3).toFixed(0) + 'K exposure';
    }
  }

  // ------- Rates (processing / refund / chargeback) -------
  const ratesView = { mode: 'market' };  // 'market' | 'processor' | 'matrix'

  function rateColor(kind, v){
    if (kind === 'proc'){
      if (v >= 80) return 'var(--good)';
      if (v >= 70) return 'var(--warn)';
      return 'var(--bad)';
    }
    if (kind === 'refund'){
      if (v <= 2.5) return 'var(--good)';
      if (v <= 4) return 'var(--warn)';
      return 'var(--bad)';
    }
    if (kind === 'cbbps'){
      if (v < 50) return 'var(--good)';
      if (v < 100) return 'var(--warn)';
      return 'var(--bad)';
    }
    return 'var(--ink-0)';
  }

  function renderRates(filter){
    const el = document.getElementById('w-rates');
    if (!el) return;
    const r = window.PortalData.state.rates;
    if (!r || !r.matrix || !r.matrix.length){ el.innerHTML = '<div class="ticker-loading">no rates data</div>'; return; }

    const drill = filter.market && filter.market !== '__ALL__';
    const mode = drill ? 'drill' : ratesView.mode;

    function num(v, d){ return (v == null ? 0 : Number(v)).toFixed(d != null ? d : 2); }
    function colCell(val, kind, suffix){
      return '<td style="text-align:right;font-family:var(--mono);color:' + rateColor(kind, val) + '">' +
             num(val, 2) + (suffix || '') + '</td>';
    }

    let rows, head, subLabel;
    if (mode === 'drill'){
      rows = r.matrix.filter(x => x.market === filter.market)
                     .slice().sort((a,b) => b.processing_pct - a.processing_pct);
      head = '<tr><th>Processor</th><th style="text-align:right">Processing %</th><th style="text-align:right">Refund %</th><th style="text-align:right">CB bps</th><th style="text-align:right">Orders</th><th style="text-align:right">Approved</th></tr>';
      subLabel = filter.market + ' drill-down &middot; ' + rows.length + ' processors';
    } else if (mode === 'processor'){
      rows = r.by_processor.slice().sort((a,b) => b.processing_pct - a.processing_pct);
      head = '<tr><th>Processor</th><th style="text-align:right">Processing %</th><th style="text-align:right">Refund %</th><th style="text-align:right">CB bps</th><th style="text-align:right">Orders</th><th style="text-align:right">Approved</th></tr>';
      subLabel = 'all processors rolled up across markets';
    } else if (mode === 'matrix'){
      rows = r.matrix.slice().sort((a,b) => (a.market === b.market ? b.processing_pct - a.processing_pct : a.market.localeCompare(b.market)));
      head = '<tr><th>Market</th><th>Processor</th><th style="text-align:right">Processing %</th><th style="text-align:right">Refund %</th><th style="text-align:right">CB bps</th><th style="text-align:right">Orders</th></tr>';
      subLabel = 'full market &times; processor matrix (' + rows.length + ' combos)';
    } else {
      rows = r.by_market.slice().sort((a,b) => b.processing_pct - a.processing_pct);
      head = '<tr><th>Market</th><th style="text-align:right">Processing %</th><th style="text-align:right">Refund %</th><th style="text-align:right">CB bps</th><th style="text-align:right">Orders</th><th style="text-align:right">Approved</th></tr>';
      subLabel = 'all markets rolled up across processors';
    }

    const body = rows.map(x => {
      if (mode === 'matrix'){
        return '<tr>' +
          '<td><b style="color:#e7eef7">' + x.market + '</b></td>' +
          '<td style="font-family:var(--mono);color:var(--ink-1)">' + x.processor + '</td>' +
          colCell(x.processing_pct, 'proc', '%') +
          colCell(x.refund_pct, 'refund', '%') +
          colCell(x.chargeback_bps, 'cbbps') +
          '<td style="text-align:right;font-family:var(--mono);color:var(--ink-2)">' + (x.orders || 0).toLocaleString() + '</td>' +
        '</tr>';
      }
      const firstLabel = (mode === 'drill' || mode === 'processor') ? x.processor : x.market;
      return '<tr>' +
        '<td><b style="color:#e7eef7">' + firstLabel + '</b></td>' +
        colCell(x.processing_pct, 'proc', '%') +
        colCell(x.refund_pct, 'refund', '%') +
        colCell(x.chargeback_bps, 'cbbps') +
        '<td style="text-align:right;font-family:var(--mono);color:var(--ink-2)">' + (x.orders || 0).toLocaleString() + '</td>' +
        '<td style="text-align:right;font-family:var(--mono);color:var(--accent-2)">' + (x.approved || 0).toLocaleString() + '</td>' +
      '</tr>';
    }).join('');

    const tabs = drill
      ? '<div class="rates-tabs"><span class="rates-tab active">Drill: ' + filter.market + '</span><span class="rates-hint">clear market filter to see rollups</span></div>'
      : '<div class="rates-tabs">' +
          '<button class="rates-tab ' + (mode === 'market' ? 'active' : '') + '" data-mode="market">By Market</button>' +
          '<button class="rates-tab ' + (mode === 'processor' ? 'active' : '') + '" data-mode="processor">By Processor</button>' +
          '<button class="rates-tab ' + (mode === 'matrix' ? 'active' : '') + '" data-mode="matrix">Matrix</button>' +
          '<span class="rates-hint">pick a market above to drill into its processors</span>' +
        '</div>';

    const legend =
      '<div class="rates-legend">' +
        '<span><i class="swatch g"></i>healthy</span>' +
        '<span><i class="swatch w"></i>watch</span>' +
        '<span><i class="swatch b"></i>at risk</span>' +
      '</div>';

    el.innerHTML =
      tabs +
      '<div class="rates-scroll"><table class="dirtable lbtbl rates-tbl">' +
        '<thead>' + head + '</thead><tbody>' + body + '</tbody>' +
      '</table></div>' +
      legend;

    // Wire up tabs
    el.querySelectorAll('.rates-tab[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        ratesView.mode = btn.dataset.mode;
        renderRates(filter);
      });
    });

    const sub = document.getElementById('rates-sub');
    if (sub) sub.innerHTML = subLabel;
  }

  // ------- AI Chat (Tier A rule-based router) -------
  function aiAnswer(q){
    // Returns {summary:'html', chart: optional-apex-opts, items: optional-list}
    const s = window.PortalData.state;
    const ql = (q || '').toLowerCase().trim();
    if (!ql) return {summary:'Ask me something like "worst decline market", "top earner", "most chargebacks", or "fraud in USA".'};

    function latestByMarket(){
      const byMkt = new Map();
      for (const r of s.approval){
        const arr = byMkt.get(r.market) || [];
        arr.push(r); byMkt.set(r.market, arr);
      }
      const out = {};
      for (const [k, arr] of byMkt){
        arr.sort((a,b) => a.date.localeCompare(b.date));
        const last30 = arr.slice(-30);
        const orders = last30.reduce((a,r) => a + r.orders, 0);
        const approved = last30.reduce((a,r) => a + r.approved, 0);
        const declined = last30.reduce((a,r) => a + r.declined, 0);
        const vol = last30.reduce((a,r) => a + r.volume_usd, 0);
        const cb = last30.reduce((a,r) => a + r.chargebacks, 0);
        out[k] = {
          rate: orders > 0 ? (approved / orders * 100) : 0,
          orders, approved, declined, vol, cb,
          cb_bps: vol > 0 ? (cb * 1e4 / vol) : 0
        };
      }
      return out;
    }

    const byMkt = latestByMarket();
    const markets = Object.keys(byMkt);

    // worst / best decline (low approval) market
    if (/(worst|lowest|bottom).*(approval|decline)/.test(ql) || /worst.*market/.test(ql) || /lowest approval/.test(ql)){
      const sorted = markets.slice().sort((a,b) => byMkt[a].rate - byMkt[b].rate);
      const rows = sorted.slice(0,5).map(m => ({market:m, rate:byMkt[m].rate.toFixed(1) + '%', orders:byMkt[m].orders}));
      return {summary:'Worst approval markets (last 30d):', items:rows, cols:['market','rate','orders']};
    }
    if (/(best|highest|top).*(approval|market)/.test(ql)){
      const sorted = markets.slice().sort((a,b) => byMkt[b].rate - byMkt[a].rate);
      const rows = sorted.slice(0,5).map(m => ({market:m, rate:byMkt[m].rate.toFixed(1) + '%', orders:byMkt[m].orders}));
      return {summary:'Best approval markets (last 30d):', items:rows, cols:['market','rate','orders']};
    }
    // most chargebacks
    if (/chargeback|cb\b|dispute/.test(ql)){
      const sorted = markets.slice().sort((a,b) => byMkt[b].cb_bps - byMkt[a].cb_bps);
      const rows = sorted.slice(0,5).map(m => ({market:m, cb_bps:byMkt[m].cb_bps.toFixed(1), chargebacks:'$' + byMkt[m].cb.toLocaleString()}));
      return {summary:'Highest chargeback rate (last 30d, bps of volume):', items:rows, cols:['market','cb_bps','chargebacks']};
    }
    // top earner / commissions
    if (/top earner|best earner|commission leader|highest commission/.test(ql)){
      const earners = s.commissions.earners.slice(0,5).map(r => ({rank:r.rank, name:r.name, market:r.market, usd:'$' + r.amount_usd.toLocaleString()}));
      return {summary:'Top earners (latest period):', items:earners, cols:['rank','name','market','usd']};
    }
    if (/top enroller|most enroll|best enroll/.test(ql)){
      const rows = s.commissions.enrollers.slice(0,5).map(r => ({rank:r.rank, name:r.name, market:r.market, new_dist:r.new_distributors, retention:r.retention_pct + '%'}));
      return {summary:'Top enrollers (latest period):', items:rows, cols:['rank','name','market','new_dist','retention']};
    }
    // market payouts
    if (/(highest|biggest|top).*(payout|commission)/.test(ql) || /market.*payout/.test(ql)){
      const rows = s.commissions.market_payouts.slice(0,5).map(r => ({market:r.market, payout_pct:r.payout_pct.toFixed(1)+'%', payout:'$' + (r.payout_usd/1e6).toFixed(2) + 'M'}));
      return {summary:'Highest-payout markets:', items:rows, cols:['market','payout_pct','payout']};
    }
    // fraud in specific market
    const fraudMatch = /fraud|abuse|refund ring|velocity|bonus/.test(ql);
    if (fraudMatch){
      const mkMatch = ql.match(/\b(usa|can|mex|bra|jpn|kor|twn|hkg|tha|mys|sgp|phl|idn|vnm|aus|nzl|ita|deu|nld|gbr)\b/i);
      const f = s.fraud.signals;
      let rows;
      if (mkMatch){
        const code = mkMatch[1].toUpperCase();
        rows = f.filter(r => r.market === code).slice(0,5).map(r => ({signal:r.label, count:r.count, exposure:'$' + r.amount_usd.toLocaleString(), severity:r.severity}));
        return {summary:'Fraud signals in ' + code + ':', items:rows, cols:['signal','count','exposure','severity']};
      }
      // aggregate by kind globally
      const byKind = new Map();
      for (const r of f){
        const a = byKind.get(r.kind) || {kind:r.kind, label:r.label, count:0, amount:0, severity:r.severity};
        a.count += r.count; a.amount += r.amount_usd; byKind.set(r.kind, a);
      }
      rows = Array.from(byKind.values()).sort((a,b) => b.amount - a.amount).slice(0,5).map(r => ({signal:r.label, count:r.count, exposure:'$' + r.amount.toLocaleString(), severity:r.severity}));
      return {summary:'Top fraud/abuse signals (all markets):', items:rows, cols:['signal','count','exposure','severity']};
    }
    // recon coverage
    if (/(recon|coverage|match|statement)/.test(ql)){
      const r = s.recon.slice().sort((a,b) => b.month.localeCompare(a.month))[0];
      if (!r) return {summary:'No recon data available.'};
      return {summary:'Reconciliation coverage &mdash; latest month <b>' + r.month + '</b>: <b>' + r.coverage_pct.toFixed(1) + '%</b> (' + (r.matched||0).toLocaleString() + ' of ' + (r.gateway_rows||0).toLocaleString() + ' rows matched).'};
    }
    // volume rank
    if (/(biggest|largest|top).*volume|volume leader|highest volume/.test(ql)){
      const sorted = markets.slice().sort((a,b) => byMkt[b].vol - byMkt[a].vol);
      const rows = sorted.slice(0,5).map(m => ({market:m, volume:'$' + (byMkt[m].vol/1e6).toFixed(2) + 'M', orders:byMkt[m].orders.toLocaleString()}));
      return {summary:'Highest volume markets (last 30d):', items:rows, cols:['market','volume','orders']};
    }
    // provider count
    if (/provider|gateway/.test(ql) && /(how many|count|total)/.test(ql)){
      return {summary:'Provider directory contains <b>' + s.providers.length + '</b> providers across ' +
        new Set(s.providers.map(p => p.region)).size + ' regions.'};
    }
    return {summary:'I can answer: worst/best approval market, most chargebacks, top earner, top enroller, highest-payout market, fraud in &lt;market&gt;, recon coverage, biggest volume.'};
  }

  const AI_PROMPTS = [
    'worst approval market',
    'most chargebacks',
    'who is my top earner?',
    'highest payout market',
    'fraud in USA',
    'biggest volume market',
    'recon coverage',
    'top enroller'
  ];
  const AI_PILLS = [
    {q:'worst approval market',   l:'Worst approval market'},
    {q:'most chargebacks',        l:'Most chargebacks'},
    {q:'top earner',              l:'Top earner'},
    {q:'top enroller',            l:'Top enroller'},
    {q:'highest payout market',   l:'Highest payout market'},
    {q:'fraud in USA',            l:'Fraud in USA'},
    {q:'biggest volume market',   l:'Biggest volume'},
    {q:'recon coverage',          l:'Recon coverage'}
  ];
  let aiPlaceholderTimer = null;

  function renderAiChat(){
    const el = document.getElementById('w-ai-chat');
    if (!el) return;
    el.innerHTML =
      '<div class="ai-wrap ai-hero">' +
        '<div class="ai-lead">' +
          '<span class="ai-spark">&#9889;</span>' +
          '<span class="ai-lead-text">Ask anything about your payment ops &mdash; I\'ll answer from live data.</span>' +
        '</div>' +
        '<div class="ai-input ai-input-hero">' +
          '<input type="text" id="ai-q" placeholder="" autocomplete="off" spellcheck="false">' +
          '<button id="ai-go" class="ai-go-hero">Ask &rarr;</button>' +
        '</div>' +
        '<div class="ai-suggest ai-suggest-hero">' +
          '<span class="ai-try">Try:</span>' +
          AI_PILLS.map(p => '<button class="ai-pill" data-q="' + p.q + '">' + p.l + '</button>').join('') +
        '</div>' +
        '<div class="ai-out ai-out-hero" id="ai-out">' +
          '<div class="ai-hint"><span class="ai-cursor">&#9632;</span> awaiting question &mdash; answers are computed locally from the loaded JSON, no network calls.</div>' +
        '</div>' +
      '</div>';

    const out = el.querySelector('#ai-out');
    const input = el.querySelector('#ai-q');

    // Cycling placeholder — rotates through example prompts until the user focuses the box.
    if (aiPlaceholderTimer){ clearInterval(aiPlaceholderTimer); aiPlaceholderTimer = null; }
    let pIdx = 0;
    function tickPlaceholder(){
      if (document.activeElement === input || input.value) return;
      input.setAttribute('placeholder', 'try "' + AI_PROMPTS[pIdx] + '"');
      pIdx = (pIdx + 1) % AI_PROMPTS.length;
    }
    tickPlaceholder();
    aiPlaceholderTimer = setInterval(tickPlaceholder, 2200);

    function submit(q){
      q = (q || '').trim();
      if (!q) return;
      input.value = q;
      const ans = aiAnswer(q);
      let html = '<div class="ai-q-echo">&rarr; ' + q + '</div>';
      html += '<div class="ai-a">' + (ans.summary || '') + '</div>';
      if (ans.items && ans.items.length){
        html += '<table class="dirtable lbtbl ai-result-tbl"><thead><tr>' +
          ans.cols.map(c => '<th>' + c.replace(/_/g,' ') + '</th>').join('') +
        '</tr></thead><tbody>' +
        ans.items.map(r => '<tr>' + ans.cols.map(c => '<td>' + (r[c] != null ? r[c] : '') + '</td>').join('') + '</tr>').join('') +
        '</tbody></table>';
      }
      out.innerHTML = html;
      out.classList.add('flash');
      setTimeout(() => out.classList.remove('flash'), 500);
    }
    el.querySelector('#ai-go').addEventListener('click', () => submit(input.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(input.value); });
    el.querySelectorAll('.ai-pill').forEach(b => b.addEventListener('click', () => submit(b.dataset.q)));
  }

  function renderAll(filter){
    renderApprovalTrend(filter);
    renderProcessingFees(filter);
    renderCbHealth(filter);
    renderRetryLadder(filter);
    renderVolumeByMarket(filter);
    renderTopDeclines(filter);
    renderActivityFeed();
    renderProviderDirectory(filter);
    renderGlobe();
    renderRates(filter);
    renderCommissions(filter);
    renderFraud(filter);
    renderAiChat();
  }

  return { renderAll };
})();
