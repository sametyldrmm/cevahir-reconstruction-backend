import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';
import { toStringArray } from '../../common/transforms/to-string-array';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    example: ['dashboard.view', 'element-classes.view'],
    type: [String],
  })
  @Transform(({ value }) => toStringArray(value))
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  pagePermissions?: string[];
}
