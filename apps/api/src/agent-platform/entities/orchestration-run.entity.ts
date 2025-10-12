import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrchestrationDefinitionEntity } from './orchestration-definition.entity';

@Entity({ name: 'orchestration_runs' })
@Index('idx_orchestration_runs_status', ['status'])
@Index('idx_orchestration_runs_conversation', ['conversationId'])
@Index('idx_orchestration_runs_parent', ['parentOrchestrationRunId'])
@Index('idx_orchestration_runs_definition', ['orchestrationDefinitionId'])
export class OrchestrationRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId!: string | null;

  @Column({
    name: 'orchestration_definition_id',
    type: 'uuid',
    nullable: true,
  })
  orchestrationDefinitionId!: string | null;

  @ManyToOne(() => OrchestrationDefinitionEntity, { nullable: true })
  @JoinColumn({ name: 'orchestration_definition_id' })
  orchestrationDefinition?: OrchestrationDefinitionEntity | null;

  @Column({ name: 'orchestration_name', type: 'text', nullable: true })
  orchestrationName!: string | null;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId!: string | null;

  @Column({
    name: 'parent_orchestration_run_id',
    type: 'uuid',
    nullable: true,
  })
  parentOrchestrationRunId!: string | null;

  @Column({ name: 'origin_type', type: 'text', default: 'plan' })
  originType!: string;

  @Column({ name: 'origin_id', type: 'uuid', nullable: true })
  originId!: string | null;

  @Column({ name: 'orchestration_slug', type: 'text', nullable: true })
  orchestrationSlug!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  parameters!: Record<string, any>;

  @Column({ name: 'organization_slug', type: 'text', nullable: true })
  organizationSlug!: string | null;

  @Column({ type: 'text', default: 'pending' })
  status!: string;

  @Column({ name: 'current_step_index', type: 'integer', nullable: true })
  currentStepIndex!: number | null;

  @Column({ name: 'current_step_id', type: 'text', nullable: true })
  currentStepId!: string | null;

  @Column({ name: 'completed_steps', type: 'jsonb', default: () => "'[]'::jsonb" })
  completedSteps!: string[];

  @Column({ name: 'step_state', type: 'jsonb', default: () => "'{}'::jsonb" })
  stepState!: Record<string, any>;

  @Column({ name: 'human_checkpoint_id', type: 'text', nullable: true })
  humanCheckpointId!: string | null;

  @Column({ name: 'plan', type: 'jsonb', default: () => "'{}'::jsonb" })
  plan!: Record<string, any>;

  @Column({ name: 'results', type: 'jsonb', default: () => "'{}'::jsonb" })
  results!: Record<string, any>;

  @Column({ name: 'error_details', type: 'jsonb', default: () => "'{}'::jsonb" })
  errorDetails!: Record<string, any>;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;
}
