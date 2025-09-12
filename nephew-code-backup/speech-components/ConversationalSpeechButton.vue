<template>
  <ion-button
    fill="clear"
    :color="getButtonColor()"
    @click="toggleConversation"
    :disabled="disabled"
    class="conversation-button custom-button-padding"
    :title="getButtonTooltip()"
  >
    <div class="ripple-container">
      <ion-icon
        slot="icon-only"
        :icon="radioButtonOnOutline"
        :class="getIconClasses()"
      ></ion-icon>

      <!-- Ripple animations -->
      <div
        v-if="isListening || isProcessing || isSpeaking"
        class="ripple-animation"
        :class="getRippleClasses()"
        :style="getRippleStyles()"
      >
        <div class="ripple"></div>
        <div class="ripple"></div>
        <div class="ripple"></div>
      </div>
    </div>
  </ion-button>
</template>

<script setup lang="ts">
import { ref, computed, defineEmits, defineProps, onUnmounted, onMounted } from 'vue';
import { IonButton, IonIcon, toastController } from '@ionic/vue';
import { radioButtonOnOutline } from 'ionicons/icons';
import { apiService } from '../services/apiService';
import { useUiStore } from '../stores/uiStore';

// Define conversation states
type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error' | 'done';

const props = defineProps<{
  sessionId: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'conversationStart'): void;
  (e: 'conversationEnd'): void;
  (e: 'error', error: string): void;
}>();

const uiStore = useUiStore();

// Component state
const conversationState = ref<ConversationState>('idle');
const currentAudio = ref<HTMLAudioElement | null>(null);
const mediaRecorder = ref<MediaRecorder | null>(null);
const audioChunks = ref<Blob[]>([]);
const continuousListening = ref(false);
const currentMimeType = ref('audio/webm;codecs=opus');
const currentFormat = ref('webm');

// Audio resource tracking
const activeStreams = ref<MediaStream[]>([]);
const audioContext = ref<AudioContext | null>(null);
const currentSource = ref<MediaStreamAudioSourceNode | null>(null);

// Voice Activity Detection state
const baselineVolume = ref(0);
const currentVolume = ref(0);
const silenceStartTime = ref(0);
const volumeThreshold = ref(0);
const analyser = ref<AnalyserNode | null>(null);
const dataArray = ref<Uint8Array | null>(null);
const vadCheckInterval = ref<number | null>(null);
const hasDetectedSpeech = ref(false);
const lastVolumeChangeTime = ref(0);

// Constants
const SILENCE_DURATION_MS = 1800; // 1.8 seconds of silence to auto-stop
const BASELINE_MEASUREMENT_MS = 500; // Measure baseline for 0.5 seconds
const VOLUME_THRESHOLD_MULTIPLIER = 0.3; // Threshold is 30% above baseline
const NO_VOLUME_CHANGE_MS = 3000; // 3 seconds of no significant volume change

// Computed properties
const isListening = computed(() => conversationState.value === 'listening');
const isProcessing = computed(() => conversationState.value === 'processing');
const isSpeaking = computed(() => conversationState.value === 'speaking');

const volumeIntensity = computed(() => {
  if (!isListening.value || !volumeThreshold.value) return 1;

  // Calculate volume as a ratio above threshold (1.0 = at threshold, 2.0 = 2x threshold, etc.)
  const ratio = Math.max(0.1, currentVolume.value / Math.max(volumeThreshold.value, 1));

  // Cap at 3x for reasonable animation bounds
  return Math.min(ratio, 3);
});

const getButtonColor = (): string => {
  switch (conversationState.value) {
    case 'listening':
      return 'primary'; // Blue instead of red
    case 'processing':
      return 'secondary'; // Purple/gray instead of yellow
    case 'speaking':
      return 'tertiary'; // Light blue instead of green
    case 'done':
      return 'medium';
    case 'error':
      return 'dark'; // Dark instead of red for errors
    default:
      return 'primary';
  }
};

const getIconClasses = (): string => {
  const classes = ['conversation-icon'];

  switch (conversationState.value) {
    case 'listening':
      classes.push('listening');
      break;
    case 'processing':
      classes.push('processing');
      break;
    case 'speaking':
      classes.push('speaking');
      break;
    case 'done':
      classes.push('done');
      break;
  }

  return classes.join(' ');
};

