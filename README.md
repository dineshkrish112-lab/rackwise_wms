# Rackwise WMS

Multi-tenant 3D warehouse and inventory management system. Built for Texmo first, and sold to other organisations as a product: each customer gets an isolated workspace with its own warehouses, racks, materials, users and branding.

- **Backend:** Java 17, Spring Boot 3.5 (monolith), Spring Security with JWT, JPA/Hibernate, MySQL 8
- **Frontend:** React 18 + Vite, three.js (3D warehouse), Recharts (reports), QR generation and camera scanning
- **Monolith build:** the React app is built into the Spring Boot jar, so production is one `java -jar` process

## Features

| Area | What it does |
|---|---|
| Sign in / sign out | JWT sign-in, roles, change password, session expiry, suspended organisations are locked out |
| Dashboard | Live 3D warehouse generated from data, 2D top view, rack details panel, rack front-view grid, KPIs, next receipt and dispatch with one-click confirm |
| Receipts (inward) | Create GRN, nearest-free-bin putaway suggestion (same storage type, reserved racks first, nearest the dock, heavy loads low), split across bins, scan or type bin to confirm |
| Dispatch (outward) | Stock check, FIFO pick list (oldest batch first), optional scan to verify each bin |
| Transfers | Move stock bin to bin; batch receipt date is kept so FIFO stays correct |
| Stock count | Count a bin, correct quantities, every correction logged |
| Inventory | By material (reorder alerts) and by location/batch with age, across one or all warehouses, CSV export |
| Reports | Dispatch vs receipts by day, week or month, top materials, warehouse split, stock aging, full stock ledger, CSV export, print |
| QR labels | Printable bin labels (`RW:<warehouse>:<bin>`), scanned with any phone camera; manual typing always works |
| Warehouses + rack builder | Create sites, add racks or floor zones (bays, levels, capacity, position, direction, reserved material) with a live 3D preview |
| Materials | Item master: storage type (solid, liquid, equipment), unit (kg, numbers, drums, litres), reorder level, 3D look |
| Users | Administrator, warehouse manager, store keeper, viewer |
| Settings | Organisation name, tagline, brand colour (applied to the whole app) |
| Platform | Platform owner onboards customer organisations, suspends or reactivates them |

## Run locally

Requirements: Java 17, Node 18+, MySQL 8 running on `localhost:3306`.

1. MySQL login: copy `backend/src/main/resources/application-local.example.yml` to `application-local.yml` (already done on the dev machine) and set your MySQL username and password. The database `rackwise_wms` is created automatically.
2. Start the backend (port 8080):

   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```

   On first start with an empty database it creates demo data (Texmo with 4 warehouses, a second customer, and about 90 days of movement history). Set `SEED_DEMO_DATA=false` to skip this.
3. Start the frontend (port 5173, proxies `/api` to 8080):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open http://localhost:5173

### Demo accounts (created by the seeder)

| Role | Email | Password |
|---|---|---|
| Texmo administrator | admin@texmo.com | Admin@12345 |
| Texmo warehouse manager | manager@texmo.com | Manager@12345 |
| Texmo store keeper | store@texmo.com | Store@12345 |
| Texmo viewer | viewer@texmo.com | Viewer@12345 |
| Second customer admin | admin@demo.com | Admin@12345 |
| Platform owner (you, the vendor) | owner@rackwise.app | Owner@12345 |

Change these passwords, or disable the seeder, before any real deployment.

## Build one jar (monolith)

```bash
cd frontend
npm run build:monolith
cd ../backend
./mvnw clean package
java -jar target/rackwise-wms-1.0.0.jar
```

Then open http://localhost:8080. Configuration through environment variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` (base64, 64 random bytes), `CORS_ORIGINS`, `SEED_DEMO_DATA`, `PORT`.

## How it fits together

```
Organisation (tenant)
 ├─ Users (role)
 ├─ Materials (storage type, unit, 3D look)
 └─ Warehouses (floor size, dock position)
     └─ Racks / floor zones (position, rotation, bays × levels, capacity, reserved material)
         └─ Bins (code like A1-L2-B03, capacity)
             └─ Stock batches (material, batch no, qty kg, received date)
Receipts → putaway → batches + ledger IN
Dispatches → FIFO picks → batches reduced + ledger OUT
Transfers / stock count → ledger TRANSFER / ADJUST
Reports are built from the stock ledger.
```

All stock is stored in kilograms; unit materials (numbers, drums) convert with their unit weight. Every query is scoped to the signed-in user's organisation, so customers never see each other's data.

The 3D view (`frontend/src/three/WarehouseView.js`) draws everything from the layout API, so a new customer's warehouse appears in 3D as soon as they add racks in the rack builder. Rack geometry constants are shared with `backend/.../service/LayoutMath.java`.
