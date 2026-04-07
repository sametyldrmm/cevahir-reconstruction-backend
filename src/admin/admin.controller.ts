import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../common/decorators/public.decorator';
import { UserId } from '../common/decorators/user.decorator';
import { AccessPolicyService } from '../access/access-policy.service';
import { ReplaceAccessDto } from './dto/replace-access.dto';
import {
  PatchVisibilityFeaturesDto,
  UpsertVisibilityBodyDto,
} from './dto/upsert-visibility.dto';

@ApiTags('admin')
@Controller('admin')
@AdminOnly()
export class AdminController {
  constructor(private readonly policy: AccessPolicyService) {}

  @Get('users/:userId/project-access')
  @ApiOperation({ summary: 'Kullanıcının proje / şantiye erişim satırları' })
  async listAccess(@UserId() adminId: string, @Param('userId') userId: string) {
    await this.policy.assertAdminSameOrg(adminId, userId);
    return this.policy.listAccess(userId);
  }

  @Put('users/:userId/projects/:projectId/access')
  @ApiOperation({
    summary: 'Proje erişimini değiştir (tüm şantiye veya belirli UUID listesi)',
  })
  async replaceAccess(
    @UserId() adminId: string,
    @Param('userId') userId: string,
    @Param('projectId') projectId: string,
    @Body() body: ReplaceAccessDto,
  ) {
    await this.policy.assertAdminSameOrg(adminId, userId);
    const ids =
      body.worksiteIds === undefined ? null : body.worksiteIds;
    await this.policy.replaceProjectAccess(userId, projectId, ids);
    return { ok: true };
  }

  @Get('users/:userId/visibility-profiles')
  @ApiOperation({ summary: 'Görünürlük profilleri listesi' })
  async listVisibility(
    @UserId() adminId: string,
    @Param('userId') userId: string,
  ) {
    await this.policy.assertAdminSameOrg(adminId, userId);
    return this.policy.listVisibilityProfiles(userId);
  }

  @Put('users/:userId/visibility')
  @ApiOperation({ summary: 'Görünürlük profili oluştur / güncelle' })
  async upsertVisibility(
    @UserId() adminId: string,
    @Param('userId') userId: string,
    @Body() body: UpsertVisibilityBodyDto,
  ) {
    await this.policy.assertAdminSameOrg(adminId, userId);
    return this.policy.upsertVisibility(
      userId,
      body.projectId,
      body.worksiteId ?? null,
      {
        featureFlags: body.featureFlags,
        visibleBlockIds: body.visibleBlockIds,
        hiddenBlockIds: body.hiddenBlockIds,
      },
    );
  }

  @Patch('users/:userId/visibility/features')
  @ApiOperation({ summary: 'Özellik bayraklarını kısmen güncelle' })
  async patchFeatures(
    @UserId() adminId: string,
    @Param('userId') userId: string,
    @Body() body: PatchVisibilityFeaturesDto,
  ) {
    await this.policy.assertAdminSameOrg(adminId, userId);
    return this.policy.patchVisibilityFeatures(
      userId,
      body.projectId,
      body.worksiteId ?? null,
      body.featureFlags,
    );
  }
}
