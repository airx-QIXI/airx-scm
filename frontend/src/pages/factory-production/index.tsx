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

  const summary = data?.summary || {};
  const dailyActual = data?.daily_actual || [];
  const products = data?.products || [];
  const dateColumns = data?.date_columns || [];

  // 月份列表
  const months = useMemo(() => {
    const set = new Set<string>();
    dateColumns.forEach((d) => set.add(d.month));
    return Array.from(set);
  }, [dateColumns]);

  // 整体完成率
  const overallRate =
    summary.total_planned > 0
      ? (summary.total_actual / summary.total_planned) * 100
      : 0;

  // 日期 -> { month, week } 映射
  const dateInfoMap = useMemo(() => {
    const map: Record<string, { month: string; week: string }> = {};
    dateColumns.forEach((d) => {
      map[d.date] = { month: d.month, week: d.week };
    });
    return map;
  }, [dateColumns]);

  // 周次 -> 日期范围映射
  const weekDateRangeMap = useMemo(() => {
    const map: Record<string, { start: string; end: string }> = {};
    const tempMap: Record<string, string[]> = {};
    dateColumns.forEach((d) => {
      const key = `${d.month}-${d.week}`;
      if (!tempMap[key]) tempMap[key] = [];
      tempMap[key].push(d.date);
    });
    Object.keys(tempMap).forEach((key) => {
      const dates = tempMap[key].sort(sortByDate);
      map[key] = { start: dates[0], end: dates[dates.length - 1] };
    });
    return map;
  }, [dateColumns]);

  // 每周工作天数映射
  const weekWorkingDaysMap = useMemo(() => {
    const map: Record<string, { total: number; working: number }> = {};
    dailyActual.forEach((d) => {
      const key = `${d.month}-${d.week}`;
      if (!map[key]) map[key] = { total: 0, working: 0 };
      map[key].total++;
      if (!d.is_sunday) map[key].working++;
    });
    return map;
  }, [dailyActual]);

  // 每周排产计划：把产品的 planned_daily 按周聚合
  const weeklyPlan = useMemo(() => {
    const weekMap: Record<string, any> = {};

    products.forEach((p) => {
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
  }, [products, dateInfoMap, selectedMonth, weekDateRangeMap, weekWorkingDaysMap]);

  // 按月过滤每日数据
  const filteredDaily = useMemo(() => {
    let list = [...dailyActual].sort((a, b) => sortByDate(a.date, b.date));
    if (selectedMonth !== '全部') {
      list = list.filter((d) => d.month === selectedMonth);
    }
    if (!showIdle) {
      list = list.filter((d) => d.status !== 'idle');
    }
    return list;
  }, [dailyActual, selectedMonth, showIdle]);

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

  // 参与生产的型号
  const producedModels = useMemo(() => {
    const set = new Set<string>();
    dailyActual.forEach((d) => d.models.forEach((m) => set.add(m.model)));
    return Array.from(set);
  }, [dailyActual]);

  // ========== 排产计划表列定义（9列，与原项目完全一致） ==========
  const weeklyColumns: TableColumnsType<any> = [
    {
      title: '周次',
      dataIndex: 'weekLabel',
      width: 120,
      render: (_, record) => {
        if (record.isWeekRow) {
          return (
            <Text strong style={{ fontSize: 13 }}>
              {record.month} {record.week}
              <br />
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                {record.dateRange} · 工作日 {record.workingDays} 天
              </Text>
            </Text>
          );
        }
        return <Text type="secondary" style={{ fontSize: 12 }}>{record.weekLabel || ''}</Text>;
      },
    },
    {
      title: '型号',
      dataIndex: 'model',
      width: 100,
      render: (v, record) => {
        if (record.isWeekRow) return <Text strong>合计</Text>;
        return <Text strong>{v}</Text>;
      },
    },
    {
      title: '品类',
      dataIndex: 'category',
      width: 120,
      render: (v, record) => {
        if (record.isWeekRow) return null;
        return <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>;
      },
    },
    {
      title: '排产数量',
      dataIndex: 'quantity',
      width: 90,
      render: (v) => <Text strong style={{ color: '#4b3fe3', fontSize: 14 }}>{formatNum(v)} 件</Text>,
    },
    {
      title: '日产能',
      dataIndex: 'capacity',
      width: 80,
      render: (v, record) => {
        if (record.isWeekRow) return <Text type="secondary">-</Text>;
        return <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>;
      },
    },
    {
      title: '需天数',
      dataIndex: 'daysNeeded',
      width: 70,
      render: (v, record) => {
        if (record.isWeekRow) return <Text type="secondary">-</Text>;
        return <Text type="secondary" style={{ fontSize: 12 }}>{v} 天</Text>;
      },
    },
    {
      title: '生产满足率',
      dataIndex: 'fullRate',
      width: 120,
      render: (rate: number, record: any) => {
        if (record.isWeekRow) {
          return (
            <Space>
              <Progress
                percent={Math.min(rate, 100)}
                size="small"
                strokeColor={rateColor(rate)}
                style={{ width: 60 }}
                showInfo={false}
              />
              <Text strong style={{ fontSize: 13 }}>{rate}%</Text>
            </Space>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: '实际生产数量',
      dataIndex: 'actualQty',
      width: 100,
      render: (_, record) => <Text type="secondary">-</Text>,
    },
    {
      title: '排产满足率',
      dataIndex: 'fulfillRate',
      width: 100,
      render: (_, record) => <Text type="secondary">-</Text>,
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
        model: '',
        quantity: total,
        fullRate: w.fullRate,
        isWeekRow: true,
      });
      w.models.forEach((m: any, i: number) => {
        rows.push({
          key: `week-${idx}-model-${i}`,
          weekLabel: i === 0 ? `${w.month} ${w.week}` : '',
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

  // ========== 每日明细表列定义（6列，与原项目一致） ==========
  const dailyColumns: TableColumnsType<any> = [
    { title: '日期', dataIndex: 'date', width: 70, render: (v) => <Text strong>{v}</Text> },
    {
      title: '星期',
      dataIndex: 'weekday',
      width: 70,
      render: (v, record) => <Text type={record.is_sunday ? 'danger' : undefined}>{v}</Text>,
    },
    { title: '周次', dataIndex: 'week', width: 80, render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
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
                style={{ width: 100 }}
                showInfo={false}
              />
              <Text strong style={{ fontSize: 13 }}>{rate}%</Text>
            </Space>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
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
          {/* 汇总卡片（7个，与原项目一致） */}
          <Row gutter={[16, 16]}>
            <Col xs={12} md={8} lg={4}>
              <Card>
                <Statistic title="产品总数" value={summary.total_products} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  覆盖 {formatNum(summary.total_categories)} 个品类
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card>
                <Statistic title="总排产计划" value={summary.total_planned} suffix="件" />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  有排产计划 {summary.products_with_plan} 个产品
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card>
                <Statistic
                  title="总实际生产"
                  value={summary.total_actual}
                  suffix="件"
                  valueStyle={{ color: '#52c41a' }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  完成率 {formatRate(overallRate)}
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card>
                <Statistic title="休息日（周日）" value={stats.sundays} suffix="天" />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  周日不生产
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card>
                <Statistic title="生产天数" value={stats.productionDays} suffix="天" valueStyle={{ color: '#52c41a' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  有实际生产记录
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card>
                <Statistic title="实际总产量" value={stats.totalQuantity} suffix="件" />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  实际生产总件数
                </Text>
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card>
                <Statistic title="平均满产率" value={stats.avgRate} suffix="%" />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  生产日平均产能利用率
                </Text>
              </Card>
            </Col>
          </Row>

          {/* 筛选区 */}
          <Card>
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Text type="secondary" style={{ fontSize: 13 }}>月份：</Text>
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
                  <Text type="secondary" style={{ fontSize: 13 }}>显示无生产日：</Text>
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

          {/* 排产计划与实际生产表（9列，与原项目完全一致） */}
          <Card
            title="排产计划与实际生产"
            extra={
              <Text type="secondary" style={{ fontSize: 13 }}>
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
              scroll={{ x: 900 }}
              rowClassName={(record) => (record.isWeekRow ? 'week-row' : '')}
            />
            <div style={{ padding: '8px 16px', fontSize: 12, color: '#9ca3af', marginTop: 8, background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
              说明：生产满足率 = &sum;(各型号排产数量 &divide; 该型号日产能) &divide; 当周工作天数 &times; 100%，反映该周排产计划对工作日产能的占用比例；排产满足率 = 实际生产数量 &divide; 排产数量 &times; 100%。实际生产数据待接入。
            </div>
          </Card>

          {/* 图例 */}
          <Card size="small">
            <Space size={24} wrap>
              <Space size={6}>
                <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: '#fffbeb', border: '1px solid #e8e8e8' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>休息日（周日）</Text>
              </Space>
              <Space size={6}>
                <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: '#f0fdf4', border: '1px solid #e8e8e8' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>有生产</Text>
              </Space>
              <Space size={6}>
                <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: '#f9fafb', border: '1px solid #e8e8e8' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>无生产</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                参与生产型号：{producedModels.length > 0 ? producedModels.join('、') : '暂无'}
              </Text>
            </Space>
          </Card>

          {/* 每日实际生产明细表 */}
          <Card
            title="每日实际生产明细"
            extra={
              <Text type="secondary" style={{ fontSize: 13 }}>
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
              scroll={{ x: 700, y: 700 }}
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
