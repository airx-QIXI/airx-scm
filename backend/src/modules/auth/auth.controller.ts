import { Controller, Post, Get, UseGuards, Request, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { LoginDto } from './dto/login.dto';

/**
 * 认证控制器
 * 提供登录和获取当前用户信息接口
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 用户登录
   * POST /api/auth/login
   * @param dto 登录数据（用户名、密码）
   * @returns JWT 令牌和用户信息
   */
  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(@Body() _dto: LoginDto, @Request() req) {
    // LocalAuthGuard 验证通过后，用户信息已挂载到 req.user
    return this.authService.login(req.user);
  }

  /**
   * 获取当前登录用户信息
   * GET /api/auth/profile
   * @param req 请求对象（包含 JWT 解析出的用户信息）
   * @returns 当前用户信息（不含密码）
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }
}
