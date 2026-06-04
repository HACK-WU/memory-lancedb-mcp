#!/usr/bin/env bash
# 发布脚本：构建项目并创建 GitHub Release，上传包含 dist 的 tarball
# 用法: ./scripts/release.sh <version> [prerelease]
# 示例:
#   ./scripts/release.sh 1.0.0          # 发布正式版
#   ./scripts/release.sh 1.0.0-beta.1 true  # 发布预发布版

set -euo pipefail

VERSION="${1:?请指定版本号，例如: $0 1.0.0}"
PRERELEASE="${2:-false}"
PKG_NAME="memory-lancedb-mcp"
TARBALL="${PKG_NAME}-${VERSION}.tgz"
REPO="HACK-WU/memory-lancedb-mcp"

echo "==> 发布版本: ${VERSION}"

# 1. 确认版本号与 package.json 一致
PKG_VERSION=$(node -p "require('./package.json').version")
if [ "$PKG_VERSION" != "$VERSION" ]; then
  echo "错误: package.json 版本为 ${PKG_VERSION}，与指定版本 ${VERSION} 不一致"
  echo "请先运行: npm version ${VERSION} --no-git-tag-version"
  exit 1
fi

# 2. 安装依赖并构建
echo "==> 安装依赖..."
npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts

echo "==> 构建项目..."
npm run build

# 3. 确认 dist 目录存在
if [ ! -d "dist" ]; then
  echo "错误: 构建后 dist/ 目录不存在"
  exit 1
fi

echo "==> dist/ 内容:"
ls -la dist/

# 4. 打包（npm pack 会自动触发 prepack，且只包含 files 字段指定的文件）
echo "==> 打包 ${TARBALL}..."
npm pack

if [ ! -f "${TARBALL}" ]; then
  echo "错误: 打包文件 ${TARBALL} 未生成"
  exit 1
fi

echo "==> 打包文件大小: $(du -h ${TARBALL} | cut -f1)"

# 5. 创建/覆盖 git tag
TAG="v${VERSION}"
if git tag -l "$TAG" | grep -q "$TAG"; then
  echo "==> tag ${TAG} 已存在，覆盖..."
  git tag -d "$TAG"
  # 也尝试删除远程 tag
  git push origin ":refs/tags/${TAG}" 2>/dev/null || true
fi
echo "==> 创建 tag: ${TAG}"
git tag "$TAG"

# 6. 推送 tag（强制覆盖）
echo "==> 推送 tag 到远程..."
git push origin "$TAG" --force

# 7. 创建 GitHub Release 并上传 tarball
RELEASE_NOTES="## ${PKG_NAME} ${TAG}

### 安装方式

\`\`\`bash
# 从 GitHub Release 安装（无需本地构建）
npm install -g https://github.com/${REPO}/releases/download/${TAG}/${TARBALL}
\`\`\`

### 包含文件
- \`dist/\` — 编译后的 JS 产物（无需本地构建）
- \`bin/\` — CLI 入口脚本"

if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  # 如果 Release 已存在，先删除再重建
  if gh release view "$TAG" &>/dev/null 2>&1; then
    echo "==> Release ${TAG} 已存在，删除旧版本..."
    gh release delete "$TAG" --yes --cleanup-tag 2>/dev/null || true
  fi

  echo "==> 创建 GitHub Release ${TAG}..."
  if [ "$PRERELEASE" = "true" ]; then
    gh release create "$TAG" "${TARBALL}" \
      --title "${TAG}" \
      --notes "${RELEASE_NOTES}" \
      --prerelease
  else
    gh release create "$TAG" "${TARBALL}" \
      --title "${TAG}" \
      --notes "${RELEASE_NOTES}"
  fi
  echo ""
  echo "==> ✅ 发布完成!"
else
  echo ""
  echo "==> ⚠️  gh CLI 未认证，请手动创建 Release："
  echo ""
  echo "    1. 在 GitHub 上创建 Release: https://github.com/${REPO}/releases/new"
  echo "    2. Tag: ${TAG}"
  echo "    3. 上传文件: ${TARBALL}"
  echo "    4. 或者运行以下命令（需要先 gh auth login）："
  echo ""
  echo "    gh release create ${TAG} ${TARBALL} --title '${TAG}'"
  echo ""
  echo "    打包文件已保存在: ${TARBALL}"
fi

echo ""
echo "==> 安装命令:"
echo "    npm install https://github.com/${REPO}/releases/download/${TAG}/${TARBALL}"

# 8. 提示清理
echo "==> 上传完成后可手动清理: rm -f ${TARBALL}"
