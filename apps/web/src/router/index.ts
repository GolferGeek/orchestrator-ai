import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
// Dynamic imports for better code splitting - all views loaded on demand
import { useAuthStore, UserRole } from '../stores/authStore';
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Landing',
    component: () => import('../views/landing/demo/DemoLandingPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/landing',
    name: 'LandingPage',
    component: () => import('../views/landing/demo/DemoLandingPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/technical',
    name: 'TechnicalLanding',
    component: () => import('../views/landing/demo/TextualLandingPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/my-org',
    name: 'MyOrgLanding',
    component: () => import('../views/landing/my-org/MyOrgLandingPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/saas',
    name: 'SaasLanding',
    component: () => import('../views/landing/saas/SaasLandingPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/app',
    component: () => import('../views/AgentsPage.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/app/welcome'
      },
      {
        path: 'home',
        name: 'Home',
        component: () => import('../views/HomePage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'welcome',
        name: 'Welcome',
        component: () => import('../views/WelcomePage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'chat',
        name: 'Chat', 
        component: () => import('../views/HomePage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'evaluations',
        name: 'Evaluations',
        component: () => import('../views/EvaluationsPage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'admin/evaluations',
        name: 'AdminEvaluations',
        component: () => import('../views/AdminEvaluationsPage.vue'),
        meta: { requiresAuth: true, requiresRole: ['admin', 'evaluation-monitor'] }
      },
      {
        path: 'admin/llm-usage',
        name: 'AdminLlmUsage',
        component: () => import('../views/admin/LlmUsageView.vue'),
        meta: { requiresAuth: true, requiresRole: ['admin'] }
      },
      {
        path: 'deliverables',
        name: 'Deliverables',
        component: () => import('../views/DeliverablesListPage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'organization',
        name: 'Organization',
        component: () => import('../views/OrganizationPage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'admin/data-sanitization',
        name: 'DataSanitization',
        component: () => import('../views/admin/DataSanitizationPage.vue'),
        meta: { 
          requiresAuth: true, 
          requiresRole: ['admin'],
          title: 'Data Sanitization Dashboard',
          description: 'Manage PII detection, pseudonymization, and data protection policies'
        }
      },
      {
        path: 'admin/pii-patterns',
        name: 'PIIManagement',
        component: () => import('../views/PIIManagementPage.vue'),
        meta: { 
          requiresAuth: true, 
          requiresRole: ['admin'],
          title: 'PII Pattern Management',
          description: 'Manage PII detection patterns and rules'
        }
      },
      {
        path: 'admin/llm-usage/:runId',
        name: 'LLMUsageDetails',
        component: () => import('../views/admin/LLMUsageDetailsPage.vue'),
        meta: { requiresAuth: true, requiresRole: ['admin'] }
      },
      {
        path: 'admin/approvals',
        name: 'AdminApprovals',
        component: () => import('../views/admin/AdminApprovalsView.vue'),
        meta: { requiresAuth: true, requiresRole: ['admin'] }
      },
      {
        path: 'admin/observability',
        name: 'AdminObservability',
        component: () => import('../views/admin/AdminObservabilityView.vue'),
        meta: { 
          requiresAuth: true, 
          requiresRole: ['admin'],
          title: 'System Observability'
        }
      },
      {
        path: 'admin/function-agents',
        name: 'AdminFunctionAgents',
        component: () => import('../views/admin/AdminFunctionAgentsView.vue'),
        meta: { requiresAuth: true, requiresRole: ['admin'] }
      },
      {
        path: 'admin/pii-testing',
        name: 'PIITesting',
        component: () => import('../views/PIITestingPage.vue'),
        meta: { requiresAuth: true, requiresRole: ['admin'] }
      },
      {
        path: 'admin/pseudonym-dictionary',
        name: 'PseudonymDictionary',
        component: () => import('../views/PseudonymDictionaryPage.vue'),
        meta: { requiresAuth: true, requiresRole: ['admin'] }
      },
      {
        path: 'admin/pseudonym-mappings',
        name: 'PseudonymMappings',
        component: () => import('../views/PseudonymMappingPage.vue'),
        meta: { 
          requiresAuth: true, 
          requiresRole: ['admin'],
          title: 'Pseudonym Mapping Viewer',
          description: 'Visualize PII to pseudonym mappings and usage history'
        }
      },
      {
        path: 'admin/settings',
        name: 'AdminSettings',
        component: () => import('../views/AdminSettingsPage.vue'),
        meta: { requiresAuth: true, requiresRole: ['admin'] }
      },
      {
        path: 'admin/audit',
        name: 'AdminAudit',
        component: () => import('../views/AdminAuditDashboard.vue'),
        meta: { 
          requiresAuth: true, 
          requiresRole: ['admin'],
          title: 'Access Control Audit Dashboard',
          description: 'Monitor access attempts and security events'
        }
      }
    ]
  },
  {
    path: '/videos',
    name: 'VideoGallery',
    component: () => import('../views/VideoGalleryPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/login', 
    name: 'Login',
    component: () => import('../views/LoginPage.vue')
  },
  {
    path: '/access-denied',
    name: 'AccessDenied',
    component: () => import('../views/AccessDeniedPage.vue'),
    meta: { requiresAuth: true }
  }
];
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});
// Navigation guard for authentication and roles
router.beforeEach(async (to, from, next) => {
  // Check if route requires auth
  if (to.matched.some(record => record.meta.requiresAuth)) {
    const authStore = useAuthStore();
    
    // Check if user is authenticated
    if (!authStore.isAuthenticated) {
      next({ 
        path: '/login',
        query: { redirect: to.fullPath }
      });
      return;
    }

    // Check if route requires specific roles
    const requiredRoles = to.meta.requiresRole as (string | UserRole)[] | undefined;
    if (requiredRoles && requiredRoles.length > 0) {
      // Ensure user data is loaded
      if (!authStore.user) {
        try {
          await authStore.fetchCurrentUser();
        } catch (error) {
          console.error('Failed to fetch user data for role check:', error);
          next({ path: '/login', query: { redirect: to.fullPath } });
          return;
        }
      }

      if (authStore.user) {
        // Convert string roles to UserRole enum values for consistency
        const normalizedRequiredRoles = requiredRoles.map(role => 
          typeof role === 'string' ? role as UserRole : role
        );
        
        // Check if user has any of the required roles
        const hasRequiredRole = authStore.hasAnyRole(normalizedRequiredRoles);
        
        if (!hasRequiredRole) {
          console.warn(`Access denied. User roles: ${authStore.user.roles}, Required: ${normalizedRequiredRoles}`);
          // Redirect to access denied page with role information
          next({ 
            path: '/access-denied', 
            query: { 
              requiredRoles: normalizedRequiredRoles.join(','),
              attemptedPath: to.fullPath 
            } 
          });
          return;
        }
      } else {
        // No user data available, redirect to login
        next({ path: '/login', query: { redirect: to.fullPath } });
        return;
      }
    }
    
    // If navigating to /app or /app/welcome and user is admin, redirect to admin dashboard
    if ((to.path === '/app' || to.path === '/app/welcome' || to.name === 'Welcome') && authStore.user?.roles?.includes(UserRole.ADMIN)) {
      // Only redirect if not explicitly coming from admin area
      if (!from.path.startsWith('/app/admin')) {
        next({ path: '/app/admin/settings' });
        return;
      }
    }
    
    // If navigating to /app/home and user is admin, prefer the admin dashboard
    // UNLESS there's a specific query parameter or redirect indicating intent to go to home
    if ((to.name === 'Home' || to.path === '/app/home') && authStore.user?.roles?.includes(UserRole.ADMIN)) {
      // Check if there's an active conversation or if coming from agent selection
      const hasActiveConversation = from?.path?.includes('/app/home') || 
                                   to.query?.conversationId || 
                                   to.query?.agentId ||
                                   to.query.forceHome ||
                                   sessionStorage.getItem('activeConversation');
      
      if (!hasActiveConversation && from.path !== '/app') {
        next({ path: '/app/admin/settings' });
        return;
      }
    }
    next();
  } else {
    next();
  }
});
export default router;
