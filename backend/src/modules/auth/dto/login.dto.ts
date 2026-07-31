import { IsString, IsNotEmpty, MinLength } from 'class-validator';

/**
 * 登录请求数据传输对象
 */
export class LoginDto {
  /** 用户名 */
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  /** 密码（最少 6 位） */
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度不能少于 6 位' })
  password: string;
}
