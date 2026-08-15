#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
TS="$(date +%Y%m%d_%H%M%S)"
OUTDIR="$ROOT/diagnose_logs_$TS"
mkdir -p "$OUTDIR"

echo "repo: $ROOT" > "$OUTDIR/summary.txt"
git rev-parse --abbrev-ref HEAD >> "$OUTDIR/summary.txt" 2>&1 || true
git status -sb > "$OUTDIR/git_status.txt" 2>&1 || true
git fetch origin >> "$OUTDIR/git_fetch.txt" 2>&1 || true

BR="feature/setup-supabase-vercel"
if git show-ref --verify --quiet "refs/heads/$BR"; then
  git checkout "$BR" >> "$OUTDIR/git_checkout.txt" 2>&1 || true
  git pull --rebase >> "$OUTDIR/git_pull.txt" 2>&1 || true
fi

rm -rf node_modules
if [ -f package-lock.json ]; then
  npm ci --silent >> "$OUTDIR/npm_install.txt" 2>&1 || true
elif [ -f yarn.lock ]; then
  yarn install --frozen-lockfile >> "$OUTDIR/yarn_install.txt" 2>&1 || true
else
  npm install --silent >> "$OUTDIR/npm_install.txt" 2>&1 || true
fi

node -v > "$OUTDIR/node_version.txt" 2>&1 || true
npm -v > "$OUTDIR/npm_version.txt" 2>&1 || true
uname -a > "$OUTDIR/uname.txt" 2>&1 || true

if npm run | grep -q "build"; then
  npm run build 2>&1 | tee "$OUTDIR/build.log" || true
else
  echo "No npm build script found" > "$OUTDIR/build.log"
fi

if command -v npx >/dev/null 2>&1; then
  npx tsc --noEmit 2>&1 | tee "$OUTDIR/tsc.log" || true
  npx eslint "src/**/*.{ts,tsx,js,jsx}" --max-warnings=0 2>&1 | tee "$OUTDIR/eslint.log" || true
fi

if command -v vercel >/dev/null 2>&1; then
  vercel build 2>&1 | tee "$OUTDIR/vercel_build.log" || true
else
  echo "vercel CLI not installed" > "$OUTDIR/vercel_build.log"
fi

git ls-files | awk '{print tolower($0)}' | sort | uniq -d > "$OUTDIR/case_duplicates.txt" || true
cp package.json "$OUTDIR/" || true
cp package-lock.json "$OUTDIR/" 2>/dev/null || true
cp yarn.lock "$OUTDIR/" 2>/dev/null || true
grep -E "NEXT_PUBLIC|SUPABASE|VERCEL" .env* 2>/dev/null | sed -n '1,200p' > "$OUTDIR/env_hints.txt" || true

tar -czf "$ROOT/diagnose_results_$TS.tar.gz" -C "$ROOT" "$(basename "$OUTDIR")"
echo "Logs and results saved to: $ROOT/diagnose_results_$TS.tar.gz"
