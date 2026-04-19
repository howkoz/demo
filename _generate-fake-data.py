"""
_generate-fake-data.py

Generates static JSON used by the Portal 9094 demo site.
Writes files into ./data/.

Everything numeric is random (seeded so runs are reproducible).
Market list and provider list are REAL -- those are not sanitized.

Run:  python _generate-fake-data.py
"""
from __future__ import annotations
import json
import random
from pathlib import Path
from datetime import date, datetime, timedelta

random.seed(9094)
HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
DATA.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# 20 markets (real Unicity markets) with plausible base approval rates
# The base rate controls the mean; daily data wobbles around it.
# ---------------------------------------------------------------------------
MARKETS = [
    dict(code="USA", name="United States", flag="US", mu="01", base=76.0, vol_base=160_000),
    dict(code="CAN", name="Canada",        flag="CA", mu="02", base=78.0, vol_base=32_000),
    dict(code="MEX", name="Mexico",        flag="MX", mu="03", base=72.0, vol_base=28_000),
    dict(code="BRA", name="Brazil",        flag="BR", mu="04", base=65.0, vol_base=18_000),
    dict(code="JPN", name="Japan",         flag="JP", mu="10", base=92.0, vol_base=120_000),
    dict(code="KOR", name="Korea",         flag="KR", mu="11", base=78.0, vol_base=85_000),
    dict(code="TWN", name="Taiwan",        flag="TW", mu="12", base=82.0, vol_base=45_000),
    dict(code="HKG", name="Hong Kong",     flag="HK", mu="13", base=83.0, vol_base=22_000),
    dict(code="THA", name="Thailand",      flag="TH", mu="14", base=70.0, vol_base=38_000),
    dict(code="MYS", name="Malaysia",      flag="MY", mu="15", base=74.0, vol_base=24_000),
    dict(code="SGP", name="Singapore",     flag="SG", mu="16", base=80.0, vol_base=18_000),
    dict(code="PHL", name="Philippines",   flag="PH", mu="17", base=68.0, vol_base=20_000),
    dict(code="IDN", name="Indonesia",     flag="ID", mu="18", base=66.0, vol_base=15_000),
    dict(code="VNM", name="Vietnam",       flag="VN", mu="19", base=71.0, vol_base=12_000),
    dict(code="AUS", name="Australia",     flag="AU", mu="20", base=79.0, vol_base=28_000),
    dict(code="NZL", name="New Zealand",   flag="NZ", mu="21", base=80.0, vol_base=8_000),
    dict(code="ITA", name="Italy",         flag="IT", mu="30", base=90.0, vol_base=16_000),
    dict(code="DEU", name="Germany",       flag="DE", mu="31", base=88.0, vol_base=22_000),
    dict(code="NLD", name="Netherlands",   flag="NL", mu="32", base=89.0, vol_base=14_000),
    dict(code="GBR", name="United Kingdom",flag="GB", mu="33", base=85.0, vol_base=26_000),
]

GATEWAYS = ["NMI", "Worldpay", "Trust", "Nuvei-CA", "Braintree", "Truemed"]

