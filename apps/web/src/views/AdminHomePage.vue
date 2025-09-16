<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Admin Home</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="admin-home">
        <h2>Admin Dashboard</h2>
        <p>Welcome to the admin dashboard. This page provides access to administrative functions.</p>
        
        <ion-list>
          <ion-item button router-link="/app/admin/settings">
            <ion-icon :icon="settingsOutline" slot="start"></ion-icon>
            <ion-label>Admin Settings</ion-label>
          </ion-item>
          <ion-item button router-link="/app/admin/llm-usage">
            <ion-icon :icon="analyticsOutline" slot="start"></ion-icon>
            <ion-label>LLM Usage Analytics</ion-label>
          </ion-item>
          <ion-item button router-link="/app/admin/data-sanitization">
            <ion-icon :icon="shieldCheckmarkOutline" slot="start"></ion-icon>
            <ion-label>Data Sanitization</ion-label>
          </ion-item>
          <ion-item button router-link="/app/admin/audit">
            <ion-icon :icon="documentTextOutline" slot="start"></ion-icon>
            <ion-label>Audit Dashboard</ion-label>
          </ion-item>
        </ion-list>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts" setup>
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonList, 
  IonItem, 
  IonLabel, 
  IonIcon 
} from '@ionic/vue';
import { 
  settingsOutline, 
  analyticsOutline, 
  shieldCheckmarkOutline, 
  documentTextOutline 
} from 'ionicons/icons';
</script>

<style scoped>
.admin-home {
  max-width: 800px;
  margin: 0 auto;
}

.admin-home h2 {
  color: var(--ion-color-primary);
  margin-bottom: 16px;
}

.admin-home p {
  color: var(--ion-color-medium);
  margin-bottom: 24px;
}
</style>
