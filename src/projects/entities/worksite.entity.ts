import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Project } from './project.entity';
import { UserProjectAccess } from './user-project-access.entity';
import { VisibilityProfile } from './visibility-profile.entity';

@Entity('worksites')
@Unique(['projectId', 'code'])
export class Worksite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, (p) => p.worksites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ length: 32 })
  code: string;

  @Column()
  name: string;

  @OneToMany(() => UserProjectAccess, (a) => a.worksite)
  userAccess: UserProjectAccess[];

  @OneToMany(() => VisibilityProfile, (v) => v.worksite)
  visibilityProfiles: VisibilityProfile[];
}
