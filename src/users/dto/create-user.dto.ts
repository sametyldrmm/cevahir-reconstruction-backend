import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { toStringArray } from '../../common/transforms/to-string-array';

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
