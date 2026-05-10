import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import {
  ISO_DATE_STRING_REGEX,
  PROGRESS_PERIODS,
  type ProgressPeriod,
} from '../progress-date.utils';

export class ProgressSummaryQueryDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsOptional()
  @IsString()
  blockNames?: string;

  @IsOptional()
  @IsIn(PROGRESS_PERIODS)
  period?: ProgressPeriod;

  @IsOptional()
  @Matches(ISO_DATE_STRING_REGEX, {
    message: 'from must be in YYYY-MM-DD format',
  })
  from?: string;

  @IsOptional()
  @Matches(ISO_DATE_STRING_REGEX, {
    message: 'to must be in YYYY-MM-DD format',
  })
  to?: string;
}
