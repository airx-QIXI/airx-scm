import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT 认证守卫
 * 基于 passport-jwt 策略保护路由
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
