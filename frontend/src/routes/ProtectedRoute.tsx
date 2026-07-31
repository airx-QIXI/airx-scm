import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '@/stores/auth';

// 路由守卫：检查 token，未登录重定向到 /login
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
