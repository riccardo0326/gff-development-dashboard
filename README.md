# GFF Development Dashboard

The web app lives in **`gff-dashboard/`**.

## Start in GitHub Codespaces

```bash
cd gff-dashboard
npm install
npm run import
npm run dev
```

Open port **3000** in the browser.

**Login (demo):** one account per role — credentials and permissions in [`gff-dashboard/README.md`](gff-dashboard/README.md#authentication):

| Role | Username | Password |
|------|----------|----------|
| admin | `admin` | `gff-admin-change-me` |
| user | `user` | `gff-user-change-me` |
| lambo | `lambo` | `gff-lambo-change-me` |

Override via `gff-dashboard/.env.local` (see `.env.example`).

The Excel source file is in the repo root: `GFF_development - internal copy.xlsm`
