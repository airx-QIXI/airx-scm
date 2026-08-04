import { useEffect, useMemo, useState, Fragment } from 'react';
import {
  Button,
  Card,
  Col,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import request from '@/api/request';

const { Text, Title } = Typography;

// ========== 类型定义 ==========
interface FactoryProductionData {
  meta: {
    source: string;
    sheet_name: string;
    fetched_at: string;
    total_rows: number;
    total_cols: number;
  };
  summary: {
    total_products: number;
    total_categories: number;
    products_with_plan: number;
    products_with_actual: number;
    total_planned: number;
    total_actual: number;
    date_range: { start: string; end: string };
  };
  category_summary: Array<{
    category: string;
    product_count: number;
    total_planned: number;
    total_actual: number;
    completion_rate: number;
    total_capacity: number;
  }>;
  daily_summary: Array<{
    date: string;
    month: string;
    week: string;
    planned: number;
    actual: number;
    completion_rate: number;
  }>;
  daily_actual: Array<{
    date: string;
    weekday: string;
    month: string;
    week: string;
    is_sunday: boolean;
    models: Array<{
      model: string;
      category: string;
      quantity: number;
      capacity: number;
      rate: number;
    }>;
    total_quantity: number;
    full_rate: number;
    status: string;
  }>;
  products: Array<{
    category: string;
    model: string;
    code: string;
    sku: string;
    capacity: number;
    planned_daily: Record<string, number>;
    actual_daily: Record<string, number>;
    planned_total: number;
    actual_total: number;
    completion_rate: number;
    has_plan: boolean;
    has_actual: boolean;
  }>;
  date_columns: Array<{
    date: string;
    month: string;
    week: string;
  }>;
}

interface ApiResponse {
  source: string;
  syncedAt: string;
  fetchedAt: string;
  hasData: boolean;
  data: FactoryProductionData | null;
}

// ========== 工具函数 ==========
function sortByDate(a: string, b: string): number {
  const [am, ad] = a.split('.').map(Number);
  const [bm, bd] = b.split('.').map(Number);
  if (am !== bm) return am - bm;
  return ad - bd;
}

function formatNum(n: number | undefined | null): string {
  return (n || 0).toLocaleString('zh-CN');
}

function formatRate(rate: number | undefined | null): string {
  const r = Number(rate) || 0;
  return r % 1 === 0 ? `${r}%` : `${r.toFixed(1)}%`;
}

function rateColor(rate: number): string {
  if (rate <= 0) return '#d9d9d9';
  if (rate < 50) return '#ff4d4f';
  if (rate < 80) return '#faad14';
  return '#52c41a';
}

// ========== 主组件 ==========
const FactoryProduction = () => {
  const [payload, setPayload] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('全部');
  const [showIdle, setShowIdle] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await request.get<ApiResponse>('/integrations/factory-production/dashboard');
      setPayload(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const data = payload?.data;

  // 月份列表
  const months = useMemo(() => {
    if (!data?.date_columns) return [];
    const set = new Set<string>();
    data.date_columns.forEach((d) => set.add(d.month));
    return Array.from(set);
  }, [data]);

  // 日期信息映射
  const dateInfoMap = useMemo(() => {
    const map: Record<string, { month: string; week: string }> = {};
    data?.date_columns?.forEach((d) => {
      map[d.date] = { month: d.month, week: d.week };
    });
    return map;
  }, [data]);

  // 周日期范围映射
  const weekDateRangeMap = useMemo(() => {
    const map: Record<string, { start: string; end: string }> = {};
    const tempMap: Record<string, string[]> = {};
    data?.date_columns?.forEach((d) => {
      const key = `${d.month}-${d.week}`;
      if (!tempMap[key]) tempMap[key] = [];
      tempMap[key].push(d.date);
    });
    Object.keys(tempMap).forEach((key) => {
      const dates = tempMap[key].sort(sortByDate);
      map[key] = { start: dates[0], end: dates[dates.length - 1] };
    });
    return map;
  }, [data]);

  // 每周工作天数
  const weekWorkingDaysMap = useMemo(() => {
    const map: Record<string, { total: number; working: number }> = {};
    data?.daily_actual?.forEach((d) => {
      const key = `${d.month}-${d.week}`;
      if (!map[key]) map[key] = { total: 0, working: 0 };
      map[key].total++;
      if (!d.is_sunday) map[key].working++;
    });
    return map;
  }, [data]);

  // 按周聚合排产计划
  const weeklyPlan = useMemo(() => {
    if (!data?.products) return [];
    const weekMap: Record<string, any> = {};

    data.products.forEach((p) => {
      Object.entries(p.planned_daily || {}).forEach(([date, qty]) => {
        if (typeof qty !== 'number') return;
        const info = dateInfoMap[date];
        if (!info) return;
        if (selectedMonth !== '全部' && info.month !== selectedMonth) return;

        const key = `${info.month}-${info.week}`;
        if (!weekMap[key]) {
          const range = weekDateRangeMap[key] || { start: date, end: date };
          const wd = weekWorkingDaysMap[key] || { total: 7, working: 6 };
          weekMap[key] = {
            month: info.month,
            week: info.week,
            dateRange: `${range.start} ~ ${range.end}`,
            workingDays: wd.working,
            models: [] as any[],
          };
        }
        weekMap[key].models.push({
          model: p.model,
          category: p.category,
          quantity: qty,
          capacity: p.capacity,
        });
      });
    });

    // 计算每周满产率
    Object.values(weekMap).forEach((w: any) => {
      const fullDaysNeeded = w.models.reduce(
        (s: number, m: any) => s + (m.capacity > 0 ? m.quantity / m.capacity : 0),
        0,
      );
      w.fullRate =
        w.workingDays > 0 ? Math.round((fullDaysNeeded / w.workingDays) * 1000) / 10 : 0;
    });

    const weekOrder: Record<string, number> = {
      '第1周': 1,
      '第2周': 2,
      '第3周': 3,
      '第4周': 4,
      '第5周': 5,
    };
    const monthOrder: Record<string, number> = { '8月': 1, '9月': 2, '10月': 3 };
    return Object.values(weekMap).sort((a: any, b: any) => {
      const ma = monthOrder[a.month] || 99;
      const mb = monthOrder[b.month] || 99;
      if (ma !== mb) return ma - mb;
      return (weekOrder[a.week] || 99) - (weekOrder[b.week] || 99);
    });
  }, [data, dateInfoMap, selectedMonth, weekDateRangeMap, weekWorkingDaysMap]);

  // 按月过滤每日数据
  const filteredDaily = useMemo(() => {
    if (!data?.daily_actual) return [];
    let list = [...data.daily_actual].sort((a, b) => sortByDate(a.date, b.date));
    if (selectedMonth !== '全部') {
      list = list.filter((d) => d.month === selectedMonth);
    }
    if (!showIdle) {
      list = list.filter((d) => d.status !== 'idle');
    }
    return list;
  }, [data, selectedMonth, showIdle]);

  // 按周分组
  const weekGroups = useMemo(() => {
    const groups: Array<{ key: string; month: string; week: string; items: any[] }> = [];
    let currentKey: string | null = null;
    filteredDaily.forEach((d) => {
      const key = `${d.month}-${d.week}`;
      if (key !== currentKey) {
        currentKey = key;
        groups.push({ key, month: d.month, week: d.week, items: [d] });
      } else {
        groups[groups.length - 1].items.push(d);
      }
    });
    return groups;
  }, [filteredDaily]);

  // 统计
  const stats = useMemo(() => {
    const total = filteredDaily.length;
    const sundays = filteredDaily.filter((d) => d.is_sunday).length;
    const productionDays = filteredDaily.filter((d) => d.status === 'production').length;
    const totalQuantity = filteredDaily.reduce((sum, d) => sum + d.total_quantity, 0);
    const avgRate =
      productionDays > 0
        ? Math.round(
            (filteredDaily.filter((d) => d.status === 'production').reduce((sum, d) => sum + d.full_rate, 0) /
              productionDays) *
              10,
          ) / 10
        : 0;
    return { total, sundays, productionDays, totalQuantity, avgRate };
  }, [filteredDaily]);

  const overallRate =
    data && data.summary.total_planned > 0
      ? (data.summary.total_actual / data.summary.total_planned) * 100
      : 0;

  // ========== 表格列定义 ==========
  const weeklyColumns: TableColumnsType<any> = [
    {
      title: '周次',
      dataIndex: 'weekLabel',
      width: 120,
      render: (_, record) => (
        <Text strong>
          {record.month} {record.week}
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.dateRange} · 工作日 {record.workingDays} 天
          </Text>
        </Text>
      ),
    },
    { title: '型号', dataIndex: 'model', width: 100, render: (v) => <Text strong>{v}</Text> },
    { title: '品类', dataIndex: 'category', width: 140, render: (v) => <Text type="secondary">{v}</Text> },
    { title: '排产数量', dataIndex: 'quantity', width: 100, render: (v) => <Text strong style={{ color: '#4b3fe3' }}>{formatNum(v)} 件</Text> },
    { title: '日产能', dataIndex: 'capacity', width: 80, render: (v) => <Text type="secondary">{v}</Text> },
    { title: '需天数', dataIndex: 'daysNeeded', width: 80, render: (v) => <Text type="secondary">{v} 天</Text> },
    {
      title: '周满产率',
      dataIndex: 'fullRate',
      width: 160,
      render: (rate: number, record: any) => {
        if (record.isWeekRow) {
          return (
            <Space>
              <Progress
                percent={Math.min(rate, 100)}
                size="small"
                strokeColor={rateColor(rate)}
                style={{ width: 80 }}
                showInfo={false}
              />
              <Text strong>{rate}%</Text>
            </Space>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
  ];

  // 构建周计划表格数据（周汇总行 + 型号明细行）
  const weeklyTableData = useMemo(() => {
    const rows: any[] = [];
    weeklyPlan.forEach((w: any, idx: number) => {
      const total = w.models.reduce((s: number, m: any) => s + m.quantity, 0);
      rows.push({
        key: `week-${idx}`,
        weekLabel: `${w.month} ${w.week}`,
        month: w.month,
        week: w.week,
        dateRange: w.dateRange,
        workingDays: w.workingDays,
        model: '合计',
        quantity: total,
        fullRate: w.fullRate,
        isWeekRow: true,
      });
      w.models.forEach((m: any, i: number) => {
        rows.push({
          key: `week-${idx}-model-${i}`,
          weekLabel: '',
          model: m.model,
          category: m.category,
          quantity: m.quantity,
          capacity: m.capacity,
          daysNeeded: m.capacity > 0 ? (m.quantity / m.capacity).toFixed(1) : '0',
          fullRate: 0,
          isWeekRow: false,
        });
      });
    });
    return rows;
  }, [weeklyPlan]);

  const dailyColumns: TableColumnsType<any> = [
    { title: '日期', dataIndex: 'date', width: 70, render: (v) => <Text strong>{v}</Text> },
    {
      title: '星期',
      dataIndex: 'weekday',
      width: 70,
      render: (v, record) => <Text type={record.is_sunday ? 'danger' : undefined}>{v}</Text>,
    },
    { title: '周次', dataIndex: 'week', width: 80, render: (v) => <Text type="secondary">{v}</Text> },
    {
      title: '生产型号及数量',
      dataIndex: 'models',
      render: (models: any[], record: any) => {
        if (record.status === 'production' && models.length > 0) {
          return (
            <Space direction="vertical" size={4}>
              {models.map((m, i) => (
                <Text key={i}>
                  <Text strong>{m.model}</Text>{' '}
                  <Text style={{ color: '#52c41a', fontWeight: 600 }}>{m.quantity}件</Text>{' '}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    （日产能{m.capacity}，占比{m.rate}%）
                  </Text>
                </Text>
              ))}
            </Space>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: '当日满产率',
      dataIndex: 'full_rate',
      width: 160,
      render: (rate: number, record: any) => {
        if (record.status === 'production') {
          return (
            <Space>
              <Progress
                percent={Math.min(rate, 100)}
                size="small"
                strokeColor={rateColor(rate)}
                style={{ width: 80 }}
                showInfo={false}
              />
              <Text strong>{rate}%</Text>
            </Space>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: string) => {
        if (status === 'rest') return <Tag color="orange">休息日</Tag>;
        if (status === 'production') return <Tag color="green">已生产</Tag>;
        return <Tag>无生产</Tag>;
      },
    },
  ];

  // 构建每日表格数据
  const dailyTableData = useMemo(() => {
    const rows: any[] = [];
    weekGroups.forEach((group) => {
      const prodDays = group.items.filter((d) => d.status === 'production').length;
      rows.push({
        key: `group-${group.key}`,
        isGroupHeader: true,
        date: `${group.month} · ${group.week}（${group.items.length}天，生产${prodDays}天）`,
      });
      group.items.forEach((d) => {
        rows.push({
          key: d.date,
          date: d.date,
          weekday: d.weekday,
          week: d.week,
          models: d.models,
          full_rate: d.full_rate,
          status: d.status,
          is_sunday: d.is_sunday,
        });
      });
    });
    return rows;
  }, [weekGroups]);

  // 品类汇总表列
  const categoryColumns: TableColumnsType<any> = [
    { title: '品类', dataIndex: 'category', width: 180 },
    { title: '产品数', dataIndex: 'product_count', width: 80 },
    { title: '排产计划', dataIndex: 'total_planned', width: 100, render: (v) => formatNum(v) },
    { title: '实际生产', dataIndex: 'total_actual', width: 100, render: (v) => formatNum(v) },
    {
      title: '完成率',
      dataIndex: 'completion_rate',
      width: 120,
      render: (v) => (
        <Space>
          <Progress percent={Math.min(v, 100)} size="small" strokeColor={rateColor(v)} style={{ width: 60 }} showInfo={false} />
          <Text>{formatRate(v)}</Text>
        </Space>
      ),
    },
    { title: '日产能', dataIndex: 'total_capacity', width: 80, render: (v) => formatNum(v) },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* 页面标题 */}
      <Card>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              工厂排产跟进
            </Title>
            <Text type="secondary">
              数据来源：{payload?.source || '-'} · 更新时间：{payload?.fetchedAt || '-'} · 日期范围：
              {data?.summary?.date_range ? `${data.summary.date_range.start} ~ ${data.summary.date_range.end}` : '-'}
            </Text>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {!payload?.hasData || !data ? (
        <Card>
          <Text type="secondary">暂无排产数据，请先同步数据。</Text>
        </Card>
      ) : (
        <>
          {/* 汇总卡片 */}
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6} lg={3}>
              <Card>
                <Statistic title="产品总数" value={data.summary.total_products} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  覆盖 {data.summary.total_categories} 个品类
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Card>
                <Statistic title="总排产计划" value={data.summary.total_planned} suffix="件" />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  有排产计划 {data.summary.products_with_plan} 个产品
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Card>
                <Statistic
                  title="总实际生产"
                  value={data.summary.total_actual}
                  suffix="件"
                  valueStyle={{ color: '#52c41a' }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  完成率 {formatRate(overallRate)}
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Card>
                <Statistic title="休息日" value={stats.sundays} suffix="天" />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  周日不生产
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Card>
                <Statistic title="生产天数" value={stats.productionDays} suffix="天" valueStyle={{ color: '#52c41a' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  有实际生产记录
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Card>
                <Statistic title="实际总产量" value={stats.totalQuantity} suffix="件" />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  实际生产总件数
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Card>
                <Statistic title="平均满产率" value={stats.avgRate} suffix="%" />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  生产日平均产能利用率
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Card>
                <Statistic title="完成率" value={Number(overallRate.toFixed(1))} suffix="%" valueStyle={{ color: '#4b3fe3' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  实际/计划
                </Text>
              </Card>
            </Col>
          </Row>

          {/* 品类汇总表 */}
          <Card title="品类排产汇总">
            <Table
              rowKey="category"
              columns={categoryColumns}
              dataSource={data.category_summary}
              loading={loading}
              pagination={false}
              size="middle"
              scroll={{ x: 660 }}
            />
          </Card>

          {/* 筛选区 */}
          <Card>
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Text type="secondary">月份：</Text>
                  <Button
                    size="small"
                    type={selectedMonth === '全部' ? 'primary' : 'default'}
                    onClick={() => setSelectedMonth('全部')}
                  >
                    全部
                  </Button>
                  {months.map((m) => (
                    <Button
                      key={m}
                      size="small"
                      type={selectedMonth === m ? 'primary' : 'default'}
                      onClick={() => setSelectedMonth(m)}
                    >
                      {m}
                    </Button>
                  ))}
                </Space>
              </Col>
              <Col>
                <Space>
                  <Text type="secondary">显示无生产日：</Text>
                  <Button
                    size="small"
                    type={showIdle ? 'primary' : 'default'}
                    onClick={() => setShowIdle(!showIdle)}
                  >
                    {showIdle ? '是' : '否'}
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* 排产计划与实际生产表 */}
          <Card
            title="排产计划与实际生产"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                按周查看排产计划与满产率，共 {weeklyPlan.length} 周
              </Text>
            }
          >
            <Table
              rowKey="key"
              columns={weeklyColumns}
              dataSource={weeklyTableData}
              loading={loading}
              pagination={false}
              size="middle"
              scroll={{ x: 800 }}
              rowClassName={(record) => (record.isWeekRow ? 'week-row' : '')}
            />
            <div style={{ padding: '8px 16px', fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
              说明：周满产率 = &sum;(各型号排产数量 &divide; 该型号日产能) &divide; 当周工作天数 &times; 100%，反映该周排产计划对工作日产能的占用比例。
            </div>
          </Card>

          {/* 每日实际生产明细表 */}
          <Card
            title="每日实际生产明细"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                满产率 = &sum;(各型号实际产量 &divide; 该型号日产能) &times; 100%
              </Text>
            }
          >
            <Table
              rowKey="key"
              columns={dailyColumns}
              dataSource={dailyTableData}
              loading={loading}
              pagination={false}
              size="middle"
              scroll={{ x: 700, y: 600 }}
              rowClassName={(record) => {
                if (record.isGroupHeader) return 'group-header-row';
                if (record.is_sunday) return 'rest-day-row';
                if (record.status === 'production') return 'production-day-row';
                return '';
              }}
            />
          </Card>
        </>
      )}
    </Space>
  );
};

export default FactoryProduction;
