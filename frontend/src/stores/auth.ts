import { create } from 'zustand';
import { getProfile, type LoginResult, type UserInfo } from '@/api/auth';

// 认证状态接口
interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  // 设置登录态（登录成功后调用）
  setAuth: (result: LoginResult) => void;
  // 退出登录
  logout: () => void;
  // 拉取当前用户信息
  fetchProfile: () => Promise<void>;
}

// token 持久化到 localStorage 的键名
const TOKEN_KEY = 'token';

const useAuthStore = create<AuthState>((set) => ({
  // 初始值从 localStorage 读取，实现 token 持久化
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),

  setAuth: (result) => {
    localStorage.setItem(TOKEN_KEY, result.access_token);
    set({
      token: result.access_token,
      user: result.user,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },

  fetchProfile: async () => {
    try {
      const user = await getProfile();
      set({ user });
    } catch {
      // 获取用户信息失败，清除登录态
      localStorage.removeItem(TOKEN_KEY);
      set({ token: null, user: null, isAuthenticated: false });
    }
  },
}));

export default useAuthStore;
