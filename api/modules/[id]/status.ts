import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth } from '../../_lib/auth';
import { formatModule } from '../../_lib/module';
import { sendSuccess, sendError, handlePreflight } from '../../_lib/response';

/**
 * 更新模块状态
 * PATCH /api/modules/:id/status
 * Body: { status: 'active' | 'pending' | 'disabled' }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  const payload = await requireAuth(req, res);
  if (!payload) return;

  if (req.method !== 'PATCH') {
    return sendError(res, '仅支持 PATCH 请求', 405);
  }

  const { id } = req.query;
  const moduleId = String(id);
  const { status } = req.body || {};

  const validStatuses = ['active', 'pending', 'disabled'];
  if (!validStatuses.includes(status)) {
    return sendError(res, `状态值无效，可选值：${validStatuses.join('、')}`, 400);
  }

  const existing = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!existing) {
    return sendError(res, `模块 "${moduleId}" 不存在`, 404);
  }

  const updated = await prisma.module.update({
    where: { id: moduleId },
    data: { status },
  });

  return sendSuccess(res, formatModule(updated));
}
