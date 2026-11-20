# Deploying to cPanel (Namecheap Stellar)

Everything runs on the existing cPanel account. MongoDB runs on Atlas.

| URL | What | cPanel setup |
|---|---|---|
| `ittighana.com` / `www` | Next.js site | **Setup Node.js App** → root `~/itti-web`, startup file `apps/web/server.js` |
| `api.ittighana.com` | Hono API | **Setup Node.js App** → root `~/itti-api`, startup file `app.cjs` |
| `www.ittighana.com/staff` | Staff portal | Built into the web app (no subdomain) |
| `media.ittighana.com` | Uploads | Subdomain, document root `~/media` |

## One-time setup

1. **Subdomains** (cPanel → Domains): `api`, `media`, plus `staging`, `staging-api`.
2. **Media folder**: move the WordPress uploads (they stay at the same relative path):
   ```bash
   mkdir -p ~/media ~/private-uploads && chmod 700 ~/private-uploads
   cp -a ~/public_html/wp-content/uploads ~/media/wp-content/   # copy, don't move, until cutover
   ```
3. **Node apps** (cPanel → Software → Setup Node.js App → Create):
   - API: Node 22, mode *Production*, root `itti-api`, URL `api.ittighana.com`, startup `app.cjs`
   - Web: Node 22, mode *Production*, root `itti-web`, URL `ittighana.com`, startup `apps/web/server.js`
   - Don't click "Run NPM Install": CI uploads `node_modules` already built.
4. **Environment**: create `~/itti-api/.env` from `.env.example` (production values) and `chmod 600` it.
   For the web app, add these in the Node.js App UI: `REVALIDATE_SECRET`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `MEDIA_ORIGIN`, `SITE_URL`, `HOSTNAME=127.0.0.1`.
5. **SSH key for CI**: cPanel → SSH Access → import the deploy public key and authorise it. Add the private key to GitHub → Settings → Environments → `production` / `staging` secrets.
6. **MongoDB Atlas**: add the server's *outbound* IP to the Atlas Network Access list (run `curl -s https://ifconfig.me` in cPanel Terminal; it can differ from the shared IP cPanel shows).
7. **First admin**:
   ```bash
   cd ~/itti-api && node --env-file=.env dist/create-admin.js --email you@ittighana.com --name "Your Name"
   ```
8. **Backups**: cPanel → Cron Jobs, nightly:
   ```
   15 2 * * * cd ~/itti-api && node --env-file=.env dist/backup.js >> ~/backups/backup.log 2>&1
   ```
   (backup script lands in Phase 7; until then use Atlas snapshots or `mongodump` from your machine.)

## Production `.env` differences
```
NODE_ENV=production
API_PUBLIC_URL=https://api.ittighana.com
WEB_PUBLIC_URL=https://www.ittighana.com
ADMIN_PUBLIC_URL=https://www.ittighana.com/staff
COOKIE_DOMAIN=.ittighana.com
MEDIA_PUBLIC_DIR=/home/<cpanel-user>/media
MEDIA_PRIVATE_DIR=/home/<cpanel-user>/private-uploads
MEDIA_PUBLIC_URL=https://media.ittighana.com
```

## Troubleshooting
- **App won't start** → `~/itti-api/stderr.log` (Passenger) and the Node.js App page.
- **Can't reach Atlas** → `nc -zv <shard-host> 27017` from Terminal; ask Namecheap to allow outbound 27017 if blocked; check the Atlas IP list.
- **Restart manually** → `touch ~/itti-api/tmp/restart.txt`.
- **Memory errors** → nothing is built on the server; if the web app still exceeds limits, reduce `maxPoolSize` and check *Resource Usage* in cPanel.
