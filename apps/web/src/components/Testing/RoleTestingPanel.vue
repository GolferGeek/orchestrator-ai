<template>
  <ion-card class="role-testing-panel">
    <ion-card-header>
      <ion-card-title>
        <ion-icon :icon="flaskOutline" />
        Role Testing Panel
      </ion-card-title>
      <ion-card-subtitle>Switch between different user roles for testing</ion-card-subtitle>
    </ion-card-header>
    <ion-card-content>
      
      <!-- Current User Display -->
      <div class="current-user-section">
        <h4>Current Test User</h4>
        <div class="user-display">
          <div class="user-info">
            <strong>{{ currentTestUser.displayName }}</strong>
            <span class="user-email">{{ currentTestUser.email }}</span>
          </div>
          <div class="user-roles">
            <ion-chip 
              v-for="role in currentTestUser.roles" 
              :key="role" 
              :color="getRoleColor(role)"
              size="small"
            >
              {{ formatRole(role) }}
            </ion-chip>
          </div>
        </div>
      </div>

      <!-- Role Selection -->
      <div class="role-selection-section">
        <h4>Switch to Test User</h4>
        <div class="test-users-grid">
          <ion-button
            v-for="testUser in testUsers"
            :key="testUser.id"
            @click="switchToUser(testUser)"
            :fill="isCurrentUser(testUser) ? 'solid' : 'outline'"
            :color="isCurrentUser(testUser) ? 'primary' : 'medium'"
            size="small"
            class="test-user-button"
          >
            <div class="button-content">
              <div class="button-title">{{ testUser.displayName }}</div>
              <div class="button-roles">{{ testUser.roles.join(', ') }}</div>
            </div>
          </ion-button>
        </div>
      </div>

      <!-- Custom Role Builder -->
      <div class="custom-role-section">
        <h4>Custom Role Builder</h4>
        <div class="role-builder">
          <ion-input
            v-model="customUser.displayName"
            placeholder="Display Name"
            label="Display Name"
            label-placement="stacked"
            class="custom-input"
          />
          <ion-input
            v-model="customUser.email"
            placeholder="email@example.com"
            label="Email"
            label-placement="stacked"
            class="custom-input"
          />
          <div class="role-checkboxes">
            <ion-item v-for="role in availableRoles" :key="role" lines="none">
              <ion-checkbox
                :checked="customUser.roles.includes(role)"
                @ionChange="toggleCustomRole(role, $event.detail.checked)"
                slot="start"
              />
              <ion-label>{{ formatRole(role) }}</ion-label>
            </ion-item>
          </div>
          <ion-button
            @click="switchToCustomUser"
            :disabled="!customUser.displayName || customUser.roles.length === 0"
            color="secondary"
            expand="block"
          >
            Apply Custom User
          </ion-button>
        </div>
      </div>

      <!-- Permission Preview -->
      <div class="permission-preview-section">
        <h4>Current User Permissions</h4>
        <div class="permission-categories">
          <div v-for="category in permissionCategories" :key="category.name" class="permission-category">
            <h5>{{ category.name }}</h5>
            <div class="permission-chips">
              <ion-chip
                v-for="permission in category.permissions"
                :key="permission"
                :color="hasPermission(permission) ? 'success' : 'medium'"
                size="small"
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
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions-section">
        <h4>Quick Test Actions</h4>
        <div class="action-buttons">
          <ion-button @click="testAllPermissions" color="tertiary" size="small">
            Test All Permissions
          </ion-button>
          <ion-button @click="testResourceAccess" color="warning" size="small">
            Test Resource Access
          </ion-button>
          <ion-button @click="generateAuditReport" color="success" size="small">
            Generate Audit Report
          </ion-button>
          <ion-button @click="resetToOriginal" color="medium" size="small">
            Reset to Original
          </ion-button>
        </div>
      </div>

    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonButton, IonIcon, IonChip, IonInput, IonItem, IonLabel, IonCheckbox,
  toastController
} from '@ionic/vue';
import {
  flaskOutline, checkmarkOutline, closeOutline
} from 'ionicons/icons';
import { useAuthStore, UserRole, Permission } from '@/stores/authStore';

