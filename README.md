# Portal 9094 &mdash; Payment Operations Command Center (DEMO)

A static, widget-enabled command center showing how Unicity's consolidated payment-operations dashboard is put together. **All financial figures are synthetic.** Provider metadata (names, markets, methods) is real.

Designed to be demo-able anywhere: local browser, GitHub Pages, any static host. No backend, no secrets.

---

## What you get

- **Index.html** &mdash; command center with 8 draggable widgets
  - Scrolling `order_approval_rates` ticker across 20 markets
  - Three.js wireframe globe with 4 hubs + market pins
  - Approval trend (area chart, date-range aware)
  - Reconciliation coverage gauge
  - Chargeback health line (bps of volume)
  - Retry ladder stacked bar
  - Volume by market bar chart
  - Activity feed
  - Provider directory table (inline fuzzy search)
- **pages/directory.html** &mdash; full provider directory (38 providers, searchable + filterable)
- **pages/docs/index.html** &mdash; inline documentation
- **SCHEMA.md** &mdash; complete backend architecture spec

---

## Run the demo

### Option A: Windows batch
```cmd
start-demo.bat
```
Opens `http://localhost:9094/` in your default browser.

### Option B: Any Python
```bash
cd PORTAL-9094-DEMO
python -m http.server 9094
```
Then open [http://localhost:9094/](http://localhost:9094/).

### Option C: GitHub Pages
Push the folder to any GitHub repo and enable Pages on the root. The demo is purely static.

---

## Filter controls

- **Range** buttons: 1Y / 6M / 3M / 1M / 2W / 1W &mdash; all widgets recompute.
- **Market** dropdown: "All markets" aggregates by order volume; picking a single market filters fact rows.
- **Reset Layout** reloads the page and resets widget positions.

---

## Regenerate the synthetic data

```bash
python _generate-fake-data.py
```

Re-runs with `random.seed(9094)` so numbers are deterministic. Rewrites the six JSON files in `data/`.

---

## File layout

```
PORTAL-9094-DEMO/
  index.html                  command-center shell
  SCHEMA.md                   backend architecture spec
  README.md                   this file
  start-demo.bat              Windows launcher (port 9094)
  _generate-fake-data.py      synthetic data generator (seed=9094)
  assets/
    css/style.css             dark theme
    js/data.js                load + filter JSON
    js/ticker.js              scrolling ticker
    js/widgets.js             renderers for each widget
    js/main.js                Gridstack wire-up
  data/
    markets.json              20 markets (ISO-3, lat/lon, base rate)
    approval-rates.json       7,300 daily rows (20 markets x 365 days)
    gateways.json             6 gateway rollups
    recon.json                12 months of statement-vs-gateway coverage
    events.json               18 ops activity events
    providers.json            38 payment providers (metadata is real)
  pages/
    directory.html            full provider directory
    docs/index.html           inline docs
```

---

## Notes

- **Demo watermark:** the header shows `DEMO &middot; synthetic data` on every page.
- **Provider names are real** by design &mdash; the directory is the demo's "this is what we actually work with" moment. Financial figures are not.
- **No tracking, no analytics, no external POSTs.** All CDN assets are read-only JS/CSS libs (Gridstack, ApexCharts, Three.js, Fuse).
- **Port collision safe.** Uses 9094 so it does not clash with your live 9090 / 9092 / 9093.
