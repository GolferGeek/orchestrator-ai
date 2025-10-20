<template>
  <ion-button 
    fill="clear" 
    :color="getButtonColor()" 
    @click="toggleSpeech" 
    :disabled="disabled || !currentAgent"
    class="speech-button"
    :title="getButtonTooltip()"
  >
    <div class="speech-container">
      <ion-icon 
        slot="icon-only" 
        :icon="micOutline"
        :class="getIconClasses()"
      ></ion-icon>
      
      <!-- Ripple animations -->
      <div 
        v-if="isListening || isProcessing || isSpeaking" 
        class="ripple-animation"
        :class="getRippleClasses()"
      >
        <div class="ripple"></div>
        <div class="ripple"></div>
        <div class="ripple"></div>
      </div>
    </div>
  </ion-button>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted } from 'vue';
import { IonButton, IonIcon, toastController } from '@ionic/vue';
import { micOutline } from 'ionicons/icons';
import { apiService } from '../services/apiService';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { sendMessage, createPlan, createDeliverable } from '@/services/agent2agent/actions';

// Define speech states
type SpeechState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'speechStart'): void;
  (e: 'speechEnd'): void;
  (e: 'error', error: string): void;
  (e: 'transcription', text: string): void;
}>();

// Stores
const chatUiStore = useChatUiStore();

// State
const speechState = ref<SpeechState>('idle');
const mediaRecorder = ref<MediaRecorder | null>(null);
const audioChunks = ref<Blob[]>([]);
const currentAudio = ref<HTMLAudioElement | null>(null);

// Computed
const currentAgent = computed(() => chatUiStore.activeConversation?.agent);

const isListening = computed(() => speechState.value === 'listening');
const isProcessing = computed(() => speechState.value === 'processing');
const isSpeaking = computed(() => speechState.value === 'speaking');

// Button appearance
const getButtonColor = () => {
  switch (speechState.value) {
    case 'listening': return 'success';
    case 'processing': return 'warning';
    case 'speaking': return 'tertiary';
    case 'error': return 'danger';
    default: return 'medium';
  }
};

const getButtonTooltip = () => {
  switch (speechState.value) {
    case 'listening': return 'Listening... Click to stop';
    case 'processing': return 'Processing your speech...';
    case 'speaking': return 'Playing response...';
    case 'error': return 'Error occurred. Click to try again';
    default: return 'Click to start voice conversation';
  }
};

const getIconClasses = () => {
  return {
    'icon-pulse': isListening.value,
    'icon-spin': isProcessing.value,
    'icon-glow': isSpeaking.value,
  };
};

const getRippleClasses = () => {
  return {
    'ripple-listening': isListening.value,
    'ripple-processing': isProcessing.value,
    'ripple-speaking': isSpeaking.value,
  };
};

// Main toggle function
const toggleSpeech = async () => {
  if (!currentAgent.value) {
    showError('No agent selected');
    return;
  }

  switch (speechState.value) {
    case 'idle':
      await startListening();
      break;
    case 'listening':
      await stopListening();
      break;
    case 'speaking':
      stopSpeaking();
      break;
    case 'error':
      speechState.value = 'idle';
      break;
    default:
      // Do nothing for processing state
      break;
  }
};

// Audio recording functions
const startListening = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    mediaRecorder.value = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    audioChunks.value = [];
    
    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data);
      }
    };
    
    mediaRecorder.value.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      await processAudio();
    };
    
    mediaRecorder.value.start();
    speechState.value = 'listening';
    emit('speechStart');
    
  } catch (error) {
    console.error('Error starting audio recording:', error);
    showError('Could not access microphone');
  }
};

const stopListening = async () => {
  if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
    mediaRecorder.value.stop();
    speechState.value = 'processing';
  }
};

