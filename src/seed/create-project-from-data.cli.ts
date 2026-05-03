import { NestFactory } from '@nestjs/core';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { Organization } from '../organizations/entities/organization.entity';
import { Project } from '../projects/entities/project.entity';
import { Worksite } from '../projects/entities/worksite.entity';
import { ProgressDataService } from '../progress/progress-data.service';
import { ProjectProgressBlock } from '../progress/entities/project-progress-block.entity';

type CliArgs = {
  orgId?: string;
  name?: string;
  slug?: string;
  sourcePath?: string;
  worksiteCode?: string;
  worksiteName?: string;
};

function readArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    switch (token) {
      case '--orgId':
        out.orgId = next;
        i += 1;
        break;
      case '--name':
        out.name = next;
        i += 1;
        break;
      case '--slug':
        out.slug = next;
        i += 1;
        break;
      case '--sourcePath':
        out.sourcePath = next;
        i += 1;
        break;
      case '--worksiteCode':
        out.worksiteCode = next;
        i += 1;
        break;
      case '--worksiteName':
        out.worksiteName = next;
        i += 1;
        break;
      default:
        break;
    }
  }

  return out;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

async function resolveOrganization(
  orgs: Repository<Organization>,
  orgId?: string,
): Promise<Organization> {
  if (orgId?.trim()) {
    const match = await orgs.findOne({ where: { id: orgId.trim() } });
    if (!match) {
      throw new Error(`Organization not found: ${orgId}`);
    }
    return match;
  }

  const all = await orgs.find({ order: { name: 'ASC' } });
  if (all.length === 0) {
    throw new Error('No organizations found. Create an organization first.');
  }
  if (all.length > 1) {
    throw new Error(
      `Multiple organizations found. Re-run with --orgId. Available: ${all
        .map((org) => `${org.id} (${org.name})`)
        .join(', ')}`,
    );
  }
  return all[0];
}

async function ensureUniqueProjectSlug(
  projects: Repository<Project>,
  organizationId: string,
  baseSlug: string,
): Promise<string> {
  let candidate = baseSlug || 'imported-project';
  let suffix = 1;

  while (
    await projects.exist({
      where: { organizationId, slug: candidate },
    })
  ) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
}

async function ensureUniqueWorksiteCode(
  worksites: Repository<Worksite>,
  projectId: string,
  baseCode: string,
): Promise<string> {
  let candidate = baseCode || 'WS-IMPORTED';
  let suffix = 1;

  while (
    await worksites.exist({
      where: { projectId, code: candidate },
    })
  ) {
    suffix += 1;
    candidate = `${baseCode}-${suffix}`;
  }

  return candidate;
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  let createdProjectId: string | null = null;

  try {
    const dataSource = app.get(DataSource);
    const orgs = dataSource.getRepository(Organization);
    const projects = dataSource.getRepository(Project);
    const worksites = dataSource.getRepository(Worksite);
    const blockRepo = dataSource.getRepository(ProjectProgressBlock);
    const progressData = app.get(ProgressDataService);

    const organization = await resolveOrganization(orgs, args.orgId);
    const defaultName = `Imported Project ${new Date().toISOString().slice(0, 10)}`;
    const projectName = args.name?.trim() || defaultName;
    const projectSlug = await ensureUniqueProjectSlug(
      projects,
      organization.id,
      slugify(args.slug?.trim() || projectName),
    );

    const project = await projects.save(
      projects.create({
        organizationId: organization.id,
        name: projectName,
        slug: projectSlug,
      }),
    );
    createdProjectId = project.id;

    const worksiteCode = await ensureUniqueWorksiteCode(
      worksites,
      project.id,
      args.worksiteCode?.trim() || 'WS-IMPORTED',
    );
    const worksiteName = args.worksiteName?.trim() || 'Imported Worksite';

    const worksite = await worksites.save(
      worksites.create({
        projectId: project.id,
        code: worksiteCode,
        name: worksiteName,
      }),
    );

    const importResult = await progressData.replaceProjectBlocksFromFile(
      project.id,
      args.sourcePath,
    );
    const importedBlockCount = await blockRepo.count({
      where: { projectId: project.id },
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          organization: {
            id: organization.id,
            name: organization.name,
          },
          project: {
            id: project.id,
            name: project.name,
            slug: project.slug,
          },
          worksite: {
            id: worksite.id,
            code: worksite.code,
            name: worksite.name,
          },
          importResult: {
            sourcePath: importResult.sourcePath,
            importedBlockCount: importResult.importedBlockCount,
            storedBlockCount: importedBlockCount,
          },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (createdProjectId) {
      const dataSource = app.get(DataSource);
      await dataSource.getRepository(Project).delete({ id: createdProjectId });
    }
    throw error;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
