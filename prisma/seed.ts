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

  console.log('种子数据初始化完成！');
}

main()
  .catch((e) => {
    console.error('种子数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
