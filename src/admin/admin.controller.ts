import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PAGE_PERMISSIONS } from '../access/domain/permission.constants';
import {
  AdminOnly,
  PagePermissions,
} from '../common/decorators/public.decorator';
import { User, UserId } from '../common/decorators/user.decorator';
import {
  AccessPolicyService,
  type JwtUserShape,
} from '../access/access-policy.service';
import { ReplaceAccessDto } from './dto/replace-access.dto';
import { UpdatePagePermissionsDto } from './dto/update-page-permissions.dto';
import {
  PatchVisibilityFeaturesDto,
  UpsertVisibilityBodyDto,
} from './dto/upsert-visibility.dto';
import { ImportProjectBlocksDto } from './dto/import-project-blocks.dto';
import { ProgressDataService } from '../progress/progress-data.service';
import { AdminUserManagementService } from './admin-user-management.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserAccountDto } from './dto/update-admin-user-account.dto';
import { SetUserPasswordDto } from '../superadmin/dto/set-user-password.dto';
import { ProjectsService } from '../projects/projects.service';
import { CreateProjectDto } from '../projects/dto/create-project.dto';
import { UpdateProjectDto } from '../projects/dto/update-project.dto';

@ApiTags('admin')
@Controller('admin')
@AdminOnly()
@PagePermissions(PAGE_PERMISSIONS.ADMIN_MANAGE)
export class AdminController {
  constructor(
    private readonly policy: AccessPolicyService,
    private readonly progressData: ProgressDataService,
    private readonly users: AdminUserManagementService,
    private readonly projects: ProjectsService,
  ) {}

  @Get('users')
  @ApiOperation({
    summary: 'Ayni organizasyondaki USER ve UPLOAD hesaplarini listeler',
  })
  async listUsers(@UserId() adminId: string) {
    return this.users.listUsers(adminId);
  }

  @Post('users')
  @ApiOperation({
    summary: 'Ayni organizasyonda USER veya UPLOAD hesabi olusturur',
  })
  async createUser(
    @UserId() adminId: string,
    @Body() body: CreateAdminUserDto,
  ) {
    return this.users.createUser(adminId, body);
  }

  @Get('users/:userId')
  @ApiOperation({
    summary: 'USER veya UPLOAD hesabinin temel bilgilerini getirir',
  })
  async getUser(@UserId() adminId: string, @Param('userId') userId: string) {
    return this.users.getUser(adminId, userId);
  }

  @Patch('users/:userId/account')
  @ApiOperation({
    summary: 'USER veya UPLOAD hesabinin email ve rol bilgilerini gunceller',
  })
  async updateUserAccount(
    @UserId() adminId: string,
    @Param('userId') userId: string,
    @Body() body: UpdateAdminUserAccountDto,
  ) {
    return this.users.updateUserAccount(adminId, userId, body);
  }

  @Patch('users/:userId/password')
  @ApiOperation({ summary: 'USER veya UPLOAD hesabinin sifresini yeniler' })
  async updateUserPassword(
    @UserId() adminId: string,
    @Param('userId') userId: string,
    @Body() body: SetUserPasswordDto,
  ) {
    return this.users.updateUserPassword(adminId, userId, body.password);
  }

  @Delete('users/:userId')
  @ApiOperation({ summary: 'USER veya UPLOAD hesabini siler' })
  async deleteUser(@UserId() adminId: string, @Param('userId') userId: string) {
    return this.users.deleteUser(adminId, userId);
  }

  @Get('users/:userId/project-access')
  @ApiOperation({ summary: 'Kullanıcının proje / şantiye erişim satırları' })
  async listAccess(@UserId() adminId: string, @Param('userId') userId: string) {
    await this.policy.assertAdminCanManageUserPermissions(adminId, userId);
    return this.policy.listAccess(userId);
  }

  @Get('users/:userId/effective-permissions')
  @ApiOperation({
    summary:
      'Kullanicinin sayfa, organizasyon, proje ve blok bazli efektif izinlerini getir',
  })
  async getEffectivePermissions(
    @UserId() adminId: string,
    @Param('userId') userId: string,
  ) {
    await this.policy.assertAdminCanManageUserPermissions(adminId, userId);
    return {
      userId,
      permissions: await this.policy.buildPermissionMapForUser(userId),
    };
  }

