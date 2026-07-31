import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_PRODUCTS_CACHE_PATH =
  'F:\\TRAE SOLO CN\\6a6971d3ef7f9cdce71976a8\\京东自营补货提醒\\data\\products_cache.json';

const PRODUCTION_DASHBOARD_DIR =
  'C:\\Users\\Administrator\\AppData\\Roaming\\TRAE SOLO CN\\ModularData\\ai-agent\\work-mode-projects\\6a68669e37ffcefc70fab61d\\inventory-dashboard\\public';

type LegacyProduct = {
  编码?: string;
  商品名称?: string;
  SKU?: string;
  全国数据?: Record<string, unknown>;
  仓库数据?: Record<string, Record<string, unknown>>;
  row_num?: number;
};

type LegacyCache = {
  cache_time?: string;
  products?: LegacyProduct[];
};

type ProjectMetrics = {
  availableStock: number;
  factoryStock: number;
  inTransitStock: number;
  sales7Days: number;
  sales30Days: number;
  avgDailySales: number;
  turnoverDays: number | null;
  turnoverRate30Days: number;
  recommendedRestock: number;
  riskLevel: string;
  riskText: string;
};

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取已识别项目列表。
   */
  async getProjects() {
    const projects = await this.prisma.integrationProject.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      include: {
        snapshots: {
          orderBy: { syncedAt: 'desc' },
          take: 1,
        },
      },
    });

    return {
      total: projects.length,
      projects: projects.map((project) => ({
        id: project.id,
        externalId: project.externalId,
        code: project.code,
        sku: project.sku,
        name: project.name,
        brand: project.brand,
        category: project.category,
        modelName: project.modelName,
        source: project.source,
        updatedAt: project.updatedAt,
        latestSnapshot: project.snapshots[0]
          ? this.toSnapshotSummary(project.snapshots[0])
          : null,
      })),
    };
  }

  /**
   * 从旧项目缓存同步项目与预测看板快照。
   */
  async syncProductionRestock(cachePath = DEFAULT_PRODUCTS_CACHE_PATH) {
    const cache = await this.readLegacyCache(cachePath);
    const products = Array.isArray(cache.products) ? cache.products : [];
    const sourceCacheTime = this.parseCacheTime(cache.cache_time);

    const syncedSnapshots = [];
    for (const product of products) {
      const identified = this.identifyProject(product);
      if (!identified.sku) {
        continue;
      }

      const metrics = this.calculateMetrics(product);
      const inventoryTurnover = this.buildInventoryTurnover(identified, metrics);
      const inventoryAnalysis = this.buildInventoryAnalysis(identified, product, metrics);
      const restockReminder = this.buildRestockReminder(identified, metrics);

      const project = await this.prisma.integrationProject.upsert({
        where: { externalId: identified.externalId },
        create: {
          externalId: identified.externalId,
          code: identified.code,
          sku: identified.sku,
          name: identified.name,
          brand: identified.brand,
          category: identified.category,
          modelName: identified.modelName,
          source: 'jd_self_operated',
          rawData: JSON.stringify(product),
        },
        update: {
          code: identified.code,
          sku: identified.sku,
          name: identified.name,
          brand: identified.brand,
          category: identified.category,
          modelName: identified.modelName,
          rawData: JSON.stringify(product),
        },
      });

      const snapshot = await this.prisma.productionRestockSnapshot.create({
        data: {
          projectId: project.id,
          sourceCacheTime,
          availableStock: metrics.availableStock,
          factoryStock: metrics.factoryStock,
          inTransitStock: metrics.inTransitStock,
          sales7Days: metrics.sales7Days,
          sales30Days: metrics.sales30Days,
          avgDailySales: metrics.avgDailySales,
          turnoverDays: metrics.turnoverDays,
          turnoverRate30Days: metrics.turnoverRate30Days,
          recommendedRestock: metrics.recommendedRestock,
          riskLevel: metrics.riskLevel,
          inventoryTurnover: JSON.stringify(inventoryTurnover),
          inventoryAnalysis: JSON.stringify(inventoryAnalysis),
          restockReminder: JSON.stringify(restockReminder),
          rawData: JSON.stringify(product),
        },
      });

      syncedSnapshots.push(this.toSnapshotSummary(snapshot));
    }

    return {
      source: cachePath,
      sourceCacheTime,
      projectCount: syncedSnapshots.length,
      syncedAt: new Date(),
      snapshots: syncedSnapshots,
    };
  }

  /**
   * 获取 3 个预测看板：库存周转、库存分析、补货提醒。
   */
  async getProductionRestockDashboards() {
    const projects = await this.prisma.integrationProject.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      include: {
        snapshots: {
          orderBy: { syncedAt: 'desc' },
          take: 1,
        },
      },
    });

    const latest = projects
      .filter((project) => project.snapshots[0])
      .map((project) => ({
        project,
        snapshot: project.snapshots[0],
        turnover: this.parseJson(project.snapshots[0].inventoryTurnover),
        analysis: this.parseJson(project.snapshots[0].inventoryAnalysis),
        reminder: this.parseJson(project.snapshots[0].restockReminder),
      }));

    return {
      generatedAt: new Date(),
      projectCount: latest.length,
      dashboards: {
        inventoryTurnover: this.aggregateInventoryTurnover(latest),
        inventoryAnalysis: this.aggregateInventoryAnalysis(latest),
        restockReminder: this.aggregateRestockReminder(latest),
      },
    };
  }

  /**
   * 读取正确的排产补货预测项目看板。
   * 这个项目对应用户截图中的 3 个看板：
   * 1. 生产需求看板
   * 2. 工厂排产看板
   * 3. 需求与实际出货达成
   */
  async getProductionPlanningDashboards() {
    const [demand, factorySchedule, forecastFulfillment] = await Promise.all([
      this.readJsonFile(`${PRODUCTION_DASHBOARD_DIR}\\dashboard-data.json`),
      this.readJsonFile(`${PRODUCTION_DASHBOARD_DIR}\\factory-schedule-data.json`),
      this.readJsonFile(`${PRODUCTION_DASHBOARD_DIR}\\forecast-fulfillment-data.json`),
    ]);

    return {
      source: PRODUCTION_DASHBOARD_DIR,
      generatedAt: new Date(),
      dashboards: {
        demand: this.buildDemandDashboard(demand),
        factorySchedule: this.buildFactoryScheduleDashboard(factorySchedule),
        forecastFulfillment: this.buildForecastFulfillmentDashboard(forecastFulfillment),
      },
      raw: {
        demand,
        factorySchedule,
        forecastFulfillment,
      },
    };
  }

  /**
   * 同步正确的排产补货预测项目。
   * 当前阶段先读取并返回 3 个 JSON 看板数据，后续可落库保存历史版本。
   */
  async syncProductionPlanningDashboards() {
    const dashboards = await this.getProductionPlanningDashboards();
    return {
      source: dashboards.source,
      syncedAt: new Date(),
      demandModels: dashboards.raw.demand?.summary?.total_models ?? dashboards.raw.demand?.items?.length ?? 0,
      factoryModels: dashboards.raw.factorySchedule?.summary?.total_models ?? 0,
      fulfillmentRecords: dashboards.raw.forecastFulfillment?.records?.length ?? 0,
      dashboards: dashboards.dashboards,
    };
  }

  private async readJsonFile(filePath: string) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      throw new BadRequestException(`读取排产补货预测看板文件失败：${filePath}`);
    }
  }

  private buildDemandDashboard(payload: any) {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const riskOrder = ['已缺货', '高缺货风险', '中缺货风险', '正常', '高库存', '无动销', '数据缺失'];
    const riskCounts = riskOrder
      .map((name) => ({
        name,
        value: items.filter((item) => item.risk_level === name).length,
      }))
      .filter((item) => item.value > 0);

    const topBy = (field: string) =>
      [...items]
        .filter((item) => this.num(item[field]) > 0)
        .sort((a, b) => this.num(b[field]) - this.num(a[field]))
        .slice(0, 10)
        .map((item) => ({
          model: item.model,
          sku: item.sku,
          category: item.category,
          value: this.num(item[field]),
          riskLevel: item.risk_level,
        }));

    return {
      title: '生产需求看板',
      updatedAt: payload?.updated_at,
      source: payload?.source,
      rules: payload?.rules,
      summary: payload?.summary || {},
      riskCounts,
      topProduction7d: topBy('production_7d_qty'),
      topProduction30d: topBy('production_30d_qty'),
      topProduction61To90d: topBy('production_61_90d_qty'),
      items,
    };
  }

  private buildFactoryScheduleDashboard(payload: any) {
    const weeks = Array.isArray(payload?.weeks) ? payload.weeks : [];
    const blocks = weeks.flatMap((week) => (Array.isArray(week.blocks) ? week.blocks : []));

    return {
      title: '工厂排产看板',
      updatedAt: payload?.updated_at,
      source: payload?.source,
      rules: payload?.rules,
      summary: payload?.summary || {},
      weeks,
      blocks,
    };
  }

  private buildForecastFulfillmentDashboard(payload: any) {
    const records = Array.isArray(payload?.records) ? payload.records : [];
    const latest = records[records.length - 1] || null;
    const items = latest?.items || [];

    return {
      title: '需求与实际出货达成',
      updatedAt: payload?.updated_at,
      source: payload?.source,
      rules: payload?.rules,
      summary: {
        recordCount: records.length,
        forecastTotal: latest?.forecast_total ?? 0,
        actualTotal: latest?.actual_total,
        pendingItems: items.filter((item) => item.status === '待采集').length,
        latestStatus: latest?.status,
      },
      records,
      latest,
      items,
    };
  }

  private async readLegacyCache(cachePath: string): Promise<LegacyCache> {
    try {
      const content = await fs.readFile(cachePath, 'utf8');
      const cache = JSON.parse(content) as LegacyCache;
      if (!Array.isArray(cache.products)) {
        throw new BadRequestException('旧项目缓存文件缺少 products 数组');
      }
      return cache;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`读取旧项目缓存失败：${cachePath}`);
    }
  }

  private identifyProject(product: LegacyProduct) {
    const name = String(product.商品名称 || '').trim();
    const sku = String(product.SKU || '').trim();
    const code = product.编码 ? String(product.编码) : undefined;
    const brand = /IAM/i.test(name) ? 'IAM' : /airx|气熙/i.test(name) ? 'airx' : undefined;
    const category = this.identifyCategory(name);
    const modelName = this.identifyModelName(name);

    return {
      externalId: `jd:${sku || code || product.row_num || name}`,
      code,
      sku,
      name,
      brand,
      category,
      modelName,
    };
  }

  private identifyCategory(name: string) {
    if (/滤网|滤芯|配件|蒸发芯/i.test(name)) return '配件耗材';
    if (/加湿/i.test(name)) return '加湿器';
    if (/除湿/i.test(name)) return '除湿机';
    if (/净化/i.test(name)) return '空气净化器';
    return '其他';
  }

  private identifyModelName(name: string) {
    const matches = name.match(/\b[A-Z]{0,3}\d{1,4}(?:\s?(?:Pro|Ultra|SE|mini|P|C))?\b/gi);
    return matches?.[matches.length - 1]?.replace(/\s+/g, ' ') ?? undefined;
  }

  private calculateMetrics(product: LegacyProduct): ProjectMetrics {
    const national = product.全国数据 || {};
    const factoryStock = this.num(national['全国厂直可用库存']);
    const availableStock = this.num(national['全国可用库存']) + factoryStock;
    const inTransitStock = this.num(national['全国采购未到货']);
    const sales7Days = this.num(national['全国近7日出库商品件数']);
    const sales30Days = this.num(national['全国近30日出库商品件数']);
    const avgDailySales = sales30Days > 0 ? sales30Days / 30 : sales7Days / 7;
    const turnoverDays = avgDailySales > 0 ? this.round(availableStock / avgDailySales, 1) : null;
    const turnoverRate30Days = availableStock > 0 ? this.round(sales30Days / availableStock, 2) : 0;
    const targetStock = avgDailySales * 30;
    const safetyStock = avgDailySales * 7;
    const recommendedRestock = Math.max(0, Math.ceil(targetStock + safetyStock - availableStock - inTransitStock));
    const { riskLevel, riskText } = this.identifyRisk(availableStock, turnoverDays, recommendedRestock);

    return {
      availableStock,
      factoryStock,
      inTransitStock,
      sales7Days,
      sales30Days,
      avgDailySales: this.round(avgDailySales, 2),
      turnoverDays,
      turnoverRate30Days,
      recommendedRestock,
      riskLevel,
      riskText,
    };
  }

  private identifyRisk(availableStock: number, turnoverDays: number | null, recommendedRestock: number) {
    if (availableStock <= 0) return { riskLevel: 'OUT_OF_STOCK', riskText: '已断货' };
    if (turnoverDays !== null && turnoverDays < 7) return { riskLevel: 'CRITICAL', riskText: '7 天内高缺货风险' };
    if (turnoverDays !== null && turnoverDays < 14) return { riskLevel: 'HIGH', riskText: '14 天内补货风险' };
    if (recommendedRestock > 0) return { riskLevel: 'MEDIUM', riskText: '建议排产补货' };
    if (turnoverDays !== null && turnoverDays > 60) return { riskLevel: 'OVERSTOCK', riskText: '周转偏慢' };
    return { riskLevel: 'NORMAL', riskText: '库存健康' };
  }

  private buildInventoryTurnover(project: ReturnType<IntegrationsService['identifyProject']>, metrics: ProjectMetrics) {
    return {
      project: this.projectPayload(project),
      metrics: {
        availableStock: metrics.availableStock,
        sales30Days: metrics.sales30Days,
        avgDailySales: metrics.avgDailySales,
        turnoverDays: metrics.turnoverDays,
        turnoverRate30Days: metrics.turnoverRate30Days,
        riskLevel: metrics.riskLevel,
        riskText: metrics.riskText,
      },
    };
  }

  private buildInventoryAnalysis(
    project: ReturnType<IntegrationsService['identifyProject']>,
    product: LegacyProduct,
    metrics: ProjectMetrics,
  ) {
    const warehouses = Object.entries(product.仓库数据 || {}).map(([name, data]) => {
      const availableStock = this.num(data['可用库存']);
      const inTransitStock = this.num(data['采购未到货']);
      const sales30Days = this.num(data['近30日出库商品件数']);
      const avgDailySales = sales30Days / 30;
      return {
        name,
        availableStock,
        inTransitStock,
        sales7Days: this.num(data['近7日出库商品件数']),
        sales30Days,
        receiving7Days: this.num(data['近7日收货地商品件数']),
        receiving30Days: this.num(data['近30日收货地商品件数']),
        stockDays: avgDailySales > 0 ? this.round(availableStock / avgDailySales, 1) : null,
      };
    });

    return {
      project: this.projectPayload(project),
      summary: {
        availableStock: metrics.availableStock,
        factoryStock: metrics.factoryStock,
        inTransitStock: metrics.inTransitStock,
        sales7Days: metrics.sales7Days,
        sales30Days: metrics.sales30Days,
      },
      warehouses,
    };
  }

  private buildRestockReminder(project: ReturnType<IntegrationsService['identifyProject']>, metrics: ProjectMetrics) {
    const priorityMap: Record<string, string> = {
      OUT_OF_STOCK: 'P0',
      CRITICAL: 'P1',
      HIGH: 'P2',
      MEDIUM: 'P3',
      OVERSTOCK: 'WATCH',
      NORMAL: 'NONE',
    };

    return {
      project: this.projectPayload(project),
      priority: priorityMap[metrics.riskLevel] || 'NONE',
      riskLevel: metrics.riskLevel,
      riskText: metrics.riskText,
      recommendedRestock: metrics.recommendedRestock,
      stockCoverageDays: metrics.turnoverDays,
      availableStock: metrics.availableStock,
      inTransitStock: metrics.inTransitStock,
      avgDailySales: metrics.avgDailySales,
    };
  }

  private aggregateInventoryTurnover(items: Array<Record<string, any>>) {
    const projects = items.map((item) => item.turnover);
    const avgTurnoverDays = this.average(
      projects.map((item) => item.metrics.turnoverDays).filter((value) => value !== null),
    );

    return {
      title: '库存周转',
      summary: {
        projectCount: projects.length,
        avgTurnoverDays,
        fastRiskCount: projects.filter((item) => ['OUT_OF_STOCK', 'CRITICAL', 'HIGH'].includes(item.metrics.riskLevel))
          .length,
        overstockCount: projects.filter((item) => item.metrics.riskLevel === 'OVERSTOCK').length,
      },
      projects: projects.sort((a, b) => (a.metrics.turnoverDays ?? 99999) - (b.metrics.turnoverDays ?? 99999)),
    };
  }

  private aggregateInventoryAnalysis(items: Array<Record<string, any>>) {
    const projects = items.map((item) => item.analysis);
    const warehouseMap = new Map<string, any>();
    for (const project of projects) {
      for (const warehouse of project.warehouses) {
        const current = warehouseMap.get(warehouse.name) || {
          name: warehouse.name,
          availableStock: 0,
          inTransitStock: 0,
          sales30Days: 0,
          projectCount: 0,
        };
        current.availableStock += warehouse.availableStock;
        current.inTransitStock += warehouse.inTransitStock;
        current.sales30Days += warehouse.sales30Days;
        current.projectCount += 1;
        warehouseMap.set(warehouse.name, current);
      }
    }

    return {
      title: '库存分析',
      summary: {
        projectCount: projects.length,
        availableStock: this.sum(projects.map((item) => item.summary.availableStock)),
        inTransitStock: this.sum(projects.map((item) => item.summary.inTransitStock)),
        sales30Days: this.sum(projects.map((item) => item.summary.sales30Days)),
      },
      warehouses: Array.from(warehouseMap.values()).sort((a, b) => b.availableStock - a.availableStock),
      projects,
    };
  }

  private aggregateRestockReminder(items: Array<Record<string, any>>) {
    const reminders = items
      .map((item) => item.reminder)
      .filter((item) => item.priority !== 'NONE')
      .sort((a, b) => this.priorityWeight(a.priority) - this.priorityWeight(b.priority));

    return {
      title: '补货提醒',
      summary: {
        reminderCount: reminders.length,
        urgentCount: reminders.filter((item) => ['P0', 'P1'].includes(item.priority)).length,
        recommendedRestockTotal: this.sum(reminders.map((item) => item.recommendedRestock)),
      },
      reminders,
    };
  }

  private projectPayload(project: ReturnType<IntegrationsService['identifyProject']>) {
    return {
      externalId: project.externalId,
      code: project.code,
      sku: project.sku,
      name: project.name,
      brand: project.brand,
      category: project.category,
      modelName: project.modelName,
    };
  }

  private toSnapshotSummary(snapshot: any) {
    return {
      id: snapshot.id,
      sourceCacheTime: snapshot.sourceCacheTime,
      availableStock: snapshot.availableStock,
      inTransitStock: snapshot.inTransitStock,
      sales30Days: snapshot.sales30Days,
      avgDailySales: snapshot.avgDailySales,
      turnoverDays: snapshot.turnoverDays,
      recommendedRestock: snapshot.recommendedRestock,
      riskLevel: snapshot.riskLevel,
      syncedAt: snapshot.syncedAt,
    };
  }

  private parseCacheTime(value?: string) {
    if (!value) return null;
    const date = new Date(value.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseJson(value: string) {
    return JSON.parse(value);
  }

  private num(value: unknown) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private sum(values: number[]) {
    return this.round(values.reduce((total, value) => total + this.num(value), 0), 2);
  }

  private average(values: number[]) {
    if (!values.length) return null;
    return this.round(this.sum(values) / values.length, 1);
  }

  private round(value: number, digits: number) {
    const base = 10 ** digits;
    return Math.round(value * base) / base;
  }

  private priorityWeight(priority: string) {
    return { P0: 0, P1: 1, P2: 2, P3: 3, WATCH: 4, NONE: 5 }[priority] ?? 9;
  }
}