# ---------------------------------------------------------------------------
# 38 real payment providers. Non-sanitized: this is reference material about
# external vendors, not Unicity customer data.
# ---------------------------------------------------------------------------
PROVIDERS = [
    dict(name="2C2P",                 status="Live",       region="APAC",    methods=["Card","PromptPay","QR","WeChat"],   markets=["TH","MY","SG","PH","ID","VN"]),
    dict(name="Adyen",                status="Evaluating", region="Global",  methods=["Card","3DS","APMs"],                markets=["EU","APAC","NA"]),
    dict(name="Airwallex",            status="Evaluating", region="APAC",    methods=["Card","Bank Transfer"],             markets=["HK","SG","AU"]),
    dict(name="Authorize.net",        status="Live",       region="NA",      methods=["Card","ACH","eCheck"],              markets=["US","CA"]),
    dict(name="Banorte",              status="Live",       region="LATAM",   methods=["Card","OXXO","SPEI"],               markets=["MX"]),
    dict(name="BillPlz",              status="Deprecated", region="APAC",    methods=["FPX","Card"],                       markets=["MY"]),
    dict(name="BluePay",              status="Live",       region="NA",      methods=["Card","ACH"],                       markets=["US"]),
    dict(name="Braintree",            status="Live",       region="Global",  methods=["Card","PayPal","Venmo","ApplePay"], markets=["US","CA","EU","AU"]),
    dict(name="CCBill",               status="Evaluating", region="Global",  methods=["Card","ACH"],                       markets=["Global"]),
    dict(name="Checkout.com",         status="Evaluating", region="Global",  methods=["Card","APMs"],                      markets=["EU","ME","APAC"]),
    dict(name="CyberSource",          status="Live",       region="Global",  methods=["Card","3DS"],                       markets=["Global"]),
    dict(name="Finix",                status="Evaluating", region="NA",      methods=["Card","ACH"],                       markets=["US"]),
    dict(name="First Data (Fiserv)",  status="Live",       region="Global",  methods=["Card","ACH"],                       markets=["US","EU"]),
    dict(name="HyperSwitch",          status="Pilot",      region="Global",  methods=["Card","3DS","APMs","Orchestration"],markets=["MX","Global"]),
    dict(name="iPay88",               status="Live",       region="APAC",    methods=["Card","FPX","GrabPay"],             markets=["MY","SG","ID","PH"]),
    dict(name="KG Inicis",            status="Live",       region="APAC",    methods=["Card","KakaoPay","NaverPay"],       markets=["KR"]),
    dict(name="Moka United",          status="Live",       region="EMEA",    methods=["Card","Bank Transfer"],             markets=["TR"]),
    dict(name="Moneris",              status="Live",       region="NA",      methods=["Card","InteracDebit"],              markets=["CA"]),
    dict(name="Nexi",                 status="Live",       region="EMEA",    methods=["Card","SEPA"],                      markets=["IT"]),
    dict(name="NICE Payments",        status="Evaluating", region="APAC",    methods=["Card","Bank Transfer"],             markets=["KR"]),
    dict(name="NMI",                  status="Live",       region="NA",      methods=["Card","ACH","Recurring"],           markets=["US","CA"]),
    dict(name="Nuvei",                status="Live",       region="Global",  methods=["Card","APMs","Crypto"],             markets=["CA","EU","LATAM"]),
    dict(name="PayPal",               status="Live",       region="Global",  methods=["PayPal","Card"],                    markets=["Global"]),
    dict(name="PayU",                 status="Evaluating", region="LATAM",   methods=["Card","Boleto","PIX"],              markets=["BR","CO","AR"]),
    dict(name="Rakuten Card",         status="Live",       region="APAC",    methods=["Card","RakutenPay"],                markets=["JP"]),
    dict(name="SBPayment (SoftBank)", status="Live",       region="APAC",    methods=["Card","Konbini","Carrier"],         markets=["JP"]),
    dict(name="SecurionPay",          status="Deprecated", region="EMEA",    methods=["Card","3DS"],                       markets=["EU"]),
    dict(name="Square",               status="Evaluating", region="NA",      methods=["Card","CashApp"],                   markets=["US","AU","UK"]),
    dict(name="Stax",                 status="Evaluating", region="NA",      methods=["Card","ACH"],                       markets=["US"]),
    dict(name="Stripe",               status="Evaluating", region="Global",  methods=["Card","3DS","APMs"],                markets=["Global"]),
    dict(name="Tebex",                status="Deprecated", region="Global",  methods=["Card","PayPal"],                    markets=["Global"]),
    dict(name="Truemed",              status="Live",       region="NA",      methods=["HSA/FSA","Card"],                   markets=["US"]),
    dict(name="TrustPayments",        status="Live",       region="EMEA",    methods=["Card","3DS","APMs"],                markets=["EU","UK"]),
    dict(name="Vantiv (Worldpay)",    status="Live",       region="Global",  methods=["Card","3DS"],                       markets=["US","EU","APAC"]),
    dict(name="Veritrans",            status="Live",       region="APAC",    methods=["Card","Konbini"],                   markets=["JP"]),
    dict(name="Vesta",                status="Evaluating", region="NA",      methods=["Card","Fraud-Guarantee"],           markets=["US"]),
    dict(name="WeChat Pay",           status="Live",       region="APAC",    methods=["WeChat"],                           markets=["CN","HK"]),
    dict(name="Worldline",            status="Evaluating", region="EMEA",    methods=["Card","APMs"],                      markets=["EU"]),
]


