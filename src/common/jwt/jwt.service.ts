import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtService {
  private readonly jwtSecret: string;

  constructor(private readonly jwtService: NestJwtService) {
    const secret = process.env.JWT_SECRET;
    if (
      !secret ||
      secret === null ||
      secret === undefined ||
      secret.trim() === ''
    ) {
      throw new Error(
        'JWT_SECRET environment variable is required but not set or is empty',
      );
    }
    this.jwtSecret = secret;
  }

  sign(payload: any, options?: any): string {
    return this.jwtService.sign(payload, options);
  }

  signRefreshToken(payload: any, options?: any): string {
    const refreshPayload = { ...payload, type: 'refresh' };
    const refreshOptions = {
      expiresIn: '7d',
      ...options,
    };
    return this.jwtService.sign(refreshPayload, refreshOptions);
  }

  signAccessToken(payload: any, options?: any): string {
    const accessPayload = { ...payload, type: 'access' };
    const accessOptions = {
      expiresIn: '1h',
      ...options,
    };
    return this.jwtService.sign(accessPayload, accessOptions);
  }

  verify(token: string, options?: any): any {
    try {
      return this.jwtService.verify(token, options);
    } catch (error: any) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  verifyRefreshToken(token: string, options?: any): any {
    try {
      const decoded: any = this.jwtService.verify(token, options);
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type - refresh token expected');
      }
      return decoded;
    } catch (error: any) {
      throw new Error(`Refresh token verification failed: ${error.message}`);
    }
  }

  decode(token: string, options?: any): any {
    return this.jwtService.decode(token, options);
  }

  verifyManual(token: string, secret?: string): any {
    try {
      const jwtSecret = secret || this.jwtSecret;
      if (
        !jwtSecret ||
        jwtSecret === null ||
        jwtSecret === undefined ||
        jwtSecret.trim() === ''
      ) {
        throw new Error('JWT_SECRET is not configured or is empty');
      }
      return jwt.verify(token, jwtSecret);
    } catch (error: any) {
      throw new Error(`Manual token verification failed: ${error.message}`);
    }
  }

  async validateToken(token: string): Promise<{
    isValid: boolean;
    decoded?: any;
    error?: string;
  }> {
    try {
      const decoded = this.verifyManual(token);
      return { isValid: true, decoded };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message || 'Unknown validation error',
      };
    }
  }

  generateTokenPair(payload: any): {
    accessToken: string;
    refreshToken: string;
  } {
    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.signRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
    };
  }
}