const getRippleClasses = (): string => {
  switch (conversationState.value) {
    case 'listening':
      return 'listening-ripples';
    case 'processing':
      return 'processing-ripples';
    case 'speaking':
      return 'speaking-ripples';
    default:
      return '';
  }
};

const getRippleStyles = () => {
  if (conversationState.value === 'listening') {
    // Use volume intensity to control ripple animation speed and scale
    const intensity = volumeIntensity.value;
    const animationDuration = Math.max(0.5, 2.5 - intensity); // Faster ripples for louder volume
    const scale = 0.5 + (intensity * 0.5); // Bigger ripples for louder volume

    return {
      '--ripple-duration': `${animationDuration}s`,
      '--ripple-scale': scale.toString()
    };
  }
  return {};
};

const getButtonTooltip = (): string => {
  switch (conversationState.value) {
    case 'listening':
      return 'Click to stop or wait for silence detection';
    case 'processing':
      return 'Processing your speech...';
    case 'speaking':
      return 'Click to interrupt or end conversation (if no recent audio)';
    case 'done':
      return 'Conversation ended - click to start new one';
    case 'error':
      return 'Error occurred - click to retry';
    default:
      return 'Start voice conversation';
  }
};

// Voice Activity Detection functions
const calculateVolume = (): number => {
  if (!analyser.value || !dataArray.value) return 0;

  analyser.value.getByteFrequencyData(dataArray.value);

  let sum = 0;
  for (let i = 0; i < dataArray.value.length; i++) {
    sum += dataArray.value[i];
  }

  return sum / dataArray.value.length;
};

const startVoiceActivityDetection = (stream: MediaStream) => {
  try {
    // Create or reuse AudioContext
    if (!audioContext.value || audioContext.value.state === 'closed') {
      audioContext.value = new AudioContext();
      console.log('VAD: Created new AudioContext');
    }

    // Disconnect any existing source
    if (currentSource.value) {
      currentSource.value.disconnect();
      currentSource.value = null;
    }

    currentSource.value = audioContext.value.createMediaStreamSource(stream);
    analyser.value = audioContext.value.createAnalyser();
    analyser.value.fftSize = 256;

    const bufferLength = analyser.value.frequencyBinCount;
    dataArray.value = new Uint8Array(bufferLength);

    currentSource.value.connect(analyser.value);

    console.log('VAD: Starting voice activity detection');

    // Measure baseline volume for first 500ms
    const baselineEndTime = Date.now() + BASELINE_MEASUREMENT_MS;
    let baselineSum = 0;
    let baselineCount = 0;

    const measureBaseline = () => {
      if (Date.now() < baselineEndTime && conversationState.value === 'listening') {
        const volume = calculateVolume();
        baselineSum += volume;
        baselineCount++;
        console.log(`VAD: Measuring baseline - volume: ${volume}`);
        requestAnimationFrame(measureBaseline);
      } else {
        baselineVolume.value = baselineSum / baselineCount;
        // Use a more robust threshold calculation - at least 5 units above baseline, or 50% more
        const minThreshold = baselineVolume.value + 5;
        const proportionalThreshold = baselineVolume.value + (baselineVolume.value * VOLUME_THRESHOLD_MULTIPLIER);
        volumeThreshold.value = Math.max(minThreshold, proportionalThreshold);

        console.log(`VAD: Baseline complete - baseline: ${baselineVolume.value}, threshold: ${volumeThreshold.value} (min: ${minThreshold}, prop: ${proportionalThreshold})`);

        // Start continuous VAD monitoring
        startVADMonitoring();
      }
    };

    measureBaseline();
  } catch (error) {
    console.error('VAD: Failed to start voice activity detection:', error);
  }
};