def season(day_of_year: int) -> float:
    """Light annual seasonality: peak in Nov/Dec, dip in Jan/Feb."""
    import math
    return 1.0 + 0.08 * math.sin((day_of_year / 365.0) * 2 * math.pi + math.pi / 2)


def gen_daily(market: dict, start: date, days: int) -> list[dict]:
    out = []
    base = market["base"]
    vol_base = market["vol_base"]
    rate = base
    for i in range(days):
        d = start + timedelta(days=i)
        doy = d.timetuple().tm_yday
        # mean-reverting random walk around base
        rate += (base - rate) * 0.22 + random.uniform(-0.85, 0.85)
        rate = max(40.0, min(97.0, rate))
        seasonal = season(doy)
        orders   = int(vol_base / 30 * seasonal * random.uniform(0.75, 1.30))
        approved = int(orders * (rate / 100.0))
        declined = orders - approved
        volume   = int(approved * random.uniform(55, 95))  # avg order value ~ $55-95
        cb       = int(approved * random.uniform(0.0015, 0.005))
        refunds  = int(approved * random.uniform(0.015, 0.04))
        out.append(dict(
            date=d.isoformat(),
            rate=round(rate, 2),
            orders=orders,
            approved=approved,
            declined=declined,
            volume_usd=volume,
            chargebacks=cb,
            refunds=refunds,
        ))
    return out


def gen_gateway_split(total_orders: int) -> dict:
    # Approximately: NMI 40%, Worldpay 28%, Trust 18%, Nuvei-CA 8%, Braintree 4%, Truemed 2%
    weights = dict(NMI=0.40, Worldpay=0.28, Trust=0.18, **{"Nuvei-CA": 0.08}, Braintree=0.04, Truemed=0.02)
    out = {}
    running = 0
    for i, (g, w) in enumerate(weights.items()):
        if i == len(weights) - 1:
            out[g] = max(0, total_orders - running)
        else:
            n = int(total_orders * w * random.uniform(0.88, 1.12))
            out[g] = n
            running += n
    return out


