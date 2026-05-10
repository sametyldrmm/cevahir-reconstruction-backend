import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  AuthRequired,
  PagePermissions,
} from '../common/decorators/public.decorator';
import { User } from '../common/decorators/user.decorator';
import type { JwtUserShape } from '../access/access-policy.service';
import { AccessPolicyService } from '../access/access-policy.service';
import { PAGE_PERMISSIONS } from '../access/domain/permission.constants';
import { CleanLogger } from '../common/logger';
import { S3Service } from '../common/aws/s3/s3.service';
import { ProgressSummaryQueryDto } from './dto/progress-summary-query.dto';
import { ProgressDataService } from './progress-data.service';
import { resolveProgressDateRange } from './progress-date.utils';
import { ProgressFilterService } from './progress-filter.service';

@ApiTags('progress')
@Controller('workspaces')
@PagePermissions(PAGE_PERMISSIONS.PROGRESS_VIEW)
export class ProgressController {
  private readonly logger = new CleanLogger(ProgressController.name);

  constructor(
    private readonly policy: AccessPolicyService,
    private readonly data: ProgressDataService,
    private readonly filter: ProgressFilterService,
    private readonly s3: S3Service,
  ) {}

  @Get(':worksiteCode/progress/summary')
  @AuthRequired()
  @ApiOperation({ summary: 'İlerleme özeti (görünürlük uygulanır)' })
  @ApiParam({ name: 'worksiteCode', example: 'WS-01' })
  @ApiQuery({ name: 'projectId', required: true })
  @ApiQuery({
    name: 'blockNames',
    required: false,
    description: 'Virgulle ayrilmis blok isimleri. Bos ise tum gorunur bloklar doner.',
    example: 'A,C1,D2',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: [
      'current-month',
      'current-week',
      'current-quarter',
      'current-year',
      'custom',
    ],
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'YYYY-MM-DD',
    example: '2026-05-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'YYYY-MM-DD',
    example: '2026-05-10',
  })
  async summary(
    @User() user: JwtUserShape,
    @Param('worksiteCode') worksiteCode: string,
    @Query() query: ProgressSummaryQueryDto,
  ) {
    const { projectId, blockNames, period, from, to } = query;
    const { worksite, project } = await this.policy.assertWorksiteInProject(
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
    const dateRange = resolveProgressDateRange({ period, from, to });
    const requestedBlockIds = this.parseBlockNames(blockNames);
    const raw = await this.data.loadSummary(projectId, {
      blockNames: requestedBlockIds ?? undefined,
      dateRange: dateRange
        ? {
            from: dateRange.from,
            to: dateRange.to,
          }
        : undefined,
    });
    const filtered = this.filter.filterSummary(
      raw,
      visibility,
      requestedBlockIds ?? undefined,
    );
    this.logger.log(
      `progress.summary ok ws=${worksiteCode} pid=${projectId.slice(0, 8)} u=${user.id.slice(0, 8)}`,
    );
    return {
      meta: {
        projectId,
        projectSlug: project.slug,
        worksiteCode,
        requestedBlockIds,
        period: dateRange?.period ?? null,
        from: dateRange?.from ?? null,
        to: dateRange?.to ?? null,
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
    const { worksite, project, visibility } = await this.policy.assertBlockVisible(
      user.id,
      user.role,
      user.organizationId,
      projectId,
      worksiteCode,
      blockId,
    );
    const raw = await this.data.loadDetailBlock(projectId, blockId);
    if (raw == null) {
      throw new NotFoundException('Block not found or not visible for this user');
    }
    const slice = this.filter.filterDetailBlock(raw, blockId, visibility);
    if (slice == null) {
      throw new NotFoundException('Block not found or not visible for this user');
    }
    const imageUrls = await this.loadBlockImageUrls(
      project.name,
      worksite.code,
      blockId,
    );
    this.logger.log(
      `progress.detail ok ws=${worksiteCode} blk=${blockId} pid=${projectId.slice(0, 8)} u=${user.id.slice(0, 8)}`,
    );
    return {
      meta: {
        projectId,
        projectSlug: project.slug,
        worksiteCode,
        blockId,
        visibility,
      },
      data: {
        ...slice,
        imageUrls,
      },
    };
  }

  private parseBlockNames(raw?: string): string[] | null {
    if (!raw?.trim()) {
      return null;
    }

    const blockNames = [...new Set(raw.split(',').map((name) => name.trim()))].filter(
      (name) => name.length > 0,
    );
    return blockNames.length > 0 ? blockNames : null;
  }

  private async loadBlockImageUrls(
    projectName: string,
    worksiteCode: string,
    blockId: string,
  ) {
    const prefix = this.buildBlockImagePrefix(projectName, worksiteCode, blockId);
    const keys = await this.s3.listObjectKeysByPrefix(prefix);

    return Promise.all(
      keys.map((key) => this.s3.generateDownloadPresignedUrl(key)),
    );
  }

  private buildBlockImagePrefix(
    projectName: string,
    worksiteCode: string,
    blockId: string,
  ) {
    return `Construction-Uploads/AdminUploads/${this.normalizeS3PathSegment(projectName)}/${this.normalizeS3PathSegment(worksiteCode)}/${this.normalizeS3PathSegment(blockId)}/`;
  }

  private normalizeS3PathSegment(value: string) {
    const normalized = value
      .trim()
      .replace(/[^\w\-./]+/g, '-')
      .replace(/\/+/g, '/')
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .replace(/\//g, '-')
      .slice(0, 120);

    if (!normalized) {
      throw new BadRequestException('Invalid S3 path segment');
    }

    return normalized;
  }
}