  @Post('projects/:projectId/blocks/import')
  @ApiOperation({
    summary: 'JSON dosyasindaki proje blok verilerini veritabanina aktarir',
  })
  async importProjectBlocks(
    @User() admin: JwtUserShape,
    @Param('projectId') projectId: string,
    @Body() body: ImportProjectBlocksDto,
  ) {
    await this.policy.assertProjectAccess(
      admin.id,
      admin.role,
      admin.organizationId,
      projectId,
    );

    const result = await this.progressData.replaceProjectBlocksFromFile(
      projectId,
      body.sourcePath,
    );

    return {
      ok: true,
      projectId,
      ...result,
    };
  }

  @Post('projects')
  @ApiOperation({ summary: 'Create a new project in the admin organization' })
  async createProject(@User() admin: JwtUserShape, @Body() body: CreateProjectDto) {
    return this.projects.createProject({
      organizationId: admin.organizationId ?? '',
      name: body.name,
      slug: body.slug,
    });
  }

  @Patch('projects/:projectId')
  @ApiOperation({ summary: 'Update a project in the admin organization' })
  async updateProject(
    @User() admin: JwtUserShape,
    @Param('projectId') projectId: string,
    @Body() body: UpdateProjectDto,
  ) {
    return this.projects.updateProject(
      { role: admin.role, organizationId: admin.organizationId },
      projectId,
      { name: body.name, slug: body.slug },
    );
  }

  @Delete('projects/:projectId')
  @ApiOperation({ summary: 'Delete a project in the admin organization' })
  async deleteProject(
    @User() admin: JwtUserShape,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.deleteProject(
      { role: admin.role, organizationId: admin.organizationId },
      projectId,
    );
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
    await this.policy.assertAdminCanManageUserPermissions(adminId, userId);
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
    await this.policy.assertAdminCanManageUserPermissions(adminId, userId);
    return this.policy.listVisibilityProfiles(userId);
  }

  @Get('users/:userId/page-permissions')
  @ApiOperation({ summary: 'Kullanicinin sayfa izinlerini getir' })
  async getPagePermissions(
    @UserId() adminId: string,
    @Param('userId') userId: string,
  ) {
    await this.policy.assertAdminCanManageUserPermissions(adminId, userId);
    return {
      userId,
      pagePermissions: await this.policy.getPagePermissions(userId),
    };
  }

  @Put('users/:userId/page-permissions')
  @ApiOperation({ summary: 'Kullanicinin sayfa izinlerini degistir' })
  async updatePagePermissions(
    @UserId() adminId: string,
    @Param('userId') userId: string,
    @Body() body: UpdatePagePermissionsDto,
  ) {
    await this.policy.assertAdminCanManageUserPermissions(adminId, userId);
    return {
      userId,
      pagePermissions: await this.policy.updatePagePermissions(
        userId,
        body.pagePermissions,
      ),
    };
  }

  @Put('users/:userId/visibility')
  @ApiOperation({ summary: 'Görünürlük profili oluştur / güncelle' })
  async upsertVisibility(
    @UserId() adminId: string,
    @Param('userId') userId: string,
    @Body() body: UpsertVisibilityBodyDto,
  ) {
    await this.policy.assertAdminCanManageUserPermissions(adminId, userId);
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
    await this.policy.assertAdminCanManageUserPermissions(adminId, userId);
    return this.policy.patchVisibilityFeatures(
      userId,
      body.projectId,
      body.worksiteId ?? null,
      body.featureFlags,
    );
  }

  @Delete('users/:userId/visibility-profiles/:profileId')
  @ApiOperation({ summary: 'Delete one visibility profile by id' })
  async deleteVisibilityProfile(
    @UserId() adminId: string,
    @Param('userId') userId: string,
    @Param('profileId') profileId: string,
  ) {
    await this.policy.assertAdminCanManageUserPermissions(adminId, userId);
    return this.policy.deleteVisibilityProfile(userId, profileId);
  }
}
