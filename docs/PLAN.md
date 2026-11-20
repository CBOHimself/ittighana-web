# ITTI Ghana Website Rebuild: Architecture & Delivery Plan

**Project:** Rebuild of https://www.ittighana.com (WordPress + Elementor) in Node.js + TypeScript
**Hosting:** Existing Namecheap **Stellar** shared cPanel account (same domain, same server)
**Admin UI:** `vantara-ui` (npm package)
**Built by:** HostHaus
**Status:** Planning, repo to be provided
**Last updated:** 2 November 2026

---

## 1. Goals

1. Replace WordPress/Elementor with a typed Node + TypeScript codebase in a **monorepo**.
2. Copy all **existing content exactly** (text, layout, images, slugs) from WordPress.
3. Keep **all files and media on cPanel**, as WordPress does today.
4. Provide a **secure admin portal** (built with vantara-ui) to manage every dynamic section.
5. Run the whole system on the **current Stellar cPanel hosting**, with no new hosting vendor.

---

## 2. Hosting reality check: Stellar on cPanel

Stellar is Namecheap's **shared** hosting tier. It is not a VPS. That shapes the design:

| Capability | Stellar | Impact on plan |
|---|---|---|
| Node.js apps (CloudLinux "Setup Node.js App", Passenger) | ✅ Node 18/20/22/24 | The website and API run as Node apps |
| MongoDB (local) | ❌ Not supported on Namecheap shared servers | Database hosted externally on **MongoDB Atlas** |
| Outbound port 27017 | ✅ Open by default on Namecheap shared servers | Node apps on cPanel can connect to Atlas |
| MariaDB / PostgreSQL | Available, **not used** | – |
| Subdomains | ✅ | `api.`, `admin.`, `media.` |
| Email / SMTP | ✅ | Notifications sent through cPanel SMTP (nodemailer) |
| Cron jobs | ✅ | Reminders, cleanup, sitemap rebuilds |
| SSH / Terminal | ✅ (jailed) | Deploys and WP-CLI |
| Long builds on server | ⚠️ Limited RAM/CPU (LVE limits) | **Build in CI, deploy only the built output** |

### What "serverless" means here
True serverless (Lambda, Vercel, Workers) can't run on cPanel. On Stellar we get the same practical benefits:
- **No server to manage:** Passenger starts and stops Node apps on demand. There's no OS, nginx or PM2 to look after.
- **Stateless API:** sessions live in the database, so the API can be restarted at any time.
- **Portable code:** the API is written with **Hono**, which runs on Node today. If you outgrow shared hosting, the same code can move to Cloudflare Workers, Vercel or a VPS **without rewriting**. Only the adapter file changes.

### Bonus: no media bridge needed
Because the API runs **in the same cPanel account** as the media folder, it writes uploads straight to disk. You don't need cPanel API tokens or FTP.

---

## 3. Final Stack

| Layer | Technology | Runs on |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | – |
| Language | **TypeScript** (strict) everywhere | – |
| Public website | **Next.js (App Router), `output: "standalone"`** with SSR + ISR | cPanel Node app → `ittighana.com` |
| Admin portal | **Vite + React + vantara-ui** (static SPA) | Static files → `admin.ittighana.com` |
| API | **Hono** on `@hono/node-server` | cPanel Node app → `api.ittighana.com` |
| Database | **MongoDB Atlas** + **Mongoose** (typed models, indexes, hooks) | Atlas cluster, region closest to the cPanel server |
| Auth | **Better Auth** (MongoDB adapter, DB sessions, RBAC, 2FA) | Inside API |
| Validation | **Zod** shared schemas | Shared package |
| Media | Local filesystem on cPanel + **sharp** for resizing/WebP | `media.ittighana.com` |
| Email | **nodemailer** via cPanel SMTP + **react-email** templates | Inside API |
| Calendar | **FullCalendar** (UI) + **ics** (file/feed generation) | Web + Admin + API |
| Rich text | **Tiptap** editor (admin) → stored as JSON → rendered on web | – |
| CI/CD | **GitHub Actions** → build → rsync/SSH (FTP fallback) | GitHub |
| Visual QA | **Playwright** screenshot diff (old vs new site) | CI / local |

> **Fallback:** if Next.js uses too much memory under Stellar's limits, swap `apps/web` to **Astro SSR (Node adapter)**. The blocks, schemas and API stay the same.

