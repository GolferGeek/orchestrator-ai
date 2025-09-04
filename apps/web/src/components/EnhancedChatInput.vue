<template>
  <div class="enhanced-chat-input">
    <!-- LLM Preferences Panel (collapsible) -->
    <div v-if="showLLMPanel" class="llm-panel">
      <div class="panel-tabs">
        <button 
          @click="activeTab = 'model'" 
          :class="{ active: activeTab === 'model' }"
          class="tab-button"
        >
          AI Model
        </button>
        <button 
          @click="activeTab = 'behavior'" 
          :class="{ active: activeTab === 'behavior' }"
          class="tab-button"
        >
          Behavior
        </button>
        <button @click="showLLMPanel = false" class="close-panel">×</button>
      </div>
      <div class="panel-content">
        <LLMSelector v-if="activeTab === 'model'" />
        <CIDAFMControls v-if="activeTab === 'behavior'" />
      </div>
    </div>
    <!-- Main Chat Input -->
    <ion-toolbar color="light" class="chat-input-toolbar">
      <!-- LLM Status Display -->
      <div class="llm-status" slot="start">
        <button @click="showLLMPanel = !showLLMPanel" class="llm-toggle-btn">
          <div class="llm-info">
            <div class="provider-name">
              {{ llmStore.selectedProvider?.name || 'Default' }}
            </div>
            <div class="model-name">
              {{ llmStore.selectedModel?.name || 'GPT-4o-mini' }}
            </div>
          </div>
          <ion-icon :icon="chevronUpOutline" :class="{ rotated: !showLLMPanel }"></ion-icon>
        </button>
      </div>
      <!-- Message Input -->
      <ion-textarea
        v-model="inputText"
        placeholder="Type a message..."
        :auto-grow="true"
        class="chat-textarea"
        :rows="1"
        @keydown.enter.prevent="handleEnterKey"
      ></ion-textarea>
      <!-- Input Buttons -->
      <ion-buttons slot="end" class="input-buttons">
        <!-- Cost Estimate -->
        <div v-if="showCostEstimate && estimatedCost" class="cost-estimate">
          ~${{ estimatedCost }}
        </div>
        <!-- PTT Button -->
        <ion-button 
          fill="clear" 
          :color="isRecording ? 'danger' : 'medium'" 
          @click="togglePtt" 
          class="ptt-button custom-button-padding"
        >
          <ion-icon slot="icon-only" :icon="isRecording ? micOffOutline : micOutline"></ion-icon>
        </ion-button>
        <!-- Send Button -->
        <ion-button 
          fill="clear" 
          color="primary" 
          @click="sendMessage" 
          :disabled="!inputText.trim() || isRecording" 
          class="send-button custom-button-padding"
        >
          <ion-icon slot="icon-only" :icon="sendOutline"></ion-icon>
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, defineEmits, onUnmounted, watch, onMounted } from 'vue';
import { IonTextarea, IonButtons, IonButton, IonIcon, IonToolbar, toastController } from '@ionic/vue';
import { sendOutline, micOutline, micOffOutline, chevronUpOutline } from 'ionicons/icons';
import { useUiStore } from '../stores/uiStore';
import { useLLMStore } from '../stores/llmStore';
import { Capacitor } from '@capacitor/core';
import LLMSelector from './LLMSelector.vue';
import CIDAFMControls from './CIDAFMControls.vue';
import { useValidation, ValidationRules } from '@/composables/useValidation';
const inputText = ref('');
const isRecording = ref(false);
const showLLMPanel = ref(false);
const activeTab = ref<'model' | 'behavior'>('model');
const showCostEstimate = ref(true);
const uiStore = useUiStore();
const llmStore = useLLMStore();
const validation = useValidation();

// Setup validation rules
onMounted(() => {
  validation.addRule('message', ValidationRules.required('Message cannot be empty'));
  validation.addRule('message', ValidationRules.maxLength(4000, 'Message must not exceed 4000 characters'));
  validation.addRule('message', ValidationRules.security('Potentially unsafe content detected in message'));
  validation.addRule('message', ValidationRules.sanitizeApiInput());
});

