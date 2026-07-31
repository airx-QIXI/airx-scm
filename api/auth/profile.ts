import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, sanitizeUser } from '../_lib/auth';
import { sendSuccess, sendError, handlePreflight } from '../_lib/response';

/**
 * 获取当前登录用户信息
 * GET /api/auth/profile
 * 需要 JWT 认证
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, '仅支持 GET 请求', 405);
  }

  const payload = await requireAuth(req, res);
  if (!payload) return;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    return sendError(res, '用户不存在', 404);
  }

  return sendSuccess(res, sanitizeUser(user));
}
