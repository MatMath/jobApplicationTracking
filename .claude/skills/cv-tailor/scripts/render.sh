#!/usr/bin/env bash
#
# Print the CV to a PDF with headless Chrome, and say how many pages came out.
#
#   render.sh <cv-repo> <output.pdf>
#
# The CV has no build step: the PDF is index.html as Chrome prints it, so this
# is the same engine as File > Print, minus the header and footer Chrome adds.
# Set CHROME_BIN to use a browser other than the first one found.

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: render.sh <cv-repo> <output.pdf>" >&2
  exit 2
fi

repo=$(cd "$1" && pwd)
source_file="$repo/index.html"
if [ ! -f "$source_file" ]; then
  echo "render.sh: no index.html in $repo" >&2
  exit 2
fi

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
  echo "render.sh: no Chrome or Chromium found${chrome:+ at $chrome}. Set CHROME_BIN." >&2
  exit 1
fi

# A failed render must not leave the previous PDF looking like this one.
rm -f "$out"

# Chrome is noisy on stderr even when it works; keep it for the failure case.
log=$(mktemp)
trap 'rm -f "$log"' EXIT
if ! "$chrome" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$out" "file://$source_file" >"$log" 2>&1 || [ ! -s "$out" ]; then
  cat "$log" >&2
  echo "render.sh: Chrome did not produce $out" >&2
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
