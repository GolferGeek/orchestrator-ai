<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/app/agents"></ion-back-button>
        </ion-buttons>
        <ion-title>Data Sanitization</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Data Sanitization</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="sanitization-dashboard">
        <!-- Header Section -->
        <div class="dashboard-header">
          <div class="header-content">
            <ion-icon :icon="shieldCheckmarkOutline" class="header-icon"></ion-icon>
            <div class="header-text">
              <h1>Data Sanitization Management</h1>
              <p>Manage PII detection, pseudonymization, and data protection policies to ensure sensitive information is properly handled across all AI interactions.</p>
            </div>
          </div>
        </div>

        <!-- Quick Stats Cards -->
        <div class="stats-section">
          <div class="stats-grid">
            <div class="stat-card">
              <ion-icon :icon="documentTextOutline" class="stat-icon primary"></ion-icon>
              <div class="stat-content">
                <h3>Active Patterns</h3>
                <p class="stat-number">{{ llmStore.formattedSanitizationStats.activePatterns }}</p>
                <p class="stat-label">PII detection rules</p>
              </div>
            </div>
            <div class="stat-card">
              <ion-icon :icon="swapHorizontalOutline" class="stat-icon success"></ion-icon>
              <div class="stat-content">
                <h3>Pseudonyms</h3>
                <p class="stat-number">{{ llmStore.formattedSanitizationStats.pseudonyms }}</p>
                <p class="stat-label">Active mappings</p>
              </div>
            </div>
            <div class="stat-card">
              <ion-icon :icon="eyeOffOutline" class="stat-icon warning"></ion-icon>
              <div class="stat-content">
                <h3>Protected Today</h3>
                <p class="stat-number">{{ llmStore.formattedSanitizationStats.protectedToday }}</p>
                <p class="stat-label">PII items sanitized</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation Cards -->
        <div class="navigation-section">
          <h2>Sanitization Tools</h2>
          <div class="nav-grid">
            <!-- PII Patterns Card -->
            <div class="nav-card" @click="navigateTo('/app/admin/pii-patterns')">
              <div class="card-header">
                <ion-icon :icon="documentTextOutline" class="card-icon primary"></ion-icon>
                <div class="card-badge severity-high">Core</div>
              </div>
              <div class="card-content">
                <h3>PII Patterns</h3>
                <p>Configure detection patterns for personally identifiable information including SSNs, credit cards, emails, and custom patterns.</p>
                <div class="card-features">
                  <span class="feature-tag">• Pattern Management</span>
                  <span class="feature-tag">• Severity Levels</span>
                  <span class="feature-tag">• Regex Rules</span>
                </div>
              </div>
              <div class="card-footer">
                <ion-button fill="clear" size="small">
                  Manage Patterns
                  <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
                </ion-button>
              </div>
            </div>

            <!-- PII Testing Card -->
            <div class="nav-card" @click="navigateTo('/app/admin/pii-testing')">
              <div class="card-header">
                <ion-icon :icon="flaskOutline" class="card-icon secondary"></ion-icon>
                <div class="card-badge severity-medium">Testing</div>
              </div>
              <div class="card-content">
                <h3>PII Testing</h3>
                <p>Test your PII detection patterns against sample data to ensure accurate identification and proper sanitization behavior.</p>
                <div class="card-features">
                  <span class="feature-tag">• Pattern Testing</span>
                  <span class="feature-tag">• Sample Data</span>
                  <span class="feature-tag">• Validation</span>
                </div>
              </div>
              <div class="card-footer">
                <ion-button fill="clear" size="small">
                  Test Patterns
                  <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
                </ion-button>
              </div>
            </div>

            <!-- Pseudonym Dictionary Card -->
            <div class="nav-card" @click="navigateTo('/app/admin/pseudonym-dictionary')">
              <div class="card-header">
                <ion-icon :icon="libraryOutline" class="card-icon tertiary"></ion-icon>
                <div class="card-badge severity-medium">Dictionary</div>
              </div>
              <div class="card-content">
                <h3>Pseudonym Dictionary</h3>
                <p>Manage the dictionary of replacement values used for pseudonymization, ensuring consistent and reversible data protection.</p>
                <div class="card-features">
                  <span class="feature-tag">• Name Replacements</span>
                  <span class="feature-tag">• Custom Values</span>
                  <span class="feature-tag">• Categories</span>
                </div>
              </div>
              <div class="card-footer">
                <ion-button fill="clear" size="small">
                  Manage Dictionary
                  <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
                </ion-button>
              </div>
            </div>

            <!-- Pseudonym Mappings Card -->
            <div class="nav-card" @click="navigateTo('/app/admin/pseudonym-mappings')">
              <div class="card-header">
                <ion-icon :icon="swapHorizontalOutline" class="card-icon success"></ion-icon>
                <div class="card-badge severity-low">Mappings</div>
              </div>
              <div class="card-content">
                <h3>Pseudonym Mappings</h3>
                <p>View and manage active pseudonym mappings to track how real values are replaced and ensure proper data restoration.</p>
                <div class="card-features">
                  <span class="feature-tag">• Active Mappings</span>
                  <span class="feature-tag">• Restoration</span>
                  <span class="feature-tag">• Audit Trail</span>
                </div>
              </div>
              <div class="card-footer">
                <ion-button fill="clear" size="small">
                  View Mappings
                  <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
                </ion-button>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions Section -->
        <div class="actions-section">
          <h2>Quick Actions</h2>
          <div class="actions-grid">
            <ion-button expand="block" fill="outline" @click="navigateTo('/app/admin/pii-testing')">
              <ion-icon :icon="flaskOutline" slot="start"></ion-icon>
              Test New Pattern
            </ion-button>
            <ion-button expand="block" fill="outline" @click="navigateTo('/app/admin/pii-patterns')">
              <ion-icon :icon="addOutline" slot="start"></ion-icon>
              Add PII Pattern
            </ion-button>
            <ion-button expand="block" fill="outline" @click="navigateTo('/app/admin/audit')">
              <ion-icon :icon="analyticsOutline" slot="start"></ion-icon>
              View Audit Logs
            </ion-button>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonIcon,
  IonButton
} from '@ionic/vue';
import {
  shieldCheckmarkOutline,
  documentTextOutline,
  flaskOutline,
  libraryOutline,
  swapHorizontalOutline,
  chevronForwardOutline,
  eyeOffOutline,
  addOutline,
  analyticsOutline
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';

const router = useRouter();
const llmStore = useLLMPreferencesStore();

const navigateTo = (path: string) => {
  router.push(path);
};

// Auto-refresh interval
let refreshInterval: NodeJS.Timeout | null = null;

onMounted(async () => {
  // Fetch initial stats
  await llmStore.fetchSanitizationStats();
  
  // Set up auto-refresh every 30 seconds for the dashboard
  refreshInterval = setInterval(() => {
    if (llmStore.sanitizationStatsStale) {
      llmStore.fetchSanitizationStats();
    }
  }, 30000);
});

onUnmounted(() => {
  // Clean up interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
});
</script>

<style scoped>
.sanitization-dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Header Section */
.dashboard-header {
  background: linear-gradient(135deg, var(--ion-color-primary) 0%, var(--ion-color-primary-shade) 100%);
  border-radius: 16px;
  padding: 32px;
  margin-bottom: 32px;
  color: white;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 24px;
}

.header-icon {
  font-size: 4rem;
  opacity: 0.9;
}

.header-text h1 {
  margin: 0 0 8px 0;
  font-size: 2rem;
  font-weight: 600;
}

.header-text p {
  margin: 0;
  font-size: 1.1rem;
  opacity: 0.9;
  line-height: 1.5;
}

/* Stats Section */
.stats-section {
  margin-bottom: 40px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--ion-color-light);
}

