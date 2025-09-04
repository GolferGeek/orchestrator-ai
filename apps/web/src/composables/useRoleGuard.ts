import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore, UserRole, Permission } from '@/stores/authStore';
import { toastController } from '@ionic/vue';

export interface RoleGuardOptions {
  /** Redirect to access denied page instead of showing toast */
  redirectOnDenied?: boolean;
  /** Custom message for access denied toast */
  deniedMessage?: string;
  /** Roles required for access (user needs ANY of these roles) */
  requiredRoles?: UserRole[];
  /** Roles required for access (user needs ALL of these roles) */
  requiredAllRoles?: UserRole[];
  /** Permissions required for access (user needs ANY of these permissions) */
  requiredPermissions?: Permission[];
  /** Permissions required for access (user needs ALL of these permissions) */
  requiredAllPermissions?: Permission[];
  /** Resource and action for access control */
  resource?: { name: string; action: string };
  /** Show loading state while checking roles */
  showLoading?: boolean;
}

/**
 * Composable for role-based access control in components
 * Provides reactive role checking and access control utilities
 */
export function useRoleGuard(options: RoleGuardOptions = {}) {
  const auth = useAuthStore();
  const router = useRouter();
  
  const isLoading = ref(options.showLoading ?? false);
  
  // Default options
  const {
    redirectOnDenied = false,
    deniedMessage = 'You do not have permission to perform this action.',
    requiredRoles = [],
    requiredAllRoles = [],
    requiredPermissions = [],
    requiredAllPermissions = [],
    resource,
  } = options;

  // Computed access checks
  const hasRequiredAccess = computed(() => {
    if (!auth.user?.roles) return false;
    
    // Check role requirements
    const hasAnyRole = requiredRoles.length === 0 || auth.hasAnyRole(requiredRoles);
    const hasAllRoles = requiredAllRoles.length === 0 || auth.hasAllRoles(requiredAllRoles);
    
    // Check permission requirements
    const hasAnyPermission = requiredPermissions.length === 0 || auth.hasAnyPermission(requiredPermissions);
    const hasAllPermissions = requiredAllPermissions.length === 0 || auth.hasAllPermissions(requiredAllPermissions);
    
    // Check resource-based access
    const hasResourceAccess = !resource || auth.canAccessResource(resource.name, resource.action);
    
    return hasAnyRole && hasAllRoles && hasAnyPermission && hasAllPermissions && hasResourceAccess;
  });

  // Access level checks
  const hasAdminAccess = computed(() => auth.hasAdminAccess);
  const hasEvaluationAccess = computed(() => auth.hasEvaluationAccess);
  const hasDeveloperAccess = computed(() => auth.hasDeveloperAccess);
  const hasSupportAccess = computed(() => auth.hasSupportAccess);

  // Individual role checks
  const isAdmin = computed(() => auth.isAdmin);
  const isDeveloper = computed(() => auth.isDeveloper);
  const isEvaluationMonitor = computed(() => auth.isEvaluationMonitor);
  const isBetaTester = computed(() => auth.isBetaTester);
  const isSupport = computed(() => auth.isSupport);

  /**
   * Check if user has specific role
   */
  const hasRole = (role: UserRole): boolean => {
    return auth.hasRole(role);
  };

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = (roles: UserRole[]): boolean => {
    return auth.hasAnyRole(roles);
  };

  /**
   * Check if user has all of the specified roles
   */
  const hasAllRoles = (roles: UserRole[]): boolean => {
    return auth.hasAllRoles(roles);
  };

  /**
   * Guard function to check access and handle denial
   * Returns true if access is granted, false otherwise
   */
  const checkAccess = async (customRoles?: UserRole[]): Promise<boolean> => {
    isLoading.value = true;
    
    try {
      // Ensure user data is loaded
      if (!auth.user && auth.isAuthenticated) {
        await auth.fetchCurrentUser();
      }

      const rolesToCheck = customRoles || requiredRoles;
      const hasAccess = rolesToCheck.length === 0 || auth.hasAnyRole(rolesToCheck);

      if (!hasAccess) {
        await handleAccessDenied(rolesToCheck);
        return false;
      }

      return true;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Handle access denied scenario
   */
  const handleAccessDenied = async (deniedRoles?: UserRole[]) => {
    if (redirectOnDenied) {
      // Redirect to access denied page
      router.push({
        path: '/access-denied',
        query: {
          requiredRoles: (deniedRoles || requiredRoles).join(','),
          attemptedPath: router.currentRoute.value.fullPath
        }
      });
    } else {
      // Show toast message
      const toast = await toastController.create({
        message: deniedMessage,
        duration: 4000,
        color: 'warning',
        position: 'bottom',
        buttons: [
          {
            text: 'OK',
            role: 'cancel'
          }
        ]
      });
      await toast.present();
    }
  };

  /**
   * Require admin access or handle denial
   */
  const requireAdmin = async (): Promise<boolean> => {
    return checkAccess([UserRole.ADMIN]);
  };

  /**
   * Require evaluation access or handle denial
   */
  const requireEvaluationAccess = async (): Promise<boolean> => {
    return checkAccess([UserRole.ADMIN, UserRole.EVALUATION_MONITOR, UserRole.DEVELOPER]);
  };

  /**
   * Require developer access or handle denial
   */
  const requireDeveloperAccess = async (): Promise<boolean> => {
    return checkAccess([UserRole.ADMIN, UserRole.DEVELOPER]);
  };

  /**
   * Get user's role display names
   */
  const getUserRoleNames = (): string[] => {
    return auth.user?.roles?.map(role => {
      switch (role) {
        case UserRole.ADMIN: return 'Administrator';
        case UserRole.DEVELOPER: return 'Developer';
        case UserRole.EVALUATION_MONITOR: return 'Evaluation Monitor';
        case UserRole.BETA_TESTER: return 'Beta Tester';
        case UserRole.SUPPORT: return 'Support';
        case UserRole.USER: return 'User';
        default: return role;
      }
    }) || ['User'];
  };

  return {
    // Loading state
    isLoading,
    
    // Access checks
    hasRequiredAccess,
    hasAdminAccess,
    hasEvaluationAccess,
    hasDeveloperAccess,
    hasSupportAccess,
    
    // Role checks
    isAdmin,
    isDeveloper,
    isEvaluationMonitor,
    isBetaTester,
    isSupport,
    
    // Helper methods
    hasRole,
    hasAnyRole,
    hasAllRoles,
    checkAccess,
    requireAdmin,
    requireEvaluationAccess,
    requireDeveloperAccess,
    handleAccessDenied,
    getUserRoleNames,
    
    // User info
    user: auth.user,
    userRoles: computed(() => auth.user?.roles || []),
    userRoleNames: computed(() => getUserRoleNames()),
  };
}
