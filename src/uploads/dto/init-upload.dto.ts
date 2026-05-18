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
    description:
      'Optional client-side grouping hint. The backend still generates the final S3 key as Construction-Uploads/UserUploads/<email>/<Date>/<file-name>.',
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

  @ApiPropertyOptional({
    example: 'Santiye-2026/Blok-A/IMG_0001.jpg',
    description:
      'Folder upload path relative to the date segment. Preserves subfolders under UserUploads/<email>/<date>/.',
  })
  @IsOptional()
  @IsString()
  relativePath?: string;
}
