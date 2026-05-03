import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateProjectSuperadminDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ example: 'Cevahir Ana Kampüs' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'cevahir-ana-kampus' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;
}

