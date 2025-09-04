<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>PII Detection Testing</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content :fullscreen="true">
      <PIITestingInterface />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent 
} from '@ionic/vue';
import PIITestingInterface from '@/components/PII/PIITestingInterface.vue';
</script>

<style scoped>
/* Page-specific styles if needed */
</style>
