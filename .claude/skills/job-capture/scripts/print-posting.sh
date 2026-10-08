#!/usr/bin/env bash
#
# Print a job posting's page to a PDF with headless Chrome, and say how many
# pages came out.
#
#   print-posting.sh <posting-url> <output.pdf>
#
# The PDF is the page as Chrome prints it, with Chrome's own header and footer
# left on: they carry the date and the URL, which is what makes the file a
# record of what the posting said and when. This is a fresh browser with no
# sign-in, so a posting behind a login prints as the login page: always read
# the PDF before keeping it. Set CHROME_BIN to use a browser other than the
# first one found.

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: print-posting.sh <posting-url> <output.pdf>" >&2
  exit 2
fi

url=$1
case "$url" in
  http://*|https://*) ;;
  *)
    echo "print-posting.sh: not an http(s) URL: $url" >&2
    exit 2
    ;;
esac

out_dir=$(dirname "$2")
mkdir -p "$out_dir"
out="$(cd "$out_dir" && pwd)/$(basename "$2")"

find_chrome() {
  if [ -n "${CHROME_BIN:-}" ]; then
    echo "$CHROME_BIN"
    return
  fi
  local candidate
  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome || true)" \
    "$(command -v google-chrome-stable || true)" \
    "$(command -v chromium || true)" \
    "$(command -v chromium-browser || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done
}

chrome=$(find_chrome)
if [ -z "$chrome" ] || [ ! -x "$chrome" ]; then
  echo "print-posting.sh: no Chrome or Chromium found${chrome:+ at $chrome}. Set CHROME_BIN." >&2
  exit 1
fi

# A failed print must not leave an earlier PDF looking like this one.
rm -f "$out"

# Most job boards build the posting with JavaScript after the page loads; the
# virtual time budget lets that finish before the page is printed.
log=$(mktemp)
trap 'rm -f "$log"' EXIT
if ! "$chrome" --headless --disable-gpu --virtual-time-budget=15000 \
  --print-to-pdf="$out" "$url" >"$log" 2>&1 || [ ! -s "$out" ]; then
  cat "$log" >&2
  echo "print-posting.sh: Chrome did not produce $out" >&2
  exit 1
fi

# Chrome writes one uncompressed "/Type /Page" object per page.
pages=$(grep -a -c -E '/Type */Page($|[^s])' "$out" || true)
bytes=$(wc -c <"$out" | tr -d ' ')

echo "pdf:   $out"
echo "pages: ${pages:-unknown}"
echo "bytes: $bytes"

# The tracker refuses a file over 1 MB (src/lib/documents/files.ts).
if [ "$bytes" -gt 1048576 ]; then
  echo "warning: over the tracker's 1 MB limit; it will not be accepted there." >&2
fi
