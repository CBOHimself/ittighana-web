# ITTI Ghana: website, CMS & API

Rebuild of [ittighana.com](https://www.ittighana.com) (formerly WordPress + Elementor) as a
TypeScript monorepo, hosted on the existing cPanel account with MongoDB Atlas. **Built by HostHaus.**

- 📐 Architecture & delivery plan: [`docs/PLAN.md`](docs/PLAN.md)
- 🚀 Deploying to cPanel: [`docs/DEPLOY-CPANEL.md`](docs/DEPLOY-CPANEL.md)
- 🔁 WordPress import: [`tools/wp-migrate/README.md`](tools/wp-migrate/README.md)

## Structure

```
apps/
  web/        Next.js public site (SSR + tag revalidation)          → ittighana.com
  admin/      Vite + React admin portal (vantara-ui via src/ui)     → admin.ittighana.com
  api/        Hono API: auth, content, forms, bookings, media       → api.ittighana.com
packages/
  schemas/    Zod schemas + types shared by everything (content, blocks, forms, roles)
  db/         Mongoose models + connection, index sync, seed
  auth/       Better Auth (MongoDB adapter, roles, 2FA, magic link) + browser client
  blocks/     Block library + React renderers (site + admin preview)
  media/      Storage adapter (cPanel disk), image processing (sharp), upload validation
  email/      SMTP mailer + email templates
  api-client/ Typed Hono RPC client
  config/     Shared tsconfig presets
tools/
  wp-migrate/   WordPress/Elementor → MongoDB importer
  visual-diff/  Old-vs-new screenshot comparison (Playwright)
```

## Getting started

Requirements: Node 22+, pnpm 10 (`corepack enable`), a MongoDB Atlas cluster (free M0 is fine for dev).

```bash
pnpm install
cp .env.example .env          # fill in MONGODB_URI (itti_dev database) and secrets
pnpm db:seed                  # site settings + empty Home/About pages
pnpm --filter @itti/api create-admin -- --email you@example.com --name "You"
pnpm dev                      # web :3000 · api :4000 · admin :5173
```

The create-admin command prints/sends a set-password link. With no SMTP configured,
emails are logged to the API console.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run web, API and admin together |
| `pnpm typecheck` | Type-check every package |
| `pnpm build` | Production builds (web standalone, API bundle, admin static) |
| `pnpm db:indexes` | Sync MongoDB indexes |
| `pnpm migrate:wp -- --inventory` | Inspect the WordPress dump |
| `pnpm migrate:wp` | Import WordPress content |
| `pnpm visual-diff` | Compare old vs new pages |

## Conventions
- **Schemas first:** add or change a content type in `packages/schemas`, then the Mongoose model in `packages/db`, then the API route.
- **Cache tags:** the site fetches with tags `"<entity>"` and `"<entity>:<slug>"`; the API revalidates those tags after every admin write.
- **UI in the admin** is imported only from `@/ui`, the single place where vantara-ui is wired in.
- **Permissions** live in `packages/schemas/src/roles.ts` and are enforced by the API (`requirePermission`).
- **Uploads**: public media → `MEDIA_PUBLIC_DIR` (served by `media.ittighana.com`); applicant documents → `MEDIA_PRIVATE_DIR` (served only through the API to signed-in staff).
