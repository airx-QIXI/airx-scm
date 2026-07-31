import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { sendSuccess, handlePreflight } from '../../_lib/response';

/** 数值安全转换 */
function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** 四舍五入到指定小数位 */
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

/**
 * 获取库存周转、库存分析、补货提醒 3 个预测看板
 * GET /api/integrations/production-restock/dashboards
 *
 * 数据来源：PlanetScale 数据库中的快照记录
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  if (req.method !== 'GET') {
    return sendSuccess(res, { generatedAt: new Date(), projectCount: 0, dashboards: {} }, 405);
  }

  const projects = await prisma.integrationProject.findMany({
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    include: {
      snapshots: {
        orderBy: { syncedAt: 'desc' },
        take: 1,
      },
    },
  });

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

  // 库存周转看板
  const turnoverProjects = latest.map((item) => item.turnover);
  const avgTurnoverDays = average(
    turnoverProjects
      .map((item) => item.metrics.turnoverDays)
      .filter((v) => v !== null),
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

  // 库存分析看板
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

  // 补货提醒看板
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
    dashboards: {
      inventoryTurnover,
      inventoryAnalysis,
      restockReminder,
    },
  });
}
