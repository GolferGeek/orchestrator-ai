<template>
  <form @submit.prevent="handleLogin">
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
      <ion-button type="submit" expand="block" :disabled="loading">Login</ion-button>
      <ion-text color="danger" v-if="error">{{ error }}</ion-text>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { IonList, IonItem, IonLabel, IonInput, IonButton, IonText } from '@ionic/vue';

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

// Define emits for when login is successful or fails
const emit = defineEmits(['login-success', 'login-failed']);

const handleLogin = async () => {
  error.value = null;
  loading.value = true;
  try {
    // Here you would call your authentication service
    // For now, this is a placeholder.
    // Example: const result = await authService.login(email.value, password.value);
    // if (result.success) {
    //   emit('login-success', result.data);
    // } else {
    //   error.value = result.message || 'Login failed.';
    //   emit('login-failed', error.value);
    // }
    console.log('Attempting login with:', email.value, password.value);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Simulate error for now, or a success to test flow
    // error.value = 'Login failed: Invalid credentials (Simulated)'; 
    // emit('login-failed', error.value);

    // To simulate success:
    emit('login-success', { token: 'fake-jwt-token', user: { email: email.value } });

  } catch (e: any) {
    error.value = e.message || 'An unexpected error occurred.';
    emit('login-failed', error.value);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.ion-padding {
  padding-top: 16px;
}
</style> 