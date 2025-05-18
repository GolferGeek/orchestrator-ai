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
import { ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner } from '@ionic/vue';
// LoginForm component is not directly used here anymore, logic moved to this view for store integration
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const email = ref('');
const password = ref('');

const performLogin = async () => {
  console.log('LoginPage: performLogin called'); // Log call
  const success = await auth.login({ email: email.value, password: password.value });
  if (success) {
    console.log('LoginPage: Login reported as successful by authStore. Redirecting...');
    const redirectPath = route.query.redirect as string || '/';
    router.push(redirectPath);
  } else {
    console.error('LoginPage: Login reported as failed by authStore. Error:', auth.error);
  }
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
</style> 