# Portal 9094 &mdash; Backend Architecture &amp; Schema

> **Scope.** This document is the production backend design the demo at port 9094 is built against. The demo itself is 100% synthetic (see `_generate-fake-data.py`), but every widget, filter, and page maps 1:1 to a real view/table defined here. Nothing in the UI would need to move if the JSON files were swapped for live API responses tomorrow.

---

## 1. System topology

```
                          +-----------------------------+
                          |   Browser (port 9094)       |
                          |   static HTML/JS/CSS        |
                          +--------------+--------------+
                                         |
                                   HTTPS (REST)
                                         |
                          +--------------v--------------+
                          |   Portal 9094 API           |
                          |   Flask / FastAPI           |
                          |   read-only, cache-friendly |
                          +--------------+--------------+
                                         |
                 +-----------------------+-----------------------+
                 |                       |                       |
        +--------v--------+   +----------v---------+   +---------v---------+
        | DW (MSSQL)      |   | DuckDB analytic   |   | Supabase metadata |
        | orders, dist,   |   | reconciliation    |   | providers,        |
        | txn detail      |   | tables, views     |   | activity events   |
        +-----------------+   +-------------------+   +-------------------+
                 ^                       ^                       ^
                 |                       |                       |
        +--------+--------+   +----------+---------+   +---------+---------+
        | CDC / nightly   |   | ETL: gateway API  |   | Operator manual   |
        | dimension sync  |   | pullers (Python)  |   | + GitHub Actions  |
        +-----------------+   +-------------------+   +-------------------+
```

**Three data planes, read-only API in front.**
- **DW (MSSQL)** is the source of truth for orders, distributors, transactions.
- **DuckDB** holds the per-gateway reconciliation tables and cross-gateway views (already running locally in prod at `CONVERTER-PROGRAMS/PROCESSOR-API-PULLS/_PULLS/unicity_payments.duckdb`).
- **Supabase** holds slowly changing metadata: the provider directory, activity events, saved searches, dashboard layouts.

The Portal 9094 API is a thin Flask/FastAPI read-only layer. No writes from the browser. All caching is keyed on `(endpoint, market, days)` with a 15-minute TTL.

---

## 2. Request flow (per widget)

| Widget               | Endpoint                                   | Primary source | Transforms                                               |
| -------------------- | ------------------------------------------ | -------------- | -------------------------------------------------------- |
| Ticker               | `GET /api/v1/approval/latest`              | DuckDB view    | Last day + vs-yesterday delta per market                 |
| Globe                | `GET /api/v1/markets`                      | Supabase       | Static metadata + lat/lon                                |
| Approval trend       | `GET /api/v1/approval?days=N&market=M`     | DuckDB view    | Daily rollup, weighted avg if market=__ALL__             |
| Recon gauge          | `GET /api/v1/recon/latest`                 | DuckDB view    | Latest month's coverage %                                |
| Chargeback health    | `GET /api/v1/chargebacks?days=N&market=M`  | DuckDB view    | bps of volume, daily                                     |
| Retry ladder         | `GET /api/v1/retries?days=N&market=M`      | DuckDB view    | declined / retried / recovered / unretried               |
| Volume by market     | `GET /api/v1/volume?days=N`                | DuckDB view    | Sum by market, sorted desc                               |
| Activity feed        | `GET /api/v1/events?limit=50`              | Supabase       | Ordered by ts desc                                       |
| Provider directory   | `GET /api/v1/providers`                    | Supabase       | Full list, client-side search                            |

---

## 3. DW (MSSQL) schema &mdash; source of truth

These tables already exist. Portal 9094 reads them through views, never joins them directly in API code.

### 3.1 `DW.dbo.DST` &mdash; distributor dimension
| Column             | Type         | Notes                                                    |
| ------------------ | ------------ | -------------------------------------------------------- |
| `DST_ID`           | BIGINT       | PK                                                       |
| `UNI_MKTING_UNIT`  | CHAR(2)      | 2-digit market code (`'01'`, `'02'`, ...). **Not** 3-letter. |
| `COUNTRY_CODE`     | CHAR(3)      | ISO-3 (e.g., `'USA'`, `'JPN'`)                           |
| `HOME_COUNTRY`     | CHAR(3)      | ISO-3, identity-of-record country                        |
| `DIST_STATUS`      | CHAR(1)      | `A/B/C/H/P/M` = active; `T` terminated; `S` suspended    |
| `ENTRY_DATE`       | DATETIME     | First enrollment                                         |
| `UPDATED_DATE`     | DATETIME     | CDC watermark                                            |

**Active-base filter (canonical):**
```sql
DIST_STATUS IN ('A','B','C','H','P','M')
```
See `reference_dw_dst_codes.md` in the ops memory for full code list.

