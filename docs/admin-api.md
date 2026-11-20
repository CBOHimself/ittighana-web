# ITTI staff portal & content API — for review

Covers the staff login (`ittighana.com/staff`), its security, the database migrations, and
the endpoints content is uploaded through. Everything sits under the API base
(`https://api.ittighana.com/v1`; locally `http://localhost:4000/v1`).

Mark anything you want changed. Items with **Decision** need your call.

---

## 1. Getting into the portal

| What | Where |
|---|---|
| Footer link | Small **Staff login** text, bottom-right of the footer bar on every page → `/staff/login` (`rel="nofollow"`) |
| Portal | `https://ittighana.com/staff` — the admin app is built into the website (`apps/web/public/staff`) |
| Local dev | Run the admin (`pnpm --filter @itti/admin dev`, port 5176) and set `ADMIN_DEV_URL=http://localhost:5176` on the web app; `localhost:3000/staff` then proxies to it. Or open `localhost:5176/staff/` directly |

`/staff` is never indexed (`X-Robots-Tag: noindex` + `<meta name="robots">`), can't be framed
(`X-Frame-Options: DENY`), and its `index.html` is never cached.

## 2. Sign-in security

| Control | Setting | Where |
|---|---|---|
| Accounts | No public sign-up; staff are created by an admin (Users & roles → invite, which emails a set-password link) | `packages/auth` (`disableSignUp`), `/auth/sign-up/*` blocked in `apps/api/src/app.ts` |
| Who can sign in | Only roles in `PORTAL_ROLES` (default **super_admin, admin**). Other roles and suspended (banned) users can't start a session, and every `/admin/*` call checks again | auth `databaseHooks.session.create.before` + `requireAuth` |
| Passwords | 12–128 characters; resetting a password signs out all of that user's sessions | auth config |
| Rate limits (per IP) | Sign-in 5/min · reset-password request 3 per 15 min · reset 5 per 15 min · everything else 60/min; stored in MongoDB so they hold across server restarts | auth `rateLimit` |
| Account lockout | 5 failed sign-ins for one account within 30 min → locked for 15 min (`LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`). Returns `423` with "Try again in N minutes" | `apps/api/src/lib/login-guard.ts` |
| Sessions | HttpOnly, SameSite=Lax, Secure on https; expire after **8 hours** without use, refreshed hourly | auth `session`, `advanced` |
| Audit | Every sign-in success, failure, lockout and denial is written to the audit log with IP; all content changes already are | `audit_log` collection |
| Other | Magic-link sign-in removed (password only); CORS and auth only accept the site's own origin; 2FA plugin installed but **not required** (as agreed) | |

**Decision:** keep `PORTAL_ROLES=super_admin,admin`, or let editors/admissions in later?

## 3. Database migrations

Versioned scripts in `packages/db/src/migrations`, recorded in the `migrations` collection
so each runs once.

```bash
pnpm db:migrate -- --dry-run     # see what would change (run this first against Atlas)
pnpm db:migrate                  # apply pending migrations
pnpm db:migrate -- --status      # applied / pending
pnpm db:migrate -- --only 20261116-04-content-templates --force   # re-run one
```

| # | Id | What it does |
|---|---|---|
| 1 | `20261116-01-indexes` | Creates every collection and its indexes, plus the lockout TTL index |
| 2 | `20261116-02-site-settings` | Adds missing settings (contact details, WhatsApp button, watermark) without touching existing values |
| 3 | `20261116-03-import-wordpress` | Imports the converted site from `content/itti` (pages, courses, news, student articles, templates, forms, media) |
| 4 | `20261116-04-content-templates` | Turns the WordPress course/news layouts into selectable templates and adds templates for events, student articles, careers and a news variant, each with its field list and a default per type |
| 5 | `20261116-05-template-refs` | Points courses at their template (`layoutTemplate` → `template`), copies news HTML into `fields.body`, and copies student-article authors into `fields.author` / `fields.programme` |
| 6 | `20261116-06-wordpress-2024-cleanup` | From the 16 Nov exports, nothing before 2024: fills the Hotel Hospitality Management and Hospitality and Customer Service Excellence course fields, adds a Course Content section to course templates 2 and 3 (hidden when empty), removes the 2016–2021 news posts and the two drafts, gives three 2025 news posts November 2025 cover photos, and removes pre-2024 images from the media library (files stay on disk) |

New migrations go at the end with a new id; released ones are never edited.

## 4. Templates

Every course, news post, event, student article and career opening is stored as:

```jsonc
{
  "title": "AI Prompt Engineering",
  "slug": "ai-prompt-engineering",
  "template": "itti-course-template-3-4271",  // empty = the type's default template
  "fields": {                                  // the template's fields
    "course_overview": "<p>…</p>",
    "learning_outcomes": "<ul>…</ul>",
    "certification": "A Course Completion Certificate…"
  },
  "status": "draft"
}
```

- A **template** is a layout (same components as the pages) plus a list of the fields it
  shows. Field keys come from one catalog per content type
  (`packages/schemas/src/templates.ts` → `FIELD_CATALOG`), so every template means the same
  thing by the same key, and switching template never loses data.