---

## 4. Domain & Folder Layout on cPanel

```
ittighana.com          → Node app: apps/web   (Next.js standalone)
api.ittighana.com      → Node app: apps/api   (Hono)
admin.ittighana.com    → static:   apps/admin/dist
media.ittighana.com    → static:   ~/media/   (uploads + migrated wp-content/uploads)
```

```
/home/<cpanel-user>/
├─ itti-web/            # Next.js standalone build (Passenger root)
├─ itti-api/            # Hono build (Passenger root)
├─ admin.ittighana.com/ # Admin SPA static files
├─ media/               # Document root of media.ittighana.com
│  ├─ wp-content/uploads/...   # Original WP files, kept at the same paths
│  └─ uploads/YYYY/MM/...      # New uploads from the portal
└─ private-uploads/     # NOT web-accessible: applicant CVs, IDs, transcripts
```

- **Public media** (gallery, course images) is served directly by LiteSpeed (fast, cacheable).
- **Private files** (application documents) are served only through the API, which checks the session first.
- Old URLs `ittighana.com/wp-content/uploads/...` **301-redirect** to `media.ittighana.com/wp-content/uploads/...`, so links already indexed by Google keep working.

---

## 5. Monorepo Structure

```
itti/
├─ apps/
│  ├─ web/                 # Next.js public site
│  │  ├─ app/
│  │  │  ├─ (site)/page.tsx                 # Home
│  │  │  ├─ about/
│  │  │  ├─ courses/[category]/[slug]/
│  │  │  ├─ campus/{gallery,articles,spaces}/
│  │  │  ├─ careers/[slug]/
│  │  │  ├─ events/[slug]/
│  │  │  ├─ contact/
│  │  │  ├─ enroll/[formSlug]/
│  │  │  └─ api/revalidate/route.ts         # Admin publish → refresh pages
│  │  └─ components/ (WhatsAppButton, Footer w/ HostHaus mark, …)
│  ├─ admin/               # Vite + React + vantara-ui
│  └─ api/                 # Hono
│     └─ src/{routes,middleware,services,jobs}/
├─ packages/
│  ├─ db/                  # Mongoose models, index sync, seed, data migrations (migrate-mongo)
│  ├─ schemas/             # Zod: content types, blocks, forms
│  ├─ blocks/              # Block definitions + React renderers (shared web/admin preview)
│  ├─ auth/                # Better Auth config, roles, permissions
│  ├─ media/               # Storage adapter (local FS now, S3/R2 later) + sharp pipeline
│  ├─ email/               # react-email templates + mailer
│  ├─ api-client/          # Typed client (Hono RPC) used by web + admin
│  └─ config/              # tsconfig, eslint, prettier presets
├─ tools/
│  ├─ wp-migrate/          # WordPress/Elementor → new DB importer
│  └─ visual-diff/         # Playwright old-vs-new screenshot comparison
├─ .github/workflows/      # ci.yml, deploy.yml
├─ turbo.json
└─ pnpm-workspace.yaml
```

---

## 6. Content Model

### 6.1 Template + Blocks approach
Every dynamic item has:
- **Fixed fields:** always present and typed (e.g. course fees, duration).
- **`template`:** an enum that picks the page layout (e.g. `classic`, `split-hero`, `gallery-led`).
- **`blocks[]`:** an ordered, typed JSON list that admins add and reorder in the portal.

**Initial block library** (mapped from the Elementor widgets used on the current site):
`Hero`, `RichText`, `Image`, `ImageGallery`, `TwoColumn`, `FeatureGrid`, `Stats`, `Testimonial`, `FAQ`, `CTA`, `Video`, `Downloads`, `ApplyButton`, `Spacer`.

### 6.2 Core collections (MongoDB / Mongoose)

MongoDB suits this content model well: `blocks[]`, form `fields[]`, submission `data` and SEO objects are stored as native nested documents instead of JSON columns. Each collection has a Mongoose model whose TypeScript type comes from the shared Zod schema, so API validation and DB shape stay in step.

