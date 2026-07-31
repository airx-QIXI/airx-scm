import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './prisma';
import { requireAuth } from './auth';
import { sendSuccess, sendError, handlePreflight } from './response';

/**
 * 将数据库 Module 记录转换为 API 响应格式
 * 解析 dataSource JSON 字符串为对象
 */
export function formatModule(mod: any) {
  return {
    id: mod.id,
    name: mod.name,
    icon: mod.icon,
    description: mod.description,
    type: mod.type,
    path: mod.path ?? undefined,
    entryUrl: mod.entryUrl ?? undefined,
    apiBaseUrl: mod.apiBaseUrl ?? undefined,
    status: mod.status,
    sortOrder: mod.sortOrder,
    version: mod.version,
    dataSource: mod.dataSource ? JSON.parse(mod.dataSource) : undefined,
  };
}

/**
 * 模块注册表
 * GET  /api/modules    - 获取注册表概要（含所有模块列表）
 * POST /api/modules    - 注册新模块或更新已有模块（需认证）
 */
export async function modulesHandler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req.method, res)) return;

  if (req.method === 'GET') {
    const modules = await prisma.module.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    const formatted = modules.map(formatModule);
    return sendSuccess(res, {
      version: '1.0.0',
      updatedAt: new Date().toISOString().split('T')[0],
      total: formatted.length,
      active: formatted.filter((m) => m.status === 'active').length,
      pending: formatted.filter((m) => m.status === 'pending').length,
      disabled: formatted.filter((m) => m.status === 'disabled').length,
      modules: formatted,
    });
  }

  if (req.method === 'POST') {
    const payload = await requireAuth(req, res);
    if (!payload) return;

    const body = req.body || {};
    if (!body.id || !body.name) {
      return sendError(res, '模块 ID 和名称不能为空', 400);
    }

    const data = {
      id: body.id,
      name: body.name,
      icon: body.icon || 'AppstoreOutlined',
      description: body.description || '',
      type: body.type || 'builtin',
      path: body.path || null,
      entryUrl: body.entryUrl || null,
      apiBaseUrl: body.apiBaseUrl || null,
      status: body.status || 'active',
      sortOrder: body.sortOrder ?? 99,
      version: body.version || '0.0.0',
      dataSource: body.dataSource ? JSON.stringify(body.dataSource) : null,
    };

    const mod = await prisma.module.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });

    return sendSuccess(res, formatModule(mod), 201);
  }

  return sendError(res, '仅支持 GET 和 POST 请求', 405);
}
