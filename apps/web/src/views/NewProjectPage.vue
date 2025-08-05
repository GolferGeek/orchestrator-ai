<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/projects"></ion-back-button>
        </ion-buttons>
        <ion-title>New Project</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            @click="createProject"
            :disabled="!isFormValid || isCreating"
            fill="solid"
          >
            <ion-spinner v-if="isCreating" name="crescent" size="small"></ion-spinner>
            <span v-else>Create</span>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">New Project</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="form-container">
        <form @submit.prevent="createProject">
          <!-- Project Details -->
          <div class="form-section">
            <h3>Project Details</h3>
            
            <ion-item>
              <ion-label position="stacked">Project Name *</ion-label>
              <ion-input
                v-model="formData.name"
                placeholder="Enter project name"
                :maxlength="100"
                required
              ></ion-input>
            </ion-item>
            
            <ion-item>
              <ion-label position="stacked">Description</ion-label>
              <ion-textarea
                v-model="formData.description"
                placeholder="Describe your project goals and objectives"
                :rows="3"
                :maxlength="500"
              ></ion-textarea>
            </ion-item>
          </div>

          <!-- Orchestrator Selection -->
          <div class="form-section">
            <h3>Orchestrator Selection</h3>
            
            <ion-item>
              <ion-label position="stacked">Choose Orchestrator *</ion-label>
              <ion-select
                v-model="formData.orchestratorId"
                placeholder="Select orchestrator agent"
                interface="action-sheet"
                required
              >
                <ion-select-option
                  v-for="orchestrator in availableOrchestrators"
                  :key="orchestrator.id"
                  :value="orchestrator.id"
                >
                  <div class="orchestrator-option">
                    <strong>{{ orchestrator.name }}</strong>
                    <div class="orchestrator-description">{{ orchestrator.description }}</div>
                  </div>
                </ion-select-option>
              </ion-select>
            </ion-item>

            <!-- Selected Orchestrator Info -->
            <div v-if="selectedOrchestrator" class="orchestrator-info">
              <ion-card>
                <ion-card-header>
                  <ion-card-title>{{ selectedOrchestrator.name }}</ion-card-title>
                  <ion-card-subtitle>{{ selectedOrchestrator.type }} Agent</ion-card-subtitle>
                </ion-card-header>
                <ion-card-content>
                  <p>{{ selectedOrchestrator.description }}</p>
                  <div class="capabilities" v-if="selectedOrchestrator.capabilities">
                    <h4>Capabilities:</h4>
                    <ion-chip 
                      v-for="capability in selectedOrchestrator.capabilities" 
                      :key="capability"
                      outline
                    >
                      {{ capability }}
                    </ion-chip>
                  </div>
                </ion-card-content>
              </ion-card>
            </div>
          </div>

          <!-- Project Configuration -->
          <div class="form-section">
            <h3>Project Configuration</h3>
            
            <ion-item>
              <ion-label position="stacked">Priority Level</ion-label>
              <ion-select
                v-model="formData.priority"
                placeholder="Select priority"
                interface="popover"
              >
                <ion-select-option value="low">Low</ion-select-option>
                <ion-select-option value="medium">Medium</ion-select-option>
                <ion-select-option value="high">High</ion-select-option>
                <ion-select-option value="urgent">Urgent</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item>
              <ion-label position="stacked">Target Completion Date</ion-label>
              <ion-datetime
                v-model="formData.targetDate"
                presentation="date"
                :min="minDate"
                placeholder="Select target date"
              ></ion-datetime>
            </ion-item>

            <ion-item>
              <ion-checkbox v-model="formData.autoStart"></ion-checkbox>
              <ion-label class="ion-margin-start">
                Start project immediately after creation
              </ion-label>
            </ion-item>
          </div>

          <!-- Project Template (Optional) -->
          <div class="form-section">
            <h3>Project Template <span class="optional">(Optional)</span></h3>
            
            <ion-item>
              <ion-label position="stacked">Use Template</ion-label>
              <ion-select
                v-model="formData.templateId"
                placeholder="Choose a template"
                interface="popover"
              >
                <ion-select-option value="">No Template</ion-select-option>
                <ion-select-option 
                  v-for="template in availableTemplates"
                  :key="template.id"
                  :value="template.id"
                >
                  {{ template.name }}
                </ion-select-option>
              </ion-select>
            </ion-item>

            <!-- Template Preview -->
            <div v-if="selectedTemplate" class="template-preview">
              <ion-card>
                <ion-card-header>
                  <ion-card-title>{{ selectedTemplate.name }}</ion-card-title>
                  <ion-card-subtitle>{{ selectedTemplate.category }} Template</ion-card-subtitle>
                </ion-card-header>
                <ion-card-content>
                  <p>{{ selectedTemplate.description }}</p>
                  <div class="template-stats">
                    <ion-badge color="primary">{{ selectedTemplate.estimatedTasks }} tasks</ion-badge>
                    <ion-badge color="secondary">{{ selectedTemplate.estimatedDuration }}</ion-badge>
                  </div>
                </ion-card-content>
              </ion-card>
            </div>
          </div>

          <!-- Initial Instructions -->
          <div class="form-section">
            <h3>Initial Instructions <span class="optional">(Optional)</span></h3>
            
            <ion-item>
              <ion-label position="stacked">Project Instructions</ion-label>
              <ion-textarea
                v-model="formData.initialInstructions"
                placeholder="Provide specific instructions or requirements for the orchestrator"
                :rows="4"
                :maxlength="1000"
              ></ion-textarea>
            </ion-item>
          </div>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonCheckbox,
  IonDatetime,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonChip,
  IonBadge,
  IonSpinner,
  toastController,
} from '@ionic/vue';
import { useRouter, useRoute } from 'vue-router';
import { useAgentsStore } from '@/stores/agentsStore';

