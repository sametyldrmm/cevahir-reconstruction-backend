import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Project } from './project.entity';
import { Worksite } from './worksite.entity';

export type FeatureFlagsJson = Record<string, boolean>;

@Entity('visibility_profiles')
export class VisibilityProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, (p) => p.visibilityProfiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Worksite, (w) => w.visibilityProfiles, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'worksite_id' })
  worksite: Worksite | null;

  @Column({ name: 'feature_flags', type: 'jsonb', default: () => "'{}'" })
  featureFlags: FeatureFlagsJson;

  @Column({ name: 'visible_block_ids', type: 'jsonb', nullable: true })
  visibleBlockIds: string[] | null;

  @Column({ name: 'hidden_block_ids', type: 'jsonb', default: () => "'[]'" })
  hiddenBlockIds: string[];
}
