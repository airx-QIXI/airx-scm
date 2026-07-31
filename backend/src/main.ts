import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

/**
 * 应用启动入口
 * AIRX 供应链管理系统后端服务
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局路由前缀
  app.setGlobalPrefix('api');

  // 全局验证管道：白名单过滤 + 自动类型转换
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // 跨域配置
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 从配置读取端口，默认 3000
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  console.log(`AIRX 供应链管理系统后端服务已启动: http://localhost:${port}/api`);
}
bootstrap();
