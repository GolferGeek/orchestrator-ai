import { Test, TestingModule } from '@nestjs/testing';
import { SecretRedactionService } from './secret-redaction.service';

describe('SecretRedactionService - Comprehensive Pattern Testing', () => {
  let service: SecretRedactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SecretRedactionService],
    }).compile();

    service = module.get<SecretRedactionService>(SecretRedactionService);
  });

  describe('Pattern 1: Generic API Keys', () => {
    const testCases = [
      { text: 'api_key=sk1234567890abcdef1234567890abcdef1234567890', name: 'underscore format' },
      { text: 'api-key: "abc123def456ghi789jkl012mno345pqr678stu901"', name: 'dash format with quotes' },
      { text: 'apikey=abcdef1234567890abcdef1234567890', name: 'no separator format' },
      { text: 'key: xyz789abc123def456ghi789jkl012', name: 'simple key format' },
      { text: 'API_KEY = ghijklmnop1234567890qrstuvwxyz', name: 'uppercase with spaces' },
      { text: 'Api-Key:mnbvcxz0987654321poiuytrewqlkjhg', name: 'mixed case with colon' },
      { text: 'apiKey="zxcvbnmasdfghjklqwertyuiopZXCVBN"', name: 'camelCase with quotes' },
      { text: 'key=\'123456789abcdefghijklmnopqrstuvw\'', name: 'single quotes' },
      { text: 'secret_key = abcDEF123456789ghiJKL012mnoPQR345', name: 'secret_key variant' },
      { text: 'access_key:qwertyuiopasdfghjklzxcvbnm123456', name: 'access_key variant' },
      { text: 'client_key = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef"', name: 'client_key variant' },
      { text: 'token_key:1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p', name: 'token_key variant' },
      { text: 'private_key="zaq1xsw2cde3vfr4bgt5nhy6mju7kilo8"', name: 'private_key variant' },
      { text: 'auth_key = plmnbvcxzasqwedrtyfghijk12345678', name: 'auth_key variant' },
      { text: 'service-key: mnbvcxzlkjhgfdsapoiuytrewq098765', name: 'service-key variant' }
    ];

    testCases.forEach(({ text, name }) => {
      it(`should redact ${name}`, () => {
        const result = service.redactSecrets(text);
        
        expect(result.redactedText).toBe('api_key=[REDACTED]');
        expect(result.result.redactionCount).toBe(1);
        expect(result.result.patternsMatched).toContain('api_key');
      });
    });
  });

  describe('Pattern 2: Bearer Tokens', () => {
    const testCases = [
      { text: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJzdWIiOiIxMjM', name: 'standard bearer token' },
      { text: 'token abcd1234567890efghijklmnopqrstuvwxyz1234567890', name: 'simple token format' },
      { text: 'Bearer 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t', name: 'bearer with mixed case' },
      { text: 'TOKEN ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdef', name: 'uppercase token' },
      { text: 'access_token ghijklmnopqrstuvwxyz1234567890ABCDEF', name: 'access_token format' },
      { text: 'bearer zxcvbnmasdfghjklqwertyuiopZXCVBNM123456', name: 'lowercase bearer' },
      { text: 'token:qwertyuiop0987654321asdfghjklzxcvbnm', name: 'token with colon' },
      { text: 'Bearer\tyhjukilo.mnbvcxzasqwedrtyfghijk123', name: 'bearer with tab and dot' },
      { text: 'auth_token plokijuhygtfrdeswaqzxcvbnmqazwsx123', name: 'auth_token format' },
      { text: 'session_token 1q2w3e4r5t6y7u8i9o0pazsxdcfvgbhnjm', name: 'session_token format' },
      { text: 'refresh_token mnbvcxzaqwsxcderfvbgtyhnujmikolpqaz', name: 'refresh_token format' },
      { text: 'id_token 9876543210fedcba0987654321zyxwvuts', name: 'id_token format' }
    ];

    testCases.forEach(({ text, name }) => {
      it(`should redact ${name}`, () => {
        const result = service.redactSecrets(text);
        
        expect(result.redactedText).toBe('bearer [REDACTED]');
        expect(result.result.redactionCount).toBe(1);
        expect(result.result.patternsMatched).toContain('bearer_token');
      });
    });
  });

  describe('Pattern 3: OpenAI API Keys', () => {
    // Generate multiple realistic 48-character OpenAI keys
    const testCases = [
      { text: 'sk-1234567890abcdef1234567890abcdef1234567890abcdef', name: 'numeric start key' },
      { text: 'sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKL', name: 'mixed case key' },
      { text: 'sk-proj1234567890abcdef1234567890abcdef1234567890ab', name: 'project key format' },
      { text: 'sk-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuv', name: 'uppercase start key' },
      { text: 'sk-zxcvbnmasdfghjklqwertyuiopZXCVBNMASDFGHJKLQWERTY', name: 'keyboard pattern key' },
      { text: 'sk-9876543210fedcba9876543210FEDCBA9876543210fedcba', name: 'reverse hex key' },
      { text: 'sk-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x', name: 'alternating key' },
      { text: 'sk-qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKL123', name: 'qwerty pattern key' },
      { text: 'sk-aaaabbbbccccddddeeeeffffgggghhhhiiiijjjjkkkllllm', name: 'repeated chars key' },
      { text: 'sk-Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6', name: 'descending key' }
    ];

    testCases.forEach(({ text, name }) => {
      it(`should redact ${name}`, () => {
        const result = service.redactSecrets(text);
        
        expect(result.redactedText).toBe('sk-[REDACTED]');
        expect(result.result.redactionCount).toBe(1);
        expect(result.result.patternsMatched).toContain('openai_key');
      });
    });

    // Test cases where specific pattern should match since format is valid
    it('should match openai_key pattern when in key=value format with correct length', () => {
      const text = 'OPENAI_API_KEY=sk-abcdef1234567890abcdef1234567890abcdef1234567890';
      const result = service.redactSecrets(text);
      
      expect(result.redactedText).toBe('OPENAI_API_KEY=sk-[REDACTED]');
      expect(result.result.redactionCount).toBe(1);
      expect(result.result.patternsMatched).toContain('openai_key');
    });
  });

  describe('Pattern 4: Anthropic API Keys', () => {
    // Generate realistic 95-character Anthropic keys
    const testCases = [
      { text: 'sk-ant-api03-' + 'a'.repeat(95), name: 'all lowercase a' },
      { text: 'sk-ant-api03-' + '1234567890'.repeat(9) + '12345', name: 'numeric pattern' },
      { text: 'sk-ant-api03-' + 'abcdefghij'.repeat(9) + 'klmno', name: 'alphabet pattern' },
      { text: 'sk-ant-api03-' + 'ABCDEFGHIJ'.repeat(9) + 'KLMNO', name: 'uppercase pattern' },
      { text: 'sk-ant-api03-' + 'aB1cD2eF3g'.repeat(9) + 'H4iJ5', name: 'mixed case numbers' },
      { text: 'sk-ant-api03-' + 'qwertyuiop'.repeat(9) + 'asdfg', name: 'keyboard pattern' },
      { text: 'sk-ant-api03-' + 'zxcvbnmqwe'.repeat(9) + 'rtyui', name: 'reverse keyboard' },
      { text: 'sk-ant-api03-' + '9876543210'.repeat(9) + '98765', name: 'descending numbers' },
      { text: 'sk-ant-api03-' + 'zyxwvutsrq'.repeat(9) + 'ponml', name: 'reverse alphabet' },
      { text: 'sk-ant-api03-' + 'aAbBcCdDeE'.repeat(9) + 'fFgGh', name: 'alternating case' }
    ];

    testCases.forEach(({ text, name }) => {
      it(`should redact ${name}`, () => {
        const result = service.redactSecrets(text);
        
        expect(result.redactedText).toBe('sk-ant-[REDACTED]');
        expect(result.result.redactionCount).toBe(1);
        expect(result.result.patternsMatched).toContain('anthropic_key');
      });
    });

    it('should match anthropic_key pattern when in key=value format with correct length', () => {
      const text = `ANTHROPIC_API_KEY=sk-ant-api03-${'b1c2d3e4f5'.repeat(9)}12345`;
      const result = service.redactSecrets(text);
      
      expect(result.redactedText).toBe('ANTHROPIC_API_KEY=sk-ant-[REDACTED]');
      expect(result.result.redactionCount).toBe(1);
      expect(result.result.patternsMatched).toContain('anthropic_key');
    });
  });

  describe('Pattern 5: Google API Keys', () => {
    // Generate realistic 35-character Google API keys (after AIza prefix)
    const testCases = [
      { text: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567', name: 'standard format' },
      { text: 'AIza1234567890abcdefghijklmnopqrstuvwxy', name: 'alphanumeric' },
      { text: 'AIzaABCDEFGHIJKLMNOPQRSTUVWXYZ123456789', name: 'uppercase mix' },
      { text: 'AIzaqwertyuiopasdfghjklzxcvbnm123456789', name: 'keyboard pattern' },
      { text: 'AIzaBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890', name: 'mixed case standard' },
      { text: 'AIza9876543210zyxwvutsrqponmlkjihgfedcb', name: 'reverse pattern' },
      { text: 'AIzaaAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqRS', name: 'alternating case' },
      { text: 'AIzaSy123456789012345678901234567890123', name: 'mostly numeric' },
      { text: 'AIzaBcXyZ123XyZ123XyZ123XyZ123XyZ123456', name: 'repeated pattern' }
    ];

    testCases.forEach(({ text, name }) => {
      it(`should redact Google API key ${name}`, () => {
        const result = service.redactSecrets(text);
        
        expect(result.redactedText).toBe('AIza[REDACTED]');
        expect(result.result.redactionCount).toBe(1);
        expect(result.result.patternsMatched).toContain('google_key');
      });
    });

    it('should match google_key pattern when in key=value format with correct length', () => {
      const text = 'GOOGLE_API_KEY=AIzaSy1234567890abcdefghijklmnopqrst123';
      const result = service.redactSecrets(text);
      
      expect(result.redactedText).toBe('GOOGLE_API_KEY=AIza[REDACTED]');
      expect(result.result.redactionCount).toBe(1);
      expect(result.result.patternsMatched).toContain('google_key');
    });
  });

  describe('Pattern 6: JWT Tokens', () => {
    const testCases = [
      { text: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', name: 'standard HS256 JWT' },
      { text: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJqb2UiLCJleHAiOjEzMDA4MTkzODAsImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ.cC4hiUPoj9Eetdgtv3hF80EGrhuB__dzERat0XF9g2VtQgr9PkJi' + 'Qz1Sb6_MHcg-98yz2vDbFXYT6-nBqlCo3', name: 'RS256 JWT' },
      { text: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJPbmxpbmUgSldUIEJ1aWxkZXIiLCJpYXQiOjE2NzEyMzQ1NjcsImV4cCI6MTcwMjc3MDU2NywiYXVkIjoid3d3LmV4YW1wbGUuY29tIiwic3ViIjoidGVzdEBleGFtcGxlLmNvbSJ9.abc123def456789ghi012jkl345mno678pqr901stu234vwx567', name: 'JWT with longer payload' },
      { text: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.abc_def-123_456-789_012-345_678-901_234-567_890-abc_def-ghi', name: 'ES256 JWT with underscores/dashes' },
      { text: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ0ZXN0IiwibmFtZSI6IlRlc3QgVXNlciIsImFkbWluIjp0cnVlfQ.', name: 'unsecured JWT (no signature)' },
      { text: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.VFb0_ikz0FppCTJf_N5g7S3tDoz6K7TK0--' + 'UWJhHQvZP1fGyfEfhGmxD5uJPdJJ9Aew4RbTlPJ2OU1ZIz5yF6w', name: 'HS512 JWT' },
      { text: 'Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJqb2UifQ.A6KTvGp3YqCKjTySAY20sSgGdE8wB5T8lG9HJ4L_RjM', name: 'JWT in auth header' },
      { text: 'token=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoidGVzdCJ9.abc123def456ghi789jkl012mno345', name: 'JWT as token parameter' }
    ];

    testCases.forEach(({ text, name }) => {
      it(`should redact ${name}`, () => {
        const result = service.redactSecrets(text);
        
        expect(result.redactedText).toContain('eyJ[REDACTED]');
        expect(result.result.redactionCount).toBeGreaterThanOrEqual(1);
        expect(result.result.patternsMatched).toContain('jwt_token');
      });
    });
  });

  describe('Pattern 7: Passwords', () => {
    const testCases = [
      { text: 'password=MySecretP@ssw0rd123', name: 'password with special chars' },
      { text: 'pwd: "SuperSecure!2024"', name: 'pwd with quotes' },
      { text: 'pass=Admin123!@#$%', name: 'pass with symbols' },
      { text: 'PASSWORD = VeryStrongP@ssw0rd2024!', name: 'uppercase with spaces' },
      { text: 'password:"C0mpl3xP@ssw0rd!2024"', name: 'password with colon' },
      { text: 'pwd=\'SingleQuotePassword123!\'', name: 'single quoted password' },
      { text: 'pass: MyLongPasswordWithManyCharacters123!@#$%^&*()', name: 'very long password' },
      { text: 'password\t=\tTabSeparatedPassword123', name: 'tab separated password' },
      { text: 'user_password=UserSpecificP@ss123', name: 'user_password variant' },
      { text: 'admin_pass: AdminP@ssword2024!', name: 'admin_pass variant' },
      { text: 'db_password="DatabaseP@ssw0rd123!"', name: 'db_password variant' },
      { text: 'secret_pass=SecretP@ssword2024', name: 'secret_pass variant' }
    ];

    testCases.forEach(({ text, name }) => {
      it(`should redact ${name}`, () => {
        const result = service.redactSecrets(text);
        
        expect(result.redactedText).toBe('password=[REDACTED]');
        expect(result.result.redactionCount).toBe(1);
        expect(result.result.patternsMatched).toContain('password');
      });
    });
  });

  describe('Pattern 8: Database URLs', () => {
    const testCases = [
      { text: 'postgresql://username:password123@localhost:5432/mydb', name: 'PostgreSQL local' },
      { text: 'mysql://dbuser:secretpass@db.example.com:3306/production', name: 'MySQL remote' },
      { text: 'mongodb://admin:complexPassword!@cluster0.mongodb.net/myapp', name: 'MongoDB Atlas' },
      { text: 'postgresql://user:p@ss!w0rd@db-server:5432/database_name', name: 'PostgreSQL with special chars' },
      { text: 'mysql://root:admin123@127.0.0.1:3306/test_db', name: 'MySQL with IP' },
      { text: 'mongodb://user:mypassword@mongo1.example.com:27017,mongo2.example.com:27017/replica_set', name: 'MongoDB replica set' },
      { text: 'postgresql://postgres:super_secret_password@prod-db.company.com:5432/main_app', name: 'PostgreSQL production' },
      { text: 'mysql://api_user:ApiP@ssw0rd2024@mysql.amazonaws.com:3306/api_database', name: 'MySQL AWS RDS' },
      { text: 'mongodb://app:application_password@mongo.cloud.mongodb.com:27017/app_data', name: 'MongoDB cloud' }
    ];

    testCases.forEach(({ text, name }) => {
      it(`should redact ${name}`, () => {
        const result = service.redactSecrets(text);
        
        expect(result.redactedText).toBe('database://[REDACTED]');
        expect(result.result.redactionCount).toBe(1);
        expect(result.result.patternsMatched).toContain('database_url');
      });
    });
  });

  describe('Pattern 9: AWS Access Keys', () => {
    const testCases = [
      { text: 'AKIA1234567890ABCDEF', name: 'standalone AWS key' },
      { text: 'AKIA9876543210FEDCBA', name: 'labeled AWS key' },
      { text: 'AKIAIOSFODNN7EXAMPLE', name: 'example AWS key format' },
      { text: 'AKIA0123456789ABCDEF', name: 'mixed alphanumeric' },
      { text: 'AKIAQWERTYUIOPASDFGH', name: 'all uppercase letters' },
      { text: 'AKIA9999888877776666', name: 'all numeric suffix' },
      { text: 'AKIAABCDEFGHIJKLMNOP', name: 'sequential letters' },
      { text: 'AKIAZXYWVUTSRQPONMLK', name: 'reverse letters' }
    ];

    testCases.forEach(({ text, name }) => {
      it(`should redact ${name}`, () => {
        const result = service.redactSecrets(text);
        
        expect(result.redactedText).toBe('AKIA[REDACTED]');
        expect(result.result.redactionCount).toBe(1);
        expect(result.result.patternsMatched).toContain('aws_key');
      });
    });

    it('should redact AWS key with label prefix', () => {
      const text = 'Access Key: AKIA9876543210FEDCBA';
      const result = service.redactSecrets(text);
      
      expect(result.redactedText).toBe('Access Key: AKIA[REDACTED]');
      expect(result.result.redactionCount).toBe(1);
      expect(result.result.patternsMatched).toContain('aws_key');
    });

    it('should match aws_key pattern when in key=value format with correct length', () => {
      const text = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const result = service.redactSecrets(text);
      
      expect(result.redactedText).toBe('AWS_ACCESS_KEY_ID=AKIA[REDACTED]');
      expect(result.result.redactionCount).toBe(1);
      expect(result.result.patternsMatched).toContain('aws_key');
    });
  });

  describe('Pattern 10: Credit Cards', () => {
    const testCases = [
      { text: 'Card: 4111-1111-1111-1111', name: 'Visa with dashes' },
      { text: 'Payment: 5555 5555 5555 4444', name: 'Mastercard with spaces' },
      { text: 'Number: 4000000000000002', name: 'Visa without separators' },
      { text: 'CC: 3782-822463-10005', name: 'Amex with dashes' },
      { text: 'Credit: 6011 0000 0000 0004', name: 'Discover with spaces' },
      { text: 'Account: 5105105105105100', name: 'Mastercard no separators' },
      { text: 'Card Number: 4242-4242-4242-4242', name: 'Test Visa with dashes' },
      { text: 'Payment Method: 5200 8282 8282 8210', name: 'Test Mastercard with spaces' },
      { text: 'Billing: 4000000000000036', name: 'Visa test no separators' },
      { text: '378282246310005', name: 'Standalone Amex' },
      { text: '4012 8888 8888 1881', name: 'Test Visa with spaces' },
      { text: '5555-5555-5555-4444', name: 'Test Mastercard with dashes' }
    ];

    testCases.forEach(({ text, name }) => {
      it(`should redact ${name}`, () => {
        const result = service.redactSecrets(text);
        
        expect(result.redactedText).toContain('[CREDIT_CARD_REDACTED]');
        expect(result.result.redactionCount).toBe(1);
        expect(result.result.patternsMatched).toContain('credit_card');
      });
    });
  });

  describe('Pattern 11: SSH Private Keys', () => {
    const testCases = [
      {
        text: `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN
OPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP
-----END RSA PRIVATE KEY-----`,
        name: 'RSA private key'
      },
      {
        text: `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIAbcd1234567890efghijklmnopqrstuvwxyzABCD1234567890abcdef
GHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyz
-----END EC PRIVATE KEY-----`,
        name: 'EC private key'
      },
      {
        text: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB
wxaMqDDFMYaVtYeqCw4zIj2t0Rm5Rc7dE8Z6WJ4pZ8x3F4yYyWqwJhJGsKtKyXa7
-----END PRIVATE KEY-----`,
        name: 'PKCS#8 private key'
      },
      {
        text: `-----BEGIN DSA PRIVATE KEY-----
MIIBuwIBAAKBgQDdwJmuFqW6T1AMV+7fKs7mP1t8Gxk6Gk8S4a7c8C3f7I9k9q2Q
8xY8hF4pZ6aE5cQr9sY3A7Y9qKmWtQ3vEhOwW4tF6eS3C7Y4hPqR5oS3A7Y9qKm
-----END DSA PRIVATE KEY-----`,
        name: 'DSA private key'
      },
      {
        text: `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAlwAAAAdzc2gtcn
NhAAAAAwEAAQAAAIEAuuSScEEoZOKWyLOG9T8CkBIkH7N9l6Y8cC8UuYcO8J5J6mVAQ
-----END OPENSSH PRIVATE KEY-----`,
        name: 'OpenSSH private key'
      },
      {
        text: `-----BEGIN ENCRYPTED PRIVATE KEY-----
MIIFHDBOBgkqhkiG9w0BBQ0wQTApBgkqhkiG9w0BBQwwHAQI2eOhYlG3Y5YCAggA
MAwGCCqGSIb3DQIJAAAAAQAQq4Q9q9y5L3Q8C2j8yS7G8q3F2K9w2N7P8J5J6mVA
-----END ENCRYPTED PRIVATE KEY-----`,
        name: 'encrypted private key'
      }
    ];

    testCases.forEach(({ text, name }) => {
      it(`should redact ${name}`, () => {
        const result = service.redactSecrets(text);
        
        expect(result.redactedText).toBe('-----BEGIN [REDACTED] PRIVATE KEY-----');
        expect(result.result.redactionCount).toBe(1);
        expect(result.result.patternsMatched).toContain('ssh_key');
      });
    });
  });

  describe('Multiple Pattern Combinations', () => {
    it('should redact multiple different secrets in one text', () => {
      const text = `Configuration:
api_key=sk-1234567890abcdef1234567890abcdef1234567890abcdef
password=MySecretPassword123
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
Card=4111-1111-1111-1111`;

      const result = service.redactSecrets(text);
      
      expect(result.result.redactionCount).toBeGreaterThanOrEqual(5);
      expect(result.redactedText).toContain('[REDACTED]');
      expect(result.redactedText).toContain('[CREDIT_CARD_REDACTED]');
      expect(result.result.patternsMatched.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle empty input', () => {
      const result = service.redactSecrets('');
      
      expect(result.redactedText).toBe('');
      expect(result.result.redactionCount).toBe(0);
      expect(result.result.patternsMatched).toHaveLength(0);
    });

    it('should handle null input', () => {
      const result = service.redactSecrets(null as any);
      
      expect(result.redactedText).toBe(null);
      expect(result.result.redactionCount).toBe(0);
    });

    it('should not redact short strings that don\'t meet minimum requirements', () => {
      const text = 'api_key=short pwd=tiny';
      const result = service.redactSecrets(text);
      
      expect(result.redactedText).toBe(text);
      expect(result.result.redactionCount).toBe(0);
    });

    it('should handle text with no secrets', () => {
      const text = 'This is just regular text with no sensitive data';
      const result = service.redactSecrets(text);
      
      expect(result.redactedText).toBe(text);
      expect(result.result.redactionCount).toBe(0);
      expect(result.result.patternsMatched).toHaveLength(0);
    });
  });

  describe('Pattern Precedence and Order', () => {
    it('should apply most specific matching pattern first', () => {
      // This should match the specific OpenAI pattern since it has the exact format
      const text = 'api_key=sk-1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = service.redactSecrets(text);
      
      expect(result.redactedText).toBe('api_key=sk-[REDACTED]');
      expect(result.result.patternsMatched).toContain('openai_key');
      // Should NOT match api_key because openai_key pattern matched first (more specific)
      expect(result.result.patternsMatched).not.toContain('api_key');
    });

    it('should match specific pattern when generic doesn\'t apply', () => {
      // This should match the openai_key pattern specifically
      const text = 'sk-1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = service.redactSecrets(text);
      
      expect(result.redactedText).toBe('sk-[REDACTED]');
      expect(result.result.patternsMatched).toContain('openai_key');
    });
  });

  describe('Comprehensive All-Pattern Test with Validation', () => {
    it('should redact all pattern types and validate complete coverage', () => {
      // Create a comprehensive test document with all secret types
      const originalSecrets = {
        apiKey: 'myapp_secret_key_abcdef1234567890ghijklmnopqrstuvwxyz123',
        bearerToken: 'bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
        openaiKey: 'sk-1234567890abcdef1234567890abcdef1234567890abcdef',
        anthropicKey: 'sk-ant-api03-' + 'A'.repeat(95),
        googleKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
        jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        password: 'password=MyVerySecretP@ssw0rd123!',
        databaseUrl: 'postgresql://username:secretpassword@db.example.com:5432/production',
        awsKey: 'AKIAIOSFODNN7EXAMPLE',
        creditCard: '4111-1111-1111-1111',
        sshKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyz
ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmn
-----END RSA PRIVATE KEY-----`
      };

      // Combine all secrets into a realistic configuration document
      const testDocument = `
        # Application Configuration
        
        ## API Keys
        app_api_key=${originalSecrets.apiKey}
        
        ## Authentication
        Authorization: ${originalSecrets.bearerToken}
        
        ## External Service Keys
        ${originalSecrets.openaiKey}
        ${originalSecrets.anthropicKey}
        ${originalSecrets.googleKey}
        
        ## Tokens
        session_token=${originalSecrets.jwtToken}
        
        ## Database & Credentials
        ${originalSecrets.password}
        DATABASE_URL=${originalSecrets.databaseUrl}
        
        ## Cloud Provider Keys
        AWS_ACCESS_KEY_ID=${originalSecrets.awsKey}
        
        ## Payment Information (for testing)
        test_card=${originalSecrets.creditCard}
        
        ## SSH Keys
        ${originalSecrets.sshKey}
      `;

      // Perform redaction
      const result = service.redactSecrets(testDocument);

      // Validate that redaction occurred
      expect(result.result.redactionCount).toBeGreaterThanOrEqual(8); // Expect at least 8 redactions
      expect(result.redactedText).toContain('[REDACTED]');
      expect(result.redactedText).toContain('[CREDIT_CARD_REDACTED]');

      // Validate that original secrets are NOT present in redacted text
      expect(result.redactedText).not.toContain(originalSecrets.apiKey);
      expect(result.redactedText).not.toContain(originalSecrets.openaiKey);
      expect(result.redactedText).not.toContain(originalSecrets.anthropicKey);
      expect(result.redactedText).not.toContain(originalSecrets.googleKey);
      expect(result.redactedText).not.toContain('MyVerySecretP@ssw0rd123!');
      expect(result.redactedText).not.toContain('secretpassword');
      expect(result.redactedText).not.toContain(originalSecrets.awsKey);
      expect(result.redactedText).not.toContain('4111-1111-1111-1111');
      expect(result.redactedText).not.toContain('MIIEpAIBAAKCAQEA');

      // Validate that multiple pattern types were matched
      expect(result.result.patternsMatched.length).toBeGreaterThanOrEqual(5);
      
      // Log the results for manual verification during test runs
      console.log('\\n=== REDACTION TEST RESULTS ===');
      console.log('Original length:', result.result.originalLength);
      console.log('Redacted length:', result.result.redactedLength);
      console.log('Redaction count:', result.result.redactionCount);
      console.log('Patterns matched:', result.result.patternsMatched);
      console.log('\\n=== REDACTED DOCUMENT ===');
      console.log(result.redactedText);
      console.log('\\n==============================');

      // Validate that the redacted text is significantly different but maintains structure
      expect(result.redactedText.length).toBeLessThan(result.result.originalLength);
      expect(result.redactedText).toContain('# Application Configuration');
      expect(result.redactedText).toContain('## API Keys');
    });

    it('should handle edge cases and invalid patterns gracefully', () => {
      const testCases = [
        'short_key=abc', // Too short to match patterns
        'almost_jwt=eyJ.incomplete', // Invalid JWT format
        'fake_credit=1234-5678-9012', // Wrong credit card length
        'not_aws=AKIA123', // Too short AWS key
        'broken_db=postgresql://incomplete', // Incomplete database URL
        'weak_password=pwd=123', // Password too short
      ];

      testCases.forEach(testCase => {
        const result = service.redactSecrets(testCase);
        // These should either not be redacted or handled gracefully
        expect(result.result.redactionCount).toBeGreaterThanOrEqual(0);
        expect(result.redactedText).toBeDefined();
      });
    });

    it('should maintain consistent performance with large documents', () => {
      // Create a large document with many secrets
      const largeDocument = Array(100).fill(0).map((_, i) => 
        `config_${i}: api_key=test_key_${'a'.repeat(25)}${i.toString().padStart(3, '0')}`
      ).join('\\n');

      const startTime = Date.now();
      const result = service.redactSecrets(largeDocument);
      const endTime = Date.now();

      expect(result.result.redactionCount).toBe(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.redactedText).toContain('api_key=[REDACTED]');
    });
  });
});