import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { toStringArray } from '../../common/transforms/to-string-array';
import { USER_ROLES } from '../../users/domain/user-role.constants';

export class CreateSuperadminUserDto {
  @ApiProperty({ example: 'user@firma.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Parola123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: Object.values(USER_ROLES), example: 'SUPERADMIN' })
  @IsIn(Object.values(USER_ROLES))
  role: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    example: ['dashboard.view', 'blocks.view'],
    type: [String],
  })
  @Transform(({ value }) => toStringArray(value))
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pagePermissions?: string[];
}
