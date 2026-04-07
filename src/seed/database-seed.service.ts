import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordService } from '../common/security/password.service';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Project } from '../projects/entities/project.entity';
import { UserProjectAccess } from '../projects/entities/user-project-access.entity';
import { VisibilityProfile } from '../projects/entities/visibility-profile.entity';
import { Worksite } from '../projects/entities/worksite.entity';
import { SEED } from './database-seed.constants';

@Injectable()
export class DatabaseSeedService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly orgs: Repository<Organization>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Worksite)
    private readonly worksites: Repository<Worksite>,
    @InjectRepository(UserProjectAccess)
    private readonly access: Repository<UserProjectAccess>,
    @InjectRepository(VisibilityProfile)
    private readonly vis: Repository<VisibilityProfile>,
    private readonly passwords: PasswordService,
  ) {}

  async onModuleInit() {
    if ((await this.users.count()) > 0) {
      return;
    }
    this.logger.log('Seeding database (demo users, projects, access)...');

    await this.orgs.save(
      this.orgs.create({ id: SEED.orgId, name: 'Cevahir Demo Org' }),
    );

    const adminHash = await this.passwords.hash('Admin123!');
    const viewerHash = await this.passwords.hash('Viewer123!');
    await this.users.save([
      this.users.create({
        id: SEED.adminUserId,
        email: 'admin@cevahir.local',
        passwordHash: adminHash,
        role: 'ADMIN',
        organizationId: SEED.orgId,
        sessionVersion: 1,
      }),
      this.users.create({
        id: SEED.viewerUserId,
        email: 'viewer@cevahir.local',
        passwordHash: viewerHash,
        role: 'USER',
        organizationId: SEED.orgId,
        sessionVersion: 1,
      }),
    ]);

    await this.projects.save([
      this.projects.create({
        id: SEED.projectAnaId,
        organizationId: SEED.orgId,
        name: 'Cevahir Ana Kampüs',
        slug: 'prj-ana',
      }),
      this.projects.create({
        id: SEED.projectKuzeyId,
        organizationId: SEED.orgId,
        name: 'Kuzey Hat İşleri',
        slug: 'prj-kuzey',
      }),
    ]);

    await this.worksites.save([
      this.worksites.create({
        id: SEED.ws.ws01,
        projectId: SEED.projectAnaId,
        code: 'WS-01',
        name: 'Merkez Şantiye',
      }),
      this.worksites.create({
        id: SEED.ws.ws02,
        projectId: SEED.projectAnaId,
        code: 'WS-02',
        name: 'Kuzey Şantiye',
      }),
      this.worksites.create({
        id: SEED.ws.ws03,
        projectId: SEED.projectKuzeyId,
        code: 'WS-03',
        name: 'Batı Şantiye',
      }),
      this.worksites.create({
        id: SEED.ws.ws04,
        projectId: SEED.projectAnaId,
        code: 'WS-04',
        name: 'Doğu Şantiye',
      }),
    ]);

    await this.access.save([
      this.access.create({
        userId: SEED.adminUserId,
        projectId: SEED.projectAnaId,
      }),
      this.access.create({
        userId: SEED.adminUserId,
        projectId: SEED.projectKuzeyId,
      }),
      this.access.create({
        userId: SEED.viewerUserId,
        projectId: SEED.projectAnaId,
      }),
    ]);

    await this.vis.save(
      this.vis.create({
        userId: SEED.viewerUserId,
        projectId: SEED.projectAnaId,
        featureFlags: { showSteel: false, showPipelineDiagnostics: false },
        visibleBlockIds: null,
        hiddenBlockIds: [],
      }),
    );

    this.logger.log(
      'Seed OK — admin@cevahir.local / Admin123! · viewer@cevahir.local / Viewer123!',
    );
  }
}
