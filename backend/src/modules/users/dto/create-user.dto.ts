import { IsString, IsNotEmpty, IsOptional, IsEmail, MinLength, IsIn } from 'class-validator';

/**
 * 创建用户数据传输对象
 */
export class CreateUserDto {
  /** 用户名 */
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  /** 密码（最少 6 位） */
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度不能少于 6 位' })
  password: string;

  /** 邮箱（可选） */
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  /** 全名 */
  @IsString()
  @IsNotEmpty({ message: '姓名不能为空' })
  fullName: string;

  /** 角色（ADMIN/MANAGER/STAFF） */
  @IsOptional()
  @IsIn(['ADMIN', 'MANAGER', 'STAFF'], { message: '角色值无效，可选值：ADMIN、MANAGER、STAFF' })
  role?: string;
}
