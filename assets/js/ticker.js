// ticker.js - scrolling order_approval_rates ticker across all markets.
// Builds a single row of items from latest snapshot + vs-yesterday delta,
// then duplicates the sequence so the CSS keyframe scroll loops seamlessly.

window.PortalTicker = (function(){
  function latestByMarket(rows){
    // Return map: market -> {latest:row, prev:row}
    const byMkt = new Map();
    for (const r of rows){
      if (!byMkt.has(r.market)) byMkt.set(r.market, []);
      byMkt.get(r.market).push(r);
    }
    const out = new Map();
    for (const [mkt, arr] of byMkt){
      arr.sort((a,b) => a.date.localeCompare(b.date));
      const latest = arr[arr.length - 1];
      const prev = arr.length > 1 ? arr[arr.length - 2] : null;
      out.set(mkt, {latest, prev});
    }
    return out;
  }

  function buildItem(marketCode, marketName, latest, prev){
    const rate = latest.rate;
    const deltaVal = prev ? rate - prev.rate : 0;
    const cls = Math.abs(deltaVal) < 0.05 ? 'flat' : (deltaVal > 0 ? 'up' : 'down');
    const arrow = cls === 'flat' ? '&rarr;' : (cls === 'up' ? '&uarr;' : '&darr;');
    const sign = deltaVal > 0 ? '+' : '';
    return '<span class="ticker-item">' +
      '<span class="mkt">' + marketCode + '</span>' +
      '<span class="rate">' + rate.toFixed(1) + '%</span>' +
      '<span class="delta ' + cls + '">' + arrow + ' ' + sign + deltaVal.toFixed(2) + '</span>' +
    '</span>';
  }

  function render(){
    const track = document.getElementById('ticker-track');
    if (!track) return;
    const rows = window.PortalData.state.approval;
    const markets = window.PortalData.state.markets;
    const mktMap = new Map(markets.map(m => [m.code, m]));
    const latestMap = latestByMarket(rows);

    const items = [];
    for (const [mkt, {latest, prev}] of latestMap){
      const meta = mktMap.get(mkt);
      const name = meta ? meta.name : mkt;
      items.push(buildItem(mkt, name, latest, prev));
    }
    if (items.length === 0){
      track.innerHTML = '<span class="ticker-loading">no data</span>';
      return;
    }
    // Double the items so the -50% transform creates a seamless loop
    const sep = '<span class="ticker-sep">|</span>';
    const single = items.join(sep);
    track.innerHTML = single + sep + single;

    // Recompute scroll duration based on content width for smooth constant speed
    requestAnimationFrame(() => {
      const w = track.scrollWidth / 2;
      const dur = Math.max(60, Math.round(w / 40));
      track.style.animationDuration = dur + 's';
    });
  }

  return { render };
})();