- **Saving** checks that the template exists for that content type and that each value
  has the right type (text, rich text, image, link, date…).
- **Publishing** also checks that the template's required fields are filled in. A failure
  returns `422 { error, fields: { "fields.certification": "Certification is required before publishing" } }`
  and the admin highlights those fields.

| Content type | Templates | Required to publish |
|---|---|---|
| Course | Course – Template 2 (**default**), Template 1, Template 3 (from WordPress) | Overview, Learning objectives, Certification |
| News | News – Article (**default**, from WordPress), News – Feature | Story |
| Event | Event – Page (**default**) | Location, Description (+ start/end dates) |
| Student article | Student Article (**default**) | Student name, Introduction |
| Career | Career Opening (**default**) | Role summary, Responsibilities, Requirements |

The new templates reuse the course page design (title band, navy highlight band, tabbed
cards, sidebar with image and call to action), so all content looks consistent.

**Decision:** the required fields above — add or remove any?

## 5. Endpoints

All `/admin/*` endpoints need a signed-in portal user; the permission listed is also
checked. List endpoints take `?page=&limit=&q=&status=&sort=` and return
`{ items, total, page, limit }`.

### Templated content — courses, news, events, student articles, careers

| Method & path | Permission | Notes |
|---|---|---|
| `GET /admin/courses` (`/news`, `/events`, `/articles`, `/careers`) | content:read | Also `?template=<slug>` to list records using one template |
| `GET /admin/courses/:id` | content:read | |
| `POST /admin/courses` | content:write | Body as above. Validates template + field types. `status: "published"` from someone without publish rights is saved as `review` |
| `PATCH /admin/courses/:id` | content:write | Partial update. `fields` **merge** into stored values |
| `POST /admin/courses/:id/publish` | content:publish | Validates required fields first |
| `POST /admin/courses/:id/unpublish` | content:publish | |
| `DELETE /admin/courses/:id` | content:write | Soft delete; frees the slug |

Core properties per type (outside `fields`):

| Type | Core properties | Public URL |
|---|---|---|
| Course | title, slug, path, categoryId, summary, duration, mode, fees, intakes, cover, gallery, formId, order, publishedAt | `/itti-course/<slug>` |
| News | title, slug, path, excerpt, categories, cover, html (imported), publishedAt | `/<slug>` |
| Event | title, slug, summary, start, end, allDay, location, onlineUrl, category, color, cover, gallery, registrationFormId, rrule | `/events/<slug>` |
| Student article | title, slug, path, excerpt, cover, tags, publishedAt | `/student-article/<slug>` |
| Career | title, slug, department, location, employmentType, summary, deadline, cover, formId | `/careers/<slug>` |

All of them also have `template`, `fields`, `status` and `seo`.

### Templates

| Method & path | Permission | Notes |
|---|---|---|
| `GET /admin/templates/content-types` | content:read | Each content type with its label, URL prefix, field catalog and published templates (no layouts): what the admin template picker uses |
| `GET /admin/templates?contentType=course` | content:read | Full template records (list omits layouts) |
| `GET /admin/templates/:id` | content:read | Includes the layout |
| `POST` / `PATCH /admin/templates/:id` | settings:manage | Saving a content template's layout rebuilds its field list (keeps edited labels and required flags) |
| `POST /admin/templates/:id/sync-fields` | settings:manage | Rebuild the field list from the layout |
| `POST /admin/templates/:id/make-default` | settings:manage | One default per content type |

### Other content (unchanged)

Pages, course categories, gallery albums, spaces and forms use the same CRUD shape at
`/admin/pages`, `/admin/course-categories`, `/admin/gallery`, `/admin/spaces`,
`/admin/forms`. Also: `/admin/media` (upload, folders, update, delete), `/admin/settings`
(+ `/redirects`), `/admin/submissions`, `/admin/bookings`, `/admin/inbox`, `/admin/users`
(role, ban/unban), `/admin/dashboard`, `/admin/audit-log`, `/admin/me`.

### Public (used by the website)

| Path | Notes |
|---|---|
| `GET /resolve?path=/x` | Which record lives at a URL and the template that renders it: its own template, else the type's default. Now covers events and careers too |
| `GET /list/:type` | For listing widgets: `page`, `news`, `article`, `course`, `event`, `career` (`?limit=&category=&exclude=&sort=date\|title\|order`) |
| `GET /templates/:slug`, `/templates/wp/:id` | Header, footer, popups, embedded sections |

## 6. Admin screens

- **New content:** pick a template (cards showing description, field count and how many
  are required) → a form with the core details and one card per field group. The
  template can be switched in the sidebar at any time.
- **Save** keeps a draft; **Save & publish** validates and publishes. Errors highlight the
  fields; confirmations appear as toasts.
- **Templates** page (sidebar): every template per content type, its fields, and *Make
  default* / *Refresh fields*.
- The raw JSON editor remains for pages, galleries, spaces and forms until their own
  editors are built.
