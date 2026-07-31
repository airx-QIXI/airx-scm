import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';

// 创建 axios 实例
const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 请求拦截器：从 localStorage 读取 token 并添加到 Authorization header
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：统一处理错误，401 时清除 token 并跳转 /login
request.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        // 未授权：清除登录态并跳转到登录页
        localStorage.removeItem('token');
        message.error('登录已过期，请重新登录');
        window.location.href = '/login';
      } else {
        message.error(data?.message || `请求失败（${status}）`);
      }
    } else if (error.request) {
      message.error('服务器无响应，请检查网络或后端服务');
    } else {
      message.error('请求异常，请稍后重试');
    }
    return Promise.reject(error);
  }
);

export default request;
