import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { toStringArray } from '../../common/transforms/to-string-array';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'user@firma.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Parola123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ default: 'USER', enum: ['USER', 'UPLOAD'] })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    example: ['dashboard.view', 'blocks.view'],
    type: [String],
  })
  @Transform(({ value }) => toStringArray(value))
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  pagePermissions?: string[];
}
