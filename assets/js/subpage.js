// subpage.js - shared helpers used by every pages/widgets/*.html drill page.
// Loads the same data namespace as the command center, so metrics stay in sync.

window.SubPage = (function(){

  function fmtUsd(v){
    if (v >= 1e9) return '$' + (v/1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v/1e6).toFixed(2) + 'M';
    if (v >= 1e3) return '$' + (v/1e3).toFixed(1) + 'K';
    return '$' + Math.round(v);
  }
  function fmtInt(v){ return (v||0).toLocaleString('en-US'); }
  function fmtPct(v, d){ d = d==null?1:d; return (v||0).toFixed(d) + '%'; }

  // Render one KPI tile.
  function kpiTile(label, value, sub, tone){
    const tClass = tone ? ' tone-' + tone : '';
    return '<div class="sub-kpi' + tClass + '">' +
      '<div class="kpi-label">' + label + '</div>' +
      '<div class="kpi-val">' + value + '</div>' +
      (sub ? '<div class="kpi-delta">' + sub + '</div>' : '') +
    '</div>';
  }

  // Render a classification stacked bar. segments: [{label, value, color}]
  function classifyBar(segments){
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const bar = segments.map(s => {
      const pct = (s.value / total * 100);
      return '<div class="sub-classify-seg" style="width:' + pct.toFixed(2) + '%;background:' + s.color + '" title="' + s.label + ': ' + pct.toFixed(1) + '%">' +
        (pct > 7 ? pct.toFixed(0) + '%' : '') +
      '</div>';
    }).join('');
    const legend = segments.map(s =>
      '<span><span class="sw" style="background:' + s.color + '"></span>' + s.label + ' &middot; ' + fmtInt(s.value) + '</span>'
    ).join('');
    return '<div class="sub-classify">' + bar + '</div>' +
           '<div class="sub-classify-legend">' + legend + '</div>';
  }

  // Build dark-theme defaults for Apex
  function apexBase(h){
    return {
      chart:{background:'transparent', parentHeightOffset:0, height:h||220, toolbar:{show:false}, animations:{enabled:false}},
      theme:{mode:'dark'},
      grid:{borderColor:'#1f2a3a', strokeDashArray:3, padding:{top:6, right:10, bottom:8, left:8}},
      tooltip:{theme:'dark'},
      xaxis:{labels:{style:{colors:'#6b778a',fontSize:'10px'}}, axisBorder:{color:'#1f2a3a'}, axisTicks:{color:'#1f2a3a'}},
      yaxis:{labels:{style:{colors:'#6b778a',fontSize:'10px'}}},
      legend:{labels:{colors:'#a9b4c4'}, fontSize:'10px', markers:{size:6}}
    };
  }
  function merge(a, b){
    const out = {};
    for (const k in a) out[k] = a[k];
    for (const k in (b||{})){
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k]){
        out[k] = merge(a[k], b[k]);
      } else out[k] = b[k];
    }
    return out;
  }

  function renderChart(mountId, opts){
    const el = document.getElementById(mountId);
    if (!el) return null;
    const base = apexBase(el.clientHeight || 240);
    const merged = merge(base, opts);
    const c = new ApexCharts(el, merged);
    c.render();
    return c;
  }

  // Load data.js state (shared with the main page)
  async function load(){
    if (window.PortalData && window.PortalData.state.loaded) return window.PortalData.state;
    return await window.PortalData.load();
  }

  // Gen date label
  function genStamp(state){
    const d = state.generatedAt ? state.generatedAt.slice(0,10) : '';
    const el = document.getElementById('gen-date');
    if (el) el.textContent = d;
    return d;
  }

  // Build the standard header block given a widget title + optional sub + tone dot color
  function renderHeader(title, sub, dotColor){
    const el = document.getElementById('sub-header');
    if (!el) return;
    const dotHtml = dotColor ? '<span class="dot" style="background:' + dotColor + ';color:' + dotColor + '"></span>' : '';
    el.innerHTML =
      '<div class="sub-hero">' +
        '<div class="sub-crumbs">' +
          '<a href="../../index.html">Command Center</a>' +
          '<span class="sep">/</span>' +
          '<span class="cur">Widget Detail</span>' +
        '</div>' +
        '<h1>' + dotHtml + title + '</h1>' +
        (sub ? '<div class="sub-meta">' + sub + '</div>' : '') +
      '</div>' +
      '<a class="sub-back" href="../../index.html">Command Center</a>';
  }

  return {
    fmtUsd, fmtInt, fmtPct,
    kpiTile, classifyBar,
    apexBase, merge, renderChart,
    load, genStamp, renderHeader
  };
})();
