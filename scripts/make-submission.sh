#!/bin/sh
# Builds the Canvas submission:  dist/<GROUP>_PhaseII.zip
#
#   sh scripts/make-submission.sh [GROUP] [path/to/design.pdf]
#
#   <GROUP>_PhaseII/
#   ├── <GROUP>_PhaseII.pdf        the design document (pass its path as the 2nd argument, or copy it in)
#   └── project/
#       ├── code/                  backend/, docker-compose.yml, Taskfile.yml, .env.example, docs/
#       ├── data/                  SQL exports + how to load them
#       ├── tests/                 Postman collection, environment, recorded run
#       ├── deploy/                deployment guide, Dockerfile + .dockerignore reference, compose file, evidence
#       └── README.md
#
# Left out on purpose: node_modules, .env (secrets), .git, and the old trip prototype in the repository
# root (index.js, init.sql, package.json), which the services under backend/ replace.
set -e
cd "$(dirname "$0")/.."
GROUP="${1:-GroupName}"
PDF="$2"
NAME="${GROUP}_PhaseII"
OUT="dist/$NAME"

rm -rf "dist/$NAME" "dist/$NAME.zip"
mkdir -p "$OUT/project/code" "$OUT/project/deploy"

rsync -a --exclude node_modules --exclude .env --exclude '*.log' \
  backend docker-compose.yml Taskfile.yml .env.example .gitignore "$OUT/project/code/"
mkdir -p "$OUT/project/code/docs"
rsync -a docs/ARCHITECTURE.md docs/diagrams "$OUT/project/code/docs/"

rsync -a data/    "$OUT/project/data/"
rsync -a tests/   "$OUT/project/tests/"
rsync -a deploy/  "$OUT/project/deploy/"
cp README.md "$OUT/project/README.md"

# a compose file that runs from deploy/ (build contexts point at ../code/backend)
sed 's#\./backend/#../code/backend/#' docker-compose.yml > "$OUT/project/deploy/docker-compose.yml"

[ -n "$PDF" ] && cp "$PDF" "$OUT/$NAME.pdf"

(cd dist && zip -qr "$NAME.zip" "$NAME")

echo "built dist/$NAME.zip ($(du -h "dist/$NAME.zip" | cut -f1))"
[ -f "$OUT/$NAME.pdf" ] || echo "NOTE: $NAME.pdf is not in the zip yet. Export the Google Doc as PDF, put it in dist/$NAME/ and zip again."
