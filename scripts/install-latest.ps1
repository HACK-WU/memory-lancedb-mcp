# install-latest.ps1
# 自动检查并安装 memory-lancedb-mcp 最新版本 (Windows PowerShell)
# 用法: .\scripts\install-latest.ps1 [选项]

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$REPO = "HACK-WU/memory-lancedb-mcp"
$LATEST_VERSION = ""
$DOWNLOAD_URL = ""
$CURRENT_VERSION = ""

# ============================================================================
# 辅助函数
# ============================================================================

function Write-Info($msg)  { Write-Host "[INFO] $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

# 统一版本号格式（去掉 v 前缀），用于比较
function Normalize-Version([string]$ver) {
    return $ver -replace '^v', ''
}

# ============================================================================
# 检查依赖
# ============================================================================

function Check-Dependencies {
    if (-not (Get-Command curl -ErrorAction SilentlyContinue) -and
        -not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
        Write-Err "curl 未安装，请先安装 curl"
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Err "npm 未安装，请先安装 Node.js 和 npm"
    }
}

# ============================================================================
# 方法1: 使用 GitHub API
# ============================================================================

function Get-ReleaseViaApi {
    $apiUrl = "https://api.github.com/repos/${REPO}/releases/latest"
    $headers = @{ "Accept" = "application/vnd.github.v3+json" }
    if ($env:GITHUB_TOKEN) {
        $headers["Authorization"] = "token $env:GITHUB_TOKEN"
    }

    try {
        $response = Invoke-WebRequest -Uri $apiUrl -Headers $headers -UseBasicParsing -ErrorAction Stop
        $body = $response.Content | ConvertFrom-Json
    } catch {
        return $false
    }

    $script:LATEST_VERSION = $body.tag_name
    $tgzAsset = $body.assets | Where-Object { $_.name -like "*.tgz" } | Select-Object -First 1
    $script:DOWNLOAD_URL = if ($tgzAsset) { $tgzAsset.browser_download_url } else { "" }

    return ($script:LATEST_VERSION -and $script:DOWNLOAD_URL)
}

# ============================================================================
# 方法2: 使用 gh CLI
# ============================================================================

function Get-ReleaseViaGh {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        return $false
    }

    try {
        # 一次调用获取所有 release 信息
        $releaseJson = gh release view --repo $REPO --json tagName,assets 2>$null
        if (-not $releaseJson) { return $false }

        $release = $releaseJson | ConvertFrom-Json
        $tagName = $release.tagName
        $assetUrl = $release.assets | Where-Object { $_.name -like "*.tgz" } | Select-Object -First 1 -ExpandProperty url

        if ($tagName -and $assetUrl) {
            $script:LATEST_VERSION = $tagName
            $script:DOWNLOAD_URL = $assetUrl
            return $true
        }
    } catch {
        Write-Warn "gh CLI 查询失败: $_"
    }

    return $false
}

# ============================================================================
# 方法3: 从 release 页面重定向获取版本
# ============================================================================

function Get-ReleaseViaRedirect {
    $latestUrl = "https://github.com/${REPO}/releases/latest"

    # 确定可用的 curl 命令（避免与 PowerShell 的 curl 别名冲突）
    $curlCmd = if (Get-Command curl.exe -ErrorAction SilentlyContinue) { "curl.exe" }
                elseif (Get-Command curl -ErrorAction SilentlyContinue) {
                    # 确认不是 Invoke-WebRequest 别名
                    $cmd = Get-Command curl -ErrorAction SilentlyContinue
                    if ($cmd.CommandType -eq "Application") { "curl" } else { $null }
                } else { $null }

    if (-not $curlCmd) {
        Write-Warn "curl 不可用，跳过页面重定向方式"
        return $false
    }

    try {
        $redirectUrl = & $curlCmd -sI -L $latestUrl 2>$null |
            Select-String -Pattern "^location:" -CaseSensitive:$false |
            Select-Object -Last 1 |
            ForEach-Object { $_.Line.Trim() -replace '^location:\s*', '' -replace '\r', '' }

        if (-not $redirectUrl) { return $false }

        # 从重定向 URL 提取 tag
        if ($redirectUrl -match '/tag/([^/]+)$') {
            $script:LATEST_VERSION = $Matches[1]
        } else {
            return $false
        }

        # 构造下载 URL
        $tagVer = $script:LATEST_VERSION
        $bareVer = $tagVer -replace '^v', ''
        $script:DOWNLOAD_URL = "https://github.com/${REPO}/releases/download/${tagVer}/memory-lancedb-mcp-${bareVer}.tgz"

        # 验证 URL 是否有效
        $statusCode = & $curlCmd -sI -o NUL -w "%{http_code}" $script:DOWNLOAD_URL 2>$null
        return ($statusCode -eq "200" -or $statusCode -eq "302")
    } catch {
        return $false
    }
}

