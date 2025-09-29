import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual, createHash } from 'crypto';
import { OrganizationCredentialsRepository } from '@agent-platform/repositories/organization-credentials.repository';
import { OrganizationCredentialRecord } from '@agent-platform/interfaces/organization-credential-record.interface';

type BufferEncodingOption = BufferEncoding | 'base64url';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  private static readonly DEFAULT_ALIAS = 'agent_api_key';

  constructor(
    private readonly credentials: OrganizationCredentialsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader =
      request.headers['x-agent-api-key'] || request.headers['x-api-key'];

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      throw new UnauthorizedException('Agent API key required.');
    }

    const orgSlug = this.extractOrgSlug(request?.params);
    const aliasHeader = this.extractAlias(request?.headers);
    const aliasesToTry = this.buildAliasList(aliasHeader);

    const credential = await this.lookupCredential(orgSlug, aliasesToTry);
    if (!credential) {
      this.logger.warn(
        `No API key credential found for organization ${orgSlug} (aliases: ${aliasesToTry.join(', ')}).`,
      );
      throw new UnauthorizedException('Invalid API key.');
    }

    if (!this.verifyKey(apiKeyHeader, credential)) {
      this.logger.warn(`API key mismatch for organization ${orgSlug}.`);
      throw new UnauthorizedException('Invalid API key.');
    }

    return true;
  }

  private extractOrgSlug(params: Record<string, any> | undefined): string {
    const raw = params?.orgSlug ?? params?.organizationSlug ?? 'global';
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new UnauthorizedException(
        'Organization slug missing from request.',
      );
    }
    return raw;
  }

  private extractAlias(
    headers: Record<string, any> | undefined,
  ): string | null {
    const candidate =
      headers?.['x-agent-key-alias'] || headers?.['x-agent-keyalias'];
    return typeof candidate === 'string' && candidate.trim()
      ? candidate.trim()
      : null;
  }

  private buildAliasList(primary: string | null): string[] {
    const aliases = new Set<string>();
    if (primary) {
      aliases.add(primary);
    }
    aliases.add(ApiKeyGuard.DEFAULT_ALIAS);
    aliases.add('api_key');
    return Array.from(aliases);
  }

  private async lookupCredential(
    organizationSlug: string,
    aliases: string[],
  ): Promise<OrganizationCredentialRecord | null> {
    for (const alias of aliases) {
      try {
        const record = await this.credentials.get(organizationSlug, alias);
        if (record) {
          return record;
        }
      } catch (error) {
        this.logger.error(
          `Credential lookup failed for ${organizationSlug}/${alias}: ${String(error)}`,
        );
        throw new UnauthorizedException('Unable to validate API key.');
      }
    }
    return null;
  }

  private verifyKey(
    providedKey: string,
    credential: OrganizationCredentialRecord,
  ): boolean {
    const metadata = credential.encryption_metadata ?? {};
    const algorithm = this.normalizeAlgorithm(
      metadata.hash_algorithm ?? metadata.hashAlgorithm ?? metadata.hash,
    );
    const encoding = this.normalizeEncoding(
      metadata.encoding ?? (algorithm ? 'base64' : 'utf8'),
    );

    const expected = algorithm
      ? this.hash(providedKey, metadata, algorithm, encoding)
      : providedKey;

    const stored = credential.encrypted_value;

    return this.safeCompare(expected, stored, encoding);
  }

  private normalizeAlgorithm(value: unknown): string | null {
    if (!value || typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    switch (normalized) {
      case 'sha256':
      case 'sha512':
        return normalized;
      default:
        this.logger.warn(
          `Unsupported hash algorithm "${value}" specified for API key credential; rejecting request.`,
        );
        return null;
    }
  }

  private normalizeEncoding(value: unknown): BufferEncodingOption {
    if (!value || typeof value !== 'string') {
      return 'utf8';
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'base64url') {
      return 'base64url';
    }
    const allowed: BufferEncodingOption[] = ['utf8', 'hex', 'latin1', 'base64'];
    return allowed.includes(normalized as BufferEncoding)
      ? (normalized as BufferEncodingOption)
      : 'utf8';
  }

  private hash(
    apiKey: string,
    metadata: Record<string, any>,
    algorithm: string,
    encoding: BufferEncodingOption,
  ): string {
    const salt = typeof metadata.salt === 'string' ? metadata.salt : '';
    const pepperEnv =
      typeof metadata.pepper_env_var === 'string'
        ? metadata.pepper_env_var
        : typeof metadata.pepperEnvVar === 'string'
          ? metadata.pepperEnvVar
          : null;
    const pepper = pepperEnv ? (process.env[pepperEnv] ?? '') : '';
    const input = `${salt}${apiKey}${pepper}`;

    const hash = createHash(algorithm as 'sha256' | 'sha512');
    hash.update(input, 'utf8');
    const digest = hash.digest();

    switch (encoding) {
      case 'hex':
        return digest.toString('hex');
      case 'latin1':
        return digest.toString('latin1');
      case 'base64':
        return digest.toString('base64');
      case 'base64url': {
        const base64 = digest.toString('base64');
        return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      }
      default:
        return digest.toString('utf8');
    }
  }

  private safeCompare(
    expected: string,
    stored: string,
    encoding: BufferEncodingOption,
  ): boolean {
    try {
      const expectedBuffer = this.toBuffer(expected, encoding);
      const storedBuffer = this.toBuffer(stored, encoding);
      if (expectedBuffer.length !== storedBuffer.length) {
        return false;
      }
      return timingSafeEqual(expectedBuffer, storedBuffer);
    } catch (error) {
      this.logger.error(
        `Failed to compare API keys (encoding=${encoding}): ${String(error)}`,
      );
      return false;
    }
  }

  private toBuffer(value: string, encoding: BufferEncodingOption): Buffer {
    if (encoding === 'base64url') {
      const normalized = this.padBase64(
        value.replace(/-/g, '+').replace(/_/g, '/'),
      );
      return Buffer.from(normalized, 'base64');
    }
    return Buffer.from(value, encoding as BufferEncoding);
  }

  private padBase64(value: string): string {
    const padding = value.length % 4;
    if (!padding) {
      return value;
    }
    return value.concat('='.repeat(4 - padding));
  }
}
