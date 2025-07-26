<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>MCP Discovery</ion-title>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button @click="showHelp" fill="clear">
            <ion-icon :icon="helpCircleOutline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <MCPDiscoveryDashboard />
      
      <!-- Help Modal -->
      <ion-modal :is-open="showHelpModal" @did-dismiss="showHelpModal = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>MCP Discovery Help</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showHelpModal = false">
                <ion-icon :icon="closeOutline"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <div class="help-content">
            <div class="help-section">
              <h3>What is MCP Discovery?</h3>
              <p>
                Model Context Protocol (MCP) Discovery allows you to manage and monitor 
                MCP services that provide tools and capabilities to your AI agents.
              </p>
            </div>

            <div class="help-section">
              <h3>Key Features</h3>
              <ul>
                <li><strong>Service Discovery:</strong> Automatically find MCP services in your system</li>
                <li><strong>Health Monitoring:</strong> Track the status and performance of MCP services</li>
                <li><strong>Tool Execution:</strong> Execute MCP tools directly from the interface</li>
                <li><strong>Real-time Stats:</strong> View live statistics and metrics</li>
              </ul>
            </div>

            <div class="help-section">
              <h3>Service Types</h3>
              <div class="service-types">
                <div class="service-type">
                  <ion-badge color="primary">Database</ion-badge>
                  <span>SQL databases, data storage services</span>
                </div>
                <div class="service-type">
                  <ion-badge color="secondary">API</ion-badge>
                  <span>REST APIs, web services</span>
                </div>
                <div class="service-type">
                  <ion-badge color="tertiary">File</ion-badge>
                  <span>File system operations, storage</span>
                </div>
                <div class="service-type">
                  <ion-badge color="success">Communication</ion-badge>
                  <span>Email, messaging, notifications</span>
                </div>
                <div class="service-type">
                  <ion-badge color="warning">Computation</ion-badge>
                  <span>Math, calculations, processing</span>
                </div>
                <div class="service-type">
                  <ion-badge color="medium">External</ion-badge>
                  <span>Third-party integrations</span>
                </div>
              </div>
            </div>

            <div class="help-section">
              <h3>How to Use</h3>
              <ol>
                <li><strong>Refresh:</strong> Click the refresh button to update the service list</li>
                <li><strong>Discover:</strong> Use the "Discover MCPs" button to find new services</li>
                <li><strong>Execute Tools:</strong> Click the play button next to any tool to execute it</li>
                <li><strong>View Details:</strong> Click on any service to see detailed information</li>
                <li><strong>Monitor Health:</strong> Check the health score and status indicators</li>
              </ol>
            </div>

            <div class="help-section">
              <h3>Status Indicators</h3>
              <div class="status-indicators">
                <div class="status-item">
                  <ion-badge color="success">Online</ion-badge>
                  <span>Service is running and responding</span>
                </div>
                <div class="status-item">
                  <ion-badge color="danger">Offline</ion-badge>
                  <span>Service is not responding</span>
                </div>
                <div class="status-item">
                  <ion-badge color="warning">Discovering</ion-badge>
                  <span>Service is being discovered</span>
                </div>
              </div>
            </div>

            <div class="help-section">
              <h3>Troubleshooting</h3>
              <ul>
                <li>If no services appear, try clicking "Discover MCPs"</li>
                <li>Check that MCP services are running on the expected ports</li>
                <li>Verify network connectivity if services show as offline</li>
                <li>Review the discovery results for any error messages</li>
              </ul>
            </div>
          </div>
        </ion-content>
      </ion-modal>
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
  IonButtons,
  IonButton,
  IonBackButton,
  IonIcon,
  IonModal,
  IonBadge
} from '@ionic/vue';
import {
  helpCircleOutline,
  closeOutline
} from 'ionicons/icons';

import MCPDiscoveryDashboard from '@/components/MCP/MCPDiscoveryDashboard.vue';

// Local state
const showHelpModal = ref(false);

// Methods
const showHelp = () => {
  showHelpModal.value = true;
};
</script>

<style scoped>
.help-content {
  padding: 16px;
  max-width: 800px;
  margin: 0 auto;
}

.help-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.help-section:last-child {
  border-bottom: none;
}

.help-section h3 {
  margin: 0 0 12px 0;
  color: var(--ion-color-primary);
  font-size: 1.1em;
}

.help-section p {
  margin: 0 0 12px 0;
  line-height: 1.5;
  color: var(--ion-color-dark);
}

.help-section ul,
.help-section ol {
  margin: 0;
  padding-left: 20px;
}

.help-section li {
  margin-bottom: 8px;
  line-height: 1.4;
  color: var(--ion-color-dark);
}

.service-types {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.service-type {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: var(--ion-color-light);
  border-radius: 6px;
}

.status-indicators {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: var(--ion-color-light);
  border-radius: 6px;
}

@media (max-width: 768px) {
  .help-content {
    padding: 12px;
  }
  
  .service-types,
  .status-indicators {
    gap: 6px;
  }
}
</style>