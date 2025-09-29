import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ApiKeyGuard } from './api-key.guard';
import { OrganizationCredentialsRepository } from '@agent-platform/repositories/organization-credentials.repository';
import { OrganizationCredentialRecord } from '@agent-platform/interfaces/organization-credential-record.interface';

const createContext = (
  headers: Record<string, any>,
  params: Record<string, any> = { orgSlug: 'acme' },
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers, params }),
    }),
    getClass: () => undefined,
    getHandler: () => undefined,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => undefined,
    switchToWs: () => undefined,
    getType: () => 'http',
  }) as unknown as ExecutionContext;

const baseRecord: OrganizationCredentialRecord = {
  id: 'cred-1',
  organization_slug: 'acme',
  alias: 'agent_api_key',
  credential_type: 'api_key',
  encrypted_value: '',
  encryption_metadata: {},
  rotated_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('ApiKeyGuard', () => {
  let repo: jest.Mocked<OrganizationCredentialsRepository>;
  let guard: ApiKeyGuard;

  beforeEach(() => {
    repo = {
      get: jest.fn(),
    } as unknown as jest.Mocked<OrganizationCredentialsRepository>;
    guard = new ApiKeyGuard(repo);
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('authorizes matching sha256 key with salt', async () => {
    const metadata = { hash_algorithm: 'sha256', salt: 'xyz', encoding: 'hex' };
    const provided = 'super-secret';
    const digest = createHash('sha256')
      .update(`${metadata.salt}${provided}`)
      .digest('hex');

    repo.get.mockResolvedValue({
      ...baseRecord,
      encrypted_value: digest,
      encryption_metadata: metadata,
    });

    const result = await guard.canActivate(
      createContext({ 'x-agent-api-key': provided }),
    );

    expect(repo.get).toHaveBeenCalledWith('acme', 'agent_api_key');
    expect(result).toBe(true);
  });

  it('authorizes using alias header', async () => {
    const metadata = { hash_algorithm: 'sha256', salt: '', encoding: 'base64' };
    const provided = 'alias-secret';
    const digest = createHash('sha256').update(provided).digest('base64');
    repo.get.mockImplementation(async (_org, alias) => {
      if (alias === 'custom_alias') {
        return {
          ...baseRecord,
          alias,
          encrypted_value: digest,
          encryption_metadata: metadata,
        };
      }
      return null;
    });

    const result = await guard.canActivate(
      createContext({
        'x-agent-api-key': provided,
        'x-agent-key-alias': 'custom_alias',
      }),
    );

    expect(repo.get).toHaveBeenCalledWith('acme', 'custom_alias');
    expect(result).toBe(true);
  });

  it('authorizes plain-text credentials when no hash metadata is provided', async () => {
    repo.get.mockResolvedValue({
      ...baseRecord,
      encrypted_value: 'plain-secret',
      encryption_metadata: { encoding: 'utf8' },
    });

    const result = await guard.canActivate(
      createContext({ 'x-agent-api-key': 'plain-secret' }),
    );

    expect(result).toBe(true);
  });

  it('supports pepper environment variables when hashing', async () => {
    process.env.A2A_PEPPER = 'pepper';
    const metadata = {
      hash_algorithm: 'sha256',
      salt: 'salt-1',
      encoding: 'hex',
      pepper_env_var: 'A2A_PEPPER',
    };
    const provided = 'peppered';
    const digest = createHash('sha256')
      .update(`${metadata.salt}${provided}${process.env.A2A_PEPPER}`)
      .digest('hex');

    repo.get.mockResolvedValue({
      ...baseRecord,
      encrypted_value: digest,
      encryption_metadata: metadata,
    });

    const result = await guard.canActivate(
      createContext({ 'x-agent-api-key': provided }),
    );

    expect(result).toBe(true);
    delete process.env.A2A_PEPPER;
  });

  it('rejects when API key is missing', async () => {
    await expect(guard.canActivate(createContext({}))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(repo.get).not.toHaveBeenCalled();
  });

  it('rejects when credential lookup fails', async () => {
    repo.get.mockResolvedValue(null);

    await expect(
      guard.canActivate(createContext({ 'x-agent-api-key': 'nope' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when computed hash does not match stored value', async () => {
    const metadata = { hash_algorithm: 'sha256', salt: 's', encoding: 'hex' };
    const digest = createHash('sha256').update('swrong').digest('hex');
    repo.get.mockResolvedValue({
      ...baseRecord,
      encrypted_value: digest,
      encryption_metadata: metadata,
    });

    await expect(
      guard.canActivate(createContext({ 'x-agent-api-key': 'different' })),
    ).rejects.toThrow(UnauthorizedException);
  });
});
