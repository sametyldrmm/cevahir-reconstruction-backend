import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { JwtUserShape } from '../access/access-policy.service';
import { UploadOnly } from '../common/decorators/public.decorator';
import { User } from '../common/decorators/user.decorator';
import { AbortUploadDto } from './dto/abort-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { InitUploadDto } from './dto/init-upload.dto';
import { SignPartDto } from './dto/sign-part.dto';
import {
  ActiveUploadItemDto,
  UploadAbortResponseDto,
  UploadCompleteResponseDto,
  UploadInitResponseDto,
  UploadSignPartResponseDto,
  UploadStatusResponseDto,
} from './dto/upload-response.dto';
import { UploadStatusQueryDto } from './dto/upload-status-query.dto';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@ApiExtraModels(
  UploadInitResponseDto,
  UploadSignPartResponseDto,
  UploadCompleteResponseDto,
  UploadAbortResponseDto,
  UploadStatusResponseDto,
  ActiveUploadItemDto,
)
@Controller('uploads')
@UploadOnly()
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('init')
  @ApiOperation({ summary: 'Create a new S3 multipart upload session' })
  @ApiBody({ type: InitUploadDto })
  @ApiCreatedResponse({ type: UploadInitResponseDto })
  async init(@User() user: JwtUserShape, @Body() body: InitUploadDto) {
    return this.uploads.initUpload(user, body);
  }

  @Post('sign-part')
  @ApiOperation({ summary: 'Sign one or more S3 multipart upload parts' })
  @ApiBody({ type: SignPartDto })
  @ApiOkResponse({ type: UploadSignPartResponseDto })
  async signPart(@User() user: JwtUserShape, @Body() body: SignPartDto) {
    return this.uploads.signParts(user, body);
  }

  @Post('complete')
  @ApiOperation({ summary: 'Complete an S3 multipart upload' })
  @ApiBody({ type: CompleteUploadDto })
  @ApiOkResponse({ type: UploadCompleteResponseDto })
  async complete(@User() user: JwtUserShape, @Body() body: CompleteUploadDto) {
    return this.uploads.completeUpload(user, body);
  }

  @Post('abort')
  @ApiOperation({ summary: 'Abort an active S3 multipart upload' })
  @ApiBody({ type: AbortUploadDto })
  @ApiOkResponse({ type: UploadAbortResponseDto })
  async abort(@User() user: JwtUserShape, @Body() body: AbortUploadDto) {
    return this.uploads.abortUpload(user, body);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get a single upload status or list active uploads' })
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
  async status(@User() user: JwtUserShape, @Query() query: UploadStatusQueryDto) {
    if (query.sessionId) {
      return this.uploads.getStatus(user, query.sessionId);
    }

    if (query.active) {
      return this.uploads.listActiveUploads(user);
    }

    throw new BadRequestException('sessionId or active=true is required');
  }
}
