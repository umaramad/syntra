#!/usr/bin/env bash
# =============================================================================
#  make_icns.sh — convert syntra-mark.svg into a macOS .icns file
#
#  Usage:
#    bash scripts/make_icns.sh <svg_path> <output.icns>
#
#  Requirements (all built into macOS):
#    qlmanage  — renders SVG to PNG
#    sips      — resizes PNGs to required icon sizes
#    iconutil  — assembles .iconset → .icns
# =============================================================================
set -euo pipefail

SVG_IN="${1:?Usage: make_icns.sh <svg_path> <output.icns>}"
ICNS_OUT="${2:?Usage: make_icns.sh <svg_path> <output.icns>}"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

ICONSET="${WORK_DIR}/Syntra.iconset"
mkdir -p "$ICONSET"

# ── Step 1: render SVG to a single high-res PNG via qlmanage ─────────────────
# qlmanage always outputs to a directory named after the file, e.g.:
#   <out_dir>/syntra-mark.svg.png
qlmanage -t -s 1024 -o "$WORK_DIR" "$SVG_IN" > /dev/null 2>&1

# Locate the output file (name = <basename>.png)
SVG_BASENAME="$(basename "$SVG_IN")"
SOURCE_PNG="${WORK_DIR}/${SVG_BASENAME}.png"

if [[ ! -f "$SOURCE_PNG" ]]; then
  echo "ERROR: qlmanage did not produce $SOURCE_PNG" >&2
  exit 1
fi

# ── Step 2: resize to all required iconset sizes using sips ──────────────────
# macOS .iconset spec: 1x and 2x variants for each logical size
declare -a SIZES=(16 32 64 128 256 512 1024)

for size in "${SIZES[@]}"; do
  out="${ICONSET}/icon_${size}x${size}.png"
  sips -z "$size" "$size" "$SOURCE_PNG" --out "$out" > /dev/null 2>&1
done

# Canonical @2x symlinks that iconutil expects
# (1024 serves as 512@2x; 512 serves as 256@2x; etc.)
for pair in "512:256" "256:128" "128:64" "64:32" "32:16"; do
  double="${pair%%:*}"
  half="${pair##*:}"
  cp "${ICONSET}/icon_${double}x${double}.png" \
     "${ICONSET}/icon_${half}x${half}@2x.png"
done

# ── Step 3: convert .iconset → .icns ─────────────────────────────────────────
iconutil -c icns -o "$ICNS_OUT" "$ICONSET"

echo "✓ Icon written to: $ICNS_OUT"
