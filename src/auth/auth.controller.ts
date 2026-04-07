import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Giriş — access ve refresh JWT üretir' })
  @ApiBody({ type: LoginDto })
  async login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }
}
