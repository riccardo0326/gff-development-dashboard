# GFF Development Dashboard

Web demo for tracking automotive GFF diagnostic coverage across ECUs and vehicle projects.

## Status nomenclature

The Excel `x` / `used` values are mapped to:

| Excel | Web app |
|-------|---------|
| *(empty)* | **N/A** — DTC not present for that project |
| `x` | **Pending** — DTC exists, not yet covered by a GFF |
| `used` | **Covered** — DTC already covered by a GFF |

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- SQLite via `better-sqlite3` (local file at `data/gff.db`)
- Recharts for statistics charts

## Quick start (local / GitHub Codespaces)

From the repository root:

```bash
cd gff-dashboard
npm install
npm run import
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Import source

`npm run import` reads:

```
../GFF_development - internal copy.xlsm
```

Override with:

```bash
GFF_XLSM_PATH="/path/to/file.xlsm" npm run import
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | ECU dashboard with completion bars and filters |
| `/statistics` | Priority stats, pie charts, daily trend |
| `/faulty` | Read-only faulty DTC list |
| `/ecu/DA0001` | ECU detail with editable coverage |
| `/settings` | Forecast settings + manual daily entries |

## Verify from your computer

### Option A — GitHub Codespaces (recommended)

1. Open the repo on GitHub → **Code** → **Codespaces** → **Create codespace**
2. In the terminal:

   ```bash
   cd gff-dashboard
   npm install
   npm run import
   npm run dev
   ```

3. When the server starts, click **Open in Browser** on port `3000` (or use the forwarded URL in the **Ports** tab).

### Option B — Local clone

Requirements: Node.js 20+

```bash
git clone <your-repo-url>
cd <repo>/gff-dashboard
npm install
npm run import
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Smoke checks

1. **Dashboard** — 63 ECUs, filter by PRIO 1
2. **Statistics** — TOT row ~53k DTCs, pie charts render
3. **Faulty DTCs** — paginated list loads
4. **ECU detail** — open `DA0001`, change a cell Pending ↔ Covered
5. **Settings** — add a daily entry, confirm it appears in Statistics trend

## Database

SQLite schema is created automatically. Re-import anytime:

```bash
npm run import
```

This replaces the database with fresh data from the Excel file.