# ============================================================================
# 获取最新 release 信息
# ============================================================================

function Get-LatestRelease {
    Write-Info "正在查询最新版本..."

    if (Get-ReleaseViaApi) {
        Write-Info "通过 GitHub API 获取成功"
        return
    }
    Write-Warn "GitHub API 失败（可能遇到速率限制），尝试备用方法..."

    if (Get-ReleaseViaGh) {
        Write-Info "通过 gh CLI 获取成功"
        return
    }

    if (Get-ReleaseViaRedirect) {
        Write-Info "通过页面重定向获取成功"
        return
    }

    Write-Err "所有方法均失败，请检查网络连接或稍后重试"
}

# ============================================================================
# 检查当前已安装版本
# ============================================================================

function Check-CurrentVersion {
    if (Get-Command mem -ErrorAction SilentlyContinue) {
        try {
            $script:CURRENT_VERSION = (mem --version 2>$null).Trim()
            Write-Info "当前已安装版本: $script:CURRENT_VERSION"
        } catch {
            $script:CURRENT_VERSION = "unknown"
            Write-Info "当前已安装版本: unknown"
        }
    } else {
        $script:CURRENT_VERSION = ""
        Write-Info "当前未安装 memory-lancedb-mcp"
    }
}

# ============================================================================
# 执行安装
# ============================================================================

function Install-Package([string]$InstallMode = "global") {
    Write-Info "最新版本: $LATEST_VERSION"
    Write-Info "下载地址: $DOWNLOAD_URL"

    # 版本比较：统一去掉 v 前缀后再比较
    $currentNorm = Normalize-Version $CURRENT_VERSION
    $latestNorm = Normalize-Version $LATEST_VERSION

    if ($CURRENT_VERSION -and ($currentNorm -eq $latestNorm)) {
        Write-Info "已是最新版本，无需更新"
        exit 0
    }

    Write-Info "开始安装..."

    if ($InstallMode -eq "--local") {
        Write-Info "使用本地模式安装（不添加 -g）"
        npm install $DOWNLOAD_URL
    } else {
        npm install -g $DOWNLOAD_URL
    }

    Write-Info "安装完成！"
    try {
        $ver = (mem --version 2>$null).Trim()
        if ($ver) {
            Write-Info "版本验证成功: $ver"
        } else {
            Write-Warn "版本验证失败，请手动检查"
        }
    } catch {
        Write-Warn "版本验证失败，请手动检查"
    }
}

# ============================================================================
# 显示帮助
# ============================================================================

function Show-Help {
    Write-Host @"
用法: $($MyInvocation.ScriptName) [选项]

自动检查并安装 memory-lancedb-mcp 最新版本

选项:
  -Help             显示此帮助信息
  -Local            使用本地模式安装（不添加 -g 全局标志）
  -Version <ver>    直接指定版本安装（如 0.1.0-beta）

环境变量:
  GITHUB_TOKEN      GitHub 个人访问令牌，用于提高 API 速率限制

示例:
  $($MyInvocation.ScriptName)                        # 自动检查并安装最新版本
  $($MyInvocation.ScriptName) -Local               # 使用本地模式安装
  $($MyInvocation.ScriptName) -Version 0.1.0-beta  # 直接安装指定版本
  `$env:GITHUB_TOKEN='xxx'; $($MyInvocation.ScriptName)  # 使用 GitHub Token 避免 API 速率限制

"@
}

# ============================================================================
# 主流程
# ============================================================================

$installMode = "global"
$specifiedVersion = ""

# 解析参数
$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -in "-Help", "-h", "--help" } { Show-Help; exit 0 }
        { $_ -in "-Local", "--local" }     { $installMode = "--local"; $i++ }
        { $_ -in "-Version", "--version" } {
            if ($i + 1 -ge $args.Count) { Write-Err "-Version 需要指定版本号" }
            $specifiedVersion = $args[$i + 1]
            $i += 2
        }
        default { Write-Err "未知选项: $($args[$i])，使用 -Help 查看帮助" }
    }
}

Write-Info "memory-lancedb-mcp 最新版本安装器"
Write-Host "========================================"

Check-Dependencies
Check-CurrentVersion

if ($specifiedVersion) {
    # 使用指定的版本（兼容 v 前缀与否）
    $script:LATEST_VERSION = $specifiedVersion
    $tagVer = $specifiedVersion
    if ($tagVer -notmatch '^v') { $tagVer = "v$tagVer" }
    $bareVer = $tagVer -replace '^v', ''
    $script:DOWNLOAD_URL = "https://github.com/${REPO}/releases/download/${tagVer}/memory-lancedb-mcp-${bareVer}.tgz"
    Write-Info "使用指定版本: $LATEST_VERSION"
} else {
    Get-LatestRelease
}

Install-Package $installMode
