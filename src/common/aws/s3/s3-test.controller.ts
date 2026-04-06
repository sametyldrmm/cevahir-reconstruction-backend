import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { S3Service } from './s3.service';
import { Public } from '../../decorators/public.decorator';

@ApiTags('Test - S3')
@Controller('test/s3')
export class S3TestController {
  private readonly logger = new Logger(S3TestController.name);

  constructor(private readonly s3Service: S3Service) {}

  @Public()
  @Post('generate-presigned-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate presigned URL for file upload' })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
  })
  async generatePresignedUrl(
    @Body()
    body: {
      folder?: string;
      fileName: string;
      contentType: string;
      expiresIn?: number;
    },
  ) {
    try {
      const result = await this.s3Service.generatePresignedUrl({
        folder: body.folder,
        fileName: body.fileName || `test-file-${Date.now()}.txt`,
        contentType: body.contentType || 'text/plain',
        expiresIn: body.expiresIn || 300,
      });

      return {
        success: true,
        message: 'Presigned URL generated successfully',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('Error generating presigned URL:', error);
      return {
        success: false,
        message: 'Failed to generate presigned URL',
        error: error.message,
      };
    }
  }

  @Public()
  @Post('generate-image-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate presigned URL for image upload' })
  @ApiResponse({
    status: 200,
    description: 'Image presigned URL generated successfully',
  })
  async generateImageUrl(
    @Body()
    body: {
      folder?: string;
      fileName: string;
      contentType?: string;
      expiresIn?: number;
    },
  ) {
    try {
      const result = await this.s3Service.getPresignedUrlImage({
        folder: body.folder,
        fileName: body.fileName || `test-image-${Date.now()}.jpg`,
        contentType: body.contentType || 'image/jpeg',
        expiresIn: body.expiresIn || 300,
      });

      return {
        success: true,
        message: 'Image presigned URL generated successfully',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('Error generating image presigned URL:', error);
      return {
        success: false,
        message: 'Failed to generate image presigned URL',
        error: error.message,
      };
    }
  }

  @Public()
  @Post('check-file-exists')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if file exists in S3' })
  @ApiResponse({
    status: 200,
    description: 'File existence checked',
  })
  async checkFileExists(@Body() body: { key: string }) {
    try {
      const exists = await this.s3Service.fileExists(body.key);

      return {
        success: true,
        message: 'File existence checked',
        data: {
          key: body.key,
          exists,
        },
      };
    } catch (error: any) {
      this.logger.error('Error checking file existence:', error);
      return {
        success: false,
        message: 'Failed to check file existence',
        error: error.message,
      };
    }
  }

  @Public()
  @Post('get-file-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get public URL for file' })
  @ApiResponse({
    status: 200,
    description: 'File URL generated',
  })
  async getFileUrl(@Body() body: { key: string }) {
    try {
      const url = await this.s3Service.getFileUrl(body.key);

      return {
        success: true,
        message: 'File URL generated',
        data: {
          key: body.key,
          url,
        },
      };
    } catch (error: any) {
      this.logger.error('Error getting file URL:', error);
      return {
        success: false,
        message: 'Failed to get file URL',
        error: error.message,
      };
    }
  }
}
