#!/bin/bash
# install-latest.sh
# 自动检查并安装 memory-lancedb-mcp 最新版本

set -eo pipefail

REPO="HACK-WU/memory-lancedb-mcp"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

# 构造 GitHub API 认证头（如果提供了 GITHUB_TOKEN）
gh_auth_header() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "-H" "Authorization: token $GITHUB_TOKEN"
  fi
}

# 检查依赖
check_dependencies() {
  if ! command -v curl &> /dev/null; then
    error "curl 未安装，请先安装 curl"
  fi
  if ! command -v npm &> /dev/null; then
    error "npm 未安装，请先安装 Node.js 和 npm"
  fi
  if ! command -v jq &> /dev/null; then
    warn "jq 未安装，将使用 grep 解析 JSON（推荐安装 jq 以获得更好的体验）"
    USE_JQ=false
  else
    USE_JQ=true
  fi
}

# 方法1: 使用 GitHub API
get_release_via_api() {
  local api_url="https://api.github.com/repos/${REPO}/releases/latest"

  RESPONSE=$(curl -sL -w "\n%{http_code}" \
    -H "Accept: application/vnd.github.v3+json" \
    $(gh_auth_header) \
    "$api_url")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" != "200" ]; then
    return 1
  fi

  if [ "$USE_JQ" = true ]; then
    LATEST_VERSION=$(echo "$BODY" | jq -r '.tag_name')
    DOWNLOAD_URL=$(echo "$BODY" | jq -r ".assets[] | select(.name | contains(\".tgz\")) | .browser_download_url" | head -1)
  else
    LATEST_VERSION=$(echo "$BODY" | grep -o '"tag_name": *"[^"]*"' | head -1 | sed 's/"tag_name": *"//;s/"//')
    DOWNLOAD_URL=$(echo "$BODY" | grep -o '"browser_download_url": *"[^"]*\.tgz"' | head -1 | sed 's/"browser_download_url": *"//;s/"//')
  fi

  return 0
}

# 方法2: 使用 gh CLI（如果已安装）
get_release_via_gh() {
  if ! command -v gh &> /dev/null; then
    return 1
  fi

  LATEST_VERSION=$(gh release view --repo "$REPO" --json tagName -q '.tagName' 2>/dev/null)
  DOWNLOAD_URL=$(gh release view --repo "$REPO" --json assets -q '.assets[] | select(.name | endswith(".tgz")) | .url' 2>/dev/null | head -1)

  [ -n "$LATEST_VERSION" ] && [ -n "$DOWNLOAD_URL" ]
}

# 方法3: 直接从 release 页面重定向获取版本
get_release_via_redirect() {
  # GitHub /releases/latest 会重定向到具体版本页面
  local redirect_url
  redirect_url=$(curl -sI -L "https://github.com/${REPO}/releases/latest" 2>/dev/null | grep -i "^location:" | tail -1 | tr -d '\r')

  # 提取版本号（tag）— 使用 sed 兼容 macOS
  LATEST_VERSION=$(echo "$redirect_url" | sed -n 's|.*/tag/\([^/]*\)$|\1|p')

  if [ -z "$LATEST_VERSION" ]; then
    return 1
  fi

  # 构造下载 URL
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_VERSION}/memory-lancedb-mcp-${LATEST_VERSION#v}.tgz"

  # 验证 URL 是否有效
  HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" "$DOWNLOAD_URL")
  [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]
}

# 获取最新 release 信息
get_latest_release() {
  info "正在查询最新版本..."

  # 尝试方法1: GitHub API
  if get_release_via_api; then
    info "通过 GitHub API 获取成功"
    return 0
  fi
  warn "GitHub API 失败（可能遇到速率限制），尝试备用方法..."

  # 尝试方法2: gh CLI
  if get_release_via_gh; then
    info "通过 gh CLI 获取成功"
    return 0
  fi

  # 尝试方法3: 页面重定向
  if get_release_via_redirect; then
    info "通过页面重定向获取成功"
    return 0
  fi

  error "所有方法均失败，请检查网络连接或稍后重试"
}

# 检查当前已安装版本
check_current_version() {
  if command -v mem &> /dev/null; then
    CURRENT_VERSION=$(mem --version 2>/dev/null || echo "unknown")
    info "当前已安装版本: $CURRENT_VERSION"
  else
    CURRENT_VERSION=""
    info "当前未安装 memory-lancedb-mcp"
  fi
}

# 统一版本号格式（去掉 v 前缀），用于比较
normalize_version() {
  echo "${1#v}"
}

# 执行安装
install_package() {
  local install_mode="${1:-global}"

  info "最新版本: $LATEST_VERSION"
  info "下载地址: $DOWNLOAD_URL"

  # 版本比较：统一去掉 v 前缀后再比较
  local current_norm latest_norm
  current_norm=$(normalize_version "$CURRENT_VERSION")
  latest_norm=$(normalize_version "$LATEST_VERSION")

  if [ -n "$CURRENT_VERSION" ] && [ "$current_norm" = "$latest_norm" ]; then
    info "已是最新版本，无需更新"
    exit 0
  fi

  info "开始安装..."

  if [ "$install_mode" = "--local" ]; then
    info "使用本地模式安装（不添加 -g）"
    npm install "$DOWNLOAD_URL"
  else
    npm install -g "$DOWNLOAD_URL"
  fi

  info "安装完成！"
  mem --version 2>/dev/null && info "版本验证成功" || warn "版本验证失败，请手动检查"

  # 清理临时变量
  unset RESPONSE BODY HTTP_CODE
}

# 显示帮助
show_help() {
  cat << EOF
用法: $0 [选项]

自动检查并安装 memory-lancedb-mcp 最新版本

选项:
  --help            显示此帮助信息
  --local           使用本地模式安装（不添加 -g 全局标志）
  --version <ver>   直接指定版本安装（如 0.1.0-beta）

环境变量:
  GITHUB_TOKEN  GitHub 个人访问令牌，用于提高 API 速率限制

示例:
  $0                    # 自动检查并安装最新版本
  $0 --local           # 使用本地模式安装
  $0 --version 0.1.0-beta  # 直接安装指定版本
  GITHUB_TOKEN=xxx $0  # 使用 GitHub Token 避免 API 速率限制

EOF
}

# 主流程
main() {
  local install_mode="global"
  local specified_version=""

  # 解析参数
  while [[ $# -gt 0 ]]; do
    case $1 in
      --help|-h)
        show_help
        exit 0
        ;;
      --local)
        install_mode="--local"
        shift
        ;;
      --version)
        specified_version="$2"
        shift 2
        ;;
      "")
        shift
        ;;
      *)
        error "未知选项: $1，使用 --help 查看帮助"
        ;;
    esac
  done

  info "memory-lancedb-mcp 最新版本安装器"
  echo "========================================"

  check_dependencies
  check_current_version

  if [ -n "$specified_version" ]; then
    # 使用指定的版本（兼容 v 前缀与否）
    LATEST_VERSION="$specified_version"
    # 确保 tag 带有 v 前缀用于 URL 路径
    local tag_ver="$specified_version"
    [[ "$tag_ver" != v* ]] && tag_ver="v$tag_ver"
    local bare_ver="${tag_ver#v}"
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${tag_ver}/memory-lancedb-mcp-${bare_ver}.tgz"
    info "使用指定版本: $LATEST_VERSION"
  else
    # 查询最新版本
    get_latest_release
  fi

  install_package "$install_mode"
}

main "$@"
