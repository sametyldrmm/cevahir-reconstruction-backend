import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  AccessPolicyService,
  type JwtUserShape,
} from '../access/access-policy.service';
import { ReplaceAccessDto } from '../admin/dto/replace-access.dto';
import {
  PatchVisibilityFeaturesDto,
  UpsertVisibilityBodyDto,
} from '../admin/dto/upsert-visibility.dto';
import { UpdatePagePermissionsDto } from '../admin/dto/update-page-permissions.dto';
import { SuperAdminOnly } from '../common/decorators/public.decorator';
import { User } from '../common/decorators/user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProgressDataService } from '../progress/progress-data.service';
import { AbortUploadDto } from '../uploads/dto/abort-upload.dto';
import { CompleteUploadDto } from '../uploads/dto/complete-upload.dto';
import { InitImageUploadsDto } from '../uploads/dto/init-image-uploads.dto';
import { SignPartDto } from '../uploads/dto/sign-part.dto';
import {
  ActiveUploadItemDto,
  ImageUploadBatchInitResponseDto,
  UploadAbortResponseDto,
  UploadCompleteResponseDto,
  UploadSignPartResponseDto,
  UploadStatusResponseDto,
} from '../uploads/dto/upload-response.dto';
import { UploadStatusQueryDto } from '../uploads/dto/upload-status-query.dto';
import { UploadsService } from '../uploads/uploads.service';
import { USER_ROLES } from '../users/domain/user-role.constants';
import { ProjectsService } from '../projects/projects.service';
import { CreateProjectSuperadminDto } from '../projects/dto/create-project-superadmin.dto';
import { UpdateProjectDto } from '../projects/dto/update-project.dto';
import { CreateSuperadminAccountDto } from './dto/create-superadmin-account.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateSuperadminUserDto } from './dto/create-superadmin-user.dto';
import { ListSuperadminUsersDto } from './dto/list-superadmin-users.dto';
import { SetUserPasswordDto } from './dto/set-user-password.dto';
import { UpdateSuperadminUserAccountDto } from './dto/update-superadmin-user-account.dto';
import { SuperadminService } from './superadmin.service';

@ApiTags('superadmin')
@ApiExtraModels(
  ImageUploadBatchInitResponseDto,
  UploadSignPartResponseDto,
  UploadCompleteResponseDto,
  UploadAbortResponseDto,
  UploadStatusResponseDto,
  ActiveUploadItemDto,
)
@Controller('superadmin')
@SuperAdminOnly()
export class SuperadminController {
  constructor(
    private readonly superadmin: SuperadminService,
    private readonly policy: AccessPolicyService,
    private readonly uploads: UploadsService,
    private readonly progressData: ProgressDataService,
    private readonly projects: ProjectsService,
  ) {}

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations for superadmin tools' })
  async listOrganizations() {
    return this.superadmin.listOrganizations();
  }

  @Post('organizations')
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiCreatedResponse({ description: 'Creates an organization' })
  async createOrganization(@Body() body: CreateOrganizationDto) {
    return this.superadmin.createOrganization(body.name);
  }

  @Get('projects')
  @ApiOperation({ summary: 'List all projects and worksites for superadmin tools' })
  async listProjects(@Query('organizationId') organizationId?: string) {
    return this.superadmin.listProjects(organizationId);
  }

  @Post('projects')
  @ApiOperation({ summary: 'Create a new project in any organization' })
  async createProject(@Body() body: CreateProjectSuperadminDto) {
    return this.projects.createProject({
      organizationId: body.organizationId,
      name: body.name,
      slug: body.slug,
    });
  }

  @Patch('projects/:projectId')
  @ApiOperation({ summary: 'Update a project in any organization' })
  async updateProject(
    @User() user: JwtUserShape,
    @Param('projectId') projectId: string,
    @Body() body: UpdateProjectDto,
  ) {
    return this.projects.updateProject(
      { role: user.role, organizationId: user.organizationId },
      projectId,
      { name: body.name, slug: body.slug },
    );
  }

