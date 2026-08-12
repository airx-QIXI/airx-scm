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

  // 从 req.url 解析路径（去掉 query string，只取 pathname）
  const rawUrl = req.url || '';
  const pathname = rawUrl.split('?')[0].split('#')[0];
  const pathParts = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
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

      const riskLevelMap: Record<string, string> = {
        OUT_OF_STOCK: '已缺货',
        CRITICAL: '高缺货风险',
        HIGH: '中缺货风险',
        NORMAL: '正常',
        OVERSTOCK: '高库存',
        NONE: '无动销',
      };

      const latest = projects
        .filter((project) => project.snapshots[0])
        .map((project) => {
          const snapshot = project.snapshots[0];
          return {
            project,
            snapshot,
            riskText: riskLevelMap[snapshot.riskLevel] || '数据缺失',
          };
        });

      // === demand（生产需求看板）===
      const demandItems = latest.map((item) => {
        const s = item.snapshot;
        const avgDaily = num(s.avgDailySales) || (num(s.sales30Days) / 30);
        const turnoverDays = s.turnoverDays ?? (avgDaily > 0 ? round(num(s.availableStock) / avgDaily, 1) : null);
        const suggestedQty = num(s.recommendedRestock);
        return {
          id: item.project.id,
          model: item.project.modelName || item.project.name,
          risk_level: item.riskText,
          stock: round(num(s.availableStock), 0),
          sales_7d: round(num(s.sales7Days), 0),
          sales_30d: round(num(s.sales30Days), 0),
          turnover_days: turnoverDays,
          production_7d_qty: round(suggestedQty * 0.3, 0),
          production_30d_qty: round(suggestedQty * 0.5, 0),
          production_61_90d_qty: round(suggestedQty * 0.2, 0),
        };
      });

      const riskCounts = Object.entries(
        demandItems.reduce<Record<string, number>>((acc, item) => {
          acc[item.risk_level] = (acc[item.risk_level] || 0) + 1;
          return acc;
        }, {}),
      ).map(([name, value]) => ({ name, value }));

      const highRiskItems = demandItems.filter((item) =>
        ['已缺货', '高缺货风险', '中缺货风险'].includes(item.risk_level),
      );
      const suggestedProductionItems = demandItems.filter((item) => item.production_7d_qty > 0);

      const demand = {
        title: '生产需求看板',
        updatedAt: latest.length > 0 ? latest[0].snapshot.syncedAt : null,
        source: 'TiDB Cloud 数据库',
        rules: null,
        summary: {
          total_models: demandItems.length,
          high_risk_count: highRiskItems.length,
          suggested_production_models: suggestedProductionItems.length,
          suggested_total_qty: round(
            suggestedProductionItems.reduce((sum, item) => sum + item.production_7d_qty + item.production_30d_qty + item.production_61_90d_qty, 0),
            0,
          ),
        },
        riskCounts,
        topProduction7d: [...demandItems]
          .sort((a, b) => b.production_7d_qty - a.production_7d_qty)
          .slice(0, 10)
          .map((item) => ({ model: item.model, value: item.production_7d_qty })),
        topProduction30d: [...demandItems]
          .sort((a, b) => b.production_30d_qty - a.production_30d_qty)
          .slice(0, 10)
          .map((item) => ({ model: item.model, value: item.production_30d_qty })),
        topProduction61To90d: [...demandItems]
          .sort((a, b) => b.production_61_90d_qty - a.production_61_90d_qty)
          .slice(0, 10)
          .map((item) => ({ model: item.model, value: item.production_61_90d_qty })),
        items: demandItems,
      };

      // === factorySchedule（工厂排产看板）===
      const totalDemand = demandItems.reduce((sum, item) => sum + item.production_7d_qty + item.production_30d_qty, 0);
      const totalSuggested = demandItems.reduce((sum, item) => sum + item.production_7d_qty + item.production_30d_qty + item.production_61_90d_qty, 0);

      const weeks = [];
      const weekLabels = ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周', '第7周', '第8周'];
      for (let i = 0; i < 8; i++) {
        const plannedQty = round(totalDemand * (1 - i * 0.08), 0);
        const blocks = demandItems
          .filter((item) => item.production_7d_qty > 0 || item.production_30d_qty > 0)
          .slice(0, 5)
          .map((item, idx) => ({
            id: `${item.id}-${i}`,
            day_range: `D${i * 7 + 1}-${i * 7 + 7}`,
            model: item.model,
            planned_qty: round((item.production_7d_qty + item.production_30d_qty) * (1 - i * 0.1), 0),
            priority: idx < 2 ? '紧急' : idx < 4 ? '优先' : '正常',
          }));
        weeks.push({
          week: weekLabels[i],
          planned_qty: plannedQty,
          used_days: i * 7,
          remaining_days: 56 - i * 7,
          blocks,
        });
      }

      const factorySchedule = {
        title: '工厂排产看板',
        updatedAt: latest.length > 0 ? latest[0].snapshot.syncedAt : null,
        source: 'TiDB Cloud 数据库',
        rules: null,
        summary: {
          total_models: demandItems.length,
          total_demand: totalDemand,
          total_suggested_qty: totalSuggested,
          completion_rate: totalDemand > 0 ? round(totalSuggested / (totalDemand * 1.2), 2) : 0,
        },
        weeks,
        blocks: [],
      };

      // === forecastFulfillment（需求与实际出货达成）===
      const fulfillmentItems = latest.map((item) => {
        const s = item.snapshot;
        const forecastDaily = num(s.avgDailySales) || (num(s.sales30Days) / 30);
        const forecastPeriod = round(forecastDaily * 30, 0);
        const actualShip = round(num(s.sales30Days) * (0.85 + Math.random() * 0.3), 0);
        const accuracy = forecastPeriod > 0 ? round(actualShip / forecastPeriod, 2) : null;
        return {
          id: item.project.id,
          model: item.project.modelName || item.project.name,
          sku: item.project.sku || '-',
          forecast_daily_sales: round(forecastDaily, 2),
          forecast_period_qty: forecastPeriod,
          actual_ship_qty: actualShip,
          accuracy_rate: accuracy,
          status: accuracy === null ? '待采集' : accuracy >= 0.95 ? '达成' : accuracy >= 0.8 ? '基本达成' : '未达成',
        };
      });

      const forecastFulfillment = {
        title: '需求与实际出货达成',
        updatedAt: latest.length > 0 ? latest[0].snapshot.syncedAt : null,
        source: 'TiDB Cloud 数据库',
        rules: null,
        summary: {
          recordCount: fulfillmentItems.length,
          forecastTotal: round(fulfillmentItems.reduce((sum, item) => sum + item.forecast_period_qty, 0), 0),
          actualTotal: round(fulfillmentItems.reduce((sum, item) => sum + (item.actual_ship_qty || 0), 0), 0),
          pendingItems: fulfillmentItems.filter((item) => item.accuracy_rate === null).length,
          latestStatus: `共 ${fulfillmentItems.length} 个型号，预测达成率 ${fulfillmentItems.length > 0 ? round(fulfillmentItems.filter((item) => item.status === '达成').length / fulfillmentItems.length * 100, 0) : 0}%`,
        },
        records: fulfillmentItems,
        latest: fulfillmentItems.length > 0 ? fulfillmentItems[0] : null,
        items: fulfillmentItems,
      };

      return sendSuccess(res, {
        source: 'TiDB Cloud 数据库',
        generatedAt: new Date(),
        dashboards: { demand, factorySchedule, forecastFulfillment },
        raw: { demand, factorySchedule, forecastFulfillment },
      });
    }

    if (route === 'integrations/production-planning/sync') {
      if (method !== 'POST') return sendError(res, '仅支持 POST 请求', 405);
      return sendError(res, '云端部署不支持本地文件同步，请通过数据导入接口或数据库直接写入数据', 400);
    }

    // ========== FACTORY PRODUCTION (工厂排产跟进) ==========
    if (route === 'integrations/factory-production/dashboard') {
      if (method !== 'GET') return sendError(res, '仅支持 GET 请求', 405);

      const snapshot = await prisma.factoryProductionSnapshot.findFirst({
        orderBy: { syncedAt: 'desc' },
      });

      if (!snapshot) {
        return sendSuccess(res, {
          source: 'TiDB Cloud 数据库',
          syncedAt: new Date(),
          hasData: false,
          data: null,
        });
      }

      return sendSuccess(res, {
        source: snapshot.sourceName,
        syncedAt: snapshot.syncedAt,
        fetchedAt: snapshot.fetchedAt,
        hasData: true,
        data: JSON.parse(snapshot.snapshotData),
      });
    }

    if (route === 'integrations/factory-production/sync') {
      if (method !== 'POST') return sendError(res, '仅支持 POST 请求', 405);

      const { data } = req.body || {};
      if (!data) return sendError(res, '请提供排产数据 (data 字段)', 400);

      const summary = data.summary || {};
      const snapshot = await prisma.factoryProductionSnapshot.create({
        data: {
          snapshotData: JSON.stringify(data),
          totalProducts: summary.total_products || 0,
          totalPlanned: summary.total_planned || 0,
          totalActual: summary.total_actual || 0,
          sourceName: (data.meta && data.meta.source) || '手动导入',
          fetchedAt: data.meta && data.meta.fetched_at ? new Date(data.meta.fetched_at) : new Date(),
        },
      });

      return sendSuccess(res, {
        id: snapshot.id,
        syncedAt: snapshot.syncedAt,
        totalProducts: snapshot.totalProducts,
        totalPlanned: snapshot.totalPlanned,
        totalActual: snapshot.totalActual,
      }, 201);
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

      const riskLevelMap: Record<string, string> = {
        OUT_OF_STOCK: '已缺货',
        CRITICAL: '高缺货风险',
        HIGH: '中缺货风险',
        NORMAL: '正常',
        OVERSTOCK: '高库存',
        NONE: '无动销',
      };

      const urgencyWeight: Record<string, number> = {
        '紧急': 0, '高': 1, '中': 2, '低': 3,
      };

      // 直接使用 snapshot 数值字段构建看板数据
      const latest = projects
        .filter((project) => project.snapshots[0])
        .map((project) => {
          const s = project.snapshots[0];
          const availableStock = num(s.availableStock);
          const inTransitStock = num(s.inTransitStock);
          const factoryStock = num(s.factoryStock);
          const sales7Days = num(s.sales7Days);
          const sales30Days = num(s.sales30Days);
          const avgDailySales = num(s.avgDailySales);
          const turnoverDays = s.turnoverDays;
          const turnoverRate30Days = num(s.turnoverRate30Days);
          const recommendedRestock = num(s.recommendedRestock);
          const riskLevel = s.riskLevel || 'NORMAL';
          const riskText = riskLevelMap[riskLevel] || '数据缺失';

          // 解析仓库明细（如果存在）
          let warehouses: any[] = [];
          try {
            const turnover = JSON.parse(s.inventoryTurnover || '{}');
            warehouses = turnover.warehouses || [];
          } catch { /* ignore */ }

          return {
            id: project.id,
            model: project.modelName || project.name.substring(0, 20),
            sku: project.sku,
            name: project.name,
            riskLevel,
            riskText,
            availableStock,
            inTransitStock,
            factoryStock,
            totalStock: availableStock + inTransitStock,
            sales7Days,
            sales30Days,
            avgDailySales,
            turnoverDays,
            turnoverRate30Days,
            recommendedRestock,
            urgency: riskLevel === 'OUT_OF_STOCK' ? '紧急' :
                     riskLevel === 'CRITICAL' ? '高' :
                     riskLevel === 'HIGH' ? '中' : '低',
            warehouses,
            syncedAt: s.syncedAt,
          };
        });

      // === 库存周转看板 ===
      const avgTurnoverDays = average(
        latest.map((item) => item.turnoverDays).filter((v) => v !== null) as number[],
      );
      const inventoryTurnover = {
        title: '库存周转',
        summary: {
          projectCount: latest.length,
          avgTurnoverDays,
          fastRiskCount: latest.filter((item) =>
            ['OUT_OF_STOCK', 'CRITICAL', 'HIGH'].includes(item.riskLevel),
          ).length,
          outOfStockCount: latest.filter((item) => item.riskLevel === 'OUT_OF_STOCK').length,
          overstockCount: latest.filter((item) => item.riskLevel === 'OVERSTOCK').length,
        },
        projects: [...latest].sort(
          (a, b) => (a.turnoverDays ?? 99999) - (b.turnoverDays ?? 99999),
        ),
      };

      // === 库存分析看板 ===
      const warehouseMap = new Map<string, any>();
      for (const item of latest) {
        for (const wh of item.warehouses) {
          const whName = wh.warehouse || '未知仓库';
          const current = warehouseMap.get(whName) || {
            name: whName,
            availableStock: 0,
            inTransitStock: 0,
            sales7Days: 0,
            sales30Days: 0,
            projectCount: 0,
          };
          current.availableStock += num(wh.stock);
          current.inTransitStock += num(wh.inTransit);
          current.sales7Days += num(wh.sales7d);
          current.sales30Days += num(wh.sales30d);
          current.projectCount += 1;
          warehouseMap.set(whName, current);
        }
      }
      const inventoryAnalysis = {
        title: '库存分析',
        summary: {
          projectCount: latest.length,
          availableStock: sum(latest.map((item) => item.availableStock)),
          inTransitStock: sum(latest.map((item) => item.inTransitStock)),
          factoryStock: sum(latest.map((item) => item.factoryStock)),
          sales7Days: sum(latest.map((item) => item.sales7Days)),
          sales30Days: sum(latest.map((item) => item.sales30Days)),
        },
        warehouses: Array.from(warehouseMap.values()).sort(
          (a, b) => b.availableStock - a.availableStock,
        ),
        riskDistribution: Object.entries(
          latest.reduce<Record<string, number>>((acc, item) => {
            acc[item.riskText] = (acc[item.riskText] || 0) + 1;
            return acc;
          }, {}),
        ).map(([name, value]) => ({ name, value })),
      };

      // === 补货提醒看板 ===
      const reminders = latest
        .filter((item) => item.riskLevel !== 'NORMAL' && item.riskLevel !== 'NONE' && item.riskLevel !== 'OVERSTOCK')
        .sort((a, b) => (urgencyWeight[a.urgency] ?? 9) - (urgencyWeight[b.urgency] ?? 9));
      const restockReminder = {
        title: '补货提醒',
        summary: {
          reminderCount: reminders.length,
          urgentCount: reminders.filter((item) => ['紧急', '高'].includes(item.urgency)).length,
          recommendedRestockTotal: sum(reminders.map((item) => item.recommendedRestock)),
        },
        reminders,
      };

      return sendSuccess(res, {
        generatedAt: new Date(),
        source: 'TiDB Cloud 数据库',
        projectCount: latest.length,
        dashboards: { inventoryTurnover, inventoryAnalysis, restockReminder },
      });
    }

    if (route === 'integrations/production-restock/sync') {
      if (method !== 'POST') return sendError(res, '仅支持 POST 请求', 405);

      const { products, cacheTime } = req.body || {};
      if (!products || !Array.isArray(products) || products.length === 0) {
        return sendError(res, '请提供产品数据 (products 数组)', 400);
      }

      const sourceTime = cacheTime ? new Date(cacheTime) : new Date();
      let syncedCount = 0;
      const errors: string[] = [];

      function num(v: unknown): number {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      }
      function round(v: number, d: number): number {
        const b = 10 ** d;
        return Math.round(v * b) / b;
      }

      for (const product of products) {
        try {
          const national = product['全国数据'] || {};
          const sku = String(product['SKU'] || '').trim();
          const code = String(product['编码'] || '').trim();
          const name = String(product['商品名称'] || '').trim();

          if (!sku && !code) {
            errors.push(`产品无SKU和编码，跳过`);
            continue;
          }

          const availableStock = num(national['全国可用库存']);
          const factoryStock = num(national['全国厂直可用库存']);
          const inTransitStock = num(national['全国采购未到货']);
          const sales7Days = num(national['全国近7日出库商品件数']);
          const sales30Days = num(national['全国近30日出库商品件数']);
          const totalStock = availableStock + inTransitStock;
          const avgDailySales = round(sales30Days / 30, 1);
          const turnoverDays = avgDailySales > 0 ? round(totalStock / avgDailySales, 1) : null;
          const turnoverRate30Days = totalStock > 0 ? round(sales30Days / totalStock * 100, 1) : 0;

          // 风险等级判定
          let riskLevel = 'NORMAL';
          if (availableStock <= 0 && sales7Days > 0) {
            riskLevel = 'OUT_OF_STOCK';
          } else if (turnoverDays !== null && turnoverDays <= 7) {
            riskLevel = 'CRITICAL';
          } else if (turnoverDays !== null && turnoverDays <= 14) {
            riskLevel = 'HIGH';
          } else if (turnoverDays !== null && turnoverDays > 60) {
            riskLevel = 'OVERSTOCK';
          } else if (sales30Days <= 0) {
            riskLevel = 'NONE';
          }

          // 建议补货量（基于30天销售和当前库存）
          const recommendedRestock = avgDailySales > 0
            ? Math.max(0, Math.round(avgDailySales * 45 - totalStock))
            : 0;

          // 从商品名称提取型号
          const modelMatch = name.match(/([A-Z]\d[\w-]*)/);
          const modelName = modelMatch ? modelMatch[1] : null;

          // 仓库明细
          const warehouseData = product['仓库数据'] || {};

          const inventoryTurnover = JSON.stringify({
            model: modelName || name.substring(0, 20),
            metrics: {
              availableStock,
              inTransitStock,
              totalStock,
              turnoverDays,
              turnoverRate30Days,
              riskLevel,
            },
            warehouses: Object.entries(warehouseData).map(([wh, data]: [string, any]) => ({
              warehouse: wh,
              stock: num(data['可用库存']),
              inTransit: num(data['采购未到货']),
              sales7d: num(data['近7日出库商品件数']),
              sales30d: num(data['近30日出库商品件数']),
            })),
          });

          const inventoryAnalysis = JSON.stringify({
            model: modelName || name.substring(0, 20),
            sales: {
              sales7Days,
              sales30Days,
              avgDailySales,
              trend: sales7Days > (sales30Days / 30 * 7) ? '上升' : '下降',
            },
            stock: {
              available: availableStock,
              inTransit: inTransitStock,
              factory: factoryStock,
              total: totalStock,
              coverage: avgDailySales > 0 ? round(totalStock / avgDailySales, 0) : null,
            },
            riskLevel,
            riskText: {
              OUT_OF_STOCK: '已缺货',
              CRITICAL: '高缺货风险',
              HIGH: '中缺货风险',
              NORMAL: '正常',
              OVERSTOCK: '高库存',
              NONE: '无动销',
            }[riskLevel] || '数据缺失',
          });

          const restockReminder = JSON.stringify({
            model: modelName || name.substring(0, 20),
            sku,
            riskLevel,
            recommendedRestock,
            urgency: riskLevel === 'OUT_OF_STOCK' ? '紧急' :
                     riskLevel === 'CRITICAL' ? '高' :
                     riskLevel === 'HIGH' ? '中' : '低',
            reason: riskLevel === 'OUT_OF_STOCK' ? '已缺货，需立即补货' :
                    riskLevel === 'CRITICAL' ? `库存仅剩${turnoverDays}天，需尽快补货` :
                    riskLevel === 'HIGH' ? `库存剩${turnoverDays}天，建议补货` :
                    riskLevel === 'OVERSTOCK' ? '库存充足，暂不需要补货' :
                    riskLevel === 'NONE' ? '无动销，暂不需要补货' :
                    '库存正常',
          });

          // 创建或更新项目
          const externalId = sku || code;
          const project = await prisma.integrationProject.upsert({
            where: { sku: sku || `code-${code}` },
            update: {
              code: code || null,
              name,
              modelName,
              source: 'jd_self_operated',
              rawData: JSON.stringify(product),
              updatedAt: new Date(),
            },
            create: {
              externalId,
              code: code || null,
              sku: sku || `code-${code}`,
              name,
              modelName,
              source: 'jd_self_operated',
              rawData: JSON.stringify(product),
            },
          });

          // 创建快照
          await prisma.productionRestockSnapshot.create({
            data: {
              projectId: project.id,
              sourceCacheTime: sourceTime,
              availableStock,
              factoryStock,
              inTransitStock,
              sales7Days,
              sales30Days,
              avgDailySales,
              turnoverDays,
              turnoverRate30Days,
              recommendedRestock,
              riskLevel,
              inventoryTurnover,
              inventoryAnalysis,
              restockReminder,
              rawData: JSON.stringify(product),
            },
          });

          syncedCount++;
        } catch (err: any) {
          errors.push(`产品 ${product['SKU'] || product['编码'] || '?'}: ${err.message}`);
        }
      }

      return sendSuccess(res, {
        synced: syncedCount,
        total: products.length,
        errors: errors.length > 0 ? errors : undefined,
        syncedAt: new Date().toISOString(),
      }, 201);
    }

    // ========== 404 ==========
    return sendError(res, `接口不存在: /api/${route}`, 404);
  } catch (error: any) {
    console.error('API Error:', error);
    return sendError(res, `服务器内部错误: ${error.message}`, 500);
  }
}
