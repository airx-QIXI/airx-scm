# AIRX 供应链管理系统 - GitHub 仓库初始化脚本
#
# 使用方法：
#   1. 在 GitHub 上创建一个空仓库（不要勾选 README、.gitignore、License）
#   2. 修改下方 $repoUrl 为你的仓库地址
#   3. 在项目根目录运行：powershell -ExecutionPolicy Bypass -File init-github.ps1

# ============ 配置区 ============
# 替换为你的 GitHub 仓库地址
$repoUrl = "https://github.com/你的用户名/airx-scm.git"
# =================================

Write-Host "`n=== AIRX SCM GitHub 仓库初始化 ===`n" -ForegroundColor Cyan

# 检查 Git 是否已安装
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "错误：未检测到 Git，请先安装 Git。" -ForegroundColor Red
    Write-Host "下载地址：https://git-scm.com/download/win"
    exit 1
}

# 检查是否已在项目根目录
if (-not (Test-Path "vercel.json")) {
    Write-Host "错误：请在项目根目录运行此脚本（包含 vercel.json 的目录）。" -ForegroundColor Red
    exit 1
}

# 初始化 Git 仓库
Write-Host "[1/5] 初始化 Git 仓库..." -ForegroundColor Yellow
if (Test-Path ".git") {
    Write-Host "  Git 仓库已存在，跳过初始化。" -ForegroundColor DarkGray
} else {
    git init
    git branch -M main
    Write-Host "  Git 仓库已初始化，默认分支：main" -ForegroundColor Green
}

# 配置 Git（如果未配置）
$userName = git config user.name
$userEmail = git config user.email
if (-not $userName -or -not $userEmail) {
    Write-Host "`n  检测到 Git 用户信息未配置，请输入：" -ForegroundColor Yellow
    if (-not $userName) {
        $userName = Read-Host "  请输入你的 GitHub 用户名"
        git config user.name $userName
    }
    if (-not $userEmail) {
        $userEmail = Read-Host "  请输入你的 GitHub 邮箱"
        git config user.email $userEmail
    }
}

# 添加文件
Write-Host "`n[2/5] 添加文件到暂存区..." -ForegroundColor Yellow
git add .
Write-Host "  文件已添加到暂存区。" -ForegroundColor Green

# 检查暂存区状态
$status = git status --porcelain
if (-not $status) {
    Write-Host "  没有需要提交的更改。" -ForegroundColor DarkGray
} else {
    # 提交
    Write-Host "`n[3/5] 创建初始提交..." -ForegroundColor Yellow
    git commit -m "feat: AIRX 供应链管理系统 - Vercel + PlanetScale 部署

- 前端：React + Vite + Ant Design
- API：Vercel Serverless Functions (Node.js)
- 数据库：PlanetScale (MySQL) + Prisma ORM
- 认证：JWT + bcryptjs
- 模块注册表：数据库存储，支持 CRUD"
    Write-Host "  初始提交已创建。" -ForegroundColor Green
}

# 关联远程仓库
Write-Host "`n[4/5] 关联远程仓库..." -ForegroundColor Yellow
$remoteExists = git remote get-url origin 2>$null
if ($remoteExists) {
    git remote set-url origin $repoUrl
    Write-Host "  远程仓库地址已更新：$repoUrl" -ForegroundColor Green
} else {
    git remote add origin $repoUrl
    Write-Host "  远程仓库已关联：$repoUrl" -ForegroundColor Green
}

# 推送
Write-Host "`n[5/5] 推送到 GitHub..." -ForegroundColor Yellow
Write-Host "  （如需登录，浏览器会自动打开 GitHub 认证页面）" -ForegroundColor DarkGray
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== 推送成功！===" -ForegroundColor Green
    Write-Host "`n下一步操作：" -ForegroundColor Cyan
    Write-Host "  1. 登录 https://vercel.com/"
    Write-Host "  2. Add New → Project → Import Git Repository"
    Write-Host "  3. 选择 airx-scm 仓库"
    Write-Host "  4. 配置环境变量："
    Write-Host "     - DATABASE_URL = PlanetScale 连接字符串"
    Write-Host "     - JWT_SECRET = 随机密钥"
    Write-Host "     - JWT_EXPIRES_IN = 7d"
    Write-Host "  5. 点击 Deploy"
    Write-Host "`n详细步骤请参考 DEPLOY.md 文件。" -ForegroundColor Cyan
} else {
    Write-Host "`n推送失败，请检查：" -ForegroundColor Red
    Write-Host "  1. GitHub 仓库地址是否正确：$repoUrl"
    Write-Host "  2. 是否有 GitHub 仓库的推送权限"
    Write-Host "  3. 网络连接是否正常"
}

Write-Host ""