const auth = useAuthStore();

// Test user data
const testUsers = ref([
  {
    id: 'admin-test',
    email: 'admin@test.local',
    displayName: 'Admin User',
    roles: [UserRole.ADMIN]
  },
  {
    id: 'developer-test',
    email: 'dev@test.local',
    displayName: 'Developer',
    roles: [UserRole.DEVELOPER]
  },
  {
    id: 'evaluation-test',
    email: 'eval@test.local',
    displayName: 'Evaluation Monitor',
    roles: [UserRole.EVALUATION_MONITOR]
  },
  {
    id: 'support-test',
    email: 'support@test.local',
    displayName: 'Support User',
    roles: [UserRole.SUPPORT]
  },
  {
    id: 'beta-test',
    email: 'beta@test.local',
    displayName: 'Beta Tester',
    roles: [UserRole.BETA_TESTER]
  },
  {
    id: 'regular-test',
    email: 'user@test.local',
    displayName: 'Regular User',
    roles: [UserRole.USER]
  },
  {
    id: 'multi-role-test',
    email: 'multi@test.local',
    displayName: 'Multi-Role User',
    roles: [UserRole.USER, UserRole.DEVELOPER, UserRole.BETA_TESTER]
  },
  {
    id: 'no-roles-test',
    email: 'none@test.local',
    displayName: 'No Roles User',
    roles: []
  }
]);

// Custom user builder
const customUser = ref({
  displayName: '',
  email: '',
  roles: [] as UserRole[]
});

// Original user (to restore later)
const originalUser = ref(null);

// Available roles for custom builder
const availableRoles = Object.values(UserRole);

// Current test user
const currentTestUser = computed(() => {
  return auth.user || {
    id: 'unknown',
    email: 'unknown@test.local',
    displayName: 'Unknown User',
    roles: []
  };
});

// Permission categories for display
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
    name: 'Analytics & Development',
    permissions: [Permission.VIEW_ANALYTICS, Permission.VIEW_EVALUATIONS, Permission.ACCESS_DEV_TOOLS, Permission.RUN_TESTS, Permission.VIEW_DEBUG_INFO]
  }
]);

// Methods
const switchToUser = async (testUser: Record<string, unknown>) => {
  // Store original user if not already stored
  if (!originalUser.value) {
    originalUser.value = auth.user;
  }

  // Switch to test user
  auth.user = {
    id: testUser.id,
    email: testUser.email,
    displayName: testUser.displayName,
    roles: testUser.roles
  };

  // Clear permission cache to reflect new roles
  auth.clearPermissionCache();

  const toast = await toastController.create({
    message: `Switched to test user: ${testUser.displayName}`,
    duration: 2000,
    color: 'primary'
  });
  await toast.present();
};

const switchToCustomUser = async () => {
  if (!customUser.value.displayName || customUser.value.roles.length === 0) {
    return;
  }

  const testUser = {
    id: 'custom-test',
    email: customUser.value.email || 'custom@test.local',
    displayName: customUser.value.displayName,
    roles: customUser.value.roles
  };

  await switchToUser(testUser);
};

const toggleCustomRole = (role: UserRole, checked: boolean) => {
  if (checked) {
    if (!customUser.value.roles.includes(role)) {
      customUser.value.roles.push(role);
    }
  } else {
    customUser.value.roles = customUser.value.roles.filter(r => r !== role);
  }
};

const isCurrentUser = (testUser: Record<string, unknown>): boolean => {
  return auth.user?.id === testUser.id;
};

const hasPermission = (permission: Permission): boolean => {
  return auth.hasPermission(permission);
};

const resetToOriginal = async () => {
  if (originalUser.value) {
    auth.user = originalUser.value;
    auth.clearPermissionCache();
    originalUser.value = null;

    const toast = await toastController.create({
      message: 'Reset to original user',
      duration: 2000,
      color: 'success'
    });
    await toast.present();
  }
};

