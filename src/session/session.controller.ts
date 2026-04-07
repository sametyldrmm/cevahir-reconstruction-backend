import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthRequired } from '../common/decorators/public.decorator';
import { User } from '../common/decorators/user.decorator';
import type { JwtUserShape } from '../access/access-policy.service';
import { AccessPolicyService } from '../access/access-policy.service';

@ApiTags('session')
@Controller()
export class SessionController {
  constructor(private readonly policy: AccessPolicyService) {}

  @Get('me/session')
  @AuthRequired()
  @ApiOperation({ summary: 'Oturum — erişilebilir projeler ve şantiye kodları' })
  async session(@User() user: JwtUserShape) {
    return this.policy.buildSession(user);
  }
}
