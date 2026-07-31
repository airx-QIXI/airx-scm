import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 本地登录守卫
 * 基于 passport-local 策略验证用户名密码
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