const startVADMonitoring = () => {
  let wasAboveThreshold = false;
  let previousVolume = 0;
  let logCount = 0;

  console.log('VAD: Starting monitoring');

  const checkVAD = () => {
    if (conversationState.value !== 'listening') {
      console.log('VAD: Stopping - conversation state changed to:', conversationState.value);
      return;
    }

    currentVolume.value = calculateVolume();
    const isAboveThreshold = currentVolume.value > volumeThreshold.value;

    // Debug logging every 30 frames (about once per second at 30fps)
    if (logCount % 30 === 0) {
      console.log(`VAD: volume=${currentVolume.value.toFixed(1)}, threshold=${volumeThreshold.value.toFixed(1)}, above=${isAboveThreshold}, wasAbove=${wasAboveThreshold}`);
    }
    logCount++;

    // Track significant volume changes
    if (Math.abs(currentVolume.value - previousVolume) > volumeThreshold.value * 0.2) {
      lastVolumeChangeTime.value = Date.now();
    }
    previousVolume = currentVolume.value;

    if (isAboveThreshold) {
      // User is speaking
      if (!wasAboveThreshold) {
        console.log('VAD: Speech detected!');
      }
      wasAboveThreshold = true;
      hasDetectedSpeech.value = true;
      silenceStartTime.value = 0;
    } else if (wasAboveThreshold) {
      // User stopped speaking, start silence timer
      if (silenceStartTime.value === 0) {
        silenceStartTime.value = Date.now();
        console.log('VAD: Silence started');
      } else {
        const silenceDuration = Date.now() - silenceStartTime.value;
        if (silenceDuration > SILENCE_DURATION_MS) {
          // Silence detected for long enough, auto-stop
          console.log(`VAD: Auto-stopping due to ${silenceDuration}ms of silence`);
          stopListening();
          return;
        }
      }
    }

    vadCheckInterval.value = requestAnimationFrame(checkVAD);
  };

  checkVAD();
};

const stopVADMonitoring = () => {
  console.log('VAD: Stopping monitoring and cleaning up audio resources');

  if (vadCheckInterval.value) {
    cancelAnimationFrame(vadCheckInterval.value);
    vadCheckInterval.value = null;
  }

  // Disconnect audio nodes
  if (currentSource.value) {
    try {
      currentSource.value.disconnect();
    } catch (error) {
      console.warn('VAD: Error disconnecting source:', error);
    }
    currentSource.value = null;
  }

  if (analyser.value) {
    try {
      analyser.value.disconnect();
    } catch (error) {
      console.warn('VAD: Error disconnecting analyser:', error);
    }
    analyser.value = null;
  }

  dataArray.value = null;
};

// Main conversation control functions
const toggleConversation = async () => {
  if (conversationState.value === 'idle') {
    await startConversation();
  } else if (conversationState.value === 'listening') {
    await stopListening();
  } else if (conversationState.value === 'speaking') {
    // Check if there's been no volume change recently - if so, end conversation
    const timeSinceVolumeChange = Date.now() - lastVolumeChangeTime.value;
    if (timeSinceVolumeChange > NO_VOLUME_CHANGE_MS && hasDetectedSpeech.value) {
      // User pressed button while AI speaking with no recent volume = end conversation
      conversationState.value = 'done';
      stopSpeaking();
      setTimeout(() => resetConversation(), 1000);
    } else {
      // Normal interruption - user wants to speak
      stopSpeaking();
    }
  } else if (conversationState.value === 'error' || conversationState.value === 'done') {
    resetConversation();
  }
};

const startConversation = async () => {
  try {
    conversationState.value = 'listening';
    hasDetectedSpeech.value = false;
    lastVolumeChangeTime.value = Date.now();
    emit('conversationStart');

    // Only use frontend mode for now
    await startMediaRecording();

  } catch (error) {
    console.error('Failed to start conversation:', error);
    conversationState.value = 'error';

    let errorMessage = 'Could not access microphone.';
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please enable microphone permissions.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone.';
      }
    }

    await presentToast(errorMessage);
    emit('error', errorMessage);
    resetConversation();
  }
};

const startMediaRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 48000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    }
  });

  // Track this stream for cleanup
  activeStreams.value.push(stream);
  console.log(`Audio: Tracking new stream, total active: ${activeStreams.value.length}`);

  // Start Voice Activity Detection
  startVoiceActivityDetection(stream);

  audioChunks.value = [];

  // Try formats that work better with Deepgram, starting with most compatible
  const formatPriority = [
    { mime: 'audio/wav', format: 'wav' },
    { mime: 'audio/webm;codecs=pcm', format: 'webm' },
    { mime: 'audio/mp4', format: 'mp4' },
    { mime: 'audio/webm', format: 'webm' },
    { mime: 'audio/webm;codecs=opus', format: 'webm' },
    { mime: 'audio/ogg;codecs=opus', format: 'ogg' }
  ];

  let mimeType = 'audio/webm;codecs=opus'; // fallback
  let actualFormat = 'webm';

  for (const format of formatPriority) {
    if (MediaRecorder.isTypeSupported(format.mime)) {
      mimeType = format.mime;
      actualFormat = format.format;
      console.log(`Selected ${actualFormat} format (${mimeType}) for recording`);
      break;
    }
  }

  // Store the format for use in processRecordedAudio
  currentMimeType.value = mimeType;
  currentFormat.value = actualFormat;

  mediaRecorder.value = new MediaRecorder(stream, {
    mimeType: mimeType
  });

  mediaRecorder.value.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.value.push(event.data);
    }
  };

  mediaRecorder.value.onstop = async () => {
    console.log('MediaRecorder: Stopping and cleaning up');

    // Force cleanup of this specific stream
    try {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log(`Audio: Stopped track: ${track.kind}`);
      });
    } catch (error) {
      console.error('Error stopping stream tracks:', error);
    }

    stopVADMonitoring();

    if (!continuousListening.value) {
      await processRecordedAudio();
    }
  };

  mediaRecorder.value.start();
  console.log('MediaRecorder: Started recording');
};

const stopListening = async () => {
  console.log('MediaRecorder: Attempting to stop listening');

  if (mediaRecorder.value) {
    const state = mediaRecorder.value.state;
    console.log(`MediaRecorder: Current state: ${state}`);

    if (state === 'recording') {
      conversationState.value = 'processing';
      continuousListening.value = false;
      try {
        mediaRecorder.value.stop();
        console.log('MediaRecorder: Stop called successfully');
      } catch (error) {
        console.error('MediaRecorder: Error stopping:', error);
        // Force cleanup even if stop fails
        forceCleanupAllStreams();
        resetConversation();
      }
    } else {
      console.log(`MediaRecorder: Not recording (state: ${state}), cleaning up anyway`);
      forceCleanupAllStreams();
      conversationState.value = 'idle';
    }
  } else {
    console.log('MediaRecorder: No active recorder to stop');
    forceCleanupAllStreams();
    conversationState.value = 'idle';
  }
};

const processRecordedAudio = async () => {
  try {
    if (audioChunks.value.length === 0) {
      throw new Error('No audio data recorded');
    }

    // Use the same format that was used for recording
    const audioBlob = new Blob(audioChunks.value, { type: currentMimeType.value });
    const base64Audio = await blobToBase64(audioBlob);

    // Backend mode: Send audio to backend for full processing
    const conversationResponse = await apiService.processConversation({
      sessionId: props.sessionId,
      audioData: base64Audio,
      encoding: currentFormat.value,
      sampleRate: 48000,
    });

    // Play the AI response audio
    await playResponseAudio(conversationResponse.responseAudio);

  } catch (error) {
    console.error('Failed to process conversation:', error);
    console.error('Error details:', error);

    conversationState.value = 'error';

    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;

      // Add more specific error information for debugging
      if (error.message.includes('500')) {
        errorMessage = 'Server error (500) - check backend API configuration';
      } else if (error.message.includes('transcribe')) {
        errorMessage = 'Speech transcription failed - API key issue?';
      }
    }

    await presentToast(`Conversation failed: ${errorMessage}`, 5000);
    emit('error', errorMessage);

    setTimeout(() => resetConversation(), 3000);
  }
};


const playResponseAudio = async (audioData: string) => {
  try {
    conversationState.value = 'speaking';

    // Start continuous listening while speaking (for interruption)
    if (!continuousListening.value) {
      continuousListening.value = true;
      await startContinuousListening();
    }

    currentAudio.value = new Audio(audioData);

    return new Promise<void>((resolve, reject) => {
      if (!currentAudio.value) {
        reject(new Error('Audio element not created'));
        return;
      }

      currentAudio.value.onended = () => {
        console.log('Audio: Playback ended naturally');
        resolve();
        resetConversation();
      };

      currentAudio.value.onerror = (error) => {
        console.error('Audio: Playback error:', error);
        // Clean up resources even on error
        try {
          if (currentAudio.value) {
            currentAudio.value.src = '';
            currentAudio.value.load();
          }
        } catch (e) {
          console.warn('Error cleaning up failed audio:', e);
        }
        reject(new Error('Audio playback failed'));
      };

      currentAudio.value.play().catch((playError) => {
        console.error('Audio: Play promise rejected:', playError);
        // Clean up on play failure
        try {
          if (currentAudio.value) {
            currentAudio.value.src = '';
            currentAudio.value.load();
          }
        } catch (e) {
          console.warn('Error cleaning up after play failure:', e);
        }
        reject(playError);
      });
    });

  } catch (error) {
    console.error('Failed to play response audio:', error);
    await presentToast('Could not play audio response');
    resetConversation();
  }
};

