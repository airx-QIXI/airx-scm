import { IsString, IsOptional, IsEmail, MinLength, IsIn } from 'class-validator';

/**
 * 更新用户数据传输对象
 * 所有字段均为可选
 */
export class UpdateUserDto {
  /** 用户名 */
  @IsOptional()
  @IsString()
  username?: string;

  /** 密码（最少 6 位） */
  @IsOptional()
  @IsString()
  @MinLength(6, { message: '密码长度不能少于 6 位' })
  password?: string;

  /** 邮箱 */
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  /** 全名 */
  @IsOptional()
  @IsString()
  fullName?: string;

  /** 角色（ADMIN/MANAGER/STAFF） */
  @IsOptional()
  @IsIn(['ADMIN', 'MANAGER', 'STAFF'], { message: '角色值无效，可选值：ADMIN、MANAGER、STAFF' })
  role?: string;
}
