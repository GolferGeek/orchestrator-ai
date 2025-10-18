import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore, UserRole, Permission } from '@/stores/authStore';
import { useRoleGuard } from '@/composables/useRoleGuard';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as typeof localStorage;

// Mock router
const routerMock = {
  push: vi.fn(),
  currentRoute: { value: { fullPath: '/test' } }
};

vi.mock('vue-router', () => ({
  useRouter: () => routerMock
}));

// Mock Ionic Vue
vi.mock('@ionic/vue', () => ({
  toastController: {
    create: vi.fn(() => Promise.resolve({ present: vi.fn() }))
  }
}));

describe('Access Control System', () => {
  let authStore: ReturnType<typeof useAuthStore>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Create fresh Pinia instance
    setActivePinia(createPinia());
    authStore = useAuthStore();
  });

  describe('AuthStore - Role Management', () => {
    it('should correctly identify admin users', () => {
      // Set user with admin role
      authStore.user = {
        id: 'test-user',
        email: 'admin@test.com',
        roles: [UserRole.ADMIN]
      };

      expect(authStore.isAdmin).toBe(true);
      expect(authStore.hasAdminAccess).toBe(true);
      expect(authStore.hasRole(UserRole.ADMIN)).toBe(true);
    });

    it('should correctly identify non-admin users', () => {
      authStore.user = {
        id: 'test-user',
        email: 'user@test.com',
        roles: [UserRole.USER]
      };

      expect(authStore.isAdmin).toBe(false);
      expect(authStore.hasAdminAccess).toBe(false);
      expect(authStore.hasRole(UserRole.ADMIN)).toBe(false);
      expect(authStore.hasRole(UserRole.USER)).toBe(true);
    });

    it('should handle multiple roles correctly', () => {
      authStore.user = {
        id: 'test-user',
        email: 'dev@test.com',
        roles: [UserRole.USER, UserRole.DEVELOPER, UserRole.BETA_TESTER]
      };

      expect(authStore.hasAnyRole([UserRole.ADMIN, UserRole.DEVELOPER])).toBe(true);
      expect(authStore.hasAllRoles([UserRole.USER, UserRole.DEVELOPER])).toBe(true);
      expect(authStore.hasAllRoles([UserRole.USER, UserRole.ADMIN])).toBe(false);
    });

    it('should handle access level checks', () => {
      authStore.user = {
        id: 'test-user',
        email: 'eval@test.com',
        roles: [UserRole.EVALUATION_MONITOR]
      };

      expect(authStore.hasEvaluationAccess).toBe(true);
      expect(authStore.hasAdminAccess).toBe(false);
      expect(authStore.hasDeveloperAccess).toBe(false);
    });
  });

  describe('AuthStore - Permission System', () => {
    beforeEach(() => {
      authStore.user = {
        id: 'admin-user',
        email: 'admin@test.com',
        roles: [UserRole.ADMIN]
      };
    });

    it('should grant all permissions to admin users', () => {
      const permissions = authStore.getUserPermissions();
      
      expect(permissions).toContain(Permission.CREATE_USERS);
      expect(permissions).toContain(Permission.READ_PII_PATTERNS);
      expect(permissions).toContain(Permission.VIEW_SYSTEM_SETTINGS);
      expect(permissions).toContain(Permission.MANAGE_EVALUATIONS);
    });

    it('should check individual permissions correctly', () => {
      expect(authStore.hasPermission(Permission.CREATE_USERS)).toBe(true);
      expect(authStore.hasPermission(Permission.DELETE_USERS)).toBe(true);
      expect(authStore.hasPermission(Permission.MANAGE_USER_ROLES)).toBe(true);
    });

    it('should check multiple permissions correctly', () => {
      const somePermissions = [Permission.CREATE_USERS, Permission.READ_USERS];
      const allPermissions = [Permission.CREATE_USERS, Permission.READ_USERS, Permission.UPDATE_USERS];
      
      expect(authStore.hasAnyPermission(somePermissions)).toBe(true);
      expect(authStore.hasAllPermissions(allPermissions)).toBe(true);
    });

    it('should deny permissions for regular users', () => {
      authStore.user = {
        id: 'regular-user',
        email: 'user@test.com',
        roles: [UserRole.USER]
      };

      expect(authStore.hasPermission(Permission.CREATE_USERS)).toBe(false);
      expect(authStore.hasPermission(Permission.DELETE_PII_PATTERNS)).toBe(false);
      expect(authStore.hasPermission(Permission.READ_PII_PATTERNS)).toBe(true); // Users can read PII patterns
    });

    it('should grant appropriate permissions to developers', () => {
      authStore.user = {
        id: 'dev-user',
        email: 'dev@test.com',
        roles: [UserRole.DEVELOPER]
      };

      expect(authStore.hasPermission(Permission.ACCESS_DEV_TOOLS)).toBe(true);
      expect(authStore.hasPermission(Permission.VIEW_DEBUG_INFO)).toBe(true);
      expect(authStore.hasPermission(Permission.CREATE_USERS)).toBe(false); // Devs can't create users
    });
  });

  describe('AuthStore - Resource Access Control', () => {
    beforeEach(() => {
      authStore.user = {
        id: 'admin-user',
        email: 'admin@test.com',
        roles: [UserRole.ADMIN]
      };
    });

    it('should grant resource access to authorized users', () => {
      expect(authStore.canAccessResource('users', 'create')).toBe(true);
      expect(authStore.canAccessResource('pii-patterns', 'delete')).toBe(true);
      expect(authStore.canAccessResource('system-settings', 'update')).toBe(true);
    });

    it('should deny resource access to unauthorized users', () => {
      authStore.user = {
        id: 'regular-user',
        email: 'user@test.com',
        roles: [UserRole.USER]
      };

      expect(authStore.canAccessResource('users', 'create')).toBe(false);
      expect(authStore.canAccessResource('pii-patterns', 'delete')).toBe(false);
      expect(authStore.canAccessResource('pii-patterns', 'read')).toBe(true); // Users can read
    });

    it('should deny access to undefined resources', () => {
      expect(authStore.canAccessResource('undefined-resource', 'create')).toBe(false);
      expect(authStore.canAccessResource('users', 'undefined-action')).toBe(false);
    });
  });

  describe('AuthStore - Session Management', () => {
    it('should track session activity', () => {
      authStore.user = {
        id: 'test-user',
        email: 'user@test.com',
        roles: [UserRole.USER]
      };

      // Simulate login
      authStore.sessionStartTime = new Date();
      authStore.lastActivityTime = new Date();

      expect(authStore.isSessionActive).toBe(true);

      // Update activity
      authStore.updateActivity();
      expect(authStore.lastActivityTime).toBeInstanceOf(Date);
    });

    it('should handle session timeout', () => {
      authStore.user = {
        id: 'test-user',
        email: 'user@test.com',
        roles: [UserRole.USER]
      };

      // Set expired session
      const pastTime = new Date(Date.now() - (9 * 60 * 60 * 1000)); // 9 hours ago
      authStore.sessionStartTime = pastTime;
      authStore.lastActivityTime = pastTime;

      expect(authStore.isSessionActive).toBe(false);
    });

    it('should calculate remaining session time', () => {
      authStore.user = {
        id: 'test-user',
        email: 'user@test.com',
        roles: [UserRole.USER]
      };

      authStore.lastActivityTime = new Date();
      const remainingTime = authStore.getRemainingSessionTime();
      
      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(480 * 60 * 1000); // 8 hours max
    });
  });

  describe('AuthStore - Access Logging', () => {
    beforeEach(() => {
      authStore.user = {
        id: 'admin-user',
        email: 'admin@test.com',
        roles: [UserRole.ADMIN]
      };
    });

    it('should log permission checks', () => {
      // Clear any existing logs
      authStore.clearPermissionCache();
      
      // Perform permission check
      authStore.hasPermission(Permission.CREATE_USERS);
      
      const attempts = authStore.getAccessAttempts();
      expect(attempts.length).toBeGreaterThan(0);
      
      const lastAttempt = attempts[attempts.length - 1];
      expect(lastAttempt.resource).toBe('permission');
      expect(lastAttempt.action).toBe(Permission.CREATE_USERS);
      expect(lastAttempt.granted).toBe(true);
    });

    it('should log resource access attempts', () => {
      authStore.clearPermissionCache();
      
      authStore.canAccessResource('users', 'create');
      
      const attempts = authStore.getAccessAttempts();
      const resourceAttempt = attempts.find(a => a.resource === 'users' && a.action === 'create');
      
      expect(resourceAttempt).toBeDefined();
      expect(resourceAttempt?.granted).toBe(true);
    });

    it('should limit access attempt history', () => {
      authStore.clearPermissionCache();
      
      // Generate more than 100 attempts
      for (let i = 0; i < 150; i++) {
        authStore.hasPermission(Permission.READ_PII_PATTERNS);
      }
      
      const attempts = authStore.getAccessAttempts();
      expect(attempts.length).toBeLessThanOrEqual(100);
    });
  });

  describe('AuthStore - Permission Caching', () => {
    beforeEach(() => {
      authStore.user = {
        id: 'admin-user',
        email: 'admin@test.com',
        roles: [UserRole.ADMIN]
      };
      authStore.clearPermissionCache();
    });

    it('should cache permission results', () => {
      // First call should compute and cache
      const result1 = authStore.hasPermission(Permission.CREATE_USERS);
      
      // Second call should use cache
      const result2 = authStore.hasPermission(Permission.CREATE_USERS);
      
      expect(result1).toBe(result2);
      expect(result1).toBe(true);
    });

    it('should clear cache when requested', () => {
      authStore.hasPermission(Permission.CREATE_USERS);
      authStore.clearPermissionCache();
      
      // Cache should be cleared, but result should still be correct
      const result = authStore.hasPermission(Permission.CREATE_USERS);
      expect(result).toBe(true);
    });
  });

  describe('useRoleGuard Composable', () => {
    beforeEach(() => {
      authStore.user = {
        id: 'admin-user',
        email: 'admin@test.com',
        roles: [UserRole.ADMIN]
      };
    });

    it('should provide correct access checks', () => {
      const roleGuard = useRoleGuard({
        requiredRoles: [UserRole.ADMIN]
      });

      expect(roleGuard.hasRequiredAccess.value).toBe(true);
      expect(roleGuard.hasAdminAccess.value).toBe(true);
      expect(roleGuard.isAdmin.value).toBe(true);
    });

    it('should handle permission-based access', () => {
      const roleGuard = useRoleGuard({
        requiredPermissions: [Permission.CREATE_USERS]
      });

      expect(roleGuard.hasRequiredAccess.value).toBe(true);
    });

    it('should handle resource-based access', () => {
      const roleGuard = useRoleGuard({
        resource: { name: 'users', action: 'create' }
      });

      expect(roleGuard.hasRequiredAccess.value).toBe(true);
    });

    it('should deny access for insufficient permissions', () => {
      authStore.user = {
        id: 'regular-user',
        email: 'user@test.com',
        roles: [UserRole.USER]
      };

      const roleGuard = useRoleGuard({
        requiredRoles: [UserRole.ADMIN]
      });

      expect(roleGuard.hasRequiredAccess.value).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should maintain consistency between role and permission checks', () => {
      // Test admin user
      authStore.user = {
        id: 'admin-user',
        email: 'admin@test.com',
        roles: [UserRole.ADMIN]
      };

      const hasAdminRole = authStore.hasRole(UserRole.ADMIN);
      const hasCreateUsersPermission = authStore.hasPermission(Permission.CREATE_USERS);
      const canCreateUsers = authStore.canAccessResource('users', 'create');

      // All should be true for admin
      expect(hasAdminRole).toBe(true);
      expect(hasCreateUsersPermission).toBe(true);
      expect(canCreateUsers).toBe(true);

      // Test regular user
      authStore.user = {
        id: 'regular-user',
        email: 'user@test.com',
        roles: [UserRole.USER]
      };

      const hasUserRole = authStore.hasRole(UserRole.USER);
      const cannotCreateUsers = authStore.hasPermission(Permission.CREATE_USERS);
      const cannotAccessUserResource = authStore.canAccessResource('users', 'create');

      expect(hasUserRole).toBe(true);
      expect(cannotCreateUsers).toBe(false);
      expect(cannotAccessUserResource).toBe(false);
    });

    it('should handle role changes correctly', () => {
      // Start as regular user
      authStore.user = {
        id: 'test-user',
        email: 'test@test.com',
        roles: [UserRole.USER]
      };

      expect(authStore.hasPermission(Permission.CREATE_USERS)).toBe(false);

      // Promote to admin
      authStore.user.roles = [UserRole.USER, UserRole.ADMIN];
      authStore.clearPermissionCache(); // Clear cache to reflect changes

      expect(authStore.hasPermission(Permission.CREATE_USERS)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined user', () => {
      authStore.user = null;

      expect(authStore.isAdmin).toBe(false);
      expect(authStore.hasPermission(Permission.CREATE_USERS)).toBe(false);
      expect(authStore.canAccessResource('users', 'create')).toBe(false);
    });

    it('should handle empty roles array', () => {
      authStore.user = {
        id: 'test-user',
        email: 'test@test.com',
        roles: []
      };

      expect(authStore.hasAnyRole([UserRole.ADMIN])).toBe(false);
      expect(authStore.getUserPermissions()).toEqual([]);
    });

    it('should handle invalid permission checks', () => {
      authStore.user = {
        id: 'admin-user',
        email: 'admin@test.com',
        roles: [UserRole.ADMIN]
      };

      // These should not throw errors
      expect(() => {
        authStore.hasPermission('INVALID_PERMISSION' as Permission);
        authStore.canAccessResource('invalid-resource', 'invalid-action');
      }).not.toThrow();
    });
  });
});