| Collection | Key fields |
|---|---|
| `user`, `session`, `account`, `verification` | Managed by Better Auth (MongoDB adapter) |
| `user.role` (field) | super_admin, admin, editor, admissions |
| `site_settings` | WhatsApp number, contact email, socials, HostHaus watermark flag |
| `pages` | slug, title, template, blocks(JSON), seo(JSON), status. Holds Home and About singletons |
| `media` | path, url, mime, size, width, height, alt, folder, visibility (public/private) |
| `course_categories` | name, slug, order, description |
| `courses` | category_id, title, slug, template, summary, duration, fees, intakes(JSON), cover_media_id, blocks, form_id, status, seo |
| `careers` | title, slug, template, department, location, type, deadline, status, blocks, form_id |
| `events` | title, slug, start, end, all_day, location, cover_media_id, blocks, status, rrule (optional recurring) |
| `gallery_albums` / `gallery_items` | album title/slug; media_id, caption, order |
| `articles` | title, slug, author_name, author_program, cover, blocks, status (draft/review/published), published_at |
| `spaces` | name, slug, capacity, amenities, photos, rules, availability(JSON), status |
| `space_bookings` | space_id, name, email, phone, start, end, purpose, status (pending/approved/declined/cancelled) |
| `forms` | name, slug, fields(JSON schema), settings (notify emails, open/close dates, confirmation message) |
| `form_submissions` | form_id, data(JSON), files(JSON → private-uploads), status (new/reviewing/accepted/rejected), notes |
| `contact_messages` | name, email, phone, subject, message, read, replied |
| `audit_log` | user_id, action, entity, entity_id, diff, timestamp |
| `redirects` | from, to, code (301/302) |

Every content collection also gets `createdAt`, `updatedAt` (Mongoose timestamps), `createdBy`, `updatedBy`, and soft-delete `deletedAt`.

**Indexes:**
- Unique `slug` on every content collection.
- `{ status, publishedAt }` for listings.
- `{ start, end }` on events and bookings.
- `{ formId, status, createdAt }` on submissions.
- A text index on courses, careers and articles for site search.

References use `ObjectId` (e.g. `course.categoryId`, `course.formId`), populated where needed.

**Booking conflicts:** MongoDB has no exclusion constraints, so approving a booking runs inside a **transaction** (Atlas clusters are replica sets). The transaction checks for overlaps (`start < newEnd && end > newStart`, status approved) and writes the approval. Two admins can't double-book the same space.

---

## 7. Screens & Features

### Public website (`apps/web`)

| Screen | Features |
|---|---|
| **Home** | Same design as today; rebuilt as React sections fed from the `pages` blocks. Global **floating WhatsApp button** (number from Site Settings, pre-filled message) |
| **About** | Same design; editable through blocks |
| **Courses** | Main page with **categories rendered on the server** as headings. Dynamic `/courses/[category]/[slug]` pages with a per-course template. **Apply Now** opens the linked form with the course pre-selected |
| **Campus → Gallery** | Albums, lightbox, lazy-loaded WebP images |
| **Campus → Student Articles** | List + detail pages, author credit, share buttons |
| **Campus → Spaces** | Space list + detail page, availability calendar, **booking request form** |
| **Careers** | Main listing (filters: department/type) + dynamic pages with templates, apply form, auto-hide after deadline |
| **Events** | **Clickable month/week/list calendar**, dynamic event pages, **"Add to calendar"** (Google, Outlook, .ics download), subscribable **ITTI calendar feed** (`/calendar.ics`) |
| **Contact Us** | Form → saved to the portal inbox + **email to admin** + auto-reply to the sender. Rate-limited with a honeypot field and Cloudflare Turnstile |
| **Enroll Now** | Renders any form from the form builder; file uploads; confirmation email |
| **Global** | Header/footer, **"Built by HostHaus" watermark**, SEO meta/OG, sitemap.xml, robots.txt, 301 redirects |

### Admin portal (`apps/admin`, vantara-ui)

| Module | Capabilities |
|---|---|
| **Dashboard** | New applicants, unread messages, pending bookings, upcoming events |
| **Pages** | Edit Home/About blocks, live preview, SEO |
| **Courses** | CRUD, categories (drag to reorder), template picker, block editor, link application form |
| **Careers** | CRUD, templates, deadlines, link form |
| **Events** | **Editable calendar** (click a day to create, drag to reschedule), event editor, recurring events |
| **Campus** | Gallery albums (bulk upload, reorder), Articles (draft → review → publish), Spaces (setup + availability), **Bookings** (approve/decline, conflict check) |
| **Form Builder** | Add fields (text, email, phone, select, radio, checkbox, date, file, textarea, section heading), required/validation rules, conditional visibility, open/close dates, notification emails |
| **Applicants** | Per-form table, status pipeline, notes, view/download documents, **CSV/Excel export** |
| **Inbox** | Contact messages, read/replied status |
| **Media Library** | Upload, folders, alt text, usage tracking, replace file |
| **Users & Roles** | Invite users, assign roles, force 2FA |
| **Settings** | WhatsApp number, emails, socials, SMTP test, watermark (super-admin only), redirects |
| **Audit Log** | Who changed what, and when |

