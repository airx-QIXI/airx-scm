import { useEffect, useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, Space, Button, Spin } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  BarChartOutlined,
  LineChartOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/stores/auth';
import useModulesStore from '@/stores/modules';
import type { ModuleConfig } from '@/api/modules';

const { Header, Sider, Content } = Layout;

/**
 * 图标名称到组件的映射
 * modules.json 中的 icon 字段是字符串，这里映射到实际的 Ant Design 图标组件
 */
const iconComponents: Record<string, React.ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  InboxOutlined: <InboxOutlined />,
  ShoppingCartOutlined: <ShoppingCartOutlined />,
  TeamOutlined: <TeamOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  LineChartOutlined: <LineChartOutlined />,
};

/**
 * 根据模块配置生成菜单项
 */
function buildMenuItems(modules: ModuleConfig[]): MenuProps['items'] {
  return modules.map((module) => {
    // builtin 模块导航到内部路由，external 模块导航到 /module/:id
    const route = module.type === 'builtin' && module.path
      ? module.path
      : `/module/${module.id}`;

    // 待开发模块的菜单项添加视觉标识
    const label = module.status === 'pending'
      ? (
        <Space>
          <span>{module.name}</span>
          <span style={{ fontSize: 11, color: '#faad14' }}>待开发</span>
        </Space>
      )
      : module.name;

    return {
      key: route,
      icon: iconComponents[module.icon] || <AppstoreOutlined />,
      label,
    };
  });
}

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // 从模块注册表加载导航
  const { modules, loaded, loading, fetchModules } = useModulesStore();

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // 导航可见的模块（排除 disabled）
  const navModules = modules
    .filter((m) => m.status !== 'disabled')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const menuItems = loaded ? buildMenuItems(navModules) : [];

  // 点击菜单项跳转
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  // 退出登录
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 顶栏用户下拉菜单
  const userMenuItems: MenuProps['items'] = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      handleLogout();
    }
  };

  // 计算当前选中的菜单项
  // 对于 /module/:id 路由，需要匹配完整的路径
  const selectedKey = location.pathname;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        {/* Logo 区域 */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: collapsed ? 16 : 20,
            fontWeight: 700,
            letterSpacing: 1,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {collapsed ? 'SCM' : 'AIRX SCM'}
        </div>
        {loading && !loaded ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spin size="small" />
          </div>
        ) : (
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        )}
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
              <span>{user?.fullName || user?.username || '当前用户'}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 24,
            background: '#fff',
            borderRadius: 8,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
