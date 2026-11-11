#!/usr/bin/env bash
# Rasterize the StarChess icons from public/icon.svg + public/icon-maskable.svg.
# Needs rsvg-convert and ImageMagick (`brew install librsvg imagemagick`).
set -euo pipefail
cd "$(dirname "$0")/../public"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for size in 16 32 48; do
  rsvg-convert -w "$size" -h "$size" icon.svg -o "$tmp/$size.png"
done
magick "$tmp/16.png" "$tmp/32.png" "$tmp/48.png" favico.ico

# `any`: the rounded tile, transparent corners (as apps/chess/public/icon-*.png).
rsvg-convert -w 192 -h 192 icon.svg -o icon-192.png
rsvg-convert -w 512 -h 512 icon.svg -o icon-512.png
# Full-bleed: launchers and iOS apply their own corner mask.
rsvg-convert -w 512 -h 512 icon-maskable.svg -o icon-maskable-512.png
rsvg-convert -w 180 -h 180 icon-maskable.svg -o apple-touch-icon.png
