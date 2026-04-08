import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpRequestLoggingInterceptor } from './common/logger';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeormModule } from './common/typeorm/typeorm.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectsModule } from './projects/projects.module';
import { SessionModule } from './session/session.module';
import { ProgressModule } from './progress/progress.module';
import { AdminModule } from './admin/admin.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeormModule,
    OrganizationsModule,
    UsersModule,
    ProjectsModule,
    AuthModule,
    SessionModule,
    ProgressModule,
    AdminModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    /** Tum HTTP controller endpointleri icin tek satir request logu */
    { provide: APP_INTERCEPTOR, useClass: HttpRequestLoggingInterceptor },
  ],
})
export class AppModule {}
