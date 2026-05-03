import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Cevahir Ana Kampüs (Güncel)' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'cevahir-ana-kampus' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;
}

