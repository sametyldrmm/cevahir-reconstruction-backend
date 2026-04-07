import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { Project } from '../projects/entities/project.entity';
import { UserProjectAccess } from '../projects/entities/user-project-access.entity';
import { VisibilityProfile } from '../projects/entities/visibility-profile.entity';
import { Worksite } from '../projects/entities/worksite.entity';
import { AccessPolicyService } from './access-policy.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      UserProjectAccess,
      Project,
      Worksite,
      VisibilityProfile,
    ]),
  ],
  providers: [AccessPolicyService],
  exports: [AccessPolicyService],
})
export class AccessModule {}
