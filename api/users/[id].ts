import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, hashPassword, sanitizeUser } from '../_lib/auth';
import { sendSuccess, sendError, handlePreflight } from '../_lib/response';

/**
 * 单个用户管理
 * GET    /api/users/:id  - 获取用户详情（需认证）
 * PATCH  /api/users/:id  - 更新用户信息（需认证）
 * DELETE /api/users/:id  - 删除用户（需认证）
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  const payload = await requireAuth(req, res);
  if (!payload) return;

  const { id } = req.query;
  const userId = Number(id);

  if (Number.isNaN(userId)) {
    return sendError(res, '用户 ID 必须是数字', 400);
  }

  if (req.method === 'GET') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return sendError(res, `用户 ID ${userId} 不存在`, 404);
    }
    return sendSuccess(res, sanitizeUser(user));
  }

  if (req.method === 'PATCH') {
    const { username, password, email, fullName, role } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return sendError(res, `用户 ID ${userId} 不存在`, 404);
    }

    const updateData: any = {};
    if (username) updateData.username = username;
    if (email !== undefined) updateData.email = email || null;
    if (fullName) updateData.fullName = fullName;
    if (role) updateData.role = role;
    if (password) {
      if (password.length < 6) {
        return sendError(res, '密码长度不能少于 6 位', 400);
      }
      updateData.password = await hashPassword(password);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    return sendSuccess(res, sanitizeUser(updated));
  }

  if (req.method === 'DELETE') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return sendError(res, `用户 ID ${userId} 不存在`, 404);
    }

    const deleted = await prisma.user.delete({ where: { id: userId } });
    return sendSuccess(res, sanitizeUser(deleted));
  }

  return sendError(res, '仅支持 GET、PATCH 和 DELETE 请求', 405);
}
