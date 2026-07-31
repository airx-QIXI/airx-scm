import { useEffect } from 'react';
import { Row, Col, Card, Tag, Typography, Space, Spin, Statistic } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  BarChartOutlined,
  LineChartOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import useAuthStore from '@/stores/auth';
import useModulesStore from '@/stores/modules';
import type { ModuleConfig } from '@/api/modules';

const { Title, Text, Paragraph } = Typography;

/**
 * 图标名称到组件的映射
 */
const iconMap: Record<string, React.ReactNode> = {
  DashboardOutlined: <DashboardOutlined style={{ fontSize: 32 }} />,
  InboxOutlined: <InboxOutlined style={{ fontSize: 32 }} />,
  ShoppingCartOutlined: <ShoppingCartOutlined style={{ fontSize: 32 }} />,
  TeamOutlined: <TeamOutlined style={{ fontSize: 32 }} />,
  BarChartOutlined: <BarChartOutlined style={{ fontSize: 32 }} />,
  LineChartOutlined: <LineChartOutlined style={{ fontSize: 32 }} />,
};

/**
 * 状态标签
 */
const statusTagMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  active: { color: 'success', icon: <CheckCircleOutlined />, text: '已上线' },
  pending: { color: 'warning', icon: <ClockCircleOutlined />, text: '待开发' },
  disabled: { color: 'default', icon: <ClockCircleOutlined />, text: '已禁用' },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { modules, loaded, loading, fetchModules, registry } = useModulesStore();

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // 点击模块卡片跳转
  const handleModuleClick = (module: ModuleConfig) => {
    const route = module.type === 'builtin' && module.path
      ? module.path
      : `/module/${module.id}`;
    navigate(route);
  };

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* 欢迎卡片 */}
      <Card>
        <Title level={3} style={{ margin: 0 }}>
          欢迎使用 AIRX 供应链管理系统
        </Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
          {user?.fullName || user?.username || '用户'}，这里是您的供应链概览。
          点击下方模块卡片快速进入对应功能。
        </Paragraph>
      </Card>

      {/* 系统概览统计 */}
      {registry && (
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Card>
              <Statistic title="注册模块总数" value={registry.total} prefix={<AppstoreOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="已上线模块" value={registry.active} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="待开发模块" value={registry.pending} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="注册表版本" value={registry.version} />
            </Card>
          </Col>
        </Row>
      )}

      {/* 模块卡片网格 */}
      <div>
        <Title level={4} style={{ marginBottom: 16 }}>功能模块</Title>
        {loading && !loaded ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {modules
              .filter((m) => m.status !== 'disabled')
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((module) => {
                const statusInfo = statusTagMap[module.status] || statusTagMap.pending;
                return (
                  <Col xs={24} sm={12} md={8} lg={6} key={module.id}>
                    <Card
                      hoverable
                      onClick={() => handleModuleClick(module)}
                      style={{ height: '100%', cursor: 'pointer' }}
                    >
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          {iconMap[module.icon] || <AppstoreOutlined style={{ fontSize: 32, color: '#4B3FE3' }} />}
                          <Tag color={statusInfo.color} icon={statusInfo.icon}>
                            {statusInfo.text}
                          </Tag>
                        </Space>
                        <div>
                          <Text strong style={{ fontSize: 16 }}>{module.name}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 13 }}>{module.description}</Text>
                        </div>
                        <Space size={8}>
                          <Tag>{module.type === 'builtin' ? '内置模块' : '独立项目'}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>v{module.version}</Text>
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                );
              })}
          </Row>
        )}
      </div>
    </Space>
  );
};

export default Dashboard;
