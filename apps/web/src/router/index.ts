import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import HomePage from '../views/HomePage.vue';
import FastAPIHomePage from '../views/FastAPIHomePage.vue';
import NestJSHomePage from '../views/NestJSHomePage.vue';
import LoginPage from '../views/LoginPage.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/fastapi' // Default to FastAPI for now
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage
  },
  {
    path: '/fastapi',
    name: 'FastAPI',
    component: FastAPIHomePage,
    meta: { requiresAuth: true }
  },
  {
    path: '/nestjs',
    name: 'NestJS', 
    component: NestJSHomePage,
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
    // Check if user is authenticated (you'll need to implement this)
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
