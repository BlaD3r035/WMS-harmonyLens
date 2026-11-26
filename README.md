# Harmony Lens

Inventory management for the Harmony Lens main warehouse. See `project.md` (context, business rules) and `some_info.md` (lens data rules, user stories).

## Run locally

```sh
cp .env.example .env        # then replace every CHANGE-ME (JWT_SECRET: openssl rand -hex 32)
pnpm install
pnpm db:up                  # PostgreSQL in Docker: applies packages/db/schema.sql and seeds the admin
pnpm dev:api                # http://localhost:3000/api
pnpm dev:client             # http://localhost:5173 (proxies /api to the API)
```

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. The admin registers the other users in **Usuarios**; there is no public sign-up.

The schema and admin seed run only when the database volume is created. After changing `schema.sql` or the admin values, run `pnpm db:reset` (this deletes the data).

## Tests

`pnpm test` runs the API unit tests and the e2e tests. The e2e tests need the database container running. They create and drop their own `harmonylens_test` database and never touch the dev data.

## Roles

| Role | Can |
| --- | --- |
| `admin` | Everything, plus register users |
| `jefe_almacen` | Register lenses and imports, locate lots, view inventory |
| `auxiliar_bodega` | Register imports, locate lots, view inventory |
| `director_tecnico` | Approve or reject lots (HU06), view inventory |
| `admin_puntos_venta`, `asesor_punto_venta` | Sign in only, until HU07 and HU08 are built |
