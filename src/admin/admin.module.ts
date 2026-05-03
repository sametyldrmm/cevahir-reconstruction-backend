import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { CommonJwtModule } from '../common/jwt/jwt.module';
import { SecurityModule } from '../common/security/security.module';
import { ProgressModule } from '../progress/progress.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { AdminUserManagementService } from './admin-user-management.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    AccessModule,
    CommonJwtModule,
    ProgressModule,
    ProjectsModule,
    SecurityModule,
    UsersModule,
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [AdminController],
  providers: [AdminUserManagementService],
})
export class AdminModule {}