### Roles & permissions

| Permission | Super Admin | Admin | Editor | Admissions |
|---|:-:|:-:|:-:|:-:|
| Content (pages, courses, careers, events, campus) | ✅ | ✅ | ✅ | – |
| Publish | ✅ | ✅ | ✅* | – |
| Forms & applicants | ✅ | ✅ | – | ✅ |
| Bookings | ✅ | ✅ | – | ✅ |
| Inbox | ✅ | ✅ | – | ✅ |
| Users, settings, redirects | ✅ | ✅ | – | – |
| Watermark toggle, audit log | ✅ | – | – | – |

\*Optional: Editors submit for review instead of publishing directly.

---

## 8. Authentication & Security

- **Better Auth** with email + password, **magic link**, and **TOTP 2FA** (required for admins).
- Sessions stored in MongoDB. **HttpOnly, Secure, SameSite=Lax cookie** scoped to `.ittighana.com`, so `admin.` and `api.` share the session.
- No public sign-up: users join by **invite only**.
- **RBAC middleware** on every admin route; permissions are defined once in `packages/auth`.
- CSRF protection (origin check + same-site cookies), CORS restricted to `ittighana.com` and `admin.ittighana.com`.
- Rate limiting on login, contact, booking and application endpoints. **Cloudflare Turnstile** on public forms.
- Upload hardening: MIME sniffing, size limits, extension allow-list, image re-encoding with sharp, private docs outside the web root.
- Audit log on all writes.
- **Backups:** the free M0 tier has no automated backups. Either use a paid tier with Atlas-managed snapshots, or run a nightly cPanel cron job that exports every collection as compressed EJSON to `~/backups` (14-day rotation) and copies it off-server.
- Atlas **IP Access List** allows only the cPanel server's IP (plus your own IP for admin access). The DB user has least privilege (readWrite on the `itti` database only), and the connection string lives only in environment variables.

---

## 9. API Outline (`api.ittighana.com`)

```
# Public (cached)
GET  /v1/pages/:slug
GET  /v1/courses?category=          GET /v1/courses/:slug
GET  /v1/course-categories
GET  /v1/careers                    GET /v1/careers/:slug
GET  /v1/events?from=&to=           GET /v1/events/:slug   GET /v1/events/:slug.ics
GET  /v1/calendar.ics
GET  /v1/gallery/albums             GET /v1/gallery/albums/:slug
GET  /v1/articles                   GET /v1/articles/:slug
GET  /v1/spaces                     GET /v1/spaces/:slug/availability
GET  /v1/forms/:slug
GET  /v1/settings/public
POST /v1/contact
POST /v1/spaces/:slug/bookings
POST /v1/forms/:slug/submissions    (multipart)

# Auth
/v1/auth/*                          (Better Auth handler)

# Admin (session + role required)
CRUD /v1/admin/{pages,courses,course-categories,careers,events,
                 gallery,articles,spaces,bookings,forms,
                 submissions,messages,media,users,settings,redirects}
GET  /v1/admin/submissions/:id/files/:fileId    (private download)
GET  /v1/admin/forms/:id/export.csv
GET  /v1/admin/audit-log
```

On publish, the API calls `POST ittighana.com/api/revalidate` (signed secret) so the changed pages refresh straight away.

---

## 10. WordPress → New System Migration

### 10.1 What gets copied
| Source (WordPress) | Destination |
|---|---|
| Pages (Home, About, etc.) + `_elementor_data` JSON | `pages.blocks` |
| Course pages/posts | `courses` + `course_categories` |
| Career / Events / Articles posts (if present) | Matching collections |
| `wp-content/uploads/**` | Kept in place under `~/media/wp-content/uploads/`, catalogued into `media` |
| Yoast/RankMath SEO meta | `seo` JSON |
| Permalinks | Same slugs; anything that changes → `redirects` |
| Menus | Header/footer nav config |
| Contact Form 7/WPForms entries (optional) | `contact_messages` / `form_submissions` |