interface CreateProjectForm {
  name: string;
  description: string;
  orchestratorId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetDate: string | null;
  autoStart: boolean;
  templateId: string;
  initialInstructions: string;
}

interface Orchestrator {
  id: string;
  name: string;
  type: string;
  description: string;
  capabilities?: string[];
}

interface ProjectTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  estimatedTasks: number;
  estimatedDuration: string;
}

const router = useRouter();
const route = useRoute();
const agentsStore = useAgentsStore();

// Form data
const formData = ref<CreateProjectForm>({
  name: '',
  description: '',
  orchestratorId: '',
  priority: 'medium',
  targetDate: null,
  autoStart: true,
  templateId: '',
  initialInstructions: '',
});

const isCreating = ref(false);

// Mock data
const availableTemplates: ProjectTemplate[] = [
  {
    id: 'marketing-campaign',
    name: 'Marketing Campaign',
    category: 'Marketing',
    description: 'Complete marketing campaign with content creation, social media, and analytics',
    estimatedTasks: 8,
    estimatedDuration: '2-3 weeks',
  },
  {
    id: 'product-launch',
    name: 'Product Launch',
    category: 'Product',
    description: 'Comprehensive product launch workflow with market research, development, and go-to-market strategy',
    estimatedTasks: 15,
    estimatedDuration: '4-6 weeks',
  },
  {
    id: 'quarterly-planning',
    name: 'Quarterly Business Planning',
    category: 'Strategy',
    description: 'Strategic planning process with goal setting, budget allocation, and resource planning',
    estimatedTasks: 10,
    estimatedDuration: '1-2 weeks',
  },
];

// Computed properties
const availableOrchestrators = computed(() => {
  const agents = agentsStore.getAvailableAgents;
  return agents
    .filter((agent: any) => agent.type === 'orchestrator')
    .map((agent: any) => ({
      id: `${agent.type}-${agent.name}`,
      name: agent.name,
      type: agent.type,
      description: agent.description || 'Orchestrator agent for managing complex workflows',
      capabilities: agent.execution_modes || ['delegation', 'planning', 'coordination'],
    }));
});

const selectedOrchestrator = computed(() => {
  return availableOrchestrators.value.find(orch => orch.id === formData.value.orchestratorId);
});

const selectedTemplate = computed(() => {
  return availableTemplates.find(template => template.id === formData.value.templateId);
});

const isFormValid = computed(() => {
  return formData.value.name.trim() !== '' && formData.value.orchestratorId !== '';
});

const minDate = computed(() => {
  return new Date().toISOString().split('T')[0];
});

// Methods
const createProject = async () => {
  if (!isFormValid.value) {
    const toast = await toastController.create({
      message: 'Please fill in all required fields',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
    return;
  }

  isCreating.value = true;

  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    const projectData = {
      ...formData.value,
      orchestratorName: selectedOrchestrator.value?.name,
      orchestratorType: selectedOrchestrator.value?.type,
      templateName: selectedTemplate.value?.name,
      createdAt: new Date(),
      status: formData.value.autoStart ? 'active' : 'draft',
    };

    console.log('Creating project:', projectData);

    const toast = await toastController.create({
      message: `Project "${formData.value.name}" created successfully!`,
      duration: 3000,
      color: 'success',
    });
    await toast.present();

    // Navigate to projects list
    router.push('/projects');

  } catch (error) {
    const toast = await toastController.create({
      message: 'Failed to create project. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isCreating.value = false;
  }
};

// Lifecycle
onMounted(async () => {
  // Load available agents
  await agentsStore.fetchAvailableAgents();

  // Pre-populate orchestrator if passed from route
  const orchestratorName = route.query.orchestrator as string;
  const orchestratorType = route.query.orchestratorType as string;
  
  if (orchestratorName && orchestratorType) {
    const orchestratorId = `${orchestratorType}-${orchestratorName}`;
    if (availableOrchestrators.value.find(orch => orch.id === orchestratorId)) {
      formData.value.orchestratorId = orchestratorId;
    }
  }
});
</script>

<style scoped>
.form-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.form-section {
  margin-bottom: 2rem;
}

.form-section h3 {
  color: var(--ion-color-primary);
  margin-bottom: 1rem;
  font-size: 1.2rem;
  font-weight: 600;
}

.optional {
  color: var(--ion-color-medium);
  font-weight: normal;
  font-size: 0.9rem;
}

.orchestrator-option {
  padding: 0.5rem 0;
}

.orchestrator-description {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  margin-top: 0.25rem;
}

.orchestrator-info,
.template-preview {
  margin-top: 1rem;
}

.capabilities {
  margin-top: 1rem;
}

.capabilities h4 {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: var(--ion-color-dark);
}

.template-stats {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .form-container {
    padding: 0.5rem;
  }
  
  .form-section h3 {
    font-size: 1.1rem;
  }
}

/* Form validation styles */
ion-item.ion-invalid ion-label {
  color: var(--ion-color-danger);
}

ion-item.ion-invalid ion-input,
ion-item.ion-invalid ion-textarea,
ion-item.ion-invalid ion-select {
  --border-color: var(--ion-color-danger);
}
</style>