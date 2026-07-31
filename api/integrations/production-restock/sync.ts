import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendError, handlePreflight } from '../../_lib/response';

/**
 * 同步旧项目补货缓存
 * POST /api/integrations/production-restock/sync
 *
 * 云端部署不支持本地文件同步，返回提示信息
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, '仅支持 POST 请求', 405);
  }

  return sendError(res, '云端部署不支持本地文件同步，请通过数据导入接口或数据库直接写入数据', 400);
}
