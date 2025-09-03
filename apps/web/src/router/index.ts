import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import LandingPage from '../views/LandingPage.vue';
import AgentsPage from '../views/AgentsPage.vue';
import HomePage from '../views/HomePage.vue';
import LoginPage from '../views/LoginPage.vue';
import EvaluationsPage from '../views/EvaluationsPage.vue';
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
    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    if (!token) {
      next({ 
        path: '/login',
        query: { redirect: to.fullPath }
      });
      return;
    }
    // Check if route requires specific roles
    const requiredRoles = to.meta.requiresRole as string[] | undefined;
    if (requiredRoles && requiredRoles.length > 0) {
      try {
        // Get current user info to check roles
        const userDataStr = localStorage.getItem('userData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          const userRoles = userData.roles || ['user'];
          // Check if user has any of the required roles
          const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
          if (!hasRequiredRole) {
            next({ path: '/app/home' }); // Redirect to home if insufficient permissions
            return;
          }
        } else {
          // No user data, redirect to login
          next({ path: '/login', query: { redirect: to.fullPath } });
          return;
        }
      } catch (error) {

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
