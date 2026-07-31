import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * PlanetScale 种子脚本
 * 初始化默认用户数据和模块注册表
 *
 * 使用方法：
 *   1. 确保 .env 中配置了正确的 DATABASE_URL
 *   2. 运行 npx prisma db push 创建表结构
 *   3. 运行 npm run db:seed 执行种子数据初始化
 */
const prisma = new PrismaClient();

/** 默认模块注册表数据 */
const defaultModules = [
  {
    id: 'dashboard',
    name: '仪表盘',
    icon: 'DashboardOutlined',
    description: '系统概览与关键业务指标',
    type: 'builtin',
    path: '/dashboard',
    status: 'active',
    sortOrder: 0,
    version: '1.0.0',
  },
  {
    id: 'production-restock',
    name: '排产补货预测',
    icon: 'LineChartOutlined',
    description: '生产需求、工厂排产、需求与实际出货达成三张看板',
    type: 'builtin',
    path: '/production-restock',
    status: 'active',
    sortOrder: 1,
    version: '1.0.0',
    dataSource: JSON.stringify({
      type: 'json-sync',
      apiEndpoint: '/api/integrations/production-planning/dashboards',
    }),
  },
  {
    id: 'inventory',
    name: '库存管理',
    icon: 'InboxOutlined',
    description: '库存查询、库存调拨、库存预警',
    type: 'external',
    status: 'pending',
    sortOrder: 2,
    version: '0.0.0',
  },
  {
    id: 'orders',
    name: '订单+物流',
    icon: 'ShoppingCartOutlined',
    description: '订单管理、物流跟踪、发货确认',
    type: 'external',
    status: 'pending',
    sortOrder: 3,
    version: '0.0.0',
  },
  {
    id: 'suppliers',
    name: '供应商采购',
    icon: 'TeamOutlined',
    description: '供应商管理、采购订单、对账',
    type: 'external',
    status: 'pending',
    sortOrder: 4,
    version: '0.0.0',
  },
  {
    id: 'analytics',
    name: '数据分析报表',
    icon: 'BarChartOutlined',
    description: '销售分析、库存分析、自定义报表',
    type: 'external',
    status: 'pending',
    sortOrder: 5,
    version: '0.0.0',
  },
];

