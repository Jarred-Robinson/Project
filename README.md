# Rotation Engine

ED Assignment Rotation Engine — a TypeScript monorepo for generating and running day/night emergency-department assignment boards.

GitHub repo name stays **Project**; this README is the product display name (`rotation-engine@5.0.0`).

The production rebuild on Cursor Origin (`jarred-robinson/tmp-c38009296c74834f`, agent `bc-c4468944`, commit `912aa8d`) was **not cloneable** from this environment (no GitHub remote, no Origin credentials). This port reconstructs that **package graph and behavior** from:

1. Origin’s published file list (81 tracked files, `pnpm@10.33.3`)
2. The Rotation Engine v5 single-file ops board — catalog, 143-name August 2026 RN roster, engine precedence, BOARDER/COMBINE, EOD, compliance recheck, Excel shapes
3. The GitHub issue specification (Vite + React + Tailwind, Hono + better-sqlite3, Commander CLI, HttpOnly session auth)

## Layout

| Path | Role |
| --- | --- |
| `apps/web` | Vite + React + TypeScript ops UI (Tailwind). Pages: Login, Dashboard, Generate, Current Shift, Archive, Closeout, Roster, Catalog, Config, Users |
| `apps/api` | Hono + SQLite API, HttpOnly `re_session` cookie, admin vs charge-nurse |
| `apps/cli` | Commander CLI |
| `packages/engine` | Pure TypeScript rotation engine + Vitest tests |
| `packages/db` | better-sqlite3 store + Excel import/export |
| `packages/shared` | Shared types, catalog, roster seed, demo auth helpers |
| `prototype/` | v5 phase notes + partial HTML (no full `app.html`); v2 JSX stub |
| `samples/roster.csv` | 143-name seed roster for CLI import |

`pnpm dev` runs API + web together. SQLite lives at `data/rotation.db` (gitignored) and is seeded on first run.

## Setup

Requires Node 20+ and [pnpm](https://pnpm.io/) 10.33.3.

```bash
pnpm install
pnpm test          # engine + db + api tests
pnpm dev           # API :3001 + web :5173
pnpm seed          # (re)create SQLite seed if needed
```

Then open http://localhost:5173.

### Demo credentials

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `rotation` | Administrator (catalog, config, users, roster writes, reset) |
| `charge` | `rotation` | Charge nurse (generate board, current shift, EOD, roster read, Excel) |

Sessions are HttpOnly cookies. Protected routes return **401** when unsigned-in and **403** when a charge-nurse hits admin-only APIs.

## Domain behavior

- Day / night sides; **calendar-month** rotation window (not a rolling 42-day lookback)
- Staff: role (RN / TECH / paramedic), competency (untrained / trained / proficient), tech specialty, agency, night-avoid, active
- Assignment catalog: Gold, Gold A, Green A/B, Flow (RTS/PIT/PFC), Triage, Trauma, Observation, B-Bed, Tech zones, HUC, specials — with load points, critical vs review, wildcard
- Generate precedence: **predetermined (+ justification) → critical coverage → remaining eligible** under frequency / compliance caps
- Partials skip frequency memory; **HOLD** keeps rooms on **REGENERATE**; **RELEASE** / **RELEASE (P)** / **HOLD** on Current Shift
- **BOARDER** (Gold + comment) and **COMBINE** (partner + comment; combined load points ≥ 5 → REVIEW deficiency)
- Deficiencies: **CRITICAL** vs **REVIEW**; day min ~8 nurses, night ~6
- EOD closeout: resumable snapshot → Archive; sent-home *exclude-from-memory* defaults **OFF**; held-over staff warn on the next generate
- Compliance recheck uses the same deficiency helper as generate (parity)
- Excel roster import/export + full-history archive export
- Seed roster is the realistic 143-name ED list from the v5 August 2026 RN rotation sheet

## UI

Login, Dashboard (open shifts, critical/review counts, pending boards), Generate Board (on-duty select, PU / predetermined / close, BOARDER, COMBINE, inline reassign, save **Current** or **PENDING**), Current Shift (RELEASE / HOLD / REGENERATE / compliance / EOD), Archive, Roster, Catalog, Config, Users, Excel export.

## CLI

Uses the same SQLite file as the API (`data/rotation.db`).

```bash
pnpm cli generate --date 2026-09-11 --side day
pnpm cli roster import ./samples/roster.csv
pnpm cli export history --out ./rotation-history.xlsx
```

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | API + web together |
| `pnpm dev:api` / `pnpm dev:web` | One process |
| `pnpm test` | Engine, db, and API Vitest suites |
| `pnpm seed` | Ensure `data/rotation.db` exists and is seeded |
| `pnpm cli …` | Commander CLI |
| `pnpm lint` | Workspace TypeScript `--noEmit` |

## What was copied vs reconstructed

| Source | Status |
| --- | --- |
| Origin git tree `tmp-c38009296c74834f` @ `912aa8d` | **Inaccessible** (agent `bc-c4468944` could not push; this environment cannot download that archive) |
| Origin package graph | **Reconstructed** to match: `apps/{web,api,cli}`, `packages/{engine,shared,db}`, `prototype/`, root scripts |
| Rotation Engine v5 HTML/JSX ops board | **Copied in spirit**: catalog, roster names, `runEngine` / deficiencies / eligible / month window, Excel sheet shapes |
| Hono API, HttpOnly auth, CLI, Vitest | **Reconstructed** to Origin behavior |

MIT License (see `LICENSE`).