def main():
    today = date.today()
    start = today - timedelta(days=364)

    daily = {}
    headline = []
    for m in MARKETS:
        rows = gen_daily(m, start, 365)
        daily[m["code"]] = rows
        last = rows[-1]
        week_ago = rows[-8]
        trend = round(last["rate"] - week_ago["rate"], 2)
        headline.append(dict(
            code=m["code"], name=m["name"], flag=m["flag"], mu=m["mu"],
            base=m["base"],
            current_rate=last["rate"],
            trend_7d=trend,
            volume_mtd=sum(r["volume_usd"] for r in rows[-30:]),
            orders_mtd=sum(r["orders"] for r in rows[-30:]),
        ))

    # Global aggregates (what shows on the ticker when "Global" is selected)
    total_orders_today    = sum(rows[-1]["orders"]   for rows in daily.values())
    total_approved_today  = sum(rows[-1]["approved"] for rows in daily.values())
    global_rate_today     = round(100.0 * total_approved_today / max(1, total_orders_today), 2)

    # Gateway split (for the chargeback/retry widgets)
    gateway_totals = gen_gateway_split(total_orders_today * 30)
    gateway_health = []
    for g in GATEWAYS:
        orders = gateway_totals.get(g, 0)
        approval = round(random.uniform(60, 94), 2)
        cb_rate = round(random.uniform(0.1, 0.8), 2)
        refund_rate = round(random.uniform(1.0, 4.0), 2)
        gateway_health.append(dict(
            gateway=g, orders=orders, approval_pct=approval,
            chargeback_pct=cb_rate, refund_pct=refund_rate,
            retry_bucket_1=round(random.uniform(55, 75), 1),
            retry_bucket_2=round(random.uniform(10, 22), 1),
            retry_bucket_3=round(random.uniform(4, 12), 1),
            retry_bucket_4_5=round(random.uniform(2, 6), 1),
            retry_bucket_6_10=round(random.uniform(1, 3), 1),
            retry_bucket_11_plus=round(random.uniform(0.1, 0.8), 1),
        ))

    # Recon coverage (fake month rollup)
    recon_monthly = []
    for i in range(12):
        m = (today.replace(day=1) - timedelta(days=30 * i))
        month_str = m.strftime("%Y-%m")
        orders = random.randint(450_000, 620_000)
        matched = int(orders * random.uniform(0.60, 0.78))
        recon_monthly.append(dict(
            month=month_str,
            orders=orders,
            orders_matched=matched,
            match_pct=round(100.0 * matched / orders, 2),
        ))
    recon_monthly.sort(key=lambda r: r["month"])

    # Activity feed (fake events)
    events = []
    event_templates = [
        "Approval rate in {m} climbed to {v}% ({d:+.1f} today)",
        "Chargeback on {g} in {m}: dispute_id {dx}",
        "Retry ladder compressed on {g}: bucket 4-5 down {d:.1f}%",
        "New gateway pilot: {g} opened for {m}",
        "Recon job completed: {n} orders reconciled",
        "Statement reconciliation closed for {g} / {mo}",
        "3DS challenge rate on {g} in {m}: {v}%",
        "Velocity spike detected on {g}: +{d:.0f}% vs 7d avg",
    ]
    for i in range(18):
        m = random.choice(MARKETS)
        g = random.choice(GATEWAYS)
        tmpl = random.choice(event_templates)
        events.append(dict(
            at=(datetime.combine(today, datetime.min.time()) - timedelta(minutes=random.randint(1, 720))).strftime("%Y-%m-%dT%H:%M"),
            text=tmpl.format(
                m=m["code"], g=g,
                v=round(random.uniform(55, 95), 1),
                d=random.uniform(-3, 5),
                dx=f"DX-{random.randint(10000,99999)}",
                n=f"{random.randint(10,480):,}k",
                mo=(today.replace(day=1) - timedelta(days=random.randint(0, 180))).strftime("%Y-%m"),
            ),
        ))
    events.sort(key=lambda e: e["at"], reverse=True)

    # --------- write files ----------
    (DATA / "markets.json").write_text(json.dumps(headline, indent=2))
    (DATA / "approval-rates.json").write_text(json.dumps({
        "generated_at": today.isoformat(),
        "range": {"start": start.isoformat(), "end": (start + timedelta(days=364)).isoformat()},
        "markets": headline,
        "daily": daily,
        "global": {
            "rate_today": global_rate_today,
            "orders_today": total_orders_today,
            "approved_today": total_approved_today,
        },
    }, indent=2))
    (DATA / "gateways.json").write_text(json.dumps({
        "gateways": gateway_health,
        "generated_at": today.isoformat(),
    }, indent=2))
    (DATA / "recon.json").write_text(json.dumps({
        "monthly": recon_monthly,
        "generated_at": today.isoformat(),
    }, indent=2))
    (DATA / "events.json").write_text(json.dumps({
        "events": events,
        "generated_at": today.isoformat(),
    }, indent=2))
    (DATA / "providers.json").write_text(json.dumps({
        "generated_at": today.isoformat(),
        "providers": PROVIDERS,
    }, indent=2))

    # ---- Commissions + Fraud/Abuse (new) ------------------------------------
    commissions = gen_commissions()
    fraud = gen_fraud()
    (DATA / "commissions.json").write_text(json.dumps({
        "generated_at": today.isoformat(),
        **commissions,
    }, indent=2))
    (DATA / "fraud.json").write_text(json.dumps({
        "generated_at": today.isoformat(),
        **fraud,
    }, indent=2))

    # ---- Rates matrix (market x processor) ----------------------------------
    rates = gen_rates_matrix()
    (DATA / "rates.json").write_text(json.dumps({
        "generated_at": today.isoformat(),
        **rates,
    }, indent=2))

    print(f"wrote {len(MARKETS)} markets x 365 days = {len(MARKETS)*365:,} rows")
    print(f"wrote {len(PROVIDERS)} providers")
    print(f"wrote {len(GATEWAYS)} gateway rollups")
    print(f"wrote {len(recon_monthly)} recon months")
    print(f"wrote {len(events)} activity events")
    print(f"wrote commissions: {len(commissions['earners'])} earners, {len(commissions['enrollers'])} enrollers")
    print(f"wrote fraud: {len(fraud['signals'])} signals, {len(fraud['cases'])} cases")
    print(f"wrote rates: {len(rates['matrix'])} market-processor combos")
    print(f"data dir: {DATA}")


