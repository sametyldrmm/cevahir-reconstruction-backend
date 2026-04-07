import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class ReplaceAccessDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  worksiteIds?: string[] | null;
}
