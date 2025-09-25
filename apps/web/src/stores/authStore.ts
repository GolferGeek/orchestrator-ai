import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { authService } from '@/services/authService'; // Removed AuthResponse import from here
import { apiService } from '@/services/apiService';
import { tokenManager } from '@/services/tokenManager';
// Interface for the token data expected from authService login/signup
interface TokenData {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
}
// Define user roles enum to match backend
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  EVALUATION_MONITOR = 'evaluation-monitor',
  BETA_TESTER = 'beta-tester',
  SUPPORT = 'support',
}

// Define granular permissions
export enum Permission {
  // User Management
  CREATE_USERS = 'create_users',
  READ_USERS = 'read_users',
  UPDATE_USERS = 'update_users',
  DELETE_USERS = 'delete_users',
  MANAGE_USER_ROLES = 'manage_user_roles',
  
  // PII Management
  CREATE_PII_PATTERNS = 'create_pii_patterns',
  READ_PII_PATTERNS = 'read_pii_patterns',
  UPDATE_PII_PATTERNS = 'update_pii_patterns',
  DELETE_PII_PATTERNS = 'delete_pii_patterns',
  TEST_PII_DETECTION = 'test_pii_detection',
  
  // Pseudonym Management
  CREATE_PSEUDONYMS = 'create_pseudonyms',
  READ_PSEUDONYMS = 'read_pseudonyms',
  UPDATE_PSEUDONYMS = 'update_pseudonyms',
  DELETE_PSEUDONYMS = 'delete_pseudonyms',
  IMPORT_PSEUDONYMS = 'import_pseudonyms',
  EXPORT_PSEUDONYMS = 'export_pseudonyms',
  
  // System Administration
  VIEW_SYSTEM_SETTINGS = 'view_system_settings',
  UPDATE_SYSTEM_SETTINGS = 'update_system_settings',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_AUDIT_SETTINGS = 'manage_audit_settings',
  
  // Analytics & Monitoring
  VIEW_ANALYTICS = 'view_analytics',
  VIEW_LLM_USAGE = 'view_llm_usage',
  VIEW_EVALUATIONS = 'view_evaluations',
  MANAGE_EVALUATIONS = 'manage_evaluations',
  
  // Development & Testing
  ACCESS_DEV_TOOLS = 'access_dev_tools',
  RUN_TESTS = 'run_tests',
  VIEW_DEBUG_INFO = 'view_debug_info',
}

// Permission mappings for roles
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.READ_PII_PATTERNS,
    Permission.TEST_PII_DETECTION,
    Permission.READ_PSEUDONYMS,
  ],
  [UserRole.ADMIN]: [
    // User Management
    Permission.CREATE_USERS,
    Permission.READ_USERS,
    Permission.UPDATE_USERS,
    Permission.DELETE_USERS,
    Permission.MANAGE_USER_ROLES,
    
    // PII Management
    Permission.CREATE_PII_PATTERNS,
    Permission.READ_PII_PATTERNS,
    Permission.UPDATE_PII_PATTERNS,
    Permission.DELETE_PII_PATTERNS,
    Permission.TEST_PII_DETECTION,
    
    // Pseudonym Management
    Permission.CREATE_PSEUDONYMS,
    Permission.READ_PSEUDONYMS,
    Permission.UPDATE_PSEUDONYMS,
    Permission.DELETE_PSEUDONYMS,
    Permission.IMPORT_PSEUDONYMS,
    Permission.EXPORT_PSEUDONYMS,
    
    // System Administration
    Permission.VIEW_SYSTEM_SETTINGS,
    Permission.UPDATE_SYSTEM_SETTINGS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_AUDIT_SETTINGS,
    
    // Analytics & Monitoring
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_LLM_USAGE,
    Permission.VIEW_EVALUATIONS,
    Permission.MANAGE_EVALUATIONS,
  ],
  [UserRole.DEVELOPER]: [
    Permission.READ_PII_PATTERNS,
    Permission.TEST_PII_DETECTION,
    Permission.READ_PSEUDONYMS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_LLM_USAGE,
    Permission.VIEW_EVALUATIONS,
    Permission.ACCESS_DEV_TOOLS,
    Permission.RUN_TESTS,
    Permission.VIEW_DEBUG_INFO,
  ],
  [UserRole.EVALUATION_MONITOR]: [
    Permission.READ_PII_PATTERNS,
    Permission.READ_PSEUDONYMS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_LLM_USAGE,
    Permission.VIEW_EVALUATIONS,
    Permission.MANAGE_EVALUATIONS,
  ],
  [UserRole.BETA_TESTER]: [
    Permission.READ_PII_PATTERNS,
    Permission.TEST_PII_DETECTION,
    Permission.READ_PSEUDONYMS,
    Permission.RUN_TESTS,
  ],
  [UserRole.SUPPORT]: [
    Permission.READ_USERS,
    Permission.READ_PII_PATTERNS,
    Permission.READ_PSEUDONYMS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.VIEW_ANALYTICS,
  ],
};

