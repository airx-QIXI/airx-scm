import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../auth.service';

/**
 * JWT 认证策略
 * 从 Bearer Token 中提取并验证 JWT
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      // 从 Authorization Bearer Token 中提取 JWT
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 不忽略过期时间校验
      ignoreExpiration: false,
      // 从环境变量读取 JWT 密钥
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * 验证 JWT 载荷，返回用户信息（注入到 request.user）
   * @param payload JWT 解码后的载荷
   * @returns 用户信息（不含密码）
   */
  async validate(payload: JwtPayload): Promise<any> {
    // 根据 payload 中的 userId 查询用户
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在或令牌无效');
    }

    // 返回不含密码的用户信息
    const { password: _, ...result } = user;
    return result;
  }
}
