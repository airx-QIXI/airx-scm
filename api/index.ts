import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma';
import {
  requireAuth,
  signToken,
  comparePassword,
  hashPassword,
  sanitizeUser,
} from './_lib/auth';
import { sendSuccess, sendError, handlePreflight } from './_lib/response';
import { formatModule, modulesHandler } from './_lib/module';

/**
 * 统一 API 入口
 * 所有 /api/* 请求通过 vercel.json rewrite 路由到此函数
 * 避免 Hobby 计划 12 个函数限制
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  // 从 req.url 解析路径（Vercel rewrite 会保留原始 URL）
  const rawUrl = req.url || '';
  const pathParts = rawUrl.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const route = pathParts.join('/');
  const method = req.method || 'GET';

  try {
    // ========== AUTH ==========
    if (route === 'auth/login') {
      if (method !== 'POST') return sendError(res, '仅支持 POST 请求', 405);

      const { username, password } = req.body || {};
      if (!username || !password) return sendError(res, '用户名和密码不能为空', 400);

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) return sendError(res, '用户名或密码错误', 401);

      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) return sendError(res, '用户名或密码错误', 401);

      const safeUser = sanitizeUser(user);
      const token = signToken({ userId: user.id, username: user.username, role: user.role });
      return sendSuccess(res, { access_token: token, user: safeUser });
    }

    if (route === 'auth/profile') {
      if (method !== 'GET') return sendError(res, '仅支持 GET 请求', 405);

      const payload = await requireAuth(req, res);
      if (!payload) return;

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) return sendError(res, '用户不存在', 404);

      return sendSuccess(res, sanitizeUser(user));
    }

    // ========== MODULES ==========
    if (route === 'modules' || route === 'modules/') {
      return modulesHandler(req, res);
    }

    if (route === 'modules/nav') {
      if (method !== 'GET') return sendSuccess(res, [], 405);

      const modules = await prisma.module.findMany({
        where: { status: { not: 'disabled' } },
        orderBy: { sortOrder: 'asc' },
      });
      return sendSuccess(res, modules.map(formatModule));
    }

    // modules/:id/status
    if (route.match(/^modules\/[^/]+\/status$/)) {
      const moduleId = pathParts[1];

      const payload = await requireAuth(req, res);
      if (!payload) return;

      if (method !== 'PATCH') return sendError(res, '仅支持 PATCH 请求', 405);

      const { status } = req.body || {};
      const validStatuses = ['active', 'pending', 'disabled'];
      if (!validStatuses.includes(status)) {
        return sendError(res, `状态值无效，可选值：${validStatuses.join('、')}`, 400);
      }

      const existing = await prisma.module.findUnique({ where: { id: moduleId } });
      if (!existing) return sendError(res, `模块 "${moduleId}" 不存在`, 404);

      const updated = await prisma.module.update({
        where: { id: moduleId },
        data: { status },
      });
      return sendSuccess(res, formatModule(updated));
    }

    // modules/:id
    if (route.match(/^modules\/[^/]+$/)) {
      const moduleId = pathParts[1];

      if (method !== 'GET') return sendError(res, '仅支持 GET 请求', 405);

      const mod = await prisma.module.findUnique({ where: { id: moduleId } });
      if (!mod) return sendError(res, `模块 "${moduleId}" 不存在`, 404);

      return sendSuccess(res, formatModule(mod));
    }

    // ========== USERS ==========
    if (route === 'users' || route === 'users/') {
      const payload = await requireAuth(req, res);
      if (!payload) return;

      if (method === 'GET') {
        const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
        return sendSuccess(res, users.map(sanitizeUser));
      }

      if (method === 'POST') {
        const { username, password, email, fullName, role } = req.body || {};

        if (!username || !password || !fullName) {
          return sendError(res, '用户名、密码和姓名不能为空', 400);
        }
        if (password.length < 6) {
          return sendError(res, '密码长度不能少于 6 位', 400);
        }

        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) return sendError(res, `用户名 "${username}" 已存在`, 409);

        if (email) {
          const existingEmail = await prisma.user.findUnique({ where: { email } });
          if (existingEmail) return sendError(res, `邮箱 "${email}" 已被使用`, 409);
        }

        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
          data: {
            username,
            password: hashedPassword,
            email: email || null,
            fullName,
            role: role || 'STAFF',
          },
        });
        return sendSuccess(res, sanitizeUser(user), 201);
      }

      return sendError(res, '仅支持 GET 和 POST 请求', 405);
    }

    // users/:id
    if (route.match(/^users\/[^/]+$/)) {
      const payload = await requireAuth(req, res);
      if (!payload) return;

      const userId = Number(pathParts[1]);
      if (Number.isNaN(userId)) return sendError(res, '用户 ID 必须是数字', 400);

      if (method === 'GET') {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return sendError(res, `用户 ID ${userId} 不存在`, 404);
        return sendSuccess(res, sanitizeUser(user));
      }

      if (method === 'PATCH') {
        const { username, password, email, fullName, role } = req.body || {};
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return sendError(res, `用户 ID ${userId} 不存在`, 404);

        const updateData: any = {};
        if (username) updateData.username = username;
        if (email !== undefined) updateData.email = email || null;
        if (fullName) updateData.fullName = fullName;
        if (role) updateData.role = role;
        if (password) {
          if (password.length < 6) return sendError(res, '密码长度不能少于 6 位', 400);
          updateData.password = await hashPassword(password);
        }

        const updated = await prisma.user.update({ where: { id: userId }, data: updateData });
        return sendSuccess(res, sanitizeUser(updated));
      }

      if (method === 'DELETE') {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return sendError(res, `用户 ID ${userId} 不存在`, 404);

        const deleted = await prisma.user.delete({ where: { id: userId } });
        return sendSuccess(res, sanitizeUser(deleted));
      }

      return sendError(res, '仅支持 GET、PATCH 和 DELETE 请求', 405);
    }

    // ========== INTEGRATIONS ==========
    if (route === 'integrations/projects') {
      if (method !== 'GET') {
        return sendSuccess(res, { total: 0, projects: [] }, 405);
      }

      const projects = await prisma.integrationProject.findMany({
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        include: { snapshots: { orderBy: { syncedAt: 'desc' }, take: 1 } },
      });

      return sendSuccess(res, {
        total: projects.length,
        projects: projects.map((project) => ({
          id: project.id,
          externalId: project.externalId,
          code: project.code,
          sku: project.sku,
          name: project.name,
          brand: project.brand,
          category: project.category,
          modelName: project.modelName,
          source: project.source,
          updatedAt: project.updatedAt,
          latestSnapshot: project.snapshots[0]
            ? {
                id: project.snapshots[0].id,
                sourceCacheTime: project.snapshots[0].sourceCacheTime,
                availableStock: project.snapshots[0].availableStock,
                inTransitStock: project.snapshots[0].inTransitStock,
                sales30Days: project.snapshots[0].sales30Days,
                avgDailySales: project.snapshots[0].avgDailySales,
                turnoverDays: project.snapshots[0].turnoverDays,
                recommendedRestock: project.snapshots[0].recommendedRestock,
                riskLevel: project.snapshots[0].riskLevel,
                syncedAt: project.snapshots[0].syncedAt,
              }
            : null,
        })),
      });
    }

    if (route === 'integrations/production-planning/dashboards') {
      if (method !== 'GET') return sendError(res, '仅支持 GET 请求', 405);

      return sendSuccess(res, {
        source: 'cloud-deployment',
        generatedAt: new Date(),
        dashboards: {
          demand: {
            title: '生产需求看板',
            updatedAt: null,
            source: null,
            rules: null,
            summary: {
              total_models: 0,
              high_risk_count: 0,
              suggested_production_models: 0,
              suggested_total_qty: 0,
            },
            riskCounts: [],
            topProduction7d: [],
            topProduction30d: [],
            topProduction61To90d: [],
            items: [],
          },
          factorySchedule: {
            title: '工厂排产看板',
            updatedAt: null,
            source: null,
            rules: null,
            summary: {
              total_models: 0,
              total_demand: 0,
              total_suggested_qty: 0,
              completion_rate: 0,
            },
            weeks: [],
            blocks: [],
          },
          forecastFulfillment: {
            title: '需求与实际出货达成',
            updatedAt: null,
            source: null,
            rules: null,
            summary: {
              recordCount: 0,
              forecastTotal: 0,
              actualTotal: null,
              pendingItems: 0,
              latestStatus: null,
            },
            records: [],
            latest: null,
            items: [],
          },
        },
        raw: { demand: null, factorySchedule: null, forecastFulfillment: null },
      });
    }

    if (route === 'integrations/production-planning/sync') {
      if (method !== 'POST') return sendError(res, '仅支持 POST 请求', 405);
      return sendError(res, '云端部署不支持本地文件同步，请通过数据导入接口或数据库直接写入数据', 400);
    }

    if (route === 'integrations/production-restock/dashboards') {
      if (method !== 'GET') {
        return sendSuccess(res, { generatedAt: new Date(), projectCount: 0, dashboards: {} }, 405);
      }

      const projects = await prisma.integrationProject.findMany({
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        include: { snapshots: { orderBy: { syncedAt: 'desc' }, take: 1 } },
      });

      function num(value: unknown): number {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
      }
      function round(value: number, digits: number): number {
        const base = 10 ** digits;
        return Math.round(value * base) / base;
      }
      function sum(values: number[]): number {
        return round(values.reduce((total, v) => total + num(v), 0), 2);
      }
      function average(values: number[]): number | null {
        if (!values.length) return null;
        return round(sum(values) / values.length, 1);
      }
      function priorityWeight(priority: string): number {
        return { P0: 0, P1: 1, P2: 2, P3: 3, WATCH: 4, NONE: 5 }[priority] ?? 9;
      }

      const latest = projects
        .filter((project) => project.snapshots[0])
        .map((project) => {
          const snapshot = project.snapshots[0];
          return {
            project,
            snapshot,
            turnover: JSON.parse(snapshot.inventoryTurnover),
            analysis: JSON.parse(snapshot.inventoryAnalysis),
            reminder: JSON.parse(snapshot.restockReminder),
          };
        });

      const turnoverProjects = latest.map((item) => item.turnover);
      const avgTurnoverDays = average(
        turnoverProjects.map((item) => item.metrics.turnoverDays).filter((v) => v !== null),
      );
      const inventoryTurnover = {
        title: '库存周转',
        summary: {
          projectCount: turnoverProjects.length,
          avgTurnoverDays,
          fastRiskCount: turnoverProjects.filter((item) =>
            ['OUT_OF_STOCK', 'CRITICAL', 'HIGH'].includes(item.metrics.riskLevel),
          ).length,
          overstockCount: turnoverProjects.filter(
            (item) => item.metrics.riskLevel === 'OVERSTOCK',
          ).length,
        },
        projects: turnoverProjects.sort(
          (a, b) => (a.metrics.turnoverDays ?? 99999) - (b.metrics.turnoverDays ?? 99999),
        ),
      };

      const analysisProjects = latest.map((item) => item.analysis);
      const warehouseMap = new Map<string, any>();
      for (const project of analysisProjects) {
        for (const warehouse of project.warehouses) {
          const current = warehouseMap.get(warehouse.name) || {
            name: warehouse.name,
            availableStock: 0,
            inTransitStock: 0,
            sales30Days: 0,
            projectCount: 0,
          };
          current.availableStock += warehouse.availableStock;
          current.inTransitStock += warehouse.inTransitStock;
          current.sales30Days += warehouse.sales30Days;
          current.projectCount += 1;
          warehouseMap.set(warehouse.name, current);
        }
      }
      const inventoryAnalysis = {
        title: '库存分析',
        summary: {
          projectCount: analysisProjects.length,
          availableStock: sum(analysisProjects.map((item) => item.summary.availableStock)),
          inTransitStock: sum(analysisProjects.map((item) => item.summary.inTransitStock)),
          sales30Days: sum(analysisProjects.map((item) => item.summary.sales30Days)),
        },
        warehouses: Array.from(warehouseMap.values()).sort(
          (a, b) => b.availableStock - a.availableStock,
        ),
        projects: analysisProjects,
      };

      const reminders = latest
        .map((item) => item.reminder)
        .filter((item) => item.priority !== 'NONE')
        .sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));
      const restockReminder = {
        title: '补货提醒',
        summary: {
          reminderCount: reminders.length,
          urgentCount: reminders.filter((item) => ['P0', 'P1'].includes(item.priority)).length,
          recommendedRestockTotal: sum(reminders.map((item) => item.recommendedRestock)),
        },
        reminders,
      };

      return sendSuccess(res, {
        generatedAt: new Date(),
        projectCount: latest.length,
        dashboards: { inventoryTurnover, inventoryAnalysis, restockReminder },
      });
    }

    if (route === 'integrations/production-restock/sync') {
      if (method !== 'POST') return sendError(res, '仅支持 POST 请求', 405);
      return sendError(res, '云端部署不支持本地文件同步，请通过数据导入接口或数据库直接写入数据', 400);
    }

    // ========== 404 ==========
    return sendError(res, `接口不存在: /api/${route}`, 404);
  } catch (error: any) {
    console.error('API Error:', error);
    return sendError(res, `服务器内部错误: ${error.message}`, 500);
  }
}
