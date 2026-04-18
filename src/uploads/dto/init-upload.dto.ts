import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class InitUploadDto {
  @ApiProperty({ example: 'site-report-001.zip' })
  @IsString()
  fileName: string;

  @ApiProperty({ example: 524288000 })
  @IsNumber()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  fileSize: number;

  @ApiProperty({ example: 'application/zip' })
  @IsString()
  contentType: string;

  @ApiPropertyOptional({
    example: 'raw',
    description: 'Optional logical prefix below the uploads root.',
  })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({
    example: { projectId: '11111111-1111-4111-8111-111111111111' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