// Audio processing (new speech-to-text only flow)
const processAudio = async () => {
  if (audioChunks.value.length === 0) {
    speechState.value = 'idle';
    return;
  }

  try {
    const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm;codecs=opus' });
    const base64Audio = await blobToBase64(audioBlob);
    
    console.log('🎤 [SpeechButton] Processing audio via new frontend flow');

    // Step 1: Transcribe the audio to text
    const transcription = await apiService.transcribeAudio(
      base64Audio,
      'webm',
      48000
    );

    if (!transcription.text || transcription.text.trim().length === 0) {
      throw new Error('No speech detected in audio');
    }

    console.log('🎤 [SpeechButton] Transcribed text:', transcription.text);

    // Step 2: Mark that the next message was sent via speech (for TTS triggering)
    chatUiStore.lastMessageWasSpeech = true;

    // Step 3: Send the transcribed text through normal chat flow
    const conversation = chatUiStore.activeConversation;
    if (conversation && conversation.agentName) {
      const mode = chatUiStore.chatMode || 'conversational';
      const agentName = conversation.agentName;

      // Route to appropriate action based on mode
      if (mode === 'plan') {
        await createPlan(agentName, conversation.id, transcription.text);
      } else if (mode === 'build') {
        await createDeliverable(agentName, conversation.id, transcription.text);
      } else {
        // converse mode (default)
        await sendMessage(agentName, conversation.id, transcription.text);
      }
    }

    console.log('🎤 [SpeechButton] Message sent through chat store');

    // Emit transcription for UI updates
    emit('transcription', transcription.text);
    
    // Speech-to-text complete, TTS will be handled separately
    speechState.value = 'idle';
    emit('speechEnd');

  } catch (error) {
    console.error('Error processing speech:', error);
    showError('Failed to process speech');
    speechState.value = 'error';
  }
};

// Old TTS functions removed - now handled by useSpeechTTS composable

const stopSpeaking = () => {
  // In new architecture, speech button should stay idle
  // TTS is handled separately and doesn't affect button state
  speechState.value = 'idle';
};

// Utility functions
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const showError = async (message: string) => {
  const toast = await toastController.create({
    message,
    duration: 3000,
    color: 'danger',
    position: 'top',
  });
  toast.present();
  emit('error', message);
};

// Cleanup
onUnmounted(() => {
  if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
    mediaRecorder.value.stop();
  }
  if (currentAudio.value) {
    currentAudio.value.pause();
  }
});

onMounted(() => {
  // Check for microphone permission
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('Speech functionality not available - missing media devices API');
  }
});

// No longer needed - speech button stays idle after speech-to-text completes
</script>

<style scoped>
.speech-button {
  position: relative;
  --padding-start: 8px;
  --padding-end: 8px;
}

.speech-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ripple-animation {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  pointer-events: none;
}

.ripple {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  opacity: 0.6;
}

.ripple-listening .ripple {
  background-color: var(--ion-color-success);
  animation: ripple-pulse 1.5s infinite ease-out;
}

.ripple-processing .ripple {
  background-color: var(--ion-color-warning);
  animation: ripple-spin 1s infinite linear;
}

.ripple-speaking .ripple {
  background-color: var(--ion-color-tertiary);
  animation: ripple-glow 2s infinite ease-in-out;
}

.ripple:nth-child(1) { animation-delay: 0s; }
.ripple:nth-child(2) { animation-delay: 0.5s; }
.ripple:nth-child(3) { animation-delay: 1s; }

.icon-pulse {
  animation: icon-pulse 1.5s infinite ease-in-out;
}

.icon-spin {
  animation: icon-spin 1s infinite linear;
}

.icon-glow {
  animation: icon-glow 2s infinite ease-in-out;
}

@keyframes ripple-pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.3;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

@keyframes ripple-spin {
  0% {
    transform: rotate(0deg) scale(0.8);
    opacity: 0.4;
  }
  100% {
    transform: rotate(360deg) scale(1.2);
    opacity: 0.1;
  }
}

@keyframes ripple-glow {
  0%, 100% {
    transform: scale(0.9);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

@keyframes icon-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@keyframes icon-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes icon-glow {
  0%, 100% {
    opacity: 1;
    filter: brightness(1);
  }
  50% {
    opacity: 0.8;
    filter: brightness(1.3);
  }
}
</style>
