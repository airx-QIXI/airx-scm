import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { formatModule } from '../_lib/module';
import { sendSuccess, handlePreflight } from '../_lib/response';

/**
 * 获取导航可见的模块列表（排除 disabled）
 * GET /api/modules/nav
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  if (req.method !== 'GET') {
    return sendSuccess(res, [], 405);
  }

  const modules = await prisma.module.findMany({
    where: { status: { not: 'disabled' } },
    orderBy: { sortOrder: 'asc' },
  });

  return sendSuccess(res, modules.map(formatModule));
}
