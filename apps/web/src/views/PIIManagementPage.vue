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
                
                <!-- Role Testing Panel (Development/Testing Only) -->
                <RoleTestingPanel v-if="showTestingTools" />
                
                <!-- Demo: Enhanced Access Control System -->
                <div class="access-control-demo" style="margin-top: 2rem; padding: 1rem; background: var(--ion-color-light-shade); border-radius: 8px;">
                  <h3>Enhanced Access Control Demo</h3>
                  <p>The following elements demonstrate role-based and permission-based protection:</p>
                  
                  <!-- Role-based protection -->
                  <div class="demo-section">
                    <h4>Role-Based Access:</h4>
                    <ion-button 
                      v-role-guard="{ roles: ['admin'] }"
                      color="danger" 
                      size="small"
                      style="margin-right: 0.5rem;"
                    >
                      Admin Only
                    </ion-button>
                    
                    <ion-button 
                      v-role-guard="{ roles: ['developer'], disable: true }"
                      color="secondary" 
                      size="small"
                      style="margin-right: 0.5rem;"
                    >
                      Developer (Disabled)
                    </ion-button>
                    
                    <ion-button 
                      v-role-guard="{ roles: ['evaluation-monitor'], hide: true }"
                      color="tertiary" 
                      size="small"
                      style="margin-right: 0.5rem;"
                    >
                      Evaluation Monitor (Hidden)
                    </ion-button>
                  </div>

                  <!-- Permission-based protection -->
                  <div class="demo-section" style="margin-top: 1rem;">
                    <h4>Permission-Based Access:</h4>
                    <ion-button 
                      v-if="auth.hasPermission('CREATE_PII_PATTERNS')"
                      color="success" 
                      size="small"
                      style="margin-right: 0.5rem;"
                      @click="showPermissionDemo('CREATE_PII_PATTERNS')"
                    >
                      Create PII Patterns ✓
                    </ion-button>
                    
                    <ion-button 
                      v-if="auth.hasPermission('DELETE_PII_PATTERNS')"
                      color="warning" 
                      size="small"
                      style="margin-right: 0.5rem;"
                      @click="showPermissionDemo('DELETE_PII_PATTERNS')"
                    >
                      Delete PII Patterns ✓
                    </ion-button>
                    
                    <ion-button 
                      v-if="auth.hasPermission('MANAGE_USER_ROLES')"
                      color="medium" 
                      size="small"
                      style="margin-right: 0.5rem;"
                      @click="showPermissionDemo('MANAGE_USER_ROLES')"
                    >
                      Manage User Roles ✓
                    </ion-button>
                  </div>

                  <!-- Resource-based protection -->
                  <div class="demo-section" style="margin-top: 1rem;">
                    <h4>Resource-Based Access:</h4>
                    <ion-button 
                      v-if="auth.canAccessResource('pii-patterns', 'create')"
                      color="primary" 
                      size="small"
                      style="margin-right: 0.5rem;"
                      @click="showResourceDemo('pii-patterns', 'create')"
                    >
                      Create PII Resource ✓
                    </ion-button>
                    
                    <ion-button 
                      v-if="auth.canAccessResource('users', 'manage_roles')"
                      color="dark" 
                      size="small"
                      style="margin-right: 0.5rem;"
                      @click="showResourceDemo('users', 'manage_roles')"
                    >
                      Manage Users ✓
                    </ion-button>
                  </div>

                  <!-- Session info -->
                  <div class="demo-section" style="margin-top: 1rem;">
                    <h4>Session Information:</h4>
                    <p style="font-size: 0.9rem; margin: 0.5rem 0;">
                      <strong>User Roles:</strong> {{ auth.user?.roles?.join(', ') || 'None' }}
                    </p>
                    <p style="font-size: 0.9rem; margin: 0.5rem 0;">
                      <strong>Permissions:</strong> {{ userPermissions.length }} total
                    </p>
                    <p style="font-size: 0.9rem; margin: 0.5rem 0;">
                      <strong>Session Active:</strong> {{ auth.isSessionActive ? 'Yes' : 'No' }}
                    </p>
                    <p style="font-size: 0.9rem; margin: 0.5rem 0;">
                      <strong>Access Attempts:</strong> {{ accessAttempts.length }} logged
                    </p>
                  </div>
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
import { ref, computed } from 'vue';
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent,
  IonButton,
  toastController 
} from '@ionic/vue';
import PIIPatternTable from '@/components/PII/PIIPatternTable.vue';
import PIIPatternEditor from '@/components/PII/PIIPatternEditor.vue';
import RoleTestingPanel from '@/components/Testing/RoleTestingPanel.vue';
import type { PIIPattern } from '@/types/pii';
import { useAuthStore } from '@/stores/authStore';

// Auth store for access control demo
const auth = useAuthStore();

// Modal state
const isEditorOpen = ref(false);
const selectedPattern = ref<PIIPattern | null>(null);

// Computed properties for demo
const userPermissions = computed(() => auth.getUserPermissions());
const accessAttempts = computed(() => auth.getAccessAttempts());

// Show testing tools in development or for admin users
const showTestingTools = computed(() => {
  return import.meta.env.DEV || auth.hasPermission('ACCESS_DEV_TOOLS');
});

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

// Demo methods for access control
const showPermissionDemo = async (permission: string) => {
  const toast = await toastController.create({
    message: `Permission "${permission}" granted! This demonstrates permission-based access control.`,
    duration: 3000,
    color: 'success',
    position: 'bottom'
  });
  await toast.present();
};

const showResourceDemo = async (resource: string, action: string) => {
  const toast = await toastController.create({
    message: `Resource access granted: ${resource}.${action}. This demonstrates resource-based access control.`,
    duration: 3000,
    color: 'primary',
    position: 'bottom'
  });
  await toast.present();
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