### 3.2 `DW.dbo.ORD_HDR` &mdash; order header
| Column             | Type         | Notes                                                    |
| ------------------ | ------------ | -------------------------------------------------------- |
| `ORD_ID`           | BIGINT       | PK                                                       |
| `DST_ID`           | BIGINT       | FK &rarr; DST                                            |
| `ORD_DATE`         | DATETIME     | Commerce timestamp                                       |
| `ORDER_SOURCE`     | INT          | 903 = EventBridge batch, 906 = ecomm user-click, ...     |
| `ENTRY_INIT`       | VARCHAR(20)  | `*as%` = subscription, `*ms%` = manual ship-now          |
| `AUTO_ORDER_ID`    | BIGINT NULL  | NOT NULL &rArr; recurring channel                        |
| `TOTAL_USD`        | DECIMAL(14,2)|                                                          |
| `ORD_STATUS`       | VARCHAR(10)  | `A` approved, `D` declined, `P` pending                  |
| `GATEWAY_KEY`      | VARCHAR(30)  | `NMI`, `WORLDPAY`, `TRUST`, `NUVEI-CA`, `BRAINTREE`, `TRUEMED` |

**Canonical "true subscription" filter** (from project memory):
```sql
ENTRY_INIT LIKE '*as%' AND AUTO_ORDER_ID IS NOT NULL
```

### 3.3 `DW.dbo.TXN_DETAIL` &mdash; per-attempt payment record
| Column             | Type         | Notes                                                    |
| ------------------ | ------------ | -------------------------------------------------------- |
| `TXN_ID`           | BIGINT       | PK                                                       |
| `ORD_ID`           | BIGINT       | FK &rarr; ORD_HDR                                        |
| `GATEWAY_TXN_ID`   | VARCHAR(64)  | Key back to gateway table                                |
| `ATTEMPT_SEQ`      | INT          | 1..N retries                                             |
| `RESULT_CODE`      | VARCHAR(10)  | Gateway response                                         |
| `IS_CIT`           | BIT          | Customer-initiated flag (incident: 25,851 mis-marked)    |
| `IS_RETRY`         | BIT          | Used to build retry ladder                               |
| `TXN_TS`           | DATETIME     | Attempt timestamp                                        |

---

## 4. DuckDB analytic layer

Lives at `CONVERTER-PROGRAMS/PROCESSOR-API-PULLS/_PULLS/unicity_payments.duckdb`.

### 4.1 Per-gateway physical tables
Names: `nmi_transactions`, `worldpay_transactions`, `trust_transactions`, `nuveica_transactions`, `braintree_transactions`, `truemed_transactions`.

All conform to the shared shape:

| Column             | Type         | Notes                                                    |
| ------------------ | ------------ | -------------------------------------------------------- |
| `gateway`          | VARCHAR      | Constant per table                                       |
| `gateway_txn_id`   | VARCHAR      | PK for the gateway                                       |
| `merchant_ord_id`  | VARCHAR      | Joins to DW.ORD_HDR                                      |
| `action_date`      | DATE         | Fixed in TKT-6595 (was DATETIME + TZ drift)              |
| `amount_usd`       | DECIMAL(14,2)|                                                          |
| `result`           | VARCHAR      | Gateway-native (`approved`, `declined`, `settled`, ...)  |
| `card_brand`       | VARCHAR      | Best effort per gateway                                  |
| `country`          | VARCHAR      | ISO-3 where known                                        |

### 4.2 `midmetrics_*` tables
RDR / Ethoca / Verifi chargeback-prevention feed. **Observational, preemptive, never merged with gateway tables.** Named `midmetrics_rdr`, `midmetrics_ethoca`, etc.

### 4.3 Views (what the API actually hits)

```sql
-- v_approval_daily: powers ticker, approval trend, chargeback health.
CREATE OR REPLACE VIEW v_approval_daily AS
SELECT
  action_date                                   AS date,
  CASE WHEN length(country) = 3 THEN country
       ELSE '???' END                           AS market,
  COUNT(*)                                      AS orders,
  SUM(CASE WHEN result IN ('approved','settled','captured') THEN 1 ELSE 0 END) AS approved,
  SUM(CASE WHEN result IN ('declined','failed','error') THEN 1 ELSE 0 END)     AS declined,
  SUM(CASE WHEN result IN ('approved','settled','captured') THEN amount_usd ELSE 0 END) AS volume_usd,
  SUM(CASE WHEN result IN ('chargeback','dispute') THEN amount_usd ELSE 0 END) AS chargebacks,
  SUM(CASE WHEN result = 'refunded' THEN amount_usd ELSE 0 END)                AS refunds
FROM (
    SELECT * FROM nmi_transactions
    UNION ALL SELECT * FROM worldpay_transactions
    UNION ALL SELECT * FROM trust_transactions
    UNION ALL SELECT * FROM nuveica_transactions
    UNION ALL SELECT * FROM braintree_transactions
    UNION ALL SELECT * FROM truemed_transactions
) t
WHERE action_date IS NOT NULL
GROUP BY 1, 2;
```

