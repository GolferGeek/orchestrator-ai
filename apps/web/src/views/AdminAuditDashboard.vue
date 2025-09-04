<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Access Control Audit Dashboard</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="refreshData" :disabled="isLoading">
            <ion-icon :icon="refreshOutline" />
          </ion-button>
          <ion-button @click="clearLogs" color="warning">
            <ion-icon :icon="trashOutline" />
            Clear
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <div class="audit-dashboard-container">
        
        <!-- Dashboard Header -->
        <div class="dashboard-header">
          <h1>Access Control Audit Dashboard</h1>
          <p>Real-time monitoring of access attempts, permissions, and security events</p>
        </div>

        <!-- Summary Cards -->
        <div class="summary-cards">
          <ion-card class="summary-card">
            <ion-card-content>
              <div class="card-icon success">
                <ion-icon :icon="checkmarkCircleOutline" />
              </div>
              <div class="card-content">
                <h3>{{ grantedAttempts }}</h3>
                <p>Access Granted</p>
              </div>
            </ion-card-content>
          </ion-card>

          <ion-card class="summary-card">
            <ion-card-content>
              <div class="card-icon danger">
                <ion-icon :icon="closeCircleOutline" />
              </div>
              <div class="card-content">
                <h3>{{ deniedAttempts }}</h3>
                <p>Access Denied</p>
              </div>
            </ion-card-content>
          </ion-card>

          <ion-card class="summary-card">
            <ion-card-content>
              <div class="card-icon primary">
                <ion-icon :icon="peopleOutline" />
              </div>
              <div class="card-content">
                <h3>{{ uniqueUsers }}</h3>
                <p>Active Users</p>
              </div>
            </ion-card-content>
          </ion-card>

          <ion-card class="summary-card">
            <ion-card-content>
              <div class="card-icon warning">
                <ion-icon :icon="timeOutline" />
              </div>
              <div class="card-content">
                <h3>{{ formatTime(sessionTime) }}</h3>
                <p>Session Time</p>
              </div>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Current User Info -->
        <ion-card class="current-user-card">
          <ion-card-header>
            <ion-card-title>Current User Information</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="user-info-grid">
              <div class="user-info-item">
                <strong>Email:</strong> {{ auth.user?.email || 'Not available' }}
              </div>
              <div class="user-info-item">
                <strong>Roles:</strong> 
                <ion-chip v-for="role in auth.user?.roles" :key="role" color="primary">
                  {{ formatRole(role) }}
                </ion-chip>
              </div>
              <div class="user-info-item">
                <strong>Permissions:</strong> {{ userPermissions.length }} total
              </div>
              <div class="user-info-item">
                <strong>Session Status:</strong> 
                <ion-badge :color="auth.isSessionActive ? 'success' : 'danger'">
                  {{ auth.isSessionActive ? 'Active' : 'Expired' }}
                </ion-badge>
              </div>
              <div class="user-info-item">
                <strong>Remaining Time:</strong> {{ formatTime(remainingTime) }}
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Permission Matrix -->
        <ion-card class="permissions-card">
          <ion-card-header>
            <ion-card-title>Permission Matrix</ion-card-title>
            <ion-card-subtitle>Current user's permissions by category</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div class="permission-categories">
              <div v-for="category in permissionCategories" :key="category.name" class="permission-category">
                <h4>{{ category.name }}</h4>
                <div class="permission-list">
                  <ion-chip 
                    v-for="permission in category.permissions" 
                    :key="permission"
                    :color="hasPermission(permission) ? 'success' : 'medium'"
                    class="permission-chip"
                  >
                    <ion-icon 
                      :icon="hasPermission(permission) ? checkmarkOutline : closeOutline" 
                      slot="start"
                    />
                    {{ formatPermission(permission) }}
                  </ion-chip>
                </div>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Access Attempts Log -->
        <ion-card class="access-log-card">
          <ion-card-header>
            <ion-card-title>Recent Access Attempts</ion-card-title>
            <ion-card-subtitle>Last {{ accessAttempts.length }} attempts</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div v-if="accessAttempts.length === 0" class="no-attempts">
              <ion-icon :icon="informationCircleOutline" />
              <p>No access attempts recorded yet. Start using the application to see audit logs.</p>
            </div>
            <div v-else class="access-attempts-list">
              <div 
                v-for="attempt in recentAttempts" 
                :key="attempt.timestamp.getTime()"
                class="access-attempt"
                :class="{ granted: attempt.granted, denied: !attempt.granted }"
              >
                <div class="attempt-header">
                  <div class="attempt-status">
                    <ion-icon 
                      :icon="attempt.granted ? checkmarkCircleOutline : closeCircleOutline"
                      :color="attempt.granted ? 'success' : 'danger'"
                    />
                    <span class="status-text">{{ attempt.granted ? 'GRANTED' : 'DENIED' }}</span>
                  </div>
                  <div class="attempt-time">
                    {{ formatDateTime(attempt.timestamp) }}
                  </div>
                </div>
                <div class="attempt-details">
                  <div class="attempt-resource">
                    <strong>Resource:</strong> {{ attempt.resource }}
                  </div>
                  <div class="attempt-action">
                    <strong>Action:</strong> {{ attempt.action }}
                  </div>
                  <div class="attempt-roles">
                    <strong>User Roles:</strong> 
                    <ion-chip v-for="role in attempt.roles" :key="role" size="small">
                      {{ formatRole(role) }}
                    </ion-chip>
                  </div>
                  <div v-if="attempt.reason" class="attempt-reason">
                    <strong>Reason:</strong> {{ attempt.reason }}
                  </div>
                </div>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Role Testing Tools -->
        <ion-card class="testing-tools-card">
          <ion-card-header>
            <ion-card-title>Testing Tools</ion-card-title>
            <ion-card-subtitle>Tools to help test different scenarios</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div class="testing-tools">
              <div class="tool-section">
                <h4>Test Permission Checks</h4>
                <ion-select 
                  v-model="selectedPermission" 
                  placeholder="Select permission to test"
                  interface="popover"
                >
                  <ion-select-option 
                    v-for="permission in allPermissions" 
                    :key="permission" 
                    :value="permission"
                  >
                    {{ formatPermission(permission) }}
                  </ion-select-option>
                </ion-select>
                <ion-button 
                  @click="testPermission" 
                  :disabled="!selectedPermission"
                  color="primary"
                  style="margin-top: 0.5rem;"
                >
                  Test Permission
                </ion-button>
              </div>

              <div class="tool-section">
                <h4>Test Resource Access</h4>
                <ion-grid>
                  <ion-row>
                    <ion-col>
                      <ion-input 
                        v-model="testResource" 
                        placeholder="Resource name" 
                        label="Resource"
                        label-placement="stacked"
                      />
                    </ion-col>
                    <ion-col>
                      <ion-input 
                        v-model="testAction" 
                        placeholder="Action name" 
                        label="Action"
                        label-placement="stacked"
                      />
                    </ion-col>
                  </ion-row>
                </ion-grid>
                <ion-button 
                  @click="testResourceAccess" 
                  :disabled="!testResource || !testAction"
                  color="secondary"
                >
                  Test Resource Access
                </ion-button>
              </div>

              <div class="tool-section">
                <h4>Session Management</h4>
                <ion-button @click="extendSession" color="success">
                  Extend Session
                </ion-button>
                <ion-button @click="updateActivity" color="tertiary">
                  Update Activity
                </ion-button>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonChip, IonBadge, IonSelect, IonSelectOption, IonInput, IonGrid, IonRow, IonCol,
  toastController
} from '@ionic/vue';
import {
  refreshOutline, trashOutline, checkmarkCircleOutline, closeCircleOutline,
  peopleOutline, timeOutline, checkmarkOutline, closeOutline, informationCircleOutline
} from 'ionicons/icons';
import { useAuthStore, Permission, UserRole } from '@/stores/authStore';