# ---------------------------------------------------------------------------
# Commissions + fraud generators (synthetic leaderboards and signal lists)
# ---------------------------------------------------------------------------

# Fake distributor names. Obviously not real.
_FIRST = ["Alex","Jordan","Taylor","Morgan","Casey","Jamie","Riley","Avery","Sam","Quinn",
         "Parker","Rowan","Drew","Reese","Blake","Cameron","Skyler","Logan","Harper","Emerson",
         "Sasha","Dakota","Phoenix","River","Eden","Marlowe","Kai","Ari","Sage","Remy"]
_LAST = ["Rivera","Chen","Patel","Kim","Tanaka","Garcia","Johnson","Smith","Mueller","Rossi",
        "Silva","Okafor","Nguyen","Park","Yamada","Reyes","Hernandez","Baker","Dubois","Novak",
        "Kowalski","Wong","Singh","Abadi","Lindgren","Carvalho","Oswald","Mertens","Hara","Duval"]

def _fake_name():
    return random.choice(_FIRST) + " " + random.choice(_LAST) + "."


def gen_commissions() -> dict:
    """
    Produces three leaderboards + one heatmap-friendly rollup:
      earners          top-earning distributors (synthetic names)
      enrollers        top enrollers by new-distributor count
      market_payouts   commission payout ratio per market
      monthly          total commissions paid per month (12 months)
    """
    # earners: 40 rows across the 20 markets
    earners = []
    for i in range(40):
        mkt = random.choice(MARKETS)
        amount = int(random.gauss(18_000, 8_000))
        amount = max(amount, 2_500)
        delta = round(random.gauss(0, 6.5), 1)
        earners.append(dict(
            name=_fake_name(),
            market=mkt["code"],
            amount_usd=amount,
            rank_delta=int(delta),
            orders=random.randint(35, 480),
        ))
    earners.sort(key=lambda r: r["amount_usd"], reverse=True)
    for i, r in enumerate(earners, 1):
        r["rank"] = i

    # enrollers: 30 rows
    enrollers = []
    for i in range(30):
        mkt = random.choice(MARKETS)
        new_dists = int(max(3, random.gauss(35, 18)))
        enrollers.append(dict(
            name=_fake_name(),
            market=mkt["code"],
            new_distributors=new_dists,
            rank_delta=random.randint(-8, 10),
            retention_pct=round(max(0, min(100, random.gauss(62, 12))), 1),
        ))
    enrollers.sort(key=lambda r: r["new_distributors"], reverse=True)
    for i, r in enumerate(enrollers, 1):
        r["rank"] = i

    # market_payouts: per-market commission intensity
    market_payouts = []
    for m in MARKETS:
        orders = m["vol_base"]
        payout_pct = round(max(22, min(55, random.gauss(35, 6))), 1)
        payout_usd = int(orders * payout_pct * 1.6)   # rough scale
        market_payouts.append(dict(
            market=m["code"],
            payout_pct=payout_pct,
            payout_usd=payout_usd,
            orders=orders,
        ))
    market_payouts.sort(key=lambda r: r["payout_usd"], reverse=True)

    # monthly: 12 months rollup of total commissions
    today = date.today()
    monthly = []
    base_month_total = 9_500_000
    for i in range(12):
        m = (today.replace(day=15) - timedelta(days=30 * (11 - i)))
        month = m.strftime("%Y-%m")
        total = int(base_month_total * (1 + random.uniform(-0.18, 0.18)) * (1 + i * 0.015))
        monthly.append(dict(
            month=month,
            total_usd=total,
            new_enrollees=int(random.gauss(2_400, 320)),
        ))

    return dict(
        earners=earners,
        enrollers=enrollers,
        market_payouts=market_payouts,
        monthly=monthly,
    )


