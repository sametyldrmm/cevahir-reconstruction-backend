import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { CommonJwtModule } from '../common/jwt/jwt.module';
import { SecurityModule } from '../common/security/security.module';
import { Organization } from '../organizations/entities/organization.entity';
import { ProgressModule } from '../progress/progress.module';
import { Project } from '../projects/entities/project.entity';
import { UserProjectAccess } from '../projects/entities/user-project-access.entity';
import { VisibilityProfile } from '../projects/entities/visibility-profile.entity';
import { Worksite } from '../projects/entities/worksite.entity';
import { ProjectsModule } from '../projects/projects.module';
import { UploadsModule } from '../uploads/uploads.module';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { SuperadminController } from './superadmin.controller';
import { SuperadminService } from './superadmin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Organization,
      Project,
      Worksite,
      UserProjectAccess,
      VisibilityProfile,
    ]),
    AccessModule,
    UsersModule,
    CommonJwtModule,
    SecurityModule,
    ProgressModule,
    ProjectsModule,
    UploadsModule,
  ],
  controllers: [SuperadminController],
  providers: [SuperadminService],
})
export class SuperadminModule {}
