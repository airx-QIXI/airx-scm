import { create } from 'zustand';
import { getModuleRegistry, type ModuleConfig, type ModuleRegistryResult } from '@/api/modules';

/**
 * 模块注册表状态管理
 * 负责从后端加载模块列表并缓存，供导航和路由使用
 */
interface ModulesState {
  /** 所有模块列表（按 sortOrder 排序） */
  modules: ModuleConfig[];
  /** 注册表概要信息 */
  registry: ModuleRegistryResult | null;
  /** 加载状态 */
  loading: boolean;
  /** 是否已加载过（避免重复请求） */
  loaded: boolean;
  /** 错误信息 */
  error: string | null;
  /** 从后端加载模块注册表 */
  fetchModules: (force?: boolean) => Promise<void>;
  /** 按 ID 获取模块 */
  getModuleById: (id: string) => ModuleConfig | undefined;
  /** 获取导航可见的模块 */
  getNavModules: () => ModuleConfig[];
}

const useModulesStore = create<ModulesState>((set, get) => ({
  modules: [],
  registry: null,
  loading: false,
  loaded: false,
  error: null,

  fetchModules: async (force = false) => {
    const state = get();
    if (state.loaded && !force) return;

    set({ loading: true, error: null });
    try {
      const registry = await getModuleRegistry();
      set({
        modules: registry.modules,
        registry,
        loading: false,
        loaded: true,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '加载模块列表失败',
      });
    }
  },

  getModuleById: (id) => get().modules.find((m) => m.id === id),

  getNavModules: () =>
    get()
      .modules.filter((m) => m.status !== 'disabled')
      .sort((a, b) => a.sortOrder - b.sortOrder),
}));

export default useModulesStore;
