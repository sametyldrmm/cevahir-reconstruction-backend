import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { UserProjectAccess } from './user-project-access.entity';
import { VisibilityProfile } from './visibility-profile.entity';
import { Worksite } from './worksite.entity';

@Entity('projects')
@Unique(['organizationId', 'slug'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column()
  name: string;

  @Column()
  slug: string;

  @OneToMany(() => Worksite, (w) => w.project)
  worksites: Worksite[];

  @OneToMany(() => UserProjectAccess, (a) => a.project)
  userAccess: UserProjectAccess[];

  @OneToMany(() => VisibilityProfile, (v) => v.project)
  visibilityProfiles: VisibilityProfile[];
}
