# GFF Development Dashboard

Web demo for tracking automotive GFF diagnostic coverage across ECUs and vehicle projects.

## Status nomenclature

The Excel `x` / `used` values are mapped to:

| Excel | Web app |
|-------|---------|
| *(empty)* | **N/A** — DTC not present for that project |
| `x` | **Pending** — DTC exists, not yet covered by a GFF |
| `used` | **Covered** — DTC already covered by a GFF |

## Coverage slot vs GFF exists

- **Coverage slot**: a single applicable cell in columns H/I/J on an ECU sheet (one vehicle project per DTC row).
- **`gff_available = y`**: a GFF function already exists for that DTC (column F). Without `y`, the GFF still needs to be developed.
- KPI totals count **all applicable coverage slots**, regardless of `y`. Covered/pending status comes from the H/I/J cells (`used` / `x`).

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

Open [http://localhost:3000](http://localhost:3000) and sign in.

### Authentication

Copy `.env.example` to `.env.local` and adjust credentials if needed:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=gff-admin-change-me
USER_USERNAME=user
USER_PASSWORD=gff-user-change-me
LAMBO_USERNAME=lambo
LAMBO_PASSWORD=gff-lambo-change-me
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

On first startup (or when a role is missing), the app seeds **one demo account per role**:

| Role | Username | Default password | Access |
|------|----------|------------------|--------|
| **admin** | `admin` | `gff-admin-change-me` | Full access: all pages, Reports, Activity, Settings (forecast parameters + workbook import/export) |
| **user** | `user` | `gff-user-change-me` | Dashboard, Statistics, Search, Faulty DTCs, ECU detail, Activity, Settings (workbook import/export only — no forecast parameters) |
| **lambo** | `lambo` | `gff-lambo-change-me` | Dashboard, Statistics, Search, Faulty DTCs, ECU detail, Settings (export workbook only — no import or forecast parameters) |

Existing databases that already have an admin account get the `user` and `lambo` accounts added automatically on the next app start.

### Workbook import / export

From **Settings** in the app:

- **Export workbook** — downloads an updated `.xlsm` (macros + charts preserved via template merge)
- **Import workbook** — replaces all SQLite data from `.xlsx` / `.xlsm`

Faulty DTCs can be exported separately from the **Faulty DTCs** page.

### Import source (CLI)

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
2. **Statistics** — TOT row shows all applicable coverage slots; pie charts render
3. **Faulty DTCs** — paginated list loads
4. **ECU detail** — open `DA0001`, change a cell Pending ↔ Covered
5. **Settings** — add a daily entry, confirm it appears in Statistics trend

## Database

SQLite schema is created automatically. Re-import anytime:

```bash
npm run import
```

This replaces the database with fresh data from the Excel file.

Import output distinguishes **DTC rows** (one per symptom/code on an ECU sheet) from **coverage slots** (all applicable LB74x/LB636/LB63x cells per DTC).
