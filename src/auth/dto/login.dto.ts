import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@cevahir.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin123!', minLength: 1 })
  @IsString()
  @MinLength(1)
  password: string;
}
