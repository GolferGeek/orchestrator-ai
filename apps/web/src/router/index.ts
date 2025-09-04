import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import LandingPage from '../views/LandingPage.vue';
import AgentsPage from '../views/AgentsPage.vue';
import HomePage from '../views/HomePage.vue';
import LoginPage from '../views/LoginPage.vue';
import EvaluationsPage from '../views/EvaluationsPage.vue';
import { useAuthStore, UserRole } from '../stores/authStore';
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Landing',
    component: LandingPage,
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/app',
    component: AgentsPage,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/app/home'
      },
      {
        path: 'home',
        name: 'Home',
        component: HomePage,
        meta: { requiresAuth: true }
      },
      {
        path: 'chat',
        name: 'Chat', 
        component: HomePage,
        meta: { requiresAuth: true }
      },
      {
        path: 'evaluations',
        name: 'Evaluations',
        component: EvaluationsPage,
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
        path: 'projects',
        name: 'Projects',
        component: () => import('../views/ProjectsListPage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'projects/new',
        name: 'NewProject',
        component: () => import('../views/NewProjectPage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'projects/:id',
        name: 'ProjectDetail',
        component: () => import('../views/ProjectDetailPage.vue'),
        meta: { requiresAuth: true }
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
    component: LoginPage
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
    
    next();
  } else {
    next();
  }
});
export default router;
