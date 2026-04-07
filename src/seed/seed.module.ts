import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../common/security/security.module';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Project } from '../projects/entities/project.entity';
import { UserProjectAccess } from '../projects/entities/user-project-access.entity';
import { VisibilityProfile } from '../projects/entities/visibility-profile.entity';
import { Worksite } from '../projects/entities/worksite.entity';
import { DatabaseSeedService } from './database-seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      User,
      Project,
      Worksite,
      UserProjectAccess,
      VisibilityProfile,
    ]),
    SecurityModule,
  ],
  providers: [DatabaseSeedService],
})
export class SeedModule {}
