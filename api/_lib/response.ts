import type { VercelResponse } from '@vercel/node';

/**
 * 设置 CORS 头，允许跨域访问
 */
export function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * 统一成功响应
 */
export function sendSuccess(res: VercelResponse, data: any, status = 200) {
  setCorsHeaders(res);
  res.status(status).json(data);
}

/**
 * 统一错误响应
 */
export function sendError(res: VercelResponse, message: string, status = 400) {
  setCorsHeaders(res);
  res.status(status).json({ message });
}

/**
 * 处理 OPTIONS 预检请求
 * 返回 true 表示已处理预检请求，调用方应直接 return
 */
export function handlePreflight(
  method: string | undefined,
  res: VercelResponse,
): boolean {
  if (method === 'OPTIONS') {
    setCorsHeaders(res);
    res.status(204).end();
    return true;
  }
  return false;
}
