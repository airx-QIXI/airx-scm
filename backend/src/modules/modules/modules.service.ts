import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs, existsSync } from 'fs';
import { join } from 'path';

/**
 * 模块类型
 * - builtin: 内置于门户，有自己的路由和页面组件
 * - external: 独立项目，通过 iframe 嵌入或 API 代理集成
 */
export type ModuleType = 'builtin' | 'external';

/**
 * 模块状态
 * - active: 已激活，可在导航中显示
 * - pending: 待开发，显示占位页
 * - disabled: 已禁用
 */
export type ModuleStatus = 'active' | 'pending' | 'disabled';

export interface ModuleConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: ModuleType;
  /** builtin 模块的内部路由路径 */
  path?: string;
  /** external 模块的前端入口 URL（用于 iframe 嵌入） */
  entryUrl?: string;
  /** external 模块的 API 基础地址（用于代理转发） */
  apiBaseUrl?: string;
  status: ModuleStatus;
  sortOrder: number;
  version: string;
  /** 数据来源配置 */
  dataSource?: {
    type: string;
    apiEndpoint?: string;
  };
}

export interface ModuleRegistry {
  version: string;
  updatedAt: string;
  modules: ModuleConfig[];
}

/**
 * 解析 modules.json 文件路径
 * NestJS assets 复制到 dist/modules/modules/，但编译后的 JS 在 dist/src/modules/modules/
 * 所以需要尝试多个路径来定位 JSON 文件
 */
function resolveRegistryPath(): string {
  // 1. 尝试与编译后 JS 同目录（理想情况）
  const alongsideJs = join(__dirname, 'modules.json');
  if (existsSync(alongsideJs)) return alongsideJs;

  // 2. 尝试 NestJS assets 实际复制位置：dist/modules/modules/
  const assetsPath = join(__dirname, '..', '..', '..', 'modules', 'modules', 'modules.json');
  if (existsSync(assetsPath)) return assetsPath;

  // 3. 开发模式：从源码目录读取
  const sourcePath = join(process.cwd(), 'src', 'modules', 'modules', 'modules.json');
  if (existsSync(sourcePath)) return sourcePath;

  // 兜底：返回默认路径（将触发明确的错误信息）
  return alongsideJs;
}

const REGISTRY_FILE = resolveRegistryPath();

@Injectable()
export class ModulesService {
  private cache: ModuleRegistry | null = null;
  private lastReadTime = 0;
  private readonly cacheTtlMs = 30_000; // 30 秒缓存

  /**
   * 读取模块注册表（带缓存）
   */
  private async readRegistry(): Promise<ModuleRegistry> {
    const now = Date.now();
    if (this.cache && now - this.lastReadTime < this.cacheTtlMs) {
      return this.cache;
    }

    const content = await fs.readFile(REGISTRY_FILE, 'utf8');
    this.cache = JSON.parse(content) as ModuleRegistry;
    this.lastReadTime = now;
    return this.cache;
  }

  /**
   * 获取所有模块（按 sortOrder 排序）
   */
  async getAllModules(): Promise<ModuleConfig[]> {
    const registry = await this.readRegistry();
    return [...registry.modules].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * 获取导航可见的模块（active + pending 状态）
   */
  async getNavModules(): Promise<ModuleConfig[]> {
    const modules = await this.getAllModules();
    return modules.filter((m) => m.status !== 'disabled');
  }

  /**
   * 获取注册表概要信息
   */
  async getRegistry() {
    const registry = await this.readRegistry();
    const modules = registry.modules;

    return {
      version: registry.version,
      updatedAt: registry.updatedAt,
      total: modules.length,
      active: modules.filter((m) => m.status === 'active').length,
      pending: modules.filter((m) => m.status === 'pending').length,
      disabled: modules.filter((m) => m.status === 'disabled').length,
      modules: modules.sort((a, b) => a.sortOrder - b.sortOrder),
    };
  }

  /**
   * 按 ID 获取单个模块
   */
  async getModuleById(id: string): Promise<ModuleConfig> {
    const registry = await this.readRegistry();
    const module = registry.modules.find((m) => m.id === id);
    if (!module) {
      throw new NotFoundException(`模块 "${id}" 不存在`);
    }
    return module;
  }

  /**
   * 注册新模块或更新已有模块
   */
  async upsertModule(module: ModuleConfig): Promise<ModuleConfig> {
    const registry = await this.readRegistry();
    const index = registry.modules.findIndex((m) => m.id === module.id);

    if (index >= 0) {
      registry.modules[index] = { ...registry.modules[index], ...module };
    } else {
      registry.modules.push(module);
    }

    registry.updatedAt = new Date().toISOString().split('T')[0];
    await this.writeRegistry(registry);
    return module;
  }

  /**
   * 更新模块状态
   */
  async updateModuleStatus(id: string, status: ModuleStatus): Promise<ModuleConfig> {
    const registry = await this.readRegistry();
    const module = registry.modules.find((m) => m.id === id);
    if (!module) {
      throw new NotFoundException(`模块 "${id}" 不存在`);
    }
    module.status = status;
    registry.updatedAt = new Date().toISOString().split('T')[0];
    await this.writeRegistry(registry);
    return module;
  }

  /**
   * 写入注册表文件（同时刷新缓存）
   */
  private async writeRegistry(registry: ModuleRegistry): Promise<void> {
    const content = JSON.stringify(registry, null, 2);
    await fs.writeFile(REGISTRY_FILE, content, 'utf8');
    this.cache = registry;
    this.lastReadTime = Date.now();
  }
}