  @Delete('projects/:projectId')
  @ApiOperation({ summary: 'Delete a project in any organization' })
  async deleteProject(
    @User() user: JwtUserShape,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.deleteProject(
      { role: user.role, organizationId: user.organizationId },
      projectId,
    );
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users with optional search and filters' })
  async listUsers(@Query() query: ListSuperadminUsersDto) {
    return this.superadmin.listUsers(query);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a new user in any organization' })
  async createUser(@Body() body: CreateSuperadminUserDto) {
    return this.superadmin.createUser(body);
  }

  @Post('superadmins')
  @ApiOperation({ summary: 'Create a new SUPERADMIN account' })
  @ApiCreatedResponse({
    description: 'Creates a SUPERADMIN user and returns the full user + permission payload',
  })
  async createSuperadmin(@Body() body: CreateSuperadminAccountDto) {
    return this.superadmin.createUser({
      email: body.email,
      password: body.password,
      organizationId: body.organizationId,
      role: USER_ROLES.SUPERADMIN,
      pagePermissions: body.pagePermissions,
    });
  }

  @Get('users/:userId')
  @ApiOperation({
    summary: 'Get one user with page permissions, data permissions, and effective access',
  })
  async getUser(@Param('userId') userId: string) {
    return this.superadmin.getUser(userId);
  }

  @Patch('users/:userId/account')
  @ApiOperation({
    summary: 'Update user account fields like email, role, and organization',
  })
  async updateUserAccount(
    @Param('userId') userId: string,
    @Body() body: UpdateSuperadminUserAccountDto,
  ) {
    return this.superadmin.updateUserAccount(userId, body);
  }

  @Patch('users/:userId/password')
  @ApiOperation({ summary: 'Replace the user password' })
  async updateUserPassword(
    @Param('userId') userId: string,
    @Body() body: SetUserPasswordDto,
  ) {
    return this.superadmin.updateUserPassword(userId, body.password);
  }

  @Delete('users/:userId')
  @ApiOperation({ summary: 'Delete a user and all cascading permission rows' })
  async deleteUser(@Param('userId') userId: string) {
    return this.superadmin.deleteUser(userId);
  }

  @Get('users/:userId/project-access')
  @ApiOperation({ summary: 'List raw project and worksite access rows for a user' })
  async listAccess(@Param('userId') userId: string) {
    return this.policy.listAccess(userId);
  }

  @Put('users/:userId/projects/:projectId/access')
  @ApiOperation({
    summary: 'Replace project access with full project or specific worksite ids',
  })
  async replaceAccess(
    @Param('userId') userId: string,
    @Param('projectId') projectId: string,
    @Body() body: ReplaceAccessDto,
  ) {
    const ids = body.worksiteIds === undefined ? null : body.worksiteIds;
    await this.policy.replaceProjectAccess(userId, projectId, ids);
    return { ok: true };
  }

  @Get('users/:userId/page-permissions')
  @ApiOperation({ summary: 'Get page permissions for a user' })
  async getPagePermissions(@Param('userId') userId: string) {
    return {
      userId,
      pagePermissions: await this.policy.getPagePermissions(userId),
    };
  }

  @Put('users/:userId/page-permissions')
  @ApiOperation({ summary: 'Replace page permissions for a user' })
  async updatePagePermissions(
    @Param('userId') userId: string,
    @Body() body: UpdatePagePermissionsDto,
  ) {
    return {
      userId,
      pagePermissions: await this.policy.updatePagePermissions(
        userId,
        body.pagePermissions,
      ),
    };
  }

  @Get('users/:userId/visibility-profiles')
  @ApiOperation({ summary: 'List visibility profiles for a user' })
  async listVisibility(@Param('userId') userId: string) {
    return this.policy.listVisibilityProfiles(userId);
  }

  @Delete('users/:userId/visibility-profiles/:profileId')
  @ApiOperation({ summary: 'Delete one visibility profile by id' })
  async deleteVisibilityProfile(
    @Param('userId') userId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.policy.deleteVisibilityProfile(userId, profileId);
  }

  @Put('users/:userId/visibility')
  @ApiOperation({ summary: 'Create or replace a visibility profile' })
  async upsertVisibility(
    @Param('userId') userId: string,
    @Body() body: UpsertVisibilityBodyDto,
  ) {
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
  @ApiOperation({ summary: 'Patch visibility feature flags for a user' })
  async patchFeatures(
    @Param('userId') userId: string,
    @Body() body: PatchVisibilityFeaturesDto,
  ) {
    return this.policy.patchVisibilityFeatures(
      userId,
      body.projectId,
      body.worksiteId ?? null,
      body.featureFlags,
    );
  }

  @Post('uploads/images/init')
  @ApiOperation({
    summary:
      'Create multipart upload sessions for many images under Construction-Uploads/images/<projectName>',
  })
  @ApiBody({ type: InitImageUploadsDto })
  @ApiCreatedResponse({ type: ImageUploadBatchInitResponseDto })
  async initImageUploads(
    @User() user: JwtUserShape,
    @Body() body: InitImageUploadsDto,
  ) {
    const project = await this.superadmin.findOrCreateProjectByInput(
      user,
      body.projectName,
    );
    const result = await this.uploads.initImageUploadsAsSuperadmin(user, {
      ...body,
      projectName: project.name,
    });

    return {
      projectId: project.id,
      projectName: project.name,
      projectSlug: project.slug,
      ...result,
    };
  }

  @Post('uploads/sign-part')
  @ApiOperation({ summary: 'Sign one or more multipart upload parts for a superadmin upload session' })
  @ApiBody({ type: SignPartDto })
  @ApiOkResponse({ type: UploadSignPartResponseDto })
  async signUploadPart(@User() user: JwtUserShape, @Body() body: SignPartDto) {
    return this.uploads.signPartsAsSuperadmin(user, body);
  }

  @Post('uploads/complete')
  @ApiOperation({ summary: 'Complete a superadmin multipart upload session' })
  @ApiBody({ type: CompleteUploadDto })
  @ApiOkResponse({ type: UploadCompleteResponseDto })
  async completeUpload(
    @User() user: JwtUserShape,
    @Body() body: CompleteUploadDto,
  ) {
    return this.uploads.completeUploadAsSuperadmin(user, body);
  }

  @Post('uploads/abort')
  @ApiOperation({ summary: 'Abort a superadmin multipart upload session' })
  @ApiBody({ type: AbortUploadDto })
  @ApiOkResponse({ type: UploadAbortResponseDto })
  async abortUpload(@User() user: JwtUserShape, @Body() body: AbortUploadDto) {
    return this.uploads.abortUploadAsSuperadmin(user, body);
  }

  @Get('uploads/status')
  @ApiOperation({
    summary: 'Get one superadmin upload status or list active upload sessions',
  })
  @ApiQuery({ name: 'sessionId', required: false })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiOkResponse({
    description:
      'Returns a single upload status when sessionId is provided, or an array of active uploads when active=true.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(UploadStatusResponseDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(ActiveUploadItemDto) },
        },
      ],
    },
  })
  async uploadStatus(
    @User() user: JwtUserShape,
    @Query() query: UploadStatusQueryDto,
  ) {
    if (query.sessionId) {
      return this.uploads.getStatusAsSuperadmin(user, query.sessionId);
    }

    if (query.active) {
      return this.uploads.listActiveUploadsAsSuperadmin(user);
    }

    throw new BadRequestException('sessionId or active=true is required');
  }

  @Post('projects/data/import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload a project data JSON file and write its block data into the database',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['projectName', 'file'],
      properties: {
        projectName: {
          type: 'string',
          example: 'Cevahir Kuzey',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async importProjectData(
    @User() user: JwtUserShape,
    @Body('projectName') projectName: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          originalname: string;
        }
      | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }

    const project = await this.superadmin.findOrCreateProjectByInput(
      user,
      projectName,
    );
    const worksite = await this.superadmin.ensureDefaultWorksite(project.id);
    const result = await this.progressData.replaceProjectBlocksFromUploadedJson(
      project.id,
      file.buffer,
      file.originalname,
    );

    return {
      ok: true,
      projectId: project.id,
      projectName: project.name,
      projectSlug: project.slug,
      worksite: {
        id: worksite.id,
        code: worksite.code,
        name: worksite.name,
      },
      ...result,
    };
  }


  @Get('users/:userId/effective-permissions')
  @ApiOperation({
    summary: 'Get the combined page, organization, project, and block permissions for a user',
  })
  async getEffectivePermissions(@Param('userId') userId: string) {
    return {
      userId,
      permissions: await this.policy.buildPermissionMapForUser(userId),
    };
  }
}