const testAllPermissions = async () => {
  const allPermissions = Object.values(Permission);
  const grantedCount = allPermissions.filter(p => auth.hasPermission(p)).length;
  
  const toast = await toastController.create({
    message: `Permission Test Complete: ${grantedCount}/${allPermissions.length} permissions granted`,
    duration: 3000,
    color: 'tertiary'
  });
  await toast.present();
};

const testResourceAccess = async () => {
  const resources = [
    { name: 'users', action: 'create' },
    { name: 'users', action: 'read' },
    { name: 'pii-patterns', action: 'create' },
    { name: 'pii-patterns', action: 'delete' },
    { name: 'system-settings', action: 'update' },
    { name: 'audit-logs', action: 'read' }
  ];

  const grantedCount = resources.filter(r => 
    auth.canAccessResource(r.name, r.action)
  ).length;

  const toast = await toastController.create({
    message: `Resource Access Test: ${grantedCount}/${resources.length} resources accessible`,
    duration: 3000,
    color: 'warning'
  });
  await toast.present();
};

const generateAuditReport = async () => {
  const attempts = auth.getAccessAttempts();
  const grantedCount = attempts.filter(a => a.granted).length;
  const deniedCount = attempts.filter(a => !a.granted).length;

  const toast = await toastController.create({
    message: `Audit Report: ${attempts.length} total attempts (${grantedCount} granted, ${deniedCount} denied)`,
    duration: 4000,
    color: 'success'
  });
  await toast.present();
};

// Formatting helpers
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

const getRoleColor = (role: UserRole): string => {
  const colorMap = {
    [UserRole.ADMIN]: 'danger',
    [UserRole.DEVELOPER]: 'secondary',
    [UserRole.EVALUATION_MONITOR]: 'tertiary',
    [UserRole.SUPPORT]: 'warning',
    [UserRole.BETA_TESTER]: 'success',
    [UserRole.USER]: 'primary'
  };
  return colorMap[role] || 'medium';
};

// Lifecycle
onMounted(() => {
  // Store the original user when component mounts
  originalUser.value = auth.user;
});
</script>

<style scoped>
.role-testing-panel {
  margin: 1rem 0;
}

.role-testing-panel ion-card-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Current User Section */
.current-user-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--ion-color-light-shade);
  border-radius: 8px;
}

.current-user-section h4 {
  margin: 0 0 0.5rem 0;
  color: var(--ion-color-primary);
}

.user-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.user-info strong {
  display: block;
  color: var(--ion-color-dark);
}

.user-email {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.user-roles {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

/* Role Selection */
.role-selection-section {
  margin-bottom: 1.5rem;
}

.role-selection-section h4 {
  margin: 0 0 1rem 0;
  color: var(--ion-color-primary);
}

.test-users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.5rem;
}

.test-user-button {
  height: auto;
  padding: 0.5rem;
}

.button-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.button-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.button-roles {
  font-size: 0.7rem;
  opacity: 0.8;
  margin-top: 0.25rem;
}

/* Custom Role Builder */
.custom-role-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--ion-color-light-tint);
  border-radius: 8px;
}

.custom-role-section h4 {
  margin: 0 0 1rem 0;
  color: var(--ion-color-secondary);
}

.role-builder {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.custom-input {
  --background: var(--ion-color-light);
}

.role-checkboxes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
}

/* Permission Preview */
.permission-preview-section {
  margin-bottom: 1.5rem;
}

.permission-preview-section h4 {
  margin: 0 0 1rem 0;
  color: var(--ion-color-primary);
}

.permission-categories {
  display: grid;
  gap: 1rem;
}

.permission-category h5 {
  margin: 0 0 0.5rem 0;
  color: var(--ion-color-dark);
  font-size: 0.9rem;
}

.permission-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.permission-chips ion-chip {
  font-size: 0.75rem;
}

/* Quick Actions */
.quick-actions-section h4 {
  margin: 0 0 1rem 0;
  color: var(--ion-color-primary);
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .test-users-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
  
  .user-display {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .role-checkboxes {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    flex-direction: column;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .current-user-section {
    background: var(--ion-color-dark-shade);
  }
  
  .custom-role-section {
    background: var(--ion-color-dark-tint);
  }
}
</style>
