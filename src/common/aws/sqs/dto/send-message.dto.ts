import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Gönderilecek mesaj body (JSON object)',
    example: {
      type: 'ANLIK_GPS',
      vehicleId: 'vehicle-123',
      lat: 41.0082,
      lon: 28.9784,
      timestamp: '2024-01-01T00:00:00.000Z',
    },
  })
  @IsObject()
  @IsNotEmpty()
  message: any;

  @ApiPropertyOptional({
    description: 'FIFO queue için message group ID (opsiyonel)',
    example: 'AnlikGpsGroup',
  })
  @IsString()
  @IsOptional()
  messageGroupId?: string;

  @ApiPropertyOptional({
    description: 'FIFO queue için message deduplication ID (opsiyonel)',
    example: 'unique-dedup-id-123',
  })
  @IsString()
  @IsOptional()
  messageDeduplicationId?: string;
}

export class SendAnlikGpsMessageDto {
  @ApiProperty({
    description: 'Araç ID',
    example: 'vehicle-123',
  })
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @ApiProperty({
    description: 'Enlem (latitude)',
    example: 41.0082,
  })
  @IsNotEmpty()
  lat: number;

  @ApiProperty({
    description: 'Boylam (longitude)',
    example: 28.9784,
  })
  @IsNotEmpty()
  lon: number;

  @ApiPropertyOptional({
    description: 'Timestamp (ISO 8601 formatı, opsiyonel)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsString()
  @IsOptional()
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'FIFO queue için message group ID (opsiyonel)',
    example: 'AnlikGpsGroup',
  })
  @IsString()
  @IsOptional()
  messageGroupId?: string;
}
