import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CloudfrontService } from './cloudfront.service';
import { Public } from '../../decorators/public.decorator';

@ApiTags('Test - CloudFront')
@Controller('test/cloudfront')
export class CloudfrontTestController {
  private readonly logger = new Logger(CloudfrontTestController.name);

  constructor(private readonly cloudfrontService: CloudfrontService) {}

  @Public()
  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check CloudFront service status' })
  @ApiResponse({
    status: 200,
    description: 'CloudFront service status',
  })
  async getStatus() {
    try {
      return {
        success: true,
        message: 'CloudFront service is available',
        data: {
          service: 'CloudFront',
          status: 'ready',
        },
      };
    } catch (error: any) {
      this.logger.error('Error checking CloudFront status:', error);
      return {
        success: false,
        message: 'CloudFront service error',
        error: error.message,
      };
    }
  }
}