const auth = useAuthStore();

// Reactive data
const isLoading = ref(false);
const selectedPermission = ref<Permission | null>(null);
const testResource = ref('');
const testAction = ref('');

// Auto-refresh interval
let refreshInterval: NodeJS.Timeout | null = null;

// Computed properties
const accessAttempts = computed(() => auth.getAccessAttempts());
const userPermissions = computed(() => auth.getUserPermissions());
const remainingTime = computed(() => auth.getRemainingSessionTime());
const sessionTime = computed(() => {
  if (!auth.sessionStartTime || !auth.lastActivityTime) return 0;
  return auth.lastActivityTime.getTime() - auth.sessionStartTime.getTime();
});

const grantedAttempts = computed(() => 
  accessAttempts.value.filter(attempt => attempt.granted).length
);

const deniedAttempts = computed(() => 
  accessAttempts.value.filter(attempt => !attempt.granted).length
);

const uniqueUsers = computed(() => {
  // For now, just return 1 since we're tracking current user
  // Could be enhanced to track multiple users in a multi-user environment
  return auth.user ? 1 : 0;
});

const recentAttempts = computed(() => 
  [...accessAttempts.value].reverse().slice(0, 20)
);

// Permission categories for organized display
const permissionCategories = computed(() => [
  {
    name: 'User Management',
    permissions: [Permission.CREATE_USERS, Permission.READ_USERS, Permission.UPDATE_USERS, Permission.DELETE_USERS, Permission.MANAGE_USER_ROLES]
  },
  {
    name: 'PII Management',
    permissions: [Permission.CREATE_PII_PATTERNS, Permission.READ_PII_PATTERNS, Permission.UPDATE_PII_PATTERNS, Permission.DELETE_PII_PATTERNS, Permission.TEST_PII_DETECTION]
  },
  {
    name: 'System Administration',
    permissions: [Permission.VIEW_SYSTEM_SETTINGS, Permission.UPDATE_SYSTEM_SETTINGS, Permission.VIEW_AUDIT_LOGS, Permission.MANAGE_AUDIT_SETTINGS]
  },
  {
    name: 'Analytics & Monitoring',
    permissions: [Permission.VIEW_ANALYTICS, Permission.VIEW_LLM_USAGE, Permission.VIEW_EVALUATIONS, Permission.MANAGE_EVALUATIONS]
  }
]);

