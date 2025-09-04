<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Pseudonym Dictionary Management</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content :fullscreen="true">
      <PseudonymDictionaryManager />
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
import PseudonymDictionaryManager from '@/components/PII/PseudonymDictionaryManager.vue';
</script>

<style scoped>
/* Page-specific styles if needed */
</style>
