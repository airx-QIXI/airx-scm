import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * 用户管理控制器
 * 提供用户 CRUD 接口，所有接口均需 JWT 认证
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * 获取所有用户列表
   * GET /api/users
   */
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * 获取单个用户详情
   * GET /api/users/:id
   * @param id 用户 ID
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  /**
   * 创建用户
   * POST /api/users
   * @param dto 创建用户数据
   */
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  /**
   * 更新用户信息
   * PATCH /api/users/:id
   * @param id 用户 ID
   * @param dto 更新数据
   */
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  /**
   * 删除用户
   * DELETE /api/users/:id
   * @param id 用户 ID
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
