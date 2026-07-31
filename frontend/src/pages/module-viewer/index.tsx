import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Spin, Result, Button, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import useModulesStore from '@/stores/modules';
import type { ModuleConfig } from '@/api/modules';

const { Title, Text, Paragraph } = Typography;

/**
 * 图标名称到组件的映射
 * 从 modules.json 中的 icon 字段映射到实际的 Ant Design 图标
 */
const iconMap: Record<string, React.ReactNode> = {
  DashboardOutlined: <span style={{ fontSize: 48, color: '#4B3FE3' }}>📊</span>,
  InboxOutlined: <span style={{ fontSize: 48, color: '#4B3FE3' }}>📦</span>,
  ShoppingCartOutlined: <span style={{ fontSize: 48, color: '#4B3FE3' }}>🛒</span>,
  TeamOutlined: <span style={{ fontSize: 48, color: '#4B3FE3' }}>👥</span>,
  BarChartOutlined: <span style={{ fontSize: 48, color: '#4B3FE3' }}>📈</span>,
  LineChartOutlined: <span style={{ fontSize: 48, color: '#4B3FE3' }}>📉</span>,
};

/**
 * 模块查看器
 * - builtin 模块：重定向到内部路由（由路由层处理，不会走到这里）
 * - external 模块有 entryUrl：通过 iframe 嵌入展示
 * - external 模块无 entryUrl（pending）：显示待开发占位页
 */
const ModuleViewer = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { modules, loaded, fetchModules } = useModulesStore();
  const [iframeLoading, setIframeLoading] = useState(true);

  useEffect(() => {
    if (!loaded) {
      fetchModules();
    }
  }, [loaded, fetchModules]);

  // 模块未加载时显示加载中
  if (!loaded) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="正在加载模块信息..." />
      </div>
    );
  }

  const module = modules.find((m) => m.id === moduleId);

  // 模块不存在
  if (!module) {
    return (
      <Result
        status="404"
        title="模块不存在"
        subTitle={`未找到 ID 为 "${moduleId}" 的模块`}
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回仪表盘
          </Button>
        }
      />
    );
  }

  // builtin 模块不应该走到这里，但作为防御性处理
  if (module.type === 'builtin' && module.path) {
    return <NavigateReplacement path={module.path} />;
  }

  // external 模块有 entryUrl → iframe 嵌入
  if (module.entryUrl) {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card size="small">
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
                返回
              </Button>
              <Text strong>{module.name}</Text>
              <Tag color="blue">v{module.version}</Tag>
              <Tag color="green">已集成</Tag>
            </Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setIframeLoading(true);
                // 通过 key 变化强制 iframe 重新加载
                const iframe = document.getElementById('module-iframe') as HTMLIFrameElement;
                if (iframe) {
                  iframe.src = module.entryUrl!;
                }
              }}
            >
              刷新
            </Button>
          </Space>
        </Card>

        <Card bodyStyle={{ padding: 0, overflow: 'hidden' }}>
          {iframeLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 600 }}>
              <Spin size="large" tip="正在加载模块页面..." />
            </div>
          )}
          <iframe
            id="module-iframe"
            src={module.entryUrl}
            title={module.name}
            onLoad={() => setIframeLoading(false)}
            style={{
              width: '100%',
              height: 'calc(100vh - 220px)',
              minHeight: 600,
              border: 'none',
              display: iframeLoading ? 'none' : 'block',
            }}
            allow="fullscreen"
          />
        </Card>
      </Space>
    );
  }

  // external 模块无 entryUrl → 待开发占位页
  return <PendingModule module={module} />;
};

/**
 * 待开发模块占位页
 */
const PendingModule = ({ module }: { module: ModuleConfig }) => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 500 }}>
      <Card style={{ maxWidth: 560, textAlign: 'center', padding: '40px 24px' }}>
        {iconMap[module.icon] || <ExclamationCircleOutlined style={{ fontSize: 48, color: '#4B3FE3' }} />}

        <Title level={3} style={{ marginTop: 24, marginBottom: 8 }}>
          {module.name}
        </Title>

        <Paragraph type="secondary" style={{ marginBottom: 24 }}>
          {module.description}
        </Paragraph>

        <Space direction="vertical" size={8} style={{ marginBottom: 32 }}>
          <Space>
            <Text type="secondary">模块类型：</Text>
            <Tag>{module.type === 'builtin' ? '内置模块' : '独立项目'}</Tag>
          </Space>
          <Space>
            <Text type="secondary">当前状态：</Text>
            <Tag color="orange">待开发</Tag>
          </Space>
          <Space>
            <Text type="secondary">版本号：</Text>
            <Text code>v{module.version}</Text>
          </Space>
        </Space>

        <Result
          icon={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
          title="该模块正在规划开发中"
          subTitle="模块开发完成后，将在模块注册表中注册入口地址，届时可在此页面直接访问。"
          extra={
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              返回仪表盘
            </Button>
          }
        />
      </Card>
    </div>
  );
};

/**
 * 导航重定向组件（用于 builtin 模块的防御性处理）
 */
const NavigateReplacement = ({ path }: { path: string }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(path, { replace: true });
  }, [path, navigate]);
  return null;
};

export default ModuleViewer;