.stat-icon {
  font-size: 2.5rem;
  padding: 12px;
  border-radius: 12px;
}

.stat-icon.primary {
  background: var(--ion-color-primary-tint);
  color: var(--ion-color-primary);
}

.stat-icon.success {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success);
}

.stat-icon.warning {
  background: var(--ion-color-warning-tint);
  color: var(--ion-color-warning);
}

.stat-content h3 {
  margin: 0 0 4px 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-number {
  margin: 0 0 4px 0;
  font-size: 2rem;
  font-weight: 700;
  color: var(--ion-color-dark);
}

.stat-label {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

/* Navigation Section */
.navigation-section {
  margin-bottom: 40px;
}

.navigation-section h2 {
  margin: 0 0 24px 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.nav-card {
  background: white;
  border-radius: 16px;
  padding: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--ion-color-light);
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

.nav-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.card-header {
  padding: 24px 24px 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-icon {
  font-size: 2.5rem;
  padding: 12px;
  border-radius: 12px;
}

.card-icon.primary {
  background: var(--ion-color-primary-tint);
  color: var(--ion-color-primary);
}

.card-icon.secondary {
  background: var(--ion-color-secondary-tint);
  color: var(--ion-color-secondary);
}

.card-icon.tertiary {
  background: var(--ion-color-tertiary-tint);
  color: var(--ion-color-tertiary);
}

.card-icon.success {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success);
}

.card-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.severity-high {
  background: var(--ion-color-danger-tint);
  color: var(--ion-color-danger);
}

.severity-medium {
  background: var(--ion-color-warning-tint);
  color: var(--ion-color-warning);
}

.severity-low {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success);
}

.card-content {
  padding: 0 24px 16px 24px;
}

.card-content h3 {
  margin: 0 0 8px 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.card-content p {
  margin: 0 0 16px 0;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  line-height: 1.5;
}

.card-features {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.feature-tag {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  background: var(--ion-color-light);
  padding: 4px 8px;
  border-radius: 8px;
}

.card-footer {
  padding: 16px 24px 24px 24px;
  border-top: 1px solid var(--ion-color-light);
}

/* Actions Section */
.actions-section h2 {
  margin: 0 0 24px 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .sanitization-dashboard {
    padding: 16px;
  }

  .header-content {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }

  .header-icon {
    font-size: 3rem;
  }

  .header-text h1 {
    font-size: 1.5rem;
  }

  .nav-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
