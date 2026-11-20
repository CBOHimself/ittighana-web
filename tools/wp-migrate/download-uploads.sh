#!/usr/bin/env bash
# Downloads every WordPress upload the site references into storage/media,
# keeping the original /wp-content/uploads/... paths so content links keep working.
#
# Usage (from the repo root, on a machine that can reach the live site):
#   bash tools/wp-migrate/download-uploads.sh
# Optional: SITE=https://www.ittighana.com LIST=tools/wp-migrate/upload-paths.txt OUT=storage/media
#           CA_BUNDLE=/path/to/ca.pem   (trust an extra certificate, e.g. an antivirus root)
#           INSECURE=1                  (last resort: skip certificate checks for these public images)
set -uo pipefail

SITE="${SITE:-https://www.ittighana.com}"
LIST="${LIST:-tools/wp-migrate/upload-paths.txt}"
OUT="${OUT:-storage/media}"

CURL_OPTS=(-fsSL --retry 2 --max-time 120 -A "itti-migration")
[ -n "${CA_BUNDLE:-}" ] && CURL_OPTS+=(--cacert "$CA_BUNDLE")
if [ "${INSECURE:-}" = "1" ]; then
  echo "WARNING: certificate checks are off (INSECURE=1). Only use this for the site's public images."
  CURL_OPTS+=(-k)
fi

# Check the connection once before looping over hundreds of files.
if ! err=$(curl "${CURL_OPTS[@]}" -o /dev/null "$SITE/" 2>&1); then
  echo "Cannot connect to $SITE securely:"
  echo "  $err"
  echo
  echo "If this is a certificate error, either:"
  echo "  1. fix the site's certificate (cPanel > SSL/TLS Status > Run AutoSSL), then run this again, or"
  echo "  2. run again with INSECURE=1 bash tools/wp-migrate/download-uploads.sh"
  exit 1
fi

ok=0; skipped=0; failed=0
failed_list="$OUT/download-failed.txt"
mkdir -p "$OUT"; : > "$failed_list"

while IFS= read -r path; do
  [ -z "$path" ] && continue
  dest="$OUT$path"
  if [ -s "$dest" ]; then skipped=$((skipped + 1)); continue; fi
  mkdir -p "$(dirname "$dest")"
  # Encode spaces and other unsafe characters in the URL path.
  url="$SITE$(printf '%s' "$path" | sed -e 's/ /%20/g' -e 's/(/%28/g' -e 's/)/%29/g')"
  if curl "${CURL_OPTS[@]}" -o "$dest.part" "$url" 2>/dev/null; then
    mv "$dest.part" "$dest"; ok=$((ok + 1))
  else
    rm -f "$dest.part"; failed=$((failed + 1)); echo "$path" >> "$failed_list"
  fi
  printf '\rdownloaded %d, already had %d, failed %d' "$ok" "$skipped" "$failed"
done < "$LIST"

echo
echo "Done. Files are in $OUT/wp-content/uploads"
[ "$failed" -gt 0 ] && echo "Missing on the server: see $failed_list"
exit 0
