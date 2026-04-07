import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../common/jwt/jwt.service';
import { PasswordService } from '../common/security/password.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async login(body: LoginDto) {
    const user = await this.usersService.findByEmailNormalized(body.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await this.passwords.compare(body.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.jwt.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        sessionVersion: user.sessionVersion,
        organizationId: user.organizationId,
      },
    };
  }
}
