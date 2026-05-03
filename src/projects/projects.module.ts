import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organizations/entities/organization.entity';
import { Project } from './entities/project.entity';
import { UserProjectAccess } from './entities/user-project-access.entity';
import { VisibilityProfile } from './entities/visibility-profile.entity';
import { Worksite } from './entities/worksite.entity';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      Project,
      Worksite,
      UserProjectAccess,
      VisibilityProfile,
    ]),
  ],
  providers: [ProjectsService],
  exports: [TypeOrmModule, ProjectsService],
})
export class ProjectsModule {}
