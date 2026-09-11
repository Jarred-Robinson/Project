# Rotation Engine

ED Assignment Rotation Engine — a TypeScript monorepo for generating and running day/night emergency-department assignment boards.

This repository previously contained only a LICENSE and stub README. The production rebuild that lived on Cursor Origin (`jarred-robinson/tmp-c38009296c74834f`, agent `bc-c4468944`) was **not readable from this environment**, so this port **reconstructs** that stack and behavior from:

1. The Rotation Engine v5 single-file ops board (`Rotation Engine v5 - ED Shift Ops Board`) — catalog, 143-name August 2026 RN roster, engine precedence, BOARDER/COMBINE, EOD, compliance recheck, and Excel shapes
2. The port specification in the GitHub issue (Vite + React + Tailwind, Hono + better-sqlite3, Commander CLI, `packages/engine` + Vitest, HttpOnly session auth)

GitHub repo name stays **Project**; this README is the product display name.

## Layout

| Path | Role |
| --- | --- |
| `apps/web` | Vite + React + TypeScript ops UI (Tailwind) |
| `apps/api` | Hono + better-sqlite3 API |
| `apps/cli` | Commander CLI |
| `packages/engine` | Pure TypeScript rotation engine + Vitest tests |
| `packages/shared` | Shared types, constants, catalog + roster seed |

`pnpm dev` runs API + web together. SQLite lives at `data/rotation.db` (gitignored) and is seeded on first run.

## Setup

Requires Node 20+ and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm test          # engine tests
pnpm dev           # API :3001 + web :5173
```

Then open http://localhost:5173.

### Demo credentials

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `rotation` | Administrator (catalog, config, users, roster writes) |
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

## What was copied vs reconstructed

| Source | Status |
| --- | --- |
| Origin git tree `tmp-c38009296c74834f` | Inaccessible (no clone / agent transcript) |
| Rotation Engine v5 HTML/JSX ops board | **Copied in spirit**: catalog, roster names, `runEngine` / `computeDeficiencies` / `eligible` / month window, Excel sheet shapes |
| TypeScript monorepo, Hono API, HttpOnly auth, CLI, Vitest | **Reconstructed** to match the specified Origin layout |

MIT License (see `LICENSE`).
