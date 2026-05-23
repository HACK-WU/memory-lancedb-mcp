#!/usr/bin/env bash
# =============================================================================
# 秘钥/凭证泄露检测
# 优先使用 gitleaks（150+ 条专业规则），fallback 到基础正则
# =============================================================================
set -euo pipefail

if command -v gitleaks &>/dev/null; then
  echo "使用 gitleaks 进行秘钥检测..."
  git diff --cached | gitleaks detect --pipe --no-git --no-banner --verbose 2>&1
  exit_code=$?
  if [ $exit_code -eq 0 ]; then
    echo "OK: gitleaks 未检测到秘钥泄露"
  else
    echo "ERROR: gitleaks 检测到疑似秘钥，请检查"
    exit $exit_code
  fi
else
  echo "WARNING: gitleaks 未安装，使用基础规则检测"
  echo "建议安装: brew install gitleaks"

  staged_files=$(git diff --cached --name-only --diff-filter=ACMR)
  found=false

  # 基础秘钥模式（仅编译型语言和配置文件）
  patterns=(
    'AKIA[0-9A-Z]{16}'
    'ghp_[0-9a-zA-Z]{36}'
    'AIza[0-9A-Za-z\-_]{35}'
    'sk_live_[0-9a-zA-Z]{24,}'
    'xox[baprs]-[0-9a-zA-Z\-]+'
    '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----'
    'sk-[A-Za-z0-9_\-]{32,}'
    'LTAI[0-9A-Za-z]{16,}'
  )

  for file in $staged_files; do
    echo "$file" | grep -qE '\.(ts|js|mjs|cjs|tsx|jsx|json|yml|yaml|toml|env|sh|py|go|rs|java|swift|kt)$' || continue
    echo "$file" | grep -qE 'package-lock\.json$|yarn\.lock$' && continue
    file "$file" 2>/dev/null | grep -qiE 'text|JSON|YAML|shell|script|empty|source' || continue

    for pattern in "${patterns[@]}"; do
      if git diff --cached -- "$file" | grep -qE "$pattern"; then
        echo "ERROR: 疑似秘钥在 $file"
        git diff --cached -- "$file" | grep -nE "$pattern" | head -3
        found=true
      fi
    done
  done

  if $found; then
    exit 1
  fi
  echo "OK: 基础检测未发现秘钥"
fi