async function main() {
  console.log('开始执行种子数据初始化...');

  // === 创建默认用户 ===
  const adminPassword = await bcrypt.hash('airx123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'airx' },
    update: {
      password: adminPassword,
      email: 'admin@airxchina.com.cn',
      fullName: 'AIRX 管理员',
      role: 'ADMIN',
    },
    create: {
      username: 'airx',
      password: adminPassword,
      email: 'admin@airxchina.com.cn',
      fullName: 'AIRX 管理员',
      role: 'ADMIN',
    },
  });
  console.log('管理员用户已创建:', admin.username, `(ID: ${admin.id})`);

  const staffPassword = await bcrypt.hash('staff123', 10);
  const staff = await prisma.user.upsert({
    where: { username: 'staff' },
    update: {},
    create: {
      username: 'staff',
      password: staffPassword,
      email: 'staff@airx.com',
      fullName: '测试员工',
      role: 'STAFF',
    },
  });
  console.log('员工用户已创建:', staff.username, `(ID: ${staff.id})`);

  // === 初始化模块注册表 ===
  for (const mod of defaultModules) {
    const existing = await prisma.module.findUnique({ where: { id: mod.id } });
    if (existing) {
      await prisma.module.update({
        where: { id: mod.id },
        data: {
          name: mod.name,
          icon: mod.icon,
          description: mod.description,
          type: mod.type,
          path: mod.path ?? null,
          status: mod.status,
          sortOrder: mod.sortOrder,
          version: mod.version,
          dataSource: mod.dataSource ?? null,
        },
      });
      console.log(`模块已更新: ${mod.id} (${mod.name})`);
    } else {
      await prisma.module.create({ data: mod });
      console.log(`模块已创建: ${mod.id} (${mod.name})`);
    }
  }

  // === 初始化排产补货模拟数据 ===
  const mockProducts = [
    { externalId: 'AIRX-A8', code: 'A8-001', sku: 'SKU-A8-001', name: 'AIRX A8 空气净化器', brand: 'AIRX', category: '空气净化器', modelName: 'A8' },
    { externalId: 'AIRX-A8S', code: 'A8S-002', sku: 'SKU-A8S-002', name: 'AIRX A8S 智能版', brand: 'AIRX', category: '空气净化器', modelName: 'A8S' },
    { externalId: 'AIRX-A8P', code: 'A8P-003', sku: 'SKU-A8P-003', name: 'AIRX A8P Pro版', brand: 'AIRX', category: '空气净化器', modelName: 'A8P' },
    { externalId: 'AIRX-A10', code: 'A10-004', sku: 'SKU-A10-004', name: 'AIRX A10 空气净化器', brand: 'AIRX', category: '空气净化器', modelName: 'A10' },
    { externalId: 'AIRX-A10S', code: 'A10S-005', sku: 'SKU-A10S-005', name: 'AIRX A10S 智能版', brand: 'AIRX', category: '空气净化器', modelName: 'A10S' },
    { externalId: 'AIRX-A12', code: 'A12-006', sku: 'SKU-A12-006', name: 'AIRX A12 空气净化器', brand: 'AIRX', category: '空气净化器', modelName: 'A12' },
    { externalId: 'AIRX-A12S', code: 'A12S-007', sku: 'SKU-A12S-007', name: 'AIRX A12S 智能版', brand: 'AIRX', category: '空气净化器', modelName: 'A12S' },
    { externalId: 'AIRX-A12P', code: 'A12P-008', sku: 'SKU-A12P-008', name: 'AIRX A12P Pro版', brand: 'AIRX', category: '空气净化器', modelName: 'A12P' },
    { externalId: 'AIRX-A15', code: 'A15-009', sku: 'SKU-A15-009', name: 'AIRX A15 旗舰版', brand: 'AIRX', category: '空气净化器', modelName: 'A15' },
    { externalId: 'AIRX-A15S', code: 'A15S-010', sku: 'SKU-A15S-010', name: 'AIRX A15S 智能旗舰版', brand: 'AIRX', category: '空气净化器', modelName: 'A15S' },
    { externalId: 'AIRX-H8', code: 'H8-011', sku: 'SKU-H8-011', name: 'AIRX H8 加湿器', brand: 'AIRX', category: '加湿器', modelName: 'H8' },
    { externalId: 'AIRX-H8S', code: 'H8S-012', sku: 'SKU-H8S-012', name: 'AIRX H8S 智能加湿器', brand: 'AIRX', category: '加湿器', modelName: 'H8S' },
  ];

  for (const product of mockProducts) {
    const existingProject = await prisma.integrationProject.findUnique({
      where: { externalId: product.externalId },
    });

    let project;
    if (existingProject) {
      project = existingProject;
    } else {
      project = await prisma.integrationProject.create({
        data: {
          externalId: product.externalId,
          code: product.code,
          sku: product.sku,
          name: product.name,
          brand: product.brand,
          category: product.category,
          modelName: product.modelName,
          source: 'jd_self_operated',
          rawData: JSON.stringify(product),
        },
      });
      console.log(`项目已创建: ${project.modelName} (ID: ${project.id})`);
    }

    // 生成模拟库存和销售数据
    const availableStock = Math.floor(Math.random() * 4000) + 200;
    const factoryStock = Math.floor(Math.random() * 2000) + 50;
    const inTransitStock = Math.floor(Math.random() * 1000);
    const sales7Days = Math.floor(Math.random() * 400) + 20;
    const sales30Days = Math.floor(Math.random() * 1800) + 100;
    const avgDailySales = round(sales30Days / 30, 2);
    const turnoverDays = avgDailySales > 0 ? round(availableStock / avgDailySales, 1) : null;
    const turnoverRate30Days = avgDailySales > 0 ? round(sales30Days / ((availableStock + factoryStock + inTransitStock) || 1), 2) : 0;

    let riskLevel: string;
    if (turnoverDays === null || availableStock === 0) riskLevel = 'OUT_OF_STOCK';
    else if (turnoverDays < 7) riskLevel = 'CRITICAL';
    else if (turnoverDays < 14) riskLevel = 'HIGH';
    else if (turnoverDays > 90) riskLevel = 'OVERSTOCK';
    else if (sales30Days < 10) riskLevel = 'NONE';
    else riskLevel = 'NORMAL';

    const riskTextMap: Record<string, string> = {
      OUT_OF_STOCK: '已缺货',
      CRITICAL: '高缺货风险',
      HIGH: '中缺货风险',
      NORMAL: '正常',
      OVERSTOCK: '高库存',
      NONE: '无动销',
    };

    const recommendedRestock = riskLevel === 'OUT_OF_STOCK' || riskLevel === 'CRITICAL'
      ? Math.ceil(avgDailySales * 45)
      : riskLevel === 'HIGH'
        ? Math.ceil(avgDailySales * 30)
        : 0;

    const stockCoverageDays = avgDailySales > 0 ? round((availableStock + inTransitStock) / avgDailySales, 1) : null;

    const inventoryTurnover = {
      project: {
        externalId: product.externalId,
        code: product.code,
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        category: product.category,
        modelName: product.modelName,
      },
      metrics: {
        availableStock,
        sales30Days,
        avgDailySales,
        turnoverDays,
        turnoverRate30Days,
        riskLevel,
        riskText: riskTextMap[riskLevel] || '数据缺失',
      },
    };

    const inventoryAnalysis = {
      project: {
        externalId: product.externalId,
        code: product.code,
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        category: product.category,
        modelName: product.modelName,
      },
      summary: { availableStock, factoryStock, inTransitStock, sales7Days, sales30Days },
      warehouses: [
        { name: '北京仓', availableStock: Math.floor(availableStock * 0.4), inTransitStock: Math.floor(inTransitStock * 0.5), sales30Days: Math.floor(sales30Days * 0.45), projectCount: 1 },
        { name: '上海仓', availableStock: Math.floor(availableStock * 0.35), inTransitStock: Math.floor(inTransitStock * 0.3), sales30Days: Math.floor(sales30Days * 0.4), projectCount: 1 },
        { name: '广州仓', availableStock: Math.floor(availableStock * 0.25), inTransitStock: Math.floor(inTransitStock * 0.2), sales30Days: Math.floor(sales30Days * 0.15), projectCount: 1 },
      ],
    };

    const priority = riskLevel === 'OUT_OF_STOCK' ? 'P0' : riskLevel === 'CRITICAL' ? 'P1' : riskLevel === 'HIGH' ? 'P2' : 'NONE';

    const restockReminder = {
      project: {
        externalId: product.externalId,
        code: product.code,
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        category: product.category,
        modelName: product.modelName,
      },
      priority,
      riskLevel,
      riskText: riskTextMap[riskLevel] || '数据缺失',
      recommendedRestock,
      stockCoverageDays,
      availableStock,
      inTransitStock,
      avgDailySales,
    };

    // 检查是否已有该项目的最新快照
    const existingSnapshot = await prisma.productionRestockSnapshot.findFirst({
      where: { projectId: project.id },
      orderBy: { syncedAt: 'desc' },
    });

    if (!existingSnapshot) {
      await prisma.productionRestockSnapshot.create({
        data: {
          projectId: project.id,
          sourceCacheTime: new Date(),
          availableStock,
          factoryStock,
          inTransitStock,
          sales7Days,
          sales30Days,
          avgDailySales,
          turnoverDays,
          turnoverRate30Days,
          recommendedRestock,
          riskLevel,
          inventoryTurnover: JSON.stringify(inventoryTurnover),
          inventoryAnalysis: JSON.stringify(inventoryAnalysis),
          restockReminder: JSON.stringify(restockReminder),
          rawData: JSON.stringify({ inventoryTurnover, inventoryAnalysis, restockReminder }),
        },
      });
      console.log(`快照已创建: ${product.modelName} (库存: ${availableStock}, 风险: ${riskTextMap[riskLevel]})`);
    }
  }

  console.log('种子数据初始化完成！');
}

function round(value: number, digits: number): number {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

main()
  .catch((e) => {
    console.error('种子数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
