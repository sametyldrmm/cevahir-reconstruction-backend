import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsObject,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InitImageUploadItemDto {
  @ApiProperty({ example: 'camera-001.jpg' })
  @IsString()
  fileName: string;

  @ApiProperty({ example: 5242880 })
  @IsNumber()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  fileSize: number;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  contentType: string;

  @ApiProperty({
    required: false,
    example: { projectId: '11111111-1111-4111-8111-111111111111' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

export class InitImageUploadsDto {
  @ApiProperty({ example: 'Cevahir Kuzey' })
  @IsNotEmpty()
  @IsString()
  projectName: string;

  @ApiProperty({ example: 'North Site' })
  @IsNotEmpty()
  @IsString()
  worksiteName: string;

  @ApiProperty({ example: 'Block A' })
  @IsNotEmpty()
  @IsString()
  blockName: string;

  @ApiProperty({ type: [InitImageUploadItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => InitImageUploadItemDto)
  files: InitImageUploadItemDto[];
}
