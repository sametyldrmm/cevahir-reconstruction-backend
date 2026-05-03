import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PAGE_PERMISSIONS } from '../access/domain/permission.constants';
import {
  AuthRequired,
  PagePermissions,
} from '../common/decorators/public.decorator';
import { User } from '../common/decorators/user.decorator';
import type { JwtUserShape } from '../access/access-policy.service';
import { AccessPolicyService } from '../access/access-policy.service';

@ApiTags('session')
@Controller()
export class SessionController {
  constructor(private readonly policy: AccessPolicyService) {}

  @Get('me/session')
  @AuthRequired()
  @PagePermissions(PAGE_PERMISSIONS.SESSION_VIEW)
  @ApiOperation({ summary: 'Oturum — erişilebilir projeler ve şantiye kodları' })
  async session(@User() user: JwtUserShape) {
    return this.policy.buildSession(user);
  }

  @Get('me/permissions')
  @AuthRequired()
  @PagePermissions(PAGE_PERMISSIONS.SESSION_VIEW)
  @ApiOperation({
    summary: 'Kullanıcının sayfa, organizasyon, proje ve blok görünürlük izinleri',
  })
  async permissions(@User() user: JwtUserShape) {
    return this.policy.buildPermissionMap(user);
  }
}