### 10.2 Importer (`tools/wp-migrate`)
1. Load the WordPress **SQL dump** into a temporary local MariaDB (Docker). It is only used as the migration source, never in production.
2. Read `wp_posts`, `wp_postmeta` (`_elementor_data`, `_wp_page_template`, SEO keys), `wp_terms`, `wp_term_relationships`.
3. Walk the Elementor tree (section → column → widget) and **map each widget to a block**: heading/text-editor → `RichText`, image → `Image`, image-gallery → `ImageGallery`, button → `CTA`, and so on.
4. Copy Elementor styles that matter (colours, spacing, typography) into Tailwind design tokens.
5. Rewrite media URLs → `media.ittighana.com`.
6. Write to MongoDB (staging DB first) through the Mongoose models, and log any widget that couldn't be mapped. The import is idempotent (upsert by slug), so it can be re-run safely before cutover.
7. **Fallback** for any page without clean Elementor JSON: scrape the rendered HTML through the WP REST API or Playwright.

### 10.3 Visual parity check
`tools/visual-diff` screenshots every URL on the **old site** and **staging** at desktop, tablet and mobile widths, then produces a pixel-diff report. A page passes when the remaining differences are approved.

### 10.4 Cutover
1. Build the new site on `staging.ittighana.com` (or `new.ittighana.com`).
2. Content freeze on WordPress → final import → diff check.
3. Back up the full cPanel account.
4. Point `ittighana.com` at the Next.js Node app; keep WordPress in `~/wp-archive/` (not public) for 30 days.
5. Submit the new sitemap in Google Search Console and watch for 404s.

---

## 11. Deployment (CI/CD)

```
push to main
  └─ GitHub Actions
       ├─ pnpm install --frozen-lockfile
       ├─ turbo lint typecheck test
       ├─ turbo build  (web standalone, api bundle via tsup, admin static)
       ├─ migrate-mongo up + syncIndexes  (direct to Atlas; runner IP allowed)
       └─ rsync over SSH  →  ~/itti-web, ~/itti-api, ~/admin.ittighana.com
            └─ touch tmp/restart.txt   (Passenger restart)
```
- **Nothing is compiled on the shared server.** Only runtime dependencies are installed there (or bundled).
- Secrets live in GitHub Secrets and in the cPanel Node app's environment variables.
- `staging` branch → staging subdomain; `main` → production.

---

## 12. Delivery Phases

| Phase | Scope | Output |
|---|---|---|
| **0. Access & audit** | Confirm cPanel features, DB dump, uploads inventory, page/URL list, screenshots | Audit checklist complete |
| **1. Foundation** | Monorepo, configs, DB schema, Better Auth, RBAC, media adapter, CI/CD to staging | Login works on staging admin |
| **2. Migration engine** | `wp-migrate`, block library, Home + About rebuilt to match the current design | Home/About look the same as today |
| **3. Courses & Careers** | Categories, templates, dynamic pages, admin editors | Live course and career pages |
| **4. Forms & Enroll** | Form builder, submissions, private uploads, emails, export | Working applications |
| **5. Events** | Calendar (public + admin), .ics, feed, add-to-calendar | ITTI calendar live |
| **6. Campus** | Gallery, Articles workflow, Spaces + bookings | Campus section complete |
| **7. Contact, settings, polish** | Inbox, WhatsApp, HostHaus watermark, SEO, sitemap, redirects, performance | Ready for launch |
| **8. QA & cutover** | Visual diff, accessibility, load test, security review, DNS switch | Production launch |

---

## 13. Pre-Work Checklists (to be done by Lord Steeze)

### 13.1 Confirm cPanel features (Stellar)
Log in to cPanel and confirm each item:

- [ ] **Software → Setup Node.js App** exists → note the highest Node version offered (aim for 20 or 22)
- [ ] **cPanel home → General Information / Server Information** → note the **shared IP address** (for the Atlas IP Access List) and the server location
- [ ] From **Terminal**, test Atlas connectivity: `nc -zv <your-cluster-shard-host> 27017`. If it's blocked, ask Namecheap live chat to allow outbound port 27017
- [ ] **Domains → Domains / Subdomains** → can create `api.`, `admin.`, `media.`, `staging.` (check the plan's subdomain limit)
- [ ] **Advanced → Terminal** or **Security → SSH Access** → SSH is enabled (needed for CI deploys and WP-CLI)
- [ ] **Security → Manage API Tokens** → *(optional; not required by this design)*
- [ ] **Advanced → Cron Jobs** → available
- [ ] **Email → Email Accounts** → create `no-reply@ittighana.com` for system mail
- [ ] **Metrics → Resource Usage** → note the RAM / entry-process limits (shown as LVE limits)
- [ ] Ask Namecheap live chat: *"On my Stellar plan, how many Node.js apps can I run, and what are my memory (PMEM) and entry-process limits?"*

### 13.1b Set up MongoDB Atlas
1. Create an account at **cloud.mongodb.com** → new Project **"ITTI Ghana"**.
2. Create a cluster: the **free M0** tier for dev/staging, a paid tier with backups for production. Pick the **region closest to your Namecheap server** (e.g. Europe if the server is in the EU) to keep latency low.
3. **Database Access** → add a user `itti_app` with readWrite on database `itti` (plus `itti_staging`).
4. **Network Access** → add the **cPanel shared IP** and your own IP. Don't use `0.0.0.0/0` in production.
5. **Connect → Drivers** → copy the `mongodb+srv://…` string. It goes into the cPanel Node app's environment variables as `MONGODB_URI`, never into the repo.

### 13.2 Export WordPress database

**Option A: phpMyAdmin (easiest)**
1. cPanel → **File Manager** → `public_html/wp-config.php` → note `DB_NAME` and `$table_prefix`.
2. cPanel → **Databases → phpMyAdmin** → select that database on the left.
3. **Export** tab → Method: *Quick* → Format: **SQL** → **Go**.
4. Save the `.sql` file (zip it if it's large).

**Option B: WP-CLI over SSH/Terminal**
```bash
cd ~/public_html
wp --info                                   # check WP-CLI exists
# If missing:
# curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && alias wp="php ~/wp-cli.phar"

wp db export ~/itti-wp-$(date +%F).sql      # full DB dump
wp post list --post_type=page --fields=ID,post_title,post_name,post_status --format=csv > ~/pages.csv
wp post list --post_type=any  --fields=ID,post_type,post_name --format=csv > ~/all-posts.csv
wp plugin list --format=csv > ~/plugins.csv
```

**Option C: Full backup**
cPanel → **Files → Backup** → download the *Home Directory* and *MySQL database* backups.

### 13.3 Media inventory
```bash
du -sh ~/public_html/wp-content/uploads
find ~/public_html/wp-content/uploads -type f | wc -l
```

### 13.4 Hand-over list
- [ ] SQL dump file
- [ ] `plugins.csv` (to see which form, SEO and events plugins are in use)
- [ ] GitHub repo URL + access
- [ ] vantara-ui npm package name + version (and an npm token if it's private)
- [ ] Brand assets: logo (SVG), fonts, colours (if not in Elementor global settings)
- [ ] WhatsApp number + default message
- [ ] Admin notification email address(es)
- [ ] Atlas project access (invite me as Project Owner) or the staging connection string

---

## 14. Open Decisions

| # | Decision | Default if not answered |
|---|---|---|
| 1 | **Payments** for applications or space bookings (Paystack / Hubtel)? | No payments at launch; a `payments` package with Paystack + Hubtel adapters can be added in a later phase |
| 2 | Should Editors publish directly or submit for review? | Submit for review |
| 3 | Are student articles written by students (with student logins) or uploaded by admins? | Uploaded by admins (as specified) |
| 4 | Should space bookings be auto-approved or need manual approval? | Manual approval |
| 5 | Migrate old form entries from WordPress? | Contact entries only |
| 6 | Staging subdomain name | `staging.ittighana.com` |
| 7 | Atlas tier for production (free M0 vs paid with automated backups) | M0 for staging; paid tier recommended for production |

---

## 15. Future-Proofing

- **Need more power?** Move to a Namecheap VPS or a cloud host. The API (Hono), web (Next.js) and Atlas database run unchanged; only the connection's IP allow-list changes.
- **Need true serverless?** Deploy `apps/api` to Cloudflare Workers by swapping the Hono adapter, and switch `packages/media` to an S3/R2 adapter, or keep it pointed at cPanel through UAPI.
- **Database scale:** Atlas scales from the free tier to dedicated clusters with no code changes. You can also add Atlas Search for full-text course search later.
