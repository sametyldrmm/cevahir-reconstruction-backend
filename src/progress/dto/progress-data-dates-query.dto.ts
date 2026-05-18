import { IsNotEmpty, IsString } from 'class-validator';

export class ProgressDataDatesQueryDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;
}
