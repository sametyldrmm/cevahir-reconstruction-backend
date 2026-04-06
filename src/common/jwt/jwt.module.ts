import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtService } from './jwt.service';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    NestJwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => {
        // ConfigModule yüklendikten sonra process.env'e erişebiliriz
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
        return {
          secret: jwtSecret,
          signOptions: { expiresIn: '1h' },
        };
      },
    }),
  ],
  providers: [JwtStrategy, JwtAuthGuard, JwtService],
  exports: [JwtStrategy, JwtAuthGuard, JwtService, NestJwtModule],
})
export class CommonJwtModule {}
