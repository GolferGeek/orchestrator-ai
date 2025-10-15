<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Login</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <!-- Using the LoginForm component is fine, but the action handling should be in the store -->
      <!-- For simplicity here, we directly use the store's login action -->
      <form @submit.prevent="performLogin">
        <ion-list>
          <ion-item>
            <ion-label position="stacked">Email</ion-label>
            <ion-input type="email" v-model="email" required></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Password</ion-label>
            <ion-input type="password" v-model="password" required></ion-input>
          </ion-item>
        </ion-list>
        <div class="ion-padding">
          <ion-button type="submit" expand="block" :disabled="auth.isLoading">
            <ion-spinner v-if="auth.isLoading" name="crescent" slot="start"></ion-spinner>
            Login
          </ion-button>
          <div v-if="hasDemoCreds" class="demo-actions">
            <ion-button expand="block" fill="outline" color="medium" @click="demoLogin" :disabled="auth.isLoading">
              Use Demo Account
            </ion-button>
            <ion-text color="medium" class="demo-hint">
              Prefilled from environment for demos
            </ion-text>
          </div>
          <ion-text color="danger" v-if="auth.error" class="ion-padding-top">{{ auth.error }}</ion-text>
        </div>
      </form>
      <!-- Commenting out link to Signup Page for now -->
      <!--
      <div class="ion-text-center ion-margin-top">
        <p>Don't have an account? <router-link to="/signup">Sign Up</router-link></p>
      </div>
      -->
    </ion-content>
  </ion-page>
</template>
<script lang="ts" setup>
import { ref, computed } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner } from '@ionic/vue';
// LoginForm component is not directly used here anymore, logic moved to this view for store integration
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore, UserRole } from '@/stores/authStore';
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
// Prefill with demo credentials for the playground
const DEMO_EMAIL = 'demo.user@orchestratorai.io';
const DEMO_PASSWORD = 'DemoUser123!';

const email = ref(DEMO_EMAIL);
const password = ref(DEMO_PASSWORD);

// Check if demo credentials are available
const hasDemoCreds = computed(() => {
  return DEMO_EMAIL && DEMO_PASSWORD;
});
const performLogin = async () => {
  const success = await auth.login({ email: email.value, password: password.value });
  if (success) {
    // Check if user is admin and redirect to admin dashboard
    // Access user roles directly instead of computed property for immediate check
    const isUserAdmin = auth.user?.roles?.includes(UserRole.ADMIN);
    if (isUserAdmin) {
      router.push('/app/admin/settings');
    } else {
      const redirectPath = route.query.redirect as string || '/app';
      router.push(redirectPath);
    }
  }
};

const demoLogin = async () => {
  // Fields are already prefilled, but ensure values
  email.value = DEMO_EMAIL;
  password.value = DEMO_PASSWORD;
  await performLogin();
};
</script>
<style scoped>
.ion-padding-top {
  display: block; /* Make ion-text block to allow padding-top */
  padding-top: 8px;
}
.ion-padding {
  padding-top: 16px;
}
.ion-margin-top {
  margin-top: 16px;
}
.demo-actions {
  margin-top: 8px;
}
.demo-hint {
  display: block;
  text-align: center;
  margin-top: 6px;
}
</style> 