# Fraud + abuse signal definitions.
_FRAUD_KINDS = [
    ("STACKED_ENROLL",   "WARN", "Stacked enrollments (one actor, multiple IDs)"),
    ("CARD_VELOCITY",    "HIGH", "Card velocity (same card, high burst)"),
    ("REFUND_RING",      "HIGH", "Refund ring pattern"),
    ("CB_CLUSTER",       "HIGH", "Chargeback cluster"),
    ("BONUS_TIMING",     "WARN", "Suspicious order timing near bonus cutoff"),
    ("FAST_TERMINATE",   "INFO", "Fast enroll-then-terminate cycle"),
    ("MISMATCHED_BIN",   "WARN", "BIN country mismatches shipping country"),
    ("DUPLICATE_ADDR",   "INFO", "Duplicate shipping address across accounts"),
    ("PROMO_STACKING",   "INFO", "Repeated first-order-only promo abuse"),
]


def gen_fraud() -> dict:
    """
    Produces:
      signals   aggregated counts per (kind, market), with severity + dollars
      trends    90 daily rows of signal counts for a sparkline
      cases     small list of individual flagged items (demo detail)
      kpis      top-line numbers for the widget head
    """
    signals = []
    for kind, sev, label in _FRAUD_KINDS:
        for m in MARKETS:
            # Many (kind, market) combos have zero; keep it realistic.
            if random.random() < 0.55:
                continue
            count = int(random.gauss(18, 14))
            if count <= 0:
                continue
            amt = int(count * random.gauss(180, 90))
            signals.append(dict(
                kind=kind,
                label=label,
                severity=sev,
                market=m["code"],
                count=count,
                amount_usd=max(amt, 50),
            ))
    signals.sort(key=lambda r: r["amount_usd"], reverse=True)

    # Daily trend for last 90 days
    today = date.today()
    trends = []
    base = 85
    for i in range(90):
        d = today - timedelta(days=(89 - i))
        base += random.uniform(-5, 5)
        base = max(30, min(180, base))
        trends.append(dict(
            date=d.isoformat(),
            signals=int(base + random.uniform(-6, 6)),
            high_severity=int(base * 0.22 + random.uniform(-4, 4)),
        ))

    # Individual cases (demo detail)
    cases = []
    for i in range(25):
        kind, sev, label = random.choice(_FRAUD_KINDS)
        mkt = random.choice(MARKETS)
        cases.append(dict(
            case_id=f"FC-{random.randint(10000, 99999)}",
            kind=kind,
            severity=sev,
            market=mkt["code"],
            opened=(today - timedelta(days=random.randint(0, 30))).isoformat(),
            actor=_fake_name(),
            amount_usd=int(max(50, random.gauss(720, 400))),
            note=label,
        ))
    cases.sort(key=lambda r: r["opened"], reverse=True)

    total_signals = sum(s["count"] for s in signals)
    high_sev = sum(s["count"] for s in signals if s["severity"] == "HIGH")
    exposure = sum(s["amount_usd"] for s in signals)

    kpis = dict(
        signals_30d=total_signals,
        high_severity_30d=high_sev,
        dollar_exposure_usd=exposure,
        open_cases=len(cases),
    )
    return dict(signals=signals, trends=trends, cases=cases, kpis=kpis)


