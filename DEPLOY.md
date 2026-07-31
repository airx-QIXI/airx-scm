# AIRX 供应链管理系统 - Vercel + PlanetScale 部署指南

## 架构概览

```
GitHub 仓库 → Vercel 自动部署 → 前端静态托管 + API Serverless Functions
                                      ↓
                               PlanetScale (MySQL)
```

- **前端**: React + Vite + Ant Design，构建为静态文件托管在 Vercel
- **API**: Vercel Serverless Functions (Node.js)，处理所有 `/api/*` 请求
- **数据库**: PlanetScale Serverless MySQL，通过 Prisma ORM 访问

## 已完成的自动化配置

以下文件已自动创建，无需手动修改：

| 文件 | 作用 |
|------|------|
| `vercel.json` | Vercel 部署配置（构建命令、路由重写、函数超时） |
| `package.json` | 根依赖（Prisma、bcryptjs、jsonwebtoken） |
| `tsconfig.json` | API TypeScript 编译配置 |
| `prisma/schema.prisma` | MySQL 数据模型（User、Module、IntegrationProject、Snapshot） |
| `prisma/seed.ts` | 种子数据脚本（管理员用户 + 默认模块注册表） |
| `api/_lib/*.ts` | 共享库（Prisma 单例、JWT 认证、响应工具） |
| `api/auth/*.ts` | 认证接口（登录、获取用户信息） |
| `api/users/*.ts` | 用户管理 CRUD |
| `api/modules/*.ts` | 模块注册表 CRUD |
| `api/integrations/*.ts` | 集成看板接口 |
| `.gitignore` | Git 忽略规则 |
| `.env.example` | 环境变量模板 |

## 部署步骤

### 第 1 步：创建 PlanetScale 数据库

1. 注册/登录 [PlanetScale](https://app.planetscale.com/)
2. 创建新数据库，名称建议：`airx_scm`
3. 选择区域（建议选最近的：`us-east` 或 `ap-southeast`）
4. 创建完成后，点击 **Connect** → 选择 **Prisma** 连接方式
5. 复制连接字符串（格式如下）：
   ```
   mysql://xxxxxxxx:pscale_pw_xxxxxxxx@us-east.connect.psdb.cloud/airx_scm?ssl={"rejectUnauthorized":true}
   ```

### 第 2 步：初始化数据库表结构

在本地项目根目录执行：

```powershell
# 1. 创建 .env 文件，填入 PlanetScale 连接字符串
# 将 .env.example 复制为 .env，替换 DATABASE_URL 为你的实际连接字符串

# 2. 安装依赖（会自动执行 prisma generate）
npm install

# 3. 创建数据库表结构
npx prisma db push

# 4. 初始化种子数据（管理员用户 + 默认模块）
npm run db:seed
```

验证：登录 PlanetScale 控制台，确认 `User`、`Module` 等表已创建，且 `airx` 用户已存在。

### 第 3 步：推送到 GitHub

```powershell
# 初始化 Git 仓库
git init
git add .
git commit -m "feat: AIRX 供应链管理系统 - Vercel + PlanetScale 部署"

# 创建 GitHub 仓库后，关联远程地址
git remote add origin https://github.com/你的用户名/airx-scm.git
git branch -M main
git push -u origin main
```

### 第 4 步：在 Vercel 部署

1. 登录 [Vercel](https://vercel.com/)
2. 点击 **Add New** → **Project**
3. 选择 **Import Git Repository**，找到 `airx-scm` 仓库
4. 配置环境变量（Project Settings → Environment Variables）：
   - `DATABASE_URL` = 你的 PlanetScale 连接字符串
   - `JWT_SECRET` = 随机长字符串（如 `airx-scm-jwt-secret-2026-xyz`）
   - `JWT_EXPIRES_IN` = `7d`
5. 点击 **Deploy**

部署完成后，Vercel 会提供一个 `*.vercel.app` 域名。

### 第 5 步：绑定自定义域名（可选）

1. 在 Vercel 项目设置 → **Domains**
2. 添加 `airxchina.com.cn`
3. 按提示在域名 DNS 配置中添加 CNAME 记录
4. Vercel 自动配置 HTTPS 证书

## API 接口清单

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | 否 | 用户登录，返回 JWT |
| GET | `/api/auth/profile` | 是 | 获取当前用户信息 |
| GET | `/api/users` | 是 | 用户列表 |
| POST | `/api/users` | 是 | 创建用户 |
| GET | `/api/users/:id` | 是 | 用户详情 |
| PATCH | `/api/users/:id` | 是 | 更新用户 |
| DELETE | `/api/users/:id` | 是 | 删除用户 |
| GET | `/api/modules` | 否 | 模块注册表概要 |
| GET | `/api/modules/nav` | 否 | 导航模块列表 |
| GET | `/api/modules/:id` | 否 | 模块详情 |
| POST | `/api/modules` | 是 | 注册/更新模块 |
| PATCH | `/api/modules/:id/status` | 是 | 更新模块状态 |
| GET | `/api/integrations/projects` | 否 | 集成项目列表 |
| GET | `/api/integrations/production-restock/dashboards` | 否 | 库存周转/分析/补货看板 |
| GET | `/api/integrations/production-planning/dashboards` | 否 | 排产补货预测看板 |

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| airx | airx123 | ADMIN |
| staff | staff123 | STAFF |

## 注意事项

1. **排产补货预测看板**: 云端部署中，该看板数据接口返回空数据。本地开发环境的看板数据来源于本地 JSON 文件，云端暂不支持自动同步。后续可通过数据库导入或外部 API 对接。

2. **模块 entryUrl**: 排产补货预测模块在本地开发中使用 iframe 嵌入 `http://localhost:5180/`。云端部署后需更新为实际部署地址，或保持 builtin 模式（当前已改为 builtin）。

3. **PlanetScale 免费额度**: 免费计划包含 5GB 存储、10亿 行读取/月。对于内部系统足够使用。

4. **Vercel 免费额度**: 免费计划包含 100GB 带宽、100GB-Hours Serverless 执行。对于内部系统足够使用。
