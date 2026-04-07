import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthRequired } from '../common/decorators/public.decorator';
import { User } from '../common/decorators/user.decorator';
import type { JwtUserShape } from '../access/access-policy.service';
import { AccessPolicyService } from '../access/access-policy.service';
import { ProgressDataService } from './progress-data.service';
import { ProgressFilterService } from './progress-filter.service';

@ApiTags('progress')
@Controller('workspaces')
export class ProgressController {
  constructor(
    private readonly policy: AccessPolicyService,
    private readonly data: ProgressDataService,
    private readonly filter: ProgressFilterService,
  ) {}

  @Get(':worksiteCode/progress/summary')
  @AuthRequired()
  @ApiOperation({ summary: 'İlerleme özeti (görünürlük uygulanır)' })
  @ApiParam({ name: 'worksiteCode', example: 'WS-01' })
  @ApiQuery({ name: 'projectId', required: true })
  async summary(
    @User() user: JwtUserShape,
    @Param('worksiteCode') worksiteCode: string,
    @Query('projectId') projectId: string,
  ) {
    const { worksite } = await this.policy.assertWorksiteInProject(
      user.id,
      user.role,
      user.organizationId,
      projectId,
      worksiteCode,
    );
    const visibility = await this.policy.getEffectiveVisibility(
      user.id,
      user.role,
      projectId,
      worksite.id,
    );
    const raw = this.data.loadSummary();
    const filtered = this.filter.filterSummary(raw, visibility);
    return {
      meta: {
        projectId,
        worksiteCode,
        visibility,
      },
      data: filtered,
    };
  }

  @Get(':worksiteCode/progress/detail')
  @AuthRequired()
  @ApiOperation({ summary: 'Tek blok detayı (progress_from_results dilimi)' })
  @ApiParam({ name: 'worksiteCode', example: 'WS-01' })
  @ApiQuery({ name: 'projectId', required: true })
  @ApiQuery({ name: 'blockId', required: true, example: 'D2' })
  async detail(
    @User() user: JwtUserShape,
    @Param('worksiteCode') worksiteCode: string,
    @Query('projectId') projectId: string,
    @Query('blockId') blockId: string,
  ) {
    if (!blockId?.trim()) {
      throw new BadRequestException('blockId query param is required');
    }
    const { worksite } = await this.policy.assertWorksiteInProject(
      user.id,
      user.role,
      user.organizationId,
      projectId,
      worksiteCode,
    );
    const visibility = await this.policy.getEffectiveVisibility(
      user.id,
      user.role,
      projectId,
      worksite.id,
    );
    const raw = this.data.loadDetailRoot();
    const slice = this.filter.filterDetailBlock(raw, blockId, visibility);
    if (slice == null) {
      throw new NotFoundException('Block not found or not visible for this user');
    }
    return {
      meta: {
        projectId,
        worksiteCode,
        blockId,
        visibility,
      },
      data: slice,
    };
  }
}