// Speech Recognition setup (copied from original ChatInput)
// @ts-ignore: next-line 
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition: SpeechRecognition | null = null;
const presentToast = async (message: string, duration: number = 2000, color: string = 'warning') => {
  const toast = await toastController.create({
    message: message,
    duration: duration,
    position: 'bottom',
    color: color,
  });
  await toast.present();
};
// Speech Recognition setup (same as original)
if (SpeechRecognition && !Capacitor.isNativePlatform()) {
  recognition = new SpeechRecognition();
  recognition.continuous = false; 
  recognition.interimResults = true; 
  recognition.lang = 'en-US'; 
  recognition.onstart = () => {
    isRecording.value = true;
  };
  recognition.onend = () => {
    if (isRecording.value) { 
        isRecording.value = false;
        emit('pttToggle', false);
    }
  };
  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interimTranscript = '';
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    if (finalTranscript.trim()) {
      inputText.value = finalTranscript.trim();
    } else if (interimTranscript.trim()) {
      inputText.value = interimTranscript.trim();
    }
  };
  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    let userMessage = 'Voice input error.';
    if (event.error === 'no-speech') {
      userMessage = 'No speech was detected. Please try again.';
    } else if (event.error === 'not-allowed') {
      userMessage = 'Microphone access denied. Please enable microphone permissions.';
    } else if (event.error === 'network') {
      userMessage = 'Network error during voice input.';
    } else {
      userMessage = `Voice input failed: ${event.error}`;
    }
    presentToast(userMessage, 3000, 'danger');
    if (isRecording.value) {
      isRecording.value = false;
      emit('pttToggle', false);
      uiStore.setPttRecording(false); 
    }
  };
} else if (!SpeechRecognition && !Capacitor.isNativePlatform()) {
  // Web Speech API is not supported in this browser
}
const emit = defineEmits<{
  (e: 'sendMessage', text: string, llmSelection?: any): void;
  (e: 'pttToggle', recordingState: boolean): void;
}>();
// Computed properties
const estimatedCost = computed(() => {
  if (!inputText.value.trim() || !llmStore.selectedModel) return null;
  const textLength = inputText.value.length;
  const estimatedTokens = Math.ceil(textLength / 4); // Rough estimation
  const inputCost = llmStore.selectedModel.pricingInputPer1k || 0;
  const estimatedOutputTokens = estimatedTokens * 0.5; // Assume response is half the input
  const outputCost = llmStore.selectedModel.pricingOutputPer1k || 0;
  const totalCost = (estimatedTokens / 1000) * inputCost + (estimatedOutputTokens / 1000) * outputCost;
  return totalCost > 0.001 ? totalCost.toFixed(4) : '< 0.001';
});
// Event handlers
const sendMessage = async () => {
  if (!inputText.value.trim() || isRecording.value) return;
  
  // Validate and sanitize the message before sending
  const validationResult = await validation.validate('message', inputText.value.trim());
  
  if (!validationResult.isValid) {
    const errorMessages = validationResult.errors.map(e => e.message).join(', ');
    presentToast(`Message validation failed: ${errorMessages}`, 3000, 'danger');
    return;
  }
  
  // Use the sanitized value if available
  const messageToSend = validationResult.sanitizedValue || inputText.value.trim();
  const llmSelection = llmStore.currentLLMSelection;
  
  emit('sendMessage', messageToSend, llmSelection);
  inputText.value = '';
};
const handleEnterKey = (event: KeyboardEvent) => {
  if (!event.shiftKey && !isRecording.value) {
    event.preventDefault();
    sendMessage();
  }
};
const togglePtt = async () => {
  if (Capacitor.isNativePlatform()) {
    // Native PTT logic (same as original)
    isRecording.value = !isRecording.value;
    const nativePttMessage = `Native PTT: Recording ${isRecording.value ? 'started' : 'stopped'}. (Plugin not yet implemented)`;
    presentToast(nativePttMessage, 2000, isRecording.value ? 'success' : 'medium');
    emit('pttToggle', isRecording.value);
    uiStore.setPttRecording(isRecording.value);
  } else if (recognition) {
    if (isRecording.value) {
      recognition.stop();
    } else {
      try {
        inputText.value = '';
        recognition.start();
      } catch (e) {
        isRecording.value = false;
        emit('pttToggle', false);
        uiStore.setPttRecording(false);
        presentToast("Could not start voice input. Please try again.", 3000, 'danger');
      }
    }
  } else {
    presentToast('Voice input is not supported in your browser.', 3000, 'danger');
  }
};
// Watchers
watch(isRecording, (newValue) => {
  uiStore.setPttRecording(newValue);
});
// Cleanup
onUnmounted(() => {
  if (recognition && isRecording.value && !Capacitor.isNativePlatform()) {
    recognition.stop();
  }
});
</script>
<style scoped>
.enhanced-chat-input {
  display: flex;
  flex-direction: column;
}
.llm-panel {
  background: white;
  border-top: 1px solid #e0e0e0;
  max-height: 60vh;
  overflow-y: auto;
}
.panel-tabs {
  display: flex;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  position: relative;
}
.tab-button {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 500;
  color: #666;
  transition: all 0.2s ease;
}
.tab-button.active {
  background: white;
  color: #3498db;
  border-bottom: 2px solid #3498db;
}
.close-panel {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.panel-content {
  padding: 0;
}
.chat-input-toolbar {
  --padding-start: 8px;
  --padding-end: 8px;
  --padding-top: 4px;
  --padding-bottom: 4px;
  min-height: auto;
  display: flex;
  align-items: center;
}
.llm-status {
  margin-right: 0.5rem;
}
.llm-toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
}
.llm-toggle-btn:hover {
  border-color: #3498db;
  background: #f8fbff;
}
.llm-info {
  flex: 1;
  text-align: left;
}
.provider-name {
  font-size: 0.75rem;
  color: #666;
  line-height: 1;
}
.model-name {
  font-size: 0.8rem;
  font-weight: 500;
  color: #333;
  line-height: 1.2;
}
.llm-toggle-btn ion-icon {
  transition: transform 0.2s ease;
}
.llm-toggle-btn ion-icon.rotated {
  transform: rotate(180deg);
}
.chat-textarea {
  flex-grow: 1;
  border: 1px solid var(--ion-color-medium-shade);
  border-radius: 20px;
  --padding-top: 8px !important; 
  --padding-bottom: 8px !important;
  --padding-start: 12px !important;
  --padding-end: 12px !important;
  line-height: 1.4;
  max-height: 100px;
  align-self: center;
  margin-right: 4px;
}
.input-buttons {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.cost-estimate {
  font-size: 0.7rem;
  color: #666;
  padding: 0.25rem 0.5rem;
  background: #f5f5f5;
  border-radius: 12px;
  white-space: nowrap;
}
.custom-button-padding {
  --padding-start: 8px;
  --padding-end: 8px;
  height: 40px;
}
/* Mobile responsiveness */
@media (max-width: 768px) {
  .llm-toggle-btn {
    min-width: 100px;
  }
  .provider-name {
    font-size: 0.7rem;
  }
  .model-name {
    font-size: 0.75rem;
  }
  .llm-panel {
    max-height: 50vh;
  }
  .cost-estimate {
    display: none; /* Hide on mobile to save space */
  }
}
</style>