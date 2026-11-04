#!/bin/bash
# TEST-ONLY. Rebuilds the release candidate next to this checkout: Build 91 (d9140ba) plus candidate.patch, and checks that the result is exactly the candidate's tree.
set -eo pipefail
W=$GITHUB_WORKSPACE; git -C "$W" worktree add "$W/../rc" d9140ba
cd "$W/../rc"; git apply --index "$W/.github/simtest/candidate.patch"
[ "$(git write-tree)" = "$(cat "$W/.github/simtest/candidate.tree")" ] || { echo 'FATAL: not the candidate tree'; exit 1; }
git show d9140ba:audio.js > /tmp/orig.js; echo "candidate tree $(git write-tree)"