// Access attempt logging interface
interface AccessAttempt {
  timestamp: Date;
  resource: string;
  action: string;
  granted: boolean;
  roles: UserRole[];
  permissions?: Permission[];
  reason?: string;
}

// Define a shape for the user object you want to store (fetched from /auth/me)
// This should align with what AuthenticatedUserResponse from backend auth/schemas.py provides
interface UserProfile {
  id: string; // UUID typically comes as string
  email?: string;
  displayName?: string;
  roles: UserRole[]; // Array of user roles
  namespaceAccess: string[];
  // Add other relevant user properties from your /auth/me endpoint
}
export const useAuthStore = defineStore('auth', () => {
  // Core authentication state
  const token = ref<string | null>(localStorage.getItem('authToken'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));
  const user = ref<UserProfile | null>(null); // Store more detailed user info
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isAuthenticated = computed(() => !!token.value);

  // Enhanced access control state
  const permissionCache = ref<Map<string, boolean>>(new Map());
  const accessAttempts = ref<AccessAttempt[]>([]);
  const sessionStartTime = ref<Date | null>(null);
  const lastActivityTime = ref<Date | null>(null);
  const sessionTimeoutMinutes = ref(480); // 8 hours default

  const ACTIVE_NAMESPACE_KEY = 'activeNamespace';
  const ACTIVE_NAMESPACE_USER_KEY = 'activeNamespaceUser';

  const activeNamespace = ref<string | null>(localStorage.getItem(ACTIVE_NAMESPACE_KEY));
  const availableNamespaces = computed(() => user.value?.namespaceAccess ?? []);
  const namespaceError = ref<string | null>(null);

  // Get default from environment variable (defaults to 'demo' if not set)
  const defaultCodebaseLocation = (import.meta.env.VITE_CODEBASE_LOCATION || 'demo').toLowerCase();

  const resolveDefaultNamespace = (namespaces: string[]): string => {
    if (!namespaces.length) {
      if (!namespaceError.value) {
        namespaceError.value = 'No namespaces available for the current user.';
        console.error('[AuthStore] No namespaces granted to the current user.');
      }
      throw new Error('No namespaces available for the current user.');
    }

    if (!defaultCodebaseLocation) {
      if (!namespaceError.value) {
        namespaceError.value = 'Missing VITE_CODEBASE_LOCATION configuration.';
        console.error('[AuthStore] VITE_CODEBASE_LOCATION is not configured.');
      }
      throw new Error('Missing VITE_CODEBASE_LOCATION configuration.');
    }

    if (!namespaces.includes(defaultCodebaseLocation)) {
      const message = `Default namespace "${defaultCodebaseLocation}" is not available for this user.`;
      namespaceError.value = message;
      console.error('[AuthStore]', message, namespaces);
      throw new Error(message);
    }

    namespaceError.value = null;
    return defaultCodebaseLocation;
  };

  const ensureActiveNamespace = (namespaces: string[], userId?: string | null) => {
    const storedUserId = localStorage.getItem(ACTIVE_NAMESPACE_USER_KEY);

    if (userId && storedUserId !== userId) {
      activeNamespace.value = null;
      localStorage.removeItem(ACTIVE_NAMESPACE_KEY);
      if (storedUserId) {
        localStorage.removeItem(ACTIVE_NAMESPACE_USER_KEY);
      }
      namespaceError.value = null;
    }

    if (!namespaces.length) {
      if (!userId) {
        return;
      }

      if (activeNamespace.value !== null) {
        activeNamespace.value = null;
        localStorage.removeItem(ACTIVE_NAMESPACE_KEY);
      }

      localStorage.setItem(ACTIVE_NAMESPACE_USER_KEY, userId);
      apiService.setActiveNamespace(null);
      namespaceError.value = 'No namespaces available for the current user.';
      console.error('[AuthStore] No namespaces available after user/profile load.');
      return;
    }

    const current = activeNamespace.value;
    if (current && namespaces.includes(current)) {
      apiService.setActiveNamespace(current);
      if (userId) {
        localStorage.setItem(ACTIVE_NAMESPACE_USER_KEY, userId);
      }
      namespaceError.value = null;
      return;
    }

    try {
      const nextNamespace = resolveDefaultNamespace(namespaces);
      activeNamespace.value = nextNamespace;
      localStorage.setItem(ACTIVE_NAMESPACE_KEY, nextNamespace);
      if (userId) {
        localStorage.setItem(ACTIVE_NAMESPACE_USER_KEY, userId);
      }
      apiService.setActiveNamespace(nextNamespace);
      namespaceError.value = null;
    } catch (error) {
      activeNamespace.value = null;
      apiService.setActiveNamespace(null);
      console.error('[AuthStore] Unable to resolve active namespace:', error);
    }
  };

  const currentNamespace = computed(() => {
    const namespaces = availableNamespaces.value;
    if (!namespaces.length) {
      namespaceError.value = null;
      return activeNamespace.value || defaultCodebaseLocation;
    }
    if (activeNamespace.value && namespaces.includes(activeNamespace.value)) {
      return activeNamespace.value;
    }
    try {
      return resolveDefaultNamespace(namespaces);
    } catch (error) {
      console.error('[AuthStore] Unable to determine current namespace:', error);
      return null;
    }
  });
  
  // Session management
  const isSessionActive = computed(() => {
    if (!sessionStartTime.value || !lastActivityTime.value) return false;
    const now = new Date();
    const timeSinceLastActivity = now.getTime() - lastActivityTime.value.getTime();
    return timeSinceLastActivity < (sessionTimeoutMinutes.value * 60 * 1000);
  });

  // Update last activity time
  const updateActivity = () => {
    lastActivityTime.value = new Date();
  };

  // Watch for user activity and update timestamp
  watch(isAuthenticated, (newVal) => {
    if (newVal && !sessionStartTime.value) {
      sessionStartTime.value = new Date();
      lastActivityTime.value = new Date();
    } else if (!newVal) {
      sessionStartTime.value = null;
      lastActivityTime.value = null;
      permissionCache.value.clear();
    }
  });

  watch(
    availableNamespaces,
    (namespaces) => {
      ensureActiveNamespace(namespaces, user.value?.id ?? null);
    },
    { immediate: true },
  );

  watch(
    currentNamespace,
    (namespace) => {
      if (namespace) {
        apiService.setActiveNamespace(namespace);
      } else {
        apiService.setActiveNamespace(null);
      }
    },
    { immediate: true },
  );

  // Role-based computed properties
  const isAdmin = computed(() => user.value?.roles?.includes(UserRole.ADMIN) ?? false);
  const isDeveloper = computed(() => user.value?.roles?.includes(UserRole.DEVELOPER) ?? false);
  const isEvaluationMonitor = computed(() => user.value?.roles?.includes(UserRole.EVALUATION_MONITOR) ?? false);
  const isBetaTester = computed(() => user.value?.roles?.includes(UserRole.BETA_TESTER) ?? false);
  const isSupport = computed(() => user.value?.roles?.includes(UserRole.SUPPORT) ?? false);

  // Helper methods for role checking
  const hasRole = (role: UserRole): boolean => {
    return user.value?.roles?.includes(role) ?? false;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.some(role => user.value?.roles?.includes(role)) ?? false;
  };

  const hasAllRoles = (roles: UserRole[]): boolean => {
    return roles.every(role => user.value?.roles?.includes(role)) ?? false;
  };

  // Admin-level access (admin role)
  const hasAdminAccess = computed(() => isAdmin.value);

  // Evaluation access (admin, evaluation-monitor, or developer)
  const hasEvaluationAccess = computed(() => 
    hasAnyRole([UserRole.ADMIN, UserRole.EVALUATION_MONITOR, UserRole.DEVELOPER])
  );

  // Developer access (admin or developer)
  const hasDeveloperAccess = computed(() => 
    hasAnyRole([UserRole.ADMIN, UserRole.DEVELOPER])
  );

  // Support access (admin or support)
  const hasSupportAccess = computed(() => 
    hasAnyRole([UserRole.ADMIN, UserRole.SUPPORT])
  );

  // Permission-based methods
  const getUserPermissions = (): Permission[] => {
    if (!user.value?.roles) return [];
    
    const permissions = new Set<Permission>();
    user.value.roles.forEach(role => {
      ROLE_PERMISSIONS[role]?.forEach(permission => {
        permissions.add(permission);
      });
    });
    
    return Array.from(permissions);
  };

  const hasPermission = (permission: Permission): boolean => {
    updateActivity(); // Track activity
    
    const cacheKey = `permission_${permission}`;
    if (permissionCache.value.has(cacheKey)) {
      return permissionCache.value.get(cacheKey)!;
    }
    
    const userPermissions = getUserPermissions();
    const hasAccess = userPermissions.includes(permission);
    
    // Cache the result for performance
    permissionCache.value.set(cacheKey, hasAccess);
    
    // Log access attempt
    logAccessAttempt({
      resource: 'permission',
      action: permission,
      granted: hasAccess,
      roles: user.value?.roles || [],
      permissions: [permission]
    });
    
    return hasAccess;
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  // Resource access control
  const canAccessResource = (resource: string, action: string): boolean => {
    updateActivity();
    
    const cacheKey = `resource_${resource}_${action}`;
    if (permissionCache.value.has(cacheKey)) {
      return permissionCache.value.get(cacheKey)!;
    }
    
    // Define resource-permission mappings
    const resourcePermissions: Record<string, Record<string, Permission[]>> = {
      'users': {
        'create': [Permission.CREATE_USERS],
        'read': [Permission.READ_USERS],
        'update': [Permission.UPDATE_USERS],
        'delete': [Permission.DELETE_USERS],
        'manage_roles': [Permission.MANAGE_USER_ROLES],
      },
      'pii-patterns': {
        'create': [Permission.CREATE_PII_PATTERNS],
        'read': [Permission.READ_PII_PATTERNS],
        'update': [Permission.UPDATE_PII_PATTERNS],
        'delete': [Permission.DELETE_PII_PATTERNS],
        'test': [Permission.TEST_PII_DETECTION],
      },
      'pseudonyms': {
        'create': [Permission.CREATE_PSEUDONYMS],
        'read': [Permission.READ_PSEUDONYMS],
        'update': [Permission.UPDATE_PSEUDONYMS],
        'delete': [Permission.DELETE_PSEUDONYMS],
        'import': [Permission.IMPORT_PSEUDONYMS],
        'export': [Permission.EXPORT_PSEUDONYMS],
      },
      'system-settings': {
        'read': [Permission.VIEW_SYSTEM_SETTINGS],
        'update': [Permission.UPDATE_SYSTEM_SETTINGS],
      },
      'audit-logs': {
        'read': [Permission.VIEW_AUDIT_LOGS],
        'manage': [Permission.MANAGE_AUDIT_SETTINGS],
      },
      'analytics': {
        'read': [Permission.VIEW_ANALYTICS],
      },
      'evaluations': {
        'read': [Permission.VIEW_EVALUATIONS],
        'manage': [Permission.MANAGE_EVALUATIONS],
      },
    };
    
    const requiredPermissions = resourcePermissions[resource]?.[action];
    if (!requiredPermissions) {
      // If no specific permissions defined, default to deny
      logAccessAttempt({
        resource,
        action,
        granted: false,
        roles: user.value?.roles || [],
        reason: 'No permission mapping defined'
      });
      return false;
    }
    
    const hasAccess = hasAnyPermission(requiredPermissions);
    permissionCache.value.set(cacheKey, hasAccess);
    
    logAccessAttempt({
      resource,
      action,
      granted: hasAccess,
      roles: user.value?.roles || [],
      permissions: requiredPermissions
    });
    
    return hasAccess;
  };

  // Access logging
  const logAccessAttempt = (attempt: Omit<AccessAttempt, 'timestamp'>) => {
    const fullAttempt: AccessAttempt = {
      ...attempt,
      timestamp: new Date()
    };
    
    accessAttempts.value.push(fullAttempt);
    
    // Keep only last 100 access attempts to prevent memory issues
    if (accessAttempts.value.length > 100) {
      accessAttempts.value = accessAttempts.value.slice(-100);
    }
  };

  // Clear permission cache (useful when roles change)
  const clearPermissionCache = () => {
    permissionCache.value.clear();
  };

  // Get access attempts for audit
  const getAccessAttempts = (limit?: number): AccessAttempt[] => {
    return limit ? accessAttempts.value.slice(-limit) : [...accessAttempts.value];
  };

  // Session timeout management
  const extendSession = (minutes?: number) => {
    if (minutes) {
      sessionTimeoutMinutes.value = minutes;
    }
    updateActivity();
  };

  const getRemainingSessionTime = (): number => {
    if (!lastActivityTime.value) return 0;
    const now = new Date();
    const elapsed = now.getTime() - lastActivityTime.value.getTime();
    const remaining = (sessionTimeoutMinutes.value * 60 * 1000) - elapsed;
    return Math.max(0, remaining);
  };

  const hasNamespaceAccess = (namespace: string): boolean => {
    return availableNamespaces.value.includes(namespace);
  };

  const setActiveNamespace = (namespace: string) => {
    if (!availableNamespaces.value.includes(namespace)) {
      return;
    }
    if (activeNamespace.value === namespace) {
      return;
    }
    activeNamespace.value = namespace;
    localStorage.setItem(ACTIVE_NAMESPACE_KEY, namespace);
    if (user.value?.id) {
      localStorage.setItem(ACTIVE_NAMESPACE_USER_KEY, user.value.id);
    }
    apiService.setActiveNamespace(namespace);
    namespaceError.value = null;
  };

  // This function is primarily for internal state update after successful token acquisition
  function setTokenData(tokenData: TokenData) {
    token.value = tokenData.accessToken;
    localStorage.setItem('authToken', tokenData.accessToken);
    if (tokenData.refreshToken) {
      refreshToken.value = tokenData.refreshToken;
      localStorage.setItem('refreshToken', tokenData.refreshToken);
    }
    // Set auth token on API service
    apiService.setAuthToken(tokenData.accessToken);
    error.value = null; // Clear error on successful token set
  }
  function clearAuthData() {
    token.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem(ACTIVE_NAMESPACE_KEY);
    localStorage.removeItem(ACTIVE_NAMESPACE_USER_KEY);
    activeNamespace.value = null;
    // Clear auth from API service
    apiService.clearAuth();
    apiService.setActiveNamespace(null);
    namespaceError.value = null;
  }
  async function login(credentials: { email: string; password: string }) {
    isLoading.value = true;
    error.value = null;
    try {
      const tokenData = await authService.login(credentials);
      setTokenData(tokenData);
      await fetchCurrentUser();
      // Start token monitoring after successful login
      tokenManager.startMonitoring();
      isLoading.value = false;
      return true;
    } catch (e: any) {

      error.value = e.message || 'Login failed in store.';
      clearAuthData();
      isLoading.value = false;
      return false;
    }
  }
  async function signupAndLogin(signupData: any) {
    isLoading.value = true;
    error.value = null;
    try {
      const tokenData = await authService.signup(signupData);
      setTokenData(tokenData);
      await fetchCurrentUser();
      // Start token monitoring after successful signup
      tokenManager.startMonitoring();
      isLoading.value = false;
      return { success: true };
    } catch (e: any) {
      error.value = e.message || 'Signup failed in store.';
      if (e.message && e.message.includes("confirm your account")) {
        isLoading.value = false;
        return { success: false, emailConfirmationPending: true, message: e.message };
      }
      clearAuthData();
      isLoading.value = false;
      return { success: false, message: error.value };
    }
  }
  async function logout() {
    // isLoading.value = true; // Logout is usually quick, maybe not needed
    try {
      await authService.logout(); 
    } catch (e: any) {
    }
    // Stop token monitoring before clearing auth data
    tokenManager.stopMonitoring();
    clearAuthData(); 
    // isLoading.value = false;
  }
  async function refreshAuthToken(): Promise<boolean> {
    try {
      isLoading.value = true;
      error.value = null;
      const tokenData = await authService.refreshToken();
      setTokenData(tokenData);
      // Fetch updated user data
      await fetchCurrentUser();
      return true;
    } catch (e: any) {
      error.value = "Could not refresh authentication token.";
      clearAuthData();
      return false;
    } finally {
      isLoading.value = false;
    }
  }
  async function fetchCurrentUser() {
    if (!token.value) {
      user.value = null;
      localStorage.removeItem('userData');
      return;
    }
    // isLoading.value = true; // This can be a separate loading state if desired, or rely on component
    try {
      const userData = await apiService.getCurrentUser(); 
      user.value = userData;
      ensureActiveNamespace(userData.namespaceAccess || [], userData.id);
      // Store user data in localStorage for router access
      localStorage.setItem('userData', JSON.stringify(userData));
      error.value = null; // Clear previous errors if user fetch is successful
    } catch (e: any) {

      error.value = "Could not fetch user details.";
      if ((e as any).response && (e as any).response.status === 401) {
        clearAuthData(); 
      }
    }
    // finally {
    //   isLoading.value = false;
    // }
  }
  if (token.value) {
    authService.initializeAuthHeader();
    // Initialize auth token on NestJS API service
    apiService.setAuthToken(token.value);
    // Start token monitoring for existing sessions
    tokenManager.startMonitoring();
    fetchCurrentUser();
  }
  return {
    token,
    refreshToken, // Store value
    user,
    isLoading,
    error,
    isAuthenticated,
    availableNamespaces,
    currentNamespace,
    namespaceError,
    setActiveNamespace,
    hasNamespaceAccess,

    // Role-based computed properties
    isAdmin,
    isDeveloper,
    isEvaluationMonitor,
    isBetaTester,
    isSupport,
    
    // Role helper methods
    hasRole,
    hasAnyRole,
    hasAllRoles,
    
    // Access level computed properties
    hasAdminAccess,
    hasEvaluationAccess,
    hasDeveloperAccess,
    hasSupportAccess,
    
    // Permission-based access control
    getUserPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
    
    // Session management
    isSessionActive,
    updateActivity,
    extendSession,
    getRemainingSessionTime,
    sessionStartTime: computed(() => sessionStartTime.value),
    lastActivityTime: computed(() => lastActivityTime.value),
    
    // Access logging and audit
    logAccessAttempt,
    getAccessAttempts,
    clearPermissionCache,
    
    // Auth methods
    login,
    signupAndLogin,
    logout,
    fetchCurrentUser,
    refreshAuthToken, // The function defined above
    clearAuthData
  };
}); 