```sql
-- v_statement_vs_actions_monthly: powers recon gauge.
-- Compares merchant statement rows against gateway action rows by (gateway, month).
CREATE OR REPLACE VIEW v_statement_vs_actions_monthly AS
SELECT
  gateway,
  strftime(action_date, '%Y-%m')                AS month,
  COUNT(a.gateway_txn_id)                       AS gateway_rows,
  COUNT(s.statement_txn_id)                     AS statement_rows,
  SUM(CASE WHEN s.statement_txn_id IS NOT NULL THEN 1 ELSE 0 END) AS matched,
  CAST(SUM(CASE WHEN s.statement_txn_id IS NOT NULL THEN 1 ELSE 0 END) AS DOUBLE)
    / NULLIF(COUNT(a.gateway_txn_id), 0) * 100  AS coverage_pct
FROM v_all_gateway_actions a
LEFT JOIN v_all_statement_rows s
  ON a.gateway = s.gateway
 AND a.gateway_txn_id = s.gateway_txn_id
GROUP BY 1, 2;
```

```sql
-- v_retry_ladder: powers retry-ladder widget.
CREATE OR REPLACE VIEW v_retry_ladder AS
SELECT
  action_date,
  market,
  SUM(CASE WHEN result = 'declined' AND is_retry = 0 THEN 1 ELSE 0 END) AS declined_original,
  SUM(CASE WHEN is_retry = 1 THEN 1 ELSE 0 END)                          AS retried,
  SUM(CASE WHEN is_retry = 1 AND result IN ('approved','settled') THEN 1 ELSE 0 END) AS recovered
FROM v_txn_attempts
GROUP BY 1, 2;
```

---

## 5. Supabase metadata

### 5.1 `providers`
| Column   | Type     | Notes                                              |
| -------- | -------- | -------------------------------------------------- |
| `id`     | UUID     | PK                                                 |
| `name`   | TEXT     | Public name                                        |
| `status` | TEXT     | `ACTIVE` / `PILOT` / `DORMANT` / `DEPRECATED`      |
| `region` | TEXT     | `North America` / `EMEA` / `APAC` / `LATAM` / `Global` |
| `model`  | TEXT     | `gateway` / `orchestrator` / `acquirer` / `apm`    |
| `methods`| JSONB    | Array of strings (`['card','ach','wallet',...]`)   |
| `markets`| JSONB    | Array of ISO-3 codes                               |
| `notes`  | TEXT     | Internal notes (safe for demo)                     |
| `updated_at` | TIMESTAMPTZ | Last metadata edit                            |

### 5.2 `activity_events`
| Column   | Type        | Notes                                             |
| -------- | ----------- | ------------------------------------------------- |
| `id`     | UUID        | PK                                                |
| `ts`     | TIMESTAMPTZ | Event time                                        |
| `kind`   | TEXT        | `INFO` / `WARN` / `OK` / `FIX`                    |
| `text`   | TEXT        | Markdown-safe short description                   |
| `actor`  | TEXT        | Human operator or system job                      |

### 5.3 `markets`
| Column        | Type   | Notes                                        |
| ------------- | ------ | -------------------------------------------- |
| `code`        | CHAR(3)| ISO-3, PK                                    |
| `name`        | TEXT   | Display name                                 |
| `region`      | TEXT   |                                              |
| `lat`         | DOUBLE | For globe                                    |
| `lon`         | DOUBLE | For globe                                    |
| `mu_code`     | CHAR(2)| Joins to `DW.DST.UNI_MKTING_UNIT`            |
| `base_rate`   | DOUBLE | Target approval %, used for anomaly alerting |

---

## 6. API endpoints (v1)

All endpoints are read-only `GET`, return JSON, cache 15 minutes.

| Endpoint                           | Query params                   | Returns                                               |
| ---------------------------------- | ------------------------------ | ----------------------------------------------------- |
| `/api/v1/markets`                  | none                           | Array of market rows                                  |
| `/api/v1/providers`                | none                           | Array of provider rows                                |
| `/api/v1/approval`                 | `days`, `market` (opt)         | Array of `{date, orders, approved, declined, rate, volume_usd, chargebacks, refunds}` |
| `/api/v1/approval/latest`          | none                           | Array of latest-day snapshot per market for ticker   |
| `/api/v1/chargebacks`              | `days`, `market` (opt)         | Array of `{date, cb_bps}`                             |
| `/api/v1/retries`                  | `days`, `market` (opt)         | `{declined, retried, recovered, unretried}`           |
| `/api/v1/volume`                   | `days`                         | Array of `{market, volume_usd, orders}`               |
| `/api/v1/recon/latest`             | none                           | `{month, coverage_pct, gateway_rows, statement_rows}` |
| `/api/v1/events`                   | `limit` (default 50)           | Array of event rows                                   |

