<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>PII Pattern Management</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content :fullscreen="true">
      <div class="pii-management-container">
        <!-- Page Header -->
        <div class="page-header">
          <h1>PII Pattern Management</h1>
          <p>Manage patterns for detecting and handling personally identifiable information (PII)</p>
        </div>
        
                        <!-- PIIPatternTable Component -->
                <PIIPatternTable 
                  @edit-pattern="handleEditPattern"
                  @create-pattern="handleCreatePattern"
                />
                
                <!-- Demo: Role Guard Directive Usage -->
                <div class="role-guard-demo" style="margin-top: 2rem; padding: 1rem; background: var(--ion-color-light-shade); border-radius: 8px;">
                  <h3>Role Guard Demo (Admin Only)</h3>
                  <p>The following elements demonstrate role-based protection:</p>
                  
                  <!-- This button will only show for admins -->
                  <ion-button 
                    v-role-guard="{ roles: ['admin'] }"
                    color="danger" 
                    size="small"
                    style="margin-right: 0.5rem;"
                  >
                    Admin Only Button
                  </ion-button>
                  
                  <!-- This button will be disabled for non-developers -->
                  <ion-button 
                    v-role-guard="{ roles: ['developer'], disable: true }"
                    color="secondary" 
                    size="small"
                    style="margin-right: 0.5rem;"
                  >
                    Developer Button (Disabled)
                  </ion-button>
                  
                  <!-- This button will be hidden for non-evaluation-monitors -->
                  <ion-button 
                    v-role-guard="{ roles: ['evaluation-monitor'], hide: true }"
                    color="tertiary" 
                    size="small"
                  >
                    Evaluation Monitor (Hidden)
                  </ion-button>
                </div>
        
        <!-- PIIPatternEditor Modal -->
        <PIIPatternEditor
          :is-open="isEditorOpen"
          :pattern="selectedPattern"
          @close="handleCloseEditor"
          @saved="handlePatternSaved"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent,
  toastController 
} from '@ionic/vue';
import PIIPatternTable from '@/components/PII/PIIPatternTable.vue';
import PIIPatternEditor from '@/components/PII/PIIPatternEditor.vue';
import type { PIIPattern } from '@/types/pii';

// Modal state
const isEditorOpen = ref(false);
const selectedPattern = ref<PIIPattern | null>(null);

// Event handlers
const handleEditPattern = (pattern: PIIPattern) => {
  selectedPattern.value = pattern;
  isEditorOpen.value = true;
};

const handleCreatePattern = () => {
  selectedPattern.value = null;
  isEditorOpen.value = true;
};

const handleCloseEditor = () => {
  isEditorOpen.value = false;
  selectedPattern.value = null;
};

const handlePatternSaved = async (pattern: PIIPattern) => {
  const toast = await toastController.create({
    message: `Pattern "${pattern.name}" ${selectedPattern.value ? 'updated' : 'created'} successfully!`,
    duration: 3000,
    color: 'success',
    position: 'bottom'
  });
  await toast.present();
  
  // Modal will close automatically via the editor component
};
</script>

<style scoped>
.pii-management-container {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
  text-align: center;
}

.page-header h1 {
  font-size: 2rem;
  color: var(--ion-color-primary);
  margin-bottom: 0.5rem;
}

.page-header p {
  color: var(--ion-color-medium);
  font-size: 1.1rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .pii-management-container {
    padding: 0.5rem;
  }
  
  .page-header h1 {
    font-size: 1.5rem;
  }
}
</style>
