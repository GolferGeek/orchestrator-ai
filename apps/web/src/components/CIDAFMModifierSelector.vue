<template>
  <div class="modifier-selector">
    <div class="selector-group">
      <button 
        @click="openModal"
        :disabled="loadingCommands"
        class="browse-button"
      >
        <ion-icon :icon="addOutline" />
        Browse Modifiers
      </button>
      <div v-if="loadingCommands" class="loading-text">
        Loading modifiers...
      </div>
      <div v-if="commandError" class="error-text">
        Error loading modifiers: {{ commandError }}
      </div>
    </div>
    <!-- Selection Modal -->
    <ion-modal :is-open="isModalOpen" @didDismiss="closeModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>Select Modifier</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeModal">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="modal-content">
        <div class="modifiers-list">
          <div 
            v-for="command in availableCommands" 
            :key="command.id"
            class="modifier-item"
            @click="selectModifier(command.name)"
          >
            <div class="modifier-name">{{ command.name }}</div>
            <div class="modifier-description">{{ command.description }}</div>
            <div v-if="command.example" class="modifier-example">
              Example: {{ command.example }}
            </div>
          </div>
          <div v-if="availableCommands.length === 0" class="no-modifiers">
            No modifiers available to add
          </div>
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
} from '@ionic/vue';
import { addOutline, closeOutline } from 'ionicons/icons';
import type { CIDAFMCommand } from '@/types/llm';
interface Props {
  availableCommands: CIDAFMCommand[];
  loadingCommands?: boolean;
  commandError?: string;
}
interface Emits {
  (e: 'add-modifier', modifierName: string): void;
}
withDefaults(defineProps<Props>(), {
  loadingCommands: false,
  commandError: undefined,
});
const emit = defineEmits<Emits>();
const isModalOpen = ref(false);
const openModal = () => {
  isModalOpen.value = true;
};
const closeModal = () => {
  isModalOpen.value = false;
};
const selectModifier = (modifierName: string) => {
  emit('add-modifier', modifierName);
  closeModal();
};
</script>
<style scoped>
.modifier-selector {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}
.selector-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.browse-button {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
  transition: all 0.2s ease;
}
.browse-button:hover:not(:disabled) {
  background: #2980b9;
  transform: translateY(-1px);
}
.browse-button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}
.loading-text, .error-text {
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
  text-align: center;
}
.loading-text {
  background: #f8f9fa;
  color: #666;
}
.error-text {
  background: #fff5f5;
  color: #e74c3c;
  border: 1px solid #fecaca;
}
.modal-content {
  --padding-top: 16px;
  --padding-bottom: 16px;
  --padding-start: 16px;
  --padding-end: 16px;
}
.modifiers-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.modifier-item {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
}
.modifier-item:hover {
  border-color: #3498db;
  background: #f8fbff;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.modifier-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}
.modifier-description {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
  margin-bottom: 0.5rem;
}
.modifier-example {
  color: #888;
  font-size: 0.8rem;
  font-style: italic;
}
.no-modifiers {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 2rem;
}
</style>