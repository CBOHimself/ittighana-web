# WordPress → ITTI importer

Copies the existing WordPress + Elementor content into MongoDB.

## 1. Load the WordPress dump locally

```bash
# from the repo root: the SQL export you downloaded from phpMyAdmin
mkdir -p tools/wp-migrate/input && cp ~/Downloads/itti-wp.sql tools/wp-migrate/input/
docker run -d --name itti-wp-db -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=wp -p 3307:3306 mariadb:11
docker exec -i itti-wp-db mariadb -uroot -proot wp < tools/wp-migrate/input/itti-wp.sql
```

## 2. Configure `.env`

```
WP_DB_URL=mysql://root:root@127.0.0.1:3307/wp
WP_TABLE_PREFIX=wp_
WP_SITE_URL=https://www.ittighana.com
MEDIA_PUBLIC_URL=https://media.ittighana.com
MONGODB_URI=...   # use the itti_staging database first!
```

## 3. Run

```bash
pnpm migrate:wp -- --inventory     # list every page/post + Elementor widget types in use (no writes)
pnpm migrate:wp -- --dry-run       # map everything, print the report, no writes
pnpm migrate:wp                    # import (idempotent: upserts by slug, safe to re-run)
```

The importer writes `tools/wp-migrate/output/report.json` listing every
unmapped Elementor widget, so we can add block mappings until the report is clean.

## Mapping rules
- **Pages** (`post_type = page`) → `pages` (Home → `home`, About → `about`)
- **Posts in the "courses" category / `course` CPT** → `courses` (adjust `COURSE_MATCH` in `src/index.ts` once we see the inventory)
- **Elementor widgets** → blocks: see `src/elementor-map.ts`
- **Media**: `wp_posts` attachments → `media` collection with `source: "wordpress"`; files stay where they are on cPanel
