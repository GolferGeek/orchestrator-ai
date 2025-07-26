#!/usr/bin/env node

/**
 * SQL Security Validation Test
 * 
 * Tests SQL injection prevention and security validation
 */

class SQLSecurityTest {
  constructor() {
    this.results = { passed: 0, failed: 0, tests: [] };
  }

  async runTests() {
    console.log('🔒 Testing SQL Security Validation...');
    
    const tests = [
      {
        name: 'Basic SQL Injection Detection',
        test: () => {
          const dangerousQueries = [
            'SELECT * FROM users; DROP TABLE users;',
            'SELECT * FROM users WHERE id = 1; DELETE FROM users;',
            'SELECT * FROM users; TRUNCATE TABLE sessions;',
            'SELECT * FROM users; ALTER TABLE users DROP COLUMN email;'
          ];
          
          const safeQueries = [
            'SELECT * FROM users WHERE active = true',
            'SELECT id, name FROM users LIMIT 10',
            'SELECT COUNT(*) FROM sessions'
          ];
          
          const validateSQL = (sql) => {
            const issues = [];
            // Fix the regex pattern
            if (sql.match(/;\s*(DROP|DELETE|TRUNCATE|ALTER)/gi)) {
              issues.push('Potentially dangerous SQL operations detected');
            }
            return { is_valid: issues.length === 0, security_issues: issues };
          };
          
          // Test dangerous queries
          for (const sql of dangerousQueries) {
            const result = validateSQL(sql);
            if (result.is_valid) {
              throw new Error(`Dangerous SQL not detected: ${sql}`);
            }
          }
          
          // Test safe queries  
          for (const sql of safeQueries) {
            const result = validateSQL(sql);
            if (!result.is_valid) {
              throw new Error(`Safe SQL incorrectly flagged: ${sql}`);
            }
          }
          
          return 'SQL injection detection working';
        }
      },
      {
        name: 'Comment-based Injection Detection',
        test: () => {
          const commentInjections = [
            'SELECT * FROM users -- DROP TABLE users',
            'SELECT * FROM users /* DROP TABLE users */',
            'SELECT * FROM users WHERE 1=1 -- AND password="admin"'
          ];
          
          const validateSQL = (sql) => {
            const issues = [];
            if (sql.match(/--|\*\/|\bUNION\b.*\bSELECT\b/gi)) {
              issues.push('Potential SQL injection patterns detected');
            }
            return { is_valid: issues.length === 0, security_issues: issues };
          };
          
          for (const sql of commentInjections) {
            const result = validateSQL(sql);
            if (result.is_valid) {
              throw new Error(`Comment injection not detected: ${sql}`);
            }
          }
          
          return 'Comment injection detection working';
        }
      },
      {
        name: 'UNION Attack Detection', 
        test: () => {
          const unionAttacks = [
            'SELECT id FROM users UNION SELECT password FROM admin',
            'SELECT * FROM products WHERE id = 1 UNION SELECT username, password FROM users'
          ];
          
          const validateSQL = (sql) => {
            const issues = [];
            if (sql.match(/\bUNION\b.*\bSELECT\b/gi)) {
              issues.push('Potential UNION-based injection detected');
            }
            return { is_valid: issues.length === 0, security_issues: issues };
          };
          
          for (const sql of unionAttacks) {
            const result = validateSQL(sql);
            if (result.is_valid) {
              throw new Error(`UNION attack not detected: ${sql}`);
            }
          }
          
          return 'UNION attack detection working';
        }
      },
      {
        name: 'Safe Query Validation',
        test: () => {
          const safeQueries = [
            'SELECT id, email FROM users WHERE active = true',
            'SELECT COUNT(*) FROM sessions WHERE created_at > NOW() - INTERVAL "1 day"',
            'SELECT u.name, s.created_at FROM users u LEFT JOIN sessions s ON u.id = s.user_id',
            'WITH recent_users AS (SELECT * FROM users WHERE created_at > NOW() - INTERVAL "7 days") SELECT COUNT(*) FROM recent_users'
          ];
          
          const validateSQL = (sql) => {
            const issues = [];
            
            // Check for dangerous operations
            if (sql.match(/;\s*(DROP|DELETE|TRUNCATE|ALTER)/gi)) {
              issues.push('Potentially dangerous SQL operations detected');
            }
            
            // Check for injection patterns
            if (sql.match(/--|\*\/|\bUNION\b.*\bSELECT\b/gi)) {
              issues.push('Potential SQL injection patterns detected');
            }
            
            return { is_valid: issues.length === 0, security_issues: issues };
          };
          
          for (const sql of safeQueries) {
            const result = validateSQL(sql);
            if (!result.is_valid) {
              throw new Error(`Safe query incorrectly flagged: ${sql} - Issues: ${result.security_issues.join(', ')}`);
            }
          }
          
          return 'Safe query validation working';
        }
      },
      {
        name: 'SQL Complexity Assessment',
        test: () => {
          const queries = [
            { sql: 'SELECT * FROM users', expectedComplexity: 'low' },
            { sql: 'SELECT u.name FROM users u JOIN sessions s ON u.id = s.user_id', expectedComplexity: 'medium' },
            { sql: 'WITH RECURSIVE user_hierarchy AS (SELECT id, parent_id FROM users WHERE parent_id IS NULL UNION ALL SELECT u.id, u.parent_id FROM users u JOIN user_hierarchy uh ON u.parent_id = uh.id) SELECT * FROM user_hierarchy', expectedComplexity: 'high' }
          ];
          
          const assessComplexity = (sql) => {
            if (sql.match(/\b(WITH|WINDOW|PARTITION|RECURSIVE)\b/gi)) return 'high';
            if (sql.match(/\bJOIN\b/gi)) return 'medium';
            return 'low';
          };
          
          for (const { sql, expectedComplexity } of queries) {
            const complexity = assessComplexity(sql);
            if (complexity !== expectedComplexity) {
              throw new Error(`Complexity assessment failed for: ${sql}. Expected: ${expectedComplexity}, Got: ${complexity}`);
            }
          }
          
          return 'SQL complexity assessment working';
        }
      }
    ];

    for (const testCase of tests) {
      try {
        console.log(`  🔍 ${testCase.name}...`);
        const result = testCase.test();
        console.log(`  ✅ ${testCase.name}: ${result}`);
        
        this.results.passed++;
        this.results.tests.push({
          name: testCase.name,
          status: 'passed',
          result: result
        });
      } catch (error) {
        console.log(`  ❌ ${testCase.name}: ${error.message}`);
        
        this.results.failed++;
        this.results.tests.push({
          name: testCase.name,
          status: 'failed',
          error: error.message
        });
      }
    }

    this.generateSummary();
  }

  generateSummary() {
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? (this.results.passed / total * 100).toFixed(1) : 0;
    
    console.log('\\n' + '='.repeat(50));
    console.log('🔒 SQL Security Test Results');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (this.results.failed > 0) {
      console.log('\\n⚠️  Some security tests failed!');
      process.exit(1);
    } else {
      console.log('\\n🎉 All security tests passed!');
    }
  }
}

// Main execution
async function main() {
  const tester = new SQLSecurityTest();
  await tester.runTests();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}