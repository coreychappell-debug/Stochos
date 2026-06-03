# Stochos Lottery Business Platform

**Version:** 0.2.0 (Phase 2 — Contract & Territory Optimization)  
**Runtime:** Next.js 16.2.6 · Node.js 24 LTS · PostgreSQL 16 · Prisma 7  
**Environment:** WSL2 (Ubuntu 22.04) + Docker · Windows host development  

---

## What This Is

A modular, lottery-agnostic business platform providing:

- Shared authentication and role-based access control
- Contract lifecycle management (CLM) with vendor, product, and compliance tracking
- Executive dashboard with KPI summaries and module navigation
- **Field Route Optimization & CRM Trip Planner (FOMO)**: Dynamic territory visit planner supporting custom geocoding (Nominatim), automated TSP route sequencing (Held-Karp / 2-opt), real road-distance path mapping (OSRM with a local Haversine fallback), concurrency queueing/throttling, and universal Google Maps navigation export.
- Extensible architecture for future marketing, analytics, and instant ticket modules

**This platform runs alongside the existing RStudio/Shiny/DuckDB analytics stack.** It does not modify, depend on, or interfere with existing services.

See [OPERATIONS.md](./OPERATIONS.md) for full setup, startup, shutdown, backup, and rollback procedures.

---

## Quick Start

```powershell
# 1. Ensure PostgreSQL is running (see OPERATIONS.md §2 for first-time setup)
wsl -d Ubuntu-22.04 -- docker start stochos_postgres

# 2. Start the development server
npm run dev

# 3. Open http://localhost:3000
# Login: admin@stochos.io / stochos2026
```

---

## Project Structure

```
stochos-platform/
├── app/
│   ├── api/                        # REST API routes
│   │   ├── auth/[...nextauth]/     #   NextAuth handler
│   │   ├── contracts/              #   Contract CRUD + line items + compliance
│   │   └── fomo/                   #   Territory visit route optimization
│   ├── components/                 # Shared UI components
│   │   ├── AppShell.js             #   Sidebar + main content wrapper
│   │   ├── Providers.js            #   NextAuth SessionProvider
│   │   └── Sidebar.js              #   Navigation with module sections
│   ├── contracts/                  # Contract management pages
│   ├── fomo/                       # CRM Dashboard, Retailer Registry & Trip Planner
│   │   ├── planner/                #   TSP driving route planning and Leaflet map
│   │   └── retailers/              #   Retailer store registry
│   ├── login/                      # Authentication page
│   ├── vendors/                    # Vendor registry
│   ├── products/                   # Product catalog
│   ├── globals.css                 # Design system
│   ├── layout.js                   # Root layout
│   └── page.js                     # Dashboard
├── lib/
│   ├── auth.js                     # NextAuth v5 configuration
│   └── db.js                       # Prisma client singleton (v7 + PrismaPg)
├── prisma/
│   ├── schema.prisma               # Data model (12 tables)
│   └── seed.js                     # Reference data seed script
├── docker-compose.yml              # PostgreSQL container definition
├── middleware.js                    # Edge-compatible route protection
├── prisma.config.ts                # Prisma v7 driver configuration
├── OPERATIONS.md                   # ← Full operational documentation
├── .env / .env.local               # Environment configuration
└── package.json                    # Dependencies + scripts
```

---

## Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server on `:3000` |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:push` | Push Prisma schema to PostgreSQL |
| `npm run db:seed` | Populate seed data |
| `npm run db:reset` | **Destructive**: Drop + recreate + reseed |
| `npm run db:studio` | Open Prisma Studio (visual DB editor) |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [OPERATIONS.md](./OPERATIONS.md) | Full operations manual: infrastructure, procedures, rollback, known issues |
| [.env.local](./.env.local) | Environment variable reference |
| [prisma/schema.prisma](./prisma/schema.prisma) | Complete database schema |
