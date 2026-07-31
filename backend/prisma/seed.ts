import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Prisma 种子脚本
 * 初始化默认用户数据
 */
const prisma = new PrismaClient();

async function main() {
  console.log('开始执行种子数据初始化...');

  // 创建默认管理员用户
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

  // 创建测试员工用户
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
