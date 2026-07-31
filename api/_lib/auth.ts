import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

/** JWT 载荷接口 */
export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

/**
 * 从请求头提取并验证 JWT，返回用户信息
 * 验证失败返回 null
 */
export async function verifyToken(req: VercelRequest): Promise<JwtPayload | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET 环境变量未配置');
    return null;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * 要求 JWT 认证的中间件
 * 验证失败时直接返回 401 响应
 * 验证成功时将用户信息挂载到 req 上
 */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
): Promise<JwtPayload | null> {
  const payload = await verifyToken(req);
  if (!payload) {
    res.status(401).json({ message: '未授权，请先登录' });
    return null;
  }

  // 验证用户是否仍然存在
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, role: true, fullName: true, email: true },
  });

  if (!user) {
    res.status(401).json({ message: '用户不存在或令牌无效' });
    return null;
  }

  return payload;
}

/**
 * 签发 JWT 令牌
 */
export function signToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

/**
 * 验证密码
 */
export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/**
 * 加密密码
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * 移除密码字段，返回安全用户对象
 */
export function sanitizeUser(user: any) {
  const { password: _, ...result } = user;
  return result;
}
