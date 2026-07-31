import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Progress, Row, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd';
import type { TableColumnsType, TabsProps } from 'antd';
import { ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import {
  getProductionPlanningDashboards,
  syncProductionPlanningDashboards,
  type ProductionPlanningDashboardsResult,
} from '@/api/integrations';

const { Text, Title } = Typography;

const riskColorMap: Record<string, string> = {
  已缺货: 'red',
  高缺货风险: 'volcano',
  中缺货风险: 'gold',
  正常: 'green',
  高库存: 'blue',
  无动销: 'default',
  数据缺失: 'default',
};

const priorityColorMap: Record<string, string> = {
  紧急: 'red',
  优先: 'orange',
  正常: 'green',
  暂缓: 'default',
};

const formatNumber = (value?: number | null, digits = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatPercent = (value?: number | null, digits = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '待采集';
  return `${formatNumber(Number(value) * 100, digits)}%`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
};

const BarList = ({ data, valueLabel = 'value' }: { data: any[]; valueLabel?: string }) => {
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {data.map((item) => {
        const percent = Math.round((Number(item.value || 0) / max) * 100);
        return (
          <div key={item.name || item.model}>
            <Row justify="space-between" style={{ marginBottom: 4 }}>
              <Text>{item.name || item.model}</Text>
              <Text strong>{formatNumber(item.value)}{valueLabel === 'count' ? ' 个' : ''}</Text>
            </Row>
            <Progress percent={percent} showInfo={false} strokeColor="#4b3fe3" />
          </div>
        );
      })}
    </Space>
  );
};

const ProductionRestock = () => {
  const [payload, setPayload] = useState<ProductionPlanningDashboardsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getProductionPlanningDashboards();
      setPayload(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncProductionPlanningDashboards();
      message.success(`同步完成：生产需求 ${result.demandModels} 个型号，工厂排产 ${result.factoryModels} 个型号`);
      await loadData();
    } finally {
      setSyncing(false);
    }
  };

  const demand = payload?.dashboards.demand;
  const factory = payload?.dashboards.factorySchedule;
  const fulfillment = payload?.dashboards.forecastFulfillment;

  const demandItems = demand?.items || [];
  const demandTableData = useMemo(
    () =>
      [...demandItems].sort((a, b) => {
        const order: Record<string, number> = { 已缺货: 0, 高缺货风险: 1, 中缺货风险: 2, 正常: 3, 高库存: 4, 无动销: 5 };
        return (order[a.risk_level] ?? 99) - (order[b.risk_level] ?? 99) || Number(b.suggested_production_qty || 0) - Number(a.suggested_production_qty || 0);
      }),
    [demandItems],
  );

  const demandColumns: TableColumnsType<any> = [
    { title: '型号', dataIndex: 'model', fixed: 'left', width: 120 },
    { title: '风险等级', dataIndex: 'risk_level', width: 130, render: (value) => <Tag color={riskColorMap[value] || 'default'}>{value}</Tag> },
    { title: '库存', dataIndex: 'stock', width: 90, render: (value) => formatNumber(value) },
    { title: '7日销售', dataIndex: 'sales_7d', width: 100, render: (value) => formatNumber(value) },
    { title: '30日销售', dataIndex: 'sales_30d', width: 110, render: (value) => formatNumber(value) },
    { title: '周转天数', dataIndex: 'turnover_days', width: 110, render: (value) => `${formatNumber(value, 1)} 天` },
    { title: '7日排产', dataIndex: 'production_7d_qty', width: 100, render: (value) => formatNumber(value) },
    { title: '30日排产', dataIndex: 'production_30d_qty', width: 110, render: (value) => formatNumber(value) },
    { title: '61-90天排产', dataIndex: 'production_61_90d_qty', width: 130, render: (value) => formatNumber(value) },
  ];

  const weekColumns: TableColumnsType<any> = [
    { title: '周次', dataIndex: 'week', width: 90 },
    { title: '计划数量', dataIndex: 'planned_qty', width: 110, render: (value) => formatNumber(value) },
    { title: '已用天数', dataIndex: 'used_days', width: 100 },
    { title: '剩余天数', dataIndex: 'remaining_days', width: 100 },
    {
      title: '排产安排',
      render: (_, record) => (
        <Space wrap>
          {(record.blocks || []).map((block: any) => (
            <Tag key={block.id} color={priorityColorMap[block.priority] || 'default'}>
              {block.day_range} {block.model} {formatNumber(block.planned_qty)}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  const fulfillmentColumns: TableColumnsType<any> = [
    { title: '型号', dataIndex: 'model', width: 120 },
    { title: 'SKU', dataIndex: 'sku', width: 150 },
    { title: '预测日销', dataIndex: 'forecast_daily_sales', width: 110, render: (value) => formatNumber(value, 2) },
    { title: '周期预测销量', dataIndex: 'forecast_period_qty', width: 130, render: (value) => formatNumber(value) },
    { title: '实际出库', dataIndex: 'actual_ship_qty', width: 110, render: (value) => value ?? '待采集' },
    { title: '准确率', dataIndex: 'accuracy_rate', width: 100, render: (value) => formatPercent(value, 1) },
    { title: '状态', dataIndex: 'status', width: 110, render: (value) => <Tag>{value}</Tag> },
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: 'demand',
      label: '生产需求看板',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}><Card><Statistic title="型号总数" value={demand?.summary?.total_models || 0} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="高风险型号" value={demand?.summary?.high_risk_count || 0} valueStyle={{ color: '#fa541c' }} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="建议生产型号" value={demand?.summary?.suggested_production_models || 0} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="建议生产总量" value={demand?.summary?.suggested_total_qty || 0} suffix="件" /></Card></Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}><Card title="风险等级分布"><BarList data={demand?.riskCounts || []} valueLabel="count" /></Card></Col>
            <Col xs={24} lg={12}><Card title="7日排产 Top 10"><BarList data={(demand?.topProduction7d || []).map((i: any) => ({ name: i.model, value: i.value }))} /></Card></Col>
            <Col xs={24} lg={12}><Card title="30日排产 Top 10"><BarList data={(demand?.topProduction30d || []).map((i: any) => ({ name: i.model, value: i.value }))} /></Card></Col>
            <Col xs={24} lg={12}><Card title="61-90天排产 Top 10"><BarList data={(demand?.topProduction61To90d || []).map((i: any) => ({ name: i.model, value: i.value }))} /></Card></Col>
          </Row>
          <Card title="生产需求明细">
            <Table rowKey="id" columns={demandColumns} dataSource={demandTableData} loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 1000 }} />
          </Card>
        </Space>
      ),
    },
    {
      key: 'factory',
      label: '工厂排产看板',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}><Card><Statistic title="排产型号" value={factory?.summary?.total_models || 0} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="总需求" value={factory?.summary?.total_demand || 0} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="已排数量" value={factory?.summary?.total_suggested_qty || 0} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="完成率" value={(factory?.summary?.completion_rate || 0) * 100} suffix="%" precision={0} /></Card></Col>
          </Row>
          <Card title="8周工厂排产安排">
            <Table rowKey="week" columns={weekColumns} dataSource={factory?.weeks || []} loading={loading} pagination={false} />
          </Card>
        </Space>
      ),
    },
    {
      key: 'fulfillment',
      label: '需求与实际出货达成',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}><Card><Statistic title="记录数" value={fulfillment?.summary?.recordCount || 0} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="周期预测销量" value={fulfillment?.summary?.forecastTotal || 0} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="实际出库" value={fulfillment?.summary?.actualTotal ?? 0} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="待采集型号" value={fulfillment?.summary?.pendingItems || 0} /></Card></Col>
          </Row>
          <Card title={fulfillment?.summary?.latestStatus || '最新预测记录'}>
            <Table rowKey="id" columns={fulfillmentColumns} dataSource={fulfillment?.items || []} loading={loading} pagination={{ pageSize: 10 }} />
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>排产补货预测</Title>
            <Text type="secondary">
              已切换到截图对应的 inventory-dashboard 项目，数据来自生产需求、工厂排产、需求与实际出货达成三张看板。
            </Text>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
              <Button type="primary" icon={<SyncOutlined />} onClick={handleSync} loading={syncing}>同步看板数据</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title="看板来源" extra={<Text type="secondary">生成时间：{formatDateTime(payload?.generatedAt)}</Text>}>
        <Text>数据目录：{payload?.source || '-'}</Text>
      </Card>

      <Card title="排产补货预测看板">
        <Tabs items={tabItems} />
      </Card>
    </Space>
  );
};

export default ProductionRestock;
