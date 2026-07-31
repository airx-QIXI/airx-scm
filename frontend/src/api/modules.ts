import request from './request';

/**
 * 模块类型
 */
export type ModuleType = 'builtin' | 'external';

/**
 * 模块状态
 */
export type ModuleStatus = 'active' | 'pending' | 'disabled';

/**
 * 模块配置
 */
export interface ModuleConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: ModuleType;
  /** builtin 模块的内部路由路径 */
  path?: string;
  /** external 模块的前端入口 URL（iframe 嵌入） */
  entryUrl?: string;
  /** external 模块的 API 基础地址 */
  apiBaseUrl?: string;
  status: ModuleStatus;
  sortOrder: number;
  version: string;
  dataSource?: {
    type: string;
    apiEndpoint?: string;
  };
}

/**
 * 注册表概要
 */
export interface ModuleRegistryResult {
  version: string;
  updatedAt: string;
  total: number;
  active: number;
  pending: number;
  disabled: number;
  modules: ModuleConfig[];
}

/**
 * 获取模块注册表概要（含所有模块）
 * GET /api/modules
 */
export function getModuleRegistry(): Promise<ModuleRegistryResult> {
  return request.get<ModuleRegistryResult>('/modules').then((res) => res.data);
}

/**
 * 获取导航可见的模块列表
 * GET /api/modules/nav
 */
export function getNavModules(): Promise<ModuleConfig[]> {
  return request.get<ModuleConfig[]>('/modules/nav').then((res) => res.data);
}

/**
 * 按 ID 获取单个模块详情
 * GET /api/modules/:id
 */
export function getModuleById(id: string): Promise<ModuleConfig> {
  return request.get<ModuleConfig>(`/modules/${id}`).then((res) => res.data);
}

/**
 * 注册新模块或更新已有模块
 * POST /api/modules
 */
export function upsertModule(data: ModuleConfig): Promise<ModuleConfig> {
  return request.post<ModuleConfig>('/modules', data).then((res) => res.data);
}

/**
 * 更新模块状态
 * PATCH /api/modules/:id/status
 */
export function updateModuleStatus(id: string, status: ModuleStatus): Promise<ModuleConfig> {
  return request.patch<ModuleConfig>(`/modules/${id}/status`, { status }).then((res) => res.data);
}