const startContinuousListening = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      }
    });

    // Track this stream for cleanup
    activeStreams.value.push(stream);
    console.log(`Audio: Tracking continuous listening stream, total active: ${activeStreams.value.length}`);

    startVoiceActivityDetection(stream);

    // Monitor for user interruption
    const monitorInterruption = () => {
      if (!continuousListening.value) return;

      const volume = calculateVolume();

      // If user starts speaking during AI response, interrupt
      if (volume > volumeThreshold.value && conversationState.value === 'speaking') {
        stopSpeaking();
        conversationState.value = 'listening';

        // Start new recording
        startMediaRecording();
        return;
      }

      requestAnimationFrame(monitorInterruption);
    };

    monitorInterruption();

  } catch (error) {
    console.error('Failed to start continuous listening:', error);
  }
};

const stopSpeaking = () => {
  console.log('Audio: Stopping speech playback');

  if (currentAudio.value) {
    try {
      currentAudio.value.pause();
      currentAudio.value.currentTime = 0;
      // Clear the src to release audio data
      currentAudio.value.src = '';
      currentAudio.value.load();
    } catch (error) {
      console.warn('Error stopping audio:', error);
    }
  }

  continuousListening.value = false;
  stopVADMonitoring();
  forceCleanupAllStreams();
};

const cancelConversation = () => {
  console.log('Audio: Cancelling conversation and cleaning up resources');

  try {
    if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
      mediaRecorder.value.stop();
    }
  } catch (error) {
    console.warn('Error stopping MediaRecorder:', error);
  }

  if (currentAudio.value) {
    stopSpeaking();
  }

  continuousListening.value = false;
  stopVADMonitoring();
  forceCleanupAllStreams();
  closeAudioContext();
  resetConversation();
};

const resetConversation = () => {
  console.log('Audio: Resetting conversation state');

  conversationState.value = 'idle';
  audioChunks.value = [];
  continuousListening.value = false;
  hasDetectedSpeech.value = false;
  lastVolumeChangeTime.value = 0;

  // Clean up MediaRecorder
  if (mediaRecorder.value) {
    try {
      if (mediaRecorder.value.state === 'recording') {
        mediaRecorder.value.stop();
      }
    } catch (error) {
      console.warn('Error stopping MediaRecorder in reset:', error);
    }
    mediaRecorder.value = null;
  }

  // Clean up audio element
  if (currentAudio.value) {
    try {
      currentAudio.value.pause();
      currentAudio.value.src = '';
      currentAudio.value.load();
      // Remove event listeners
      currentAudio.value.onended = null;
      currentAudio.value.onerror = null;
    } catch (error) {
      console.warn('Error cleaning up audio element:', error);
    }
    currentAudio.value = null;
  }

  stopVADMonitoring();
  forceCleanupAllStreams();
  emit('conversationEnd');
};

// Utility functions
const presentToast = async (message: string, duration: number = 3000, color: string = 'danger') => {
  console.log(`TOAST [${color}]: ${message}`);
  const toast = await toastController.create({
    message: message,
    duration: duration,
    position: 'bottom',
    color: color,
  });
  await toast.present();
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Force cleanup all MediaStreams
const forceCleanupAllStreams = () => {
  console.log(`Audio: Force cleaning up ${activeStreams.value.length} active streams`);

  activeStreams.value.forEach((stream, index) => {
    try {
      stream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
          console.log(`Audio: Force stopped track ${index}: ${track.kind}`);
        }
      });
    } catch (error) {
      console.warn(`Error cleaning up stream ${index}:`, error);
    }
  });

  activeStreams.value = [];
};

// Close AudioContext properly
const closeAudioContext = async () => {
  if (audioContext.value && audioContext.value.state !== 'closed') {
    try {
      console.log('Audio: Closing AudioContext');
      await audioContext.value.close();
      audioContext.value = null;
    } catch (error) {
      console.warn('Error closing AudioContext:', error);
    }
  }
};