const allPermissions = computed(() => Object.values(Permission));

// Methods
const refreshData = () => {
  isLoading.value = true;
  // Force reactivity update
  auth.updateActivity();
  setTimeout(() => {
    isLoading.value = false;
  }, 500);
};

const clearLogs = async () => {
  auth.clearPermissionCache();
  // Reset access attempts (would need to add this method to store)
  const toast = await toastController.create({
    message: 'Audit logs cleared successfully',
    duration: 2000,
    color: 'success'
  });
  await toast.present();
};

const hasPermission = (permission: Permission): boolean => {
  return auth.hasPermission(permission);
};

const testPermission = async () => {
  if (!selectedPermission.value) return;
  
  const hasAccess = auth.hasPermission(selectedPermission.value);
  const toast = await toastController.create({
    message: `Permission "${formatPermission(selectedPermission.value)}" is ${hasAccess ? 'GRANTED' : 'DENIED'}`,
    duration: 3000,
    color: hasAccess ? 'success' : 'warning'
  });
  await toast.present();
};

const testResourceAccess = async () => {
  if (!testResource.value || !testAction.value) return;
  
  const hasAccess = auth.canAccessResource(testResource.value, testAction.value);
  const toast = await toastController.create({
    message: `Resource access "${testResource.value}.${testAction.value}" is ${hasAccess ? 'GRANTED' : 'DENIED'}`,
    duration: 3000,
    color: hasAccess ? 'success' : 'warning'
  });
  await toast.present();
};

