import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { comparePassword, signToken, sanitizeUser } from '../_lib/auth';
import { sendSuccess, sendError, handlePreflight } from '../_lib/response';

/**
 * 用户登录
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { access_token, user }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, '仅支持 POST 请求', 405);
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return sendError(res, '用户名和密码不能为空', 400);
  }

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    return sendError(res, '用户名或密码错误', 401);
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    return sendError(res, '用户名或密码错误', 401);
  }

  const safeUser = sanitizeUser(user);
  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  return sendSuccess(res, {
    access_token: token,
    user: safeUser,
  });
}
