import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env.JWT_SECRET;
    if (
      !jwtSecret ||
      jwtSecret === null ||
      jwtSecret === undefined ||
      jwtSecret.trim() === ''
    ) {
      throw new Error(
        'JWT_SECRET environment variable is required but not set or is empty',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    if (payload.type === 'refresh') {
      throw new UnauthorizedException(
        'Invalid token type - access token required',
      );
    }

    if (!payload.id || !payload.email) {
      throw new UnauthorizedException(
        'Invalid token payload - missing required fields',
      );
    }

    return payload;
  }
}
