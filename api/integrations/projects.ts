import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { sendSuccess, handlePreflight } from '../_lib/response';

/**
 * 获取已识别项目列表
 * GET /api/integrations/projects
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  if (req.method !== 'GET') {
    return sendSuccess(res, { total: 0, projects: [] }, 405);
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
