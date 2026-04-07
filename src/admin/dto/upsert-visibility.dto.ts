import { IsArray, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpsertVisibilityBodyDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsUUID()
  worksiteId?: string | null;

  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleBlockIds?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenBlockIds?: string[];
}

export class PatchVisibilityFeaturesDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsUUID()
  worksiteId?: string | null;

  @IsObject()
  featureFlags: Record<string, boolean>;
}
