import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'orchestration_definitions' })
@Unique('orchestration_definitions_owner_version_unique', [
  'ownerAgentSlug',
  'organizationSlug',
  'name',
  'version',
])
@Index('idx_orchestration_definitions_owner', [
  'ownerAgentSlug',
  'organizationSlug',
])
@Index('idx_orchestration_definitions_org_name', [
  'organizationSlug',
  'name',
])
export class OrchestrationDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_agent_slug', type: 'text' })
  ownerAgentSlug!: string;

  @Column({ name: 'organization_slug', type: 'text' })
  organizationSlug!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  @Column({ type: 'text', default: '1.0.0' })
  version!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb' })
  definition!: Record<string, any>;

  @Column({ type: 'text', default: 'active' })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;
}
