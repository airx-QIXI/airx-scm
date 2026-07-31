import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

/**
 * 本地登录策略
 * 用于处理用户名密码登录验证
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // 默认字段名为 username 和 password，无需额外配置
    super();
  }

  /**
   * 验证用户名密码
   * @param username 用户名
   * @param password 密码
   * @returns 验证通过的用户信息（注入到 request.user）
   */
  async validate(username: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return user;
  }
}
