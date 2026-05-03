import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import type { GroupData } from '../domain/progress.types';

@Entity('project_progress_blocks')
@Unique(['projectId', 'blockName'])
export class ProjectProgressBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'block_name', length: 64 })
  blockName: string;

  @Column({ name: 'required_data', type: 'jsonb', nullable: true })
  requiredData: GroupData | null;

  @Column({ name: 'built_data', type: 'jsonb', nullable: true })
  builtData: GroupData | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
