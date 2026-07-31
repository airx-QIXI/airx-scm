import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';

/**
 * JWT 载荷接口
 */
export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

/**
 * 认证服务
 * 负责用户验证、登录令牌签发、用户信息查询
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 验证用户名和密码
   * @param username 用户名
   * @param password 明文密码
   * @returns 验证通过返回用户信息（不含密码），失败抛出异常
   */
  async validateUser(username: string, password: string): Promise<Omit<User, 'password'>> {
    // 根据用户名查询用户
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    // 用户不存在或密码不匹配
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 使用 bcrypt 比较密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 返回不含密码的用户信息
    const { password: _, ...result } = user;
    return result;
  }

  /**
   * 用户登录，签发 JWT 令牌
   * @param user 已验证的用户信息
   * @returns 包含 access_token 和用户信息的对象
   */
  async login(user: Omit<User, 'password'>): Promise<{ access_token: string; user: Omit<User, 'password'> }> {
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  /**
   * 获取用户信息（不含密码）
   * @param userId 用户 ID
   * @returns 用户信息
   */
  async getProfile(userId: number): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const { password: _, ...result } = user;
    return result;
  }
}
