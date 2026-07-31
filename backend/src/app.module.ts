import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ModulesModule } from './modules/modules/modules.module';

/**
 * 应用根模块
 * 负责导入全局配置及各功能模块
 */
@Module({
  imports: [
    // 全局环境变量配置
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Prisma 数据库模块（全局）
    PrismaModule,
    // 认证模块
    AuthModule,
    // 用户管理模块
    UsersModule,
    // 外部项目集成与预测看板同步模块
    IntegrationsModule,
    // 模块注册表（管理独立业务模块的注册与状态）
    ModulesModule,
  ],
})
export class AppModule {}
