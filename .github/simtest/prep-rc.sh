#!/bin/bash
# TEST-ONLY. Checks out the Build 93 release candidate (ios-93-release e067c50) next to this checkout and checks it is exactly that tree.
set -eo pipefail
W=$GITHUB_WORKSPACE; git -C "$W" worktree add "$W/../rc" e067c50
cd "$W/../rc"
[ "$(git rev-parse HEAD^{tree})" = "019780fc0ebefbe64efec793c154c094a40ae7bb" ] || { echo 'FATAL: not the candidate tree'; exit 1; }
echo "candidate commit $(git rev-parse HEAD) tree $(git rev-parse HEAD^{tree})"
