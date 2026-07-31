import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, hashPassword, sanitizeUser } from '../_lib/auth';
import { sendSuccess, sendError, handlePreflight } from '../_lib/response';

/**
 * 用户管理
 * GET  /api/users    - 获取所有用户列表（需认证）
 * POST /api/users    - 创建用户（需认证）
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  const payload = await requireAuth(req, res);
  if (!payload) return;

  if (req.method === 'GET') {
    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' },
    });
    return sendSuccess(res, users.map(sanitizeUser));
  }

  if (req.method === 'POST') {
    const { username, password, email, fullName, role } = req.body || {};

    if (!username || !password || !fullName) {
      return sendError(res, '用户名、密码和姓名不能为空', 400);
    }

    if (password.length < 6) {
      return sendError(res, '密码长度不能少于 6 位', 400);
    }

    // 检查用户名是否已存在
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return sendError(res, `用户名 "${username}" 已存在`, 409);
    }

    // 检查邮箱是否已存在
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        return sendError(res, `邮箱 "${email}" 已被使用`, 409);
      }
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