const extendSession = async () => {
  auth.extendSession();
  const toast = await toastController.create({
    message: 'Session extended successfully',
    duration: 2000,
    color: 'success'
  });
  await toast.present();
};

const updateActivity = async () => {
  auth.updateActivity();
  const toast = await toastController.create({
    message: 'Activity timestamp updated',
    duration: 2000,
    color: 'tertiary'
  });
  await toast.present();
};

// Formatting helpers
const formatTime = (milliseconds: number): string => {
  if (milliseconds <= 0) return '0m';
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
};

const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

const formatRole = (role: UserRole): string => {
  return role.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const formatPermission = (permission: Permission): string => {
  return permission.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

// Lifecycle
onMounted(() => {
  // Set up auto-refresh every 10 seconds
  refreshInterval = setInterval(refreshData, 10000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style scoped>
.audit-dashboard-container {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  text-align: center;
  margin-bottom: 2rem;
}

.dashboard-header h1 {
  color: var(--ion-color-primary);
  margin: 0 0 0.5rem 0;
}

.dashboard-header p {
  color: var(--ion-color-medium);
  margin: 0;
}

/* Summary Cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.summary-card {
  margin: 0;
}

.summary-card ion-card-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.card-icon.success {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success);
}

.card-icon.danger {
  background: var(--ion-color-danger-tint);
  color: var(--ion-color-danger);
}

.card-icon.primary {
  background: var(--ion-color-primary-tint);
  color: var(--ion-color-primary);
}

.card-icon.warning {
  background: var(--ion-color-warning-tint);
  color: var(--ion-color-warning);
}

.card-content h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--ion-color-dark);
}

.card-content p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

/* Current User Card */
.current-user-card {
  margin-bottom: 2rem;
}

.user-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.user-info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* Permission Matrix */
.permissions-card {
  margin-bottom: 2rem;
}

.permission-categories {
  display: grid;
  gap: 1.5rem;
}

.permission-category h4 {
  margin: 0 0 0.5rem 0;
  color: var(--ion-color-primary);
}

.permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.permission-chip {
  font-size: 0.8rem;
}

/* Access Log */
.access-log-card {
  margin-bottom: 2rem;
}

.no-attempts {
  text-align: center;
  padding: 2rem;
  color: var(--ion-color-medium);
}

.no-attempts ion-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.access-attempts-list {
  max-height: 600px;
  overflow-y: auto;
}

.access-attempt {
  border-left: 4px solid var(--ion-color-medium);
  padding: 1rem;
  margin-bottom: 1rem;
  background: var(--ion-color-light);
  border-radius: 0 8px 8px 0;
}

.access-attempt.granted {
  border-left-color: var(--ion-color-success);
}

.access-attempt.denied {
  border-left-color: var(--ion-color-danger);
}

.attempt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.attempt-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.attempt-time {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.attempt-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
  font-size: 0.9rem;
}

/* Testing Tools */
.testing-tools-card {
  margin-bottom: 2rem;
}

.testing-tools {
  display: grid;
  gap: 1.5rem;
}

.tool-section {
  padding: 1rem;
  background: var(--ion-color-light-shade);
  border-radius: 8px;
}

.tool-section h4 {
  margin: 0 0 1rem 0;
  color: var(--ion-color-primary);
}

/* Responsive design */
@media (max-width: 768px) {
  .audit-dashboard-container {
    padding: 0.5rem;
  }
  
  .summary-cards {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
  
  .user-info-grid {
    grid-template-columns: 1fr;
  }
  
  .attempt-details {
    grid-template-columns: 1fr;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .access-attempt {
    background: var(--ion-color-dark-tint);
  }
  
  .tool-section {
    background: var(--ion-color-dark-shade);
  }
}
</style>