def gen_rates_matrix() -> dict:
    """
    Produces a market x processor matrix with:
      processing_pct   approval rate
      refund_pct       refund rate of approved volume
      chargeback_pct   chargeback rate of approved volume (displayed as bps)
      orders           volume basis
    Only populates realistic processor x market combos (a processor does not live in every market).
    Also returns market rollups and processor rollups so the widget can pivot either direction.
    """
    # Which processors are live in which markets (realistic-ish).
    PROCESSOR_MARKETS = {
        "NMI":       ["USA","CAN"],
        "Worldpay":  ["USA","CAN","GBR","DEU","NLD","ITA","AUS","NZL"],
        "Trust":     ["USA","CAN","GBR","DEU","NLD","ITA","AUS","NZL","JPN","KOR","TWN","HKG","SGP","MYS","THA","PHL","IDN","VNM","MEX","BRA"],
        "Nuvei-CA":  ["CAN","USA"],
        "Braintree": ["USA","CAN","GBR","DEU","NLD","ITA","AUS","NZL","JPN"],
        "Truemed":   ["USA"],
    }

    matrix = []
    by_market = {m["code"]: dict(market=m["code"], orders=0, approved=0, refunded=0, chargebacks=0) for m in MARKETS}
    by_processor = {p: dict(processor=p, orders=0, approved=0, refunded=0, chargebacks=0) for p in GATEWAYS}

    for m in MARKETS:
        base_rate = m["base"]
        for proc in GATEWAYS:
            if m["code"] not in PROCESSOR_MARKETS.get(proc, []):
                continue
            # Small adjustments by processor for realism
            proc_adj = {"NMI": 0, "Worldpay": -1.2, "Trust": 0.6, "Nuvei-CA": 2.1, "Braintree": 1.4, "Truemed": 3.5}[proc]
            rate = max(40, min(97, base_rate + proc_adj + random.gauss(0, 1.8)))
            refund_pct = max(0.2, min(10.0, random.gauss(2.8, 0.9)))
            cb_pct = max(0.02, min(1.2, random.gauss(0.28, 0.12)))
            orders = max(200, int(m["vol_base"] * random.uniform(0.05, 0.45)))
            approved = int(orders * rate / 100)
            refunded = int(approved * refund_pct / 100)
            chargebacks = int(approved * cb_pct / 100)
            row = dict(
                market=m["code"],
                processor=proc,
                processing_pct=round(rate, 2),
                refund_pct=round(refund_pct, 2),
                chargeback_pct=round(cb_pct, 3),
                chargeback_bps=round(cb_pct * 100, 1),
                orders=orders,
                approved=approved,
                refunded=refunded,
                chargebacks=chargebacks,
            )
            matrix.append(row)
            a = by_market[m["code"]]
            a["orders"] += orders; a["approved"] += approved; a["refunded"] += refunded; a["chargebacks"] += chargebacks
            b = by_processor[proc]
            b["orders"] += orders; b["approved"] += approved; b["refunded"] += refunded; b["chargebacks"] += chargebacks

    def finalize(rollup):
        out = []
        for r in rollup.values():
            if r["orders"] == 0:
                continue
            pr = r["approved"] / r["orders"] * 100
            rf = (r["refunded"] / r["approved"] * 100) if r["approved"] else 0
            cb = (r["chargebacks"] / r["approved"] * 100) if r["approved"] else 0
            out.append({**r,
                "processing_pct": round(pr, 2),
                "refund_pct": round(rf, 2),
                "chargeback_pct": round(cb, 3),
                "chargeback_bps": round(cb * 100, 1),
            })
        return out

    market_rollup = finalize(by_market)
    processor_rollup = finalize(by_processor)

    return dict(matrix=matrix, by_market=market_rollup, by_processor=processor_rollup)


if __name__ == "__main__":
    main()
