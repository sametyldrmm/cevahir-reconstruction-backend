import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@firma.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Parola123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({ default: 'USER' })
  @IsOptional()
  @IsString()
  role?: string;
}
