#!/bin/sh
# Copies app/ to dist/ and stamps the current git sha into the page (R6).
set -e
cd "$(dirname "$0")"
sha=$(git rev-parse HEAD)
rm -rf dist && cp -r app dist
sed -i "s/__BUILD_SHA__/$sha/g" dist/index.html
echo "$sha"
