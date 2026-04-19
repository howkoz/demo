// data.js - loads synthetic data JSON files and exposes PortalData namespace.
// Normalizes the generator's per-market `daily` map into a single flat array
// with a `market` field so every downstream widget can filter uniformly.

window.PortalData = (function(){
  const state = {
    markets: [],
    approval: [],   // flattened: [{date, market, rate, orders, approved, declined, volume_usd, chargebacks, refunds}, ...]
    gateways: [],
    recon: [],      // [{month, coverage_pct, gateway_rows, matched}]
    events: [],
    providers: [],
    commissions: {earners:[], enrollers:[], market_payouts:[], monthly:[]},
    fraud: {signals:[], trends:[], cases:[], kpis:{}},
    rates: {matrix:[], by_market:[], by_processor:[]},
    loaded: false,
    generatedAt: null
  };

  // Lat/lon per market (not in the generator payload, attached here for the globe).
  const LATLON = {
    USA:[39.0,-98.0], CAN:[56.1,-106.3], MEX:[23.6,-102.6], BRA:[-14.2,-51.9],
    JPN:[36.2,138.3], KOR:[35.9,127.8], TWN:[23.7,121.0], HKG:[22.3,114.2],
    THA:[13.8,100.5], MYS:[4.2,101.9], SGP:[1.35,103.8], PHL:[13.0,122.0],
    IDN:[-0.8,113.9], VNM:[14.1,108.3], AUS:[-25.3,133.8], NZL:[-40.9,174.9],
    ITA:[41.9,12.6],  DEU:[51.2,10.5],  NLD:[52.1,5.3],   GBR:[54.0,-2.0]
  };

  async function load(){
    const [markets, approval, gateways, recon, events, providers, commissions, fraud, rates] = await Promise.all([
      fetch('data/markets.json').then(r => r.json()),
      fetch('data/approval-rates.json').then(r => r.json()),
      fetch('data/gateways.json').then(r => r.json()),
      fetch('data/recon.json').then(r => r.json()),
      fetch('data/events.json').then(r => r.json()),
      fetch('data/providers.json').then(r => r.json()),
      fetch('data/commissions.json').then(r => r.json()).catch(() => ({earners:[],enrollers:[],market_payouts:[],monthly:[]})),
      fetch('data/fraud.json').then(r => r.json()).catch(() => ({signals:[],trends:[],cases:[],kpis:{}})),
      fetch('data/rates.json').then(r => r.json()).catch(() => ({matrix:[],by_market:[],by_processor:[]}))
    ]);

    // Markets: attach lat/lon. Accept either {markets:[]} or [].
    const mkts = (markets.markets || markets).slice();
    for (const m of mkts){
      const ll = LATLON[m.code];
      if (ll){ m.lat = ll[0]; m.lon = ll[1]; }
    }
    state.markets = mkts;

    // Approval: flatten daily {code: [rows]} into [rows with market field].
    const flat = [];
    if (approval.daily && typeof approval.daily === 'object' && !Array.isArray(approval.daily)){
      for (const code of Object.keys(approval.daily)){
        for (const row of approval.daily[code]){
          flat.push(Object.assign({market: code}, row));
        }
      }
    } else if (Array.isArray(approval.rows || approval)){
      for (const row of (approval.rows || approval)) flat.push(row);
    }
    state.approval = flat;

    // Gateways: accept {gateways:[]} or [].
    state.gateways = gateways.gateways || gateways.rows || gateways;

    // Recon: accept {monthly:[]} or {rows:[]} or []. Normalize match_pct -> coverage_pct.
    const reconRows = recon.monthly || recon.rows || recon;
    state.recon = (Array.isArray(reconRows) ? reconRows : []).map(r => ({
      month: r.month,
      coverage_pct: r.coverage_pct != null ? r.coverage_pct : r.match_pct,
      gateway_rows: r.gateway_rows != null ? r.gateway_rows : r.orders,
      matched: r.matched != null ? r.matched : r.orders_matched
    }));

    // Events: accept {events:[]} or [].
    state.events = events.events || events;

    // Providers: accept {providers:[]} or [].
    state.providers = providers.providers || providers;

    state.commissions = {
      earners: commissions.earners || [],
      enrollers: commissions.enrollers || [],
      market_payouts: commissions.market_payouts || [],
      monthly: commissions.monthly || []
    };
    state.fraud = {
      signals: fraud.signals || [],
      trends: fraud.trends || [],
      cases: fraud.cases || [],
      kpis: fraud.kpis || {}
    };
    state.rates = {
      matrix: rates.matrix || [],
      by_market: rates.by_market || [],
      by_processor: rates.by_processor || []
    };

    state.generatedAt = (markets.generated_at || approval.generated_at || new Date().toISOString());
    state.loaded = true;
    return state;
  }

  function filterByDays(rows, days){
    if (!rows || !rows.length) return [];
    const maxDate = rows.reduce((m, r) => r.date > m ? r.date : m, rows[0].date);
    const cutoff = new Date(maxDate);
    cutoff.setDate(cutoff.getDate() - days + 1);
    const cutoffStr = cutoff.toISOString().slice(0,10);
    return rows.filter(r => r.date >= cutoffStr);
  }

  function filterByMarket(rows, marketCode){
    if (!marketCode || marketCode === '__ALL__') return rows;
    return rows.filter(r => r.market === marketCode);
  }

  function aggregateAllMarkets(rows){
    // Weighted aggregate by order count
    const byDate = new Map();
    for (const r of rows){
      if (!byDate.has(r.date)){
        byDate.set(r.date, {date:r.date, orders:0, approved:0, declined:0, volume_usd:0, chargebacks:0, refunds:0});
      }
      const a = byDate.get(r.date);
      a.orders += (r.orders || 0);
      a.approved += (r.approved || 0);
      a.declined += (r.declined || 0);
      a.volume_usd += (r.volume_usd || 0);
      a.chargebacks += (r.chargebacks || 0);
      a.refunds += (r.refunds || 0);
    }
    const agg = Array.from(byDate.values()).sort((a,b) => a.date.localeCompare(b.date));
    for (const r of agg){
      r.rate = r.orders > 0 ? (r.approved / r.orders) * 100 : 0;
    }
    return agg;
  }

  return { state, load, filterByDays, filterByMarket, aggregateAllMarkets };
})();
