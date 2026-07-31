import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { formatModule } from '../_lib/module';
import { sendSuccess, sendError, handlePreflight } from '../_lib/response';

/**
 * 按 ID 获取单个模块详情
 * GET /api/modules/:id
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, '仅支持 GET 请求', 405);
  }

  const { id } = req.query;
  const moduleId = String(id);

  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod) {
    return sendError(res, `模块 "${moduleId}" 不存在`, 404);
  }

  return sendSuccess(res, formatModule(mod));
}
