import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import ProductionRestock from '@/pages/production-restock';
import ModuleViewer from '@/pages/module-viewer';
import ProtectedRoute from './ProtectedRoute';

/**
 * 路由配置
 *
 * builtin 模块（仪表盘、排产补货预测）使用直接路由
 * external 模块（库存管理、订单+物流、供应商采购、数据分析）统一走 /module/:moduleId
 *   - 有 entryUrl → iframe 嵌入展示
 *   - 无 entryUrl → 待开发占位页
 */
const router = createBrowserRouter([
  {
    // 登录页（公开访问）
    path: '/login',
    element: <Login />,
  },
  {
    // 主布局（需认证，路由守卫）
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      // 根路径重定向到仪表盘
      { index: true, element: <Navigate to="/dashboard" replace /> },

      // === builtin 模块路由 ===
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'production-restock', element: <ProductionRestock /> },

      // === external 模块统一路由 ===
      // 通过模块注册表动态展示：iframe 嵌入 或 待开发占位页
      { path: 'module/:moduleId', element: <ModuleViewer /> },

      // 兼容旧路由：重定向到模块查看器
      { path: 'inventory', element: <Navigate to="/module/inventory" replace /> },
      { path: 'orders', element: <Navigate to="/module/orders" replace /> },
      { path: 'suppliers', element: <Navigate to="/module/suppliers" replace /> },
      { path: 'analytics', element: <Navigate to="/module/analytics" replace /> },
    ],
  },
]);

export default router;
