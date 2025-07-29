import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import HomePage from '../views/HomePage.vue';
import LoginPage from '../views/LoginPage.vue';
import MCPDiscoveryPage from '../views/MCPDiscoveryPage.vue';
import EvaluationsPage from '../views/EvaluationsPage.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage,
    meta: { requiresAuth: true }
  },
  {
    path: '/chat',
    name: 'Chat', 
    component: HomePage,
    meta: { requiresAuth: true }
  },
  {
    path: '/mcp-discovery',
    name: 'MCPDiscovery',
    component: MCPDiscoveryPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/evaluations',
    name: 'Evaluations',
    component: EvaluationsPage,
    meta: { requiresAuth: true }
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

// Navigation guard for authentication
router.beforeEach((to, from, next) => {
  // Check if route requires auth
  if (to.matched.some(record => record.meta.requiresAuth)) {
    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    if (!token) {
      next({ 
        path: '/login',
        query: { redirect: to.fullPath }
      });
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;