### 6.1 Auth

In production:
- Portal 9094 sits behind SSO (Azure AD).
- API requires a signed JWT with claim `portal_9094_read`.
- Row-level security on Supabase enforces read-only for non-admins.

In demo:
- No auth. Static files only.

### 6.2 Caching
- Per-endpoint Redis cache, TTL 15 min, keyed on `endpoint + querystring`.
- Manual bust via `DELETE /api/v1/cache/:key` (admin only).

---

## 7. ETL &amp; refresh cadence

| Source          | Puller                                | Cadence    | Landing           |
| --------------- | ------------------------------------- | ---------- | ----------------- |
| NMI             | `CONVERTER-PROGRAMS/PROCESSOR-API-PULLS/nmi_pull.py` | hourly | DuckDB `nmi_transactions` |
| Worldpay        | `.../worldpay_pull.py` (TKT-6496)     | hourly     | DuckDB            |
| Trust           | `.../trust_pull.py`                   | hourly     | DuckDB            |
| Nuvei-CA        | `.../nuveica_pull.py`                 | hourly     | DuckDB            |
| Braintree       | `.../braintree_pull.py`               | hourly     | DuckDB            |
| Truemed         | `.../truemed_pull.py`                 | hourly     | DuckDB            |
| MidMetrics RDR  | `.../midmetrics_pull.py`              | daily      | DuckDB `midmetrics_*` |
| DW dimensions   | CDC sync to local DuckDB              | nightly 02:00 UTC | DuckDB `dim_*` |
| Views refresh   | `_build-join-views.py`                | on-demand  | DuckDB            |

Each puller respects the per-gateway **data floor** documented in `project_gateway_data_floors.md` &mdash; e.g., Worldpay &ge; 2025-02-13. Nothing older is requested.

---

## 8. Reconciliation model (why the recon gauge matters)

For each gateway, monthly statements arrive as PDF or CSV. A parser lands them in `v_all_statement_rows`. The recon gauge is literally:

```
coverage_pct = matched_gateway_rows / total_gateway_rows
```

In practice coverage sits at 60-65% because some gateway-native rows (wallet fees, FX haircuts) never appear on the merchant statement. Anything &lt; 40% is a WARN; anything &lt; 20% means the parser is broken.

---

## 9. Dashboards that feed into this one

Portal 9094 consolidates four predecessors:

| Port | Name              | Role it absorbed                                |
| ---- | ----------------- | ----------------------------------------------- |
| 8080 | Reconciliation    | gateway vs statement matching tables            |
| 9090 | Portal V2         | 3D globe, 23 analyst views                      |
| 8502 | Streamlit Analytics | ad-hoc DuckDB queries                         |
| 9091 | Payment Intelligence | decline forensics                            |
| 9092 | Command Center v1 | initial consolidation (TKT-6593)                |

9094 is the public-demo-safe sibling of 9092. Same widget set, synthetic data.

---

## 10. What would need to change to hook up real data

1. Add `.env` with DW / DuckDB / Supabase creds.
2. Stand up Flask/FastAPI with the endpoints in section 6.
3. Change `data.js` from `fetch('data/*.json')` to `fetch('/api/v1/*')`.
4. Nothing else in the UI changes.

That is the point of this demo &mdash; the front-end is already aligned with the final shape of the API. The bottleneck for going live is auth + a hostname, not UI work.

---

## 11. Notes on demo synthesis

The file `_generate-fake-data.py` produces all six JSONs from a fixed `random.seed(9094)` so runs are reproducible. Shape fidelity:

- Approval rates use a **mean-reverting random walk** toward each market's `base_rate` with &sigma; &asymp; 0.85 per day, clamped to [40, 97].
- Annual **seasonality** is a sin wave peaking Nov-Dec (holiday) and dipping Jan-Feb.
- Gateway splits are fixed: NMI 40 / Worldpay 28 / Trust 18 / Nuvei-CA 8 / Braintree 4 / Truemed 2.
- Chargebacks = 0.25% of approved volume + noise.
- Refunds = 2.5% of approved volume + noise.

Nothing here leaks real figures, but the **shape** matches what an analyst would expect to see, so the widgets render naturally.
