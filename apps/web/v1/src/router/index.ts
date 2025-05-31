import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/authStore'; // Import the auth store
// import HomePage from '../views/HomePage.vue' // Original direct import

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    // Lazy load HomePage component
    component: () => import('../views/HomePage.vue') 
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginPage.vue')
  },
  // {
  //   path: '/signup',
  //   name: 'Signup',
  //   component: () => import('../views/SignupPage.vue') // Assuming SignupPage.vue would be created
  // },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const publicPages = ['/login', '/signup']; // Add any other public paths like /password-reset
  const authRequired = !publicPages.includes(to.path);

  if (authRequired && !authStore.isAuthenticated) {
    // If trying to access a protected route and not authenticated,
    // redirect to login. Store the intended destination to redirect back after login.
    return next({ path: '/login', query: { redirect: to.fullPath } });
  }
  
  // If trying to access login/signup page while already authenticated, redirect to home
  if (!authRequired && authStore.isAuthenticated && (to.path === '/login' || to.path === '/signup')){
      return next('/'); // Or your main authenticated page
  }

  next();
});

export default router
