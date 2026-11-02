#!/bin/bash
# Check dragology as an npm user gets it: build the library, pack it the way
# `pnpm publish` would, install the tarball here, then typecheck and build
# this app against it.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

echo "== Building the library"
(cd "$ROOT" && pnpm run build:lib)

echo "== Packing"
rm -rf "$HERE/.pack"
mkdir "$HERE/.pack"
(cd "$ROOT" && pnpm pack --pack-destination "$HERE/.pack" >/dev/null)
mv "$HERE"/.pack/dragology-*.tgz "$HERE/.pack/dragology.tgz"
tar -tzf "$HERE/.pack/dragology.tgz" | sed 's/^/  /'

echo "== Installing"
cd "$HERE"
# A reinstall can keep a stale copy of a same-version tarball; start clean.
rm -rf node_modules
pnpm install --prefer-offline

echo "== Typechecking"
pnpm run typecheck

echo "== Building"
pnpm run build

echo "== OK"
