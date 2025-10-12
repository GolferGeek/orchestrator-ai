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
import { OrchestrationRunEntity } from './orchestration-run.entity';

@Entity({ name: 'orchestration_steps' })
@Index('idx_orchestration_steps_run', ['orchestrationRunId'])
@Index('idx_orchestration_steps_status', ['status'])
@Index('idx_orchestration_steps_conversation', ['conversationId'])
@Index('idx_orchestration_steps_deliverable', ['deliverableId'])
export class OrchestrationStepEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'orchestration_run_id', type: 'uuid' })
  orchestrationRunId!: string;

  @ManyToOne(() => OrchestrationRunEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orchestration_run_id' })
  orchestrationRun?: OrchestrationRunEntity;

  @Column({ name: 'step_index', type: 'integer' })
  stepIndex!: number;

  @Column({ name: 'step_id', type: 'text', nullable: true })
  stepId!: string | null;

  @Column({ type: 'text', default: 'pending' })
  status!: string;

  @Column({ name: 'agent_slug', type: 'text', nullable: true })
  agentSlug!: string | null;

  @Column({ type: 'text', default: 'BUILD' })
  mode!: string;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId!: string | null;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId!: string | null;

  @Column({ name: 'deliverable_id', type: 'uuid', nullable: true })
  deliverableId!: string | null;

  @Column({
    name: 'depends_on',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  dependsOn!: string[];

  @Column({ name: 'attempt_number', type: 'integer', default: 1 })
  attemptNumber!: number;

  @Column({ name: 'checkpoint_decision', type: 'jsonb', nullable: true })
  checkpointDecision!: Record<string, any> | null;

  @Column({ name: 'checkpoint_decided_by', type: 'uuid', nullable: true })
  checkpointDecidedBy!: string | null;

  @Column({ name: 'checkpoint_decided_at', type: 'timestamptz', nullable: true })
  checkpointDecidedAt!: Date | null;

  @Column({ name: 'invalidated_at', type: 'timestamptz', nullable: true })
  invalidatedAt!: Date | null;

  @Column({ name: 'invalidated_reason', type: 'text', nullable: true })
  invalidatedReason!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  input!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  output!: Record<string, any> | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, any>;

  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails!: Record<string, any> | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
