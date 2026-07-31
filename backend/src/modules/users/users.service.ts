import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * 用户服务
 * 提供用户 CRUD 操作
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询所有用户（不含密码）
   * @returns 用户列表
   */
  async findAll(): Promise<Omit<User, 'password'>[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { id: 'asc' },
    });
    // 移除所有用户的密码字段
    return users.map(({ password: _, ...user }) => user);
  }

  /**
   * 根据 ID 查询单个用户（不含密码）
   * @param id 用户 ID
   * @returns 用户信息
   */
  async findOne(id: number): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`用户 ID ${id} 不存在`);
    }

    const { password: _, ...result } = user;
    return result;
  }

  /**
   * 创建用户
   * @param data 创建用户数据
   * @returns 创建的用户信息（不含密码）
   */
  async create(data: CreateUserDto): Promise<Omit<User, 'password'>> {
    // 检查用户名是否已存在
    const existing = await this.prisma.user.findUnique({
      where: { username: data.username },
    });
    if (existing) {
      throw new ConflictException(`用户名 "${data.username}" 已存在`);
    }

    // 检查邮箱是否已存在（如果提供了邮箱）
    if (data.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingEmail) {
        throw new ConflictException(`邮箱 "${data.email}" 已被使用`);
      }
    }

    // 使用 bcrypt 加密密码
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        email: data.email,
        fullName: data.fullName,
        role: data.role,
      },
    });

    const { password: _, ...result } = user;
    return result;
  }

  /**
   * 更新用户信息
   * @param id 用户 ID
   * @param data 更新数据
   * @returns 更新后的用户信息（不含密码）
   */
  async update(id: number, data: UpdateUserDto): Promise<Omit<User, 'password'>> {
    // 检查用户是否存在
    await this.findOne(id);

    // 如果更新密码，需要加密
    let updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    const { password: _, ...result } = user;
    return result;
  }

  /**
   * 删除用户
   * @param id 用户 ID
   * @returns 删除的用户信息（不含密码）
   */
  async remove(id: number): Promise<Omit<User, 'password'>> {
    // 检查用户是否存在
    await this.findOne(id);

    const user = await this.prisma.user.delete({
      where: { id },
    });

    const { password: _, ...result } = user;
    return result;
  }
}
