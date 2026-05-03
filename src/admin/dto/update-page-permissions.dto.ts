import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsString } from 'class-validator';
import { toStringArray } from '../../common/transforms/to-string-array';

export class UpdatePagePermissionsDto {
  @ApiProperty({
    example: ['dashboard.view', 'element-classes.view'],
    type: [String],
  })
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  pagePermissions: string[];
}