// System-level cleanup
const systemCleanup = () => {
  console.log('Audio: Performing system-level cleanup');
  cancelConversation();
  forceCleanupAllStreams();
  closeAudioContext();
};

// Cleanup on unmount
onUnmounted(() => {
  systemCleanup();
});

// Cleanup on page unload/visibility change
onMounted(() => {
  const handleBeforeUnload = () => {
    console.log('Audio: Page unloading, cleaning up resources');
    systemCleanup();
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.log('Audio: Page hidden, cleaning up resources');
      systemCleanup();
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Cleanup listeners on unmount
  onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });
});
</script>

<style scoped>
.conversation-button {
  --padding-start: 8px;
  --padding-end: 8px;
  height: 40px;
  position: relative;
}

.ripple-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.conversation-icon {
  transition: all 0.3s ease;
  z-index: 2;
  position: relative;
}

.conversation-icon.listening {
  color: var(--ion-color-primary);
}

.conversation-icon.processing {
  color: var(--ion-color-secondary);
  animation: pulse 1.5s ease-in-out infinite;
}

.conversation-icon.speaking {
  color: var(--ion-color-tertiary);
}

.conversation-icon.done {
  color: var(--ion-color-medium);
}

.ripple-animation {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.ripple {
  position: absolute;
  border: 2px solid;
  border-radius: 50%;
  pointer-events: none;
}

/* Listening ripples - gentle pulse */
.listening-ripples .ripple {
  border-color: var(--ion-color-primary);
  opacity: 0.6;
  animation: listening-pulse var(--ripple-duration, 2.5s) infinite ease-out;
  transform: scale(var(--ripple-scale, 1));
}

.listening-ripples .ripple:nth-child(1) {
  animation-delay: 0s;
}

.listening-ripples .ripple:nth-child(2) {
  animation-delay: 0.8s;
  opacity: 0.4;
}

.listening-ripples .ripple:nth-child(3) {
  animation-delay: 1.6s;
  opacity: 0.3;
}

/* Processing ripples - subtle pulsing */
.processing-ripples .ripple {
  border-color: var(--ion-color-secondary);
  opacity: 0.5;
  animation: processing-pulse 2s infinite ease-in-out;
}

.processing-ripples .ripple:nth-child(1) {
  animation-delay: 0s;
}

.processing-ripples .ripple:nth-child(2) {
  animation-delay: 0.7s;
  opacity: 0.3;
}

.processing-ripples .ripple:nth-child(3) {
  animation-delay: 1.4s;
  opacity: 0.2;
}

/* Speaking ripples - gentle waves */
.speaking-ripples .ripple {
  border-color: var(--ion-color-tertiary);
  opacity: 0.5;
  animation: speaking-wave 3.5s infinite ease-in-out;
}

.speaking-ripples .ripple:nth-child(1) {
  animation-delay: 0s;
}

.speaking-ripples .ripple:nth-child(2) {
  animation-delay: 1s;
}

.speaking-ripples .ripple:nth-child(3) {
  animation-delay: 2s;
}

/* Animations - gentle and subtle */
@keyframes listening-pulse {
  0% {
    width: 24px;
    height: 24px;
    opacity: 0.6;
    top: -12px;
    left: -12px;
    transform: scale(var(--ripple-scale, 1));
  }
  70% {
    width: 40px;
    height: 40px;
    opacity: 0.3;
    top: -20px;
    left: -20px;
    transform: scale(var(--ripple-scale, 1.2));
  }
  100% {
    width: 45px;
    height: 45px;
    opacity: 0;
    top: -22.5px;
    left: -22.5px;
    transform: scale(var(--ripple-scale, 1.3));
  }
}

@keyframes processing-pulse {
  0%, 100% {
    width: 26px;
    height: 26px;
    opacity: 0.5;
    top: -13px;
    left: -13px;
  }
  50% {
    width: 34px;
    height: 34px;
    opacity: 0.2;
    top: -17px;
    left: -17px;
  }
}

@keyframes speaking-wave {
  0%, 100% {
    width: 28px;
    height: 28px;
    opacity: 0.5;
    top: -14px;
    left: -14px;
  }
  50% {
    width: 38px;
    height: 38px;
    opacity: 0.2;
    top: -19px;
    left: -19px;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* Custom button padding class */
.custom-button-padding {
  --padding-start: 8px;
  --padding-end: 8px;
  height: 40px;
}
</style>