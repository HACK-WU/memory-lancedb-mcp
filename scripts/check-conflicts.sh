#!/usr/bin/env bash
# =============================================================================
# Git 合并冲突标记检测
# 检查暂存区文件中是否残留 <<<<<<< / ======= / >>>>>>>
# =============================================================================
set -euo pipefail

staged_files=$(git diff --cached --name-only --diff-filter=ACMR)
has_conflict=false

for file in $staged_files; do
  # 仅检查代码类文件
  echo "$file" | grep -qE '\.(ts|js|mjs|cjs|tsx|jsx|json|md|txt|yml|yaml|toml|css|html|xml|svg|sh|bash|py|java|go|rs|c|cpp|h|hpp)$' || continue
  file "$file" 2>/dev/null | grep -qiE 'text|JSON|XML|YAML|shell|script|empty' || continue

  if git diff --cached -- "$file" | grep -qE '^(<{7}|>{7}|={7})'; then
    echo "ERROR: 合并冲突标记残留: $file"
    has_conflict=true
  fi
done

if $has_conflict; then
  exit 1
fi

echo "OK: 未检测到合并冲突"
