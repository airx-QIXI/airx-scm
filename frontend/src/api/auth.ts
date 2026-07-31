import request from './request';

// 登录请求参数
export interface LoginParams {
  username: string;
  password: string;
}

// 用户信息
export interface UserInfo {
  id: number;
  username: string;
  role: string;
  fullName: string;
}

// 登录返回结果
export interface LoginResult {
  access_token: string;
  user: UserInfo;
}

// 登录接口：POST /auth/login
export function login(data: LoginParams): Promise<LoginResult> {
  return request.post<LoginResult>('/auth/login', data).then((res) => res.data);
}

// 获取当前登录用户信息：GET /auth/profile
export function getProfile(): Promise<UserInfo> {
  return request.get<UserInfo>('/auth/profile').then((res) => res.data);
}
