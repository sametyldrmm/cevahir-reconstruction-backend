import { IsOptional, IsString } from 'class-validator';

export class ImportProjectBlocksDto {
  @IsOptional()
  @IsString()
  sourcePath?: string;
}
