import { watch } from 'vue'
import { useAgentChatStore } from '@/stores/agentChatStore'
import apiService from '@/services/apiService'
import { toastController } from '@ionic/vue'

/**
 * Composable for handling automatic Text-to-Speech when assistant messages arrive
 * Only triggers TTS if the last user message was sent via speech-to-text
 */
export function useSpeechTTS() {
  const agentChatStore = useAgentChatStore()

  // Watch for new assistant messages
  const stopWatcher = watch(
    () => agentChatStore.getActiveConversation()?.messages,
    (newMessages, oldMessages) => {
      // Only trigger TTS if last message was sent via speech
      if (!agentChatStore.lastMessageWasSpeech) {
        console.log('🎤 [TTS] Skipping TTS - last message was not via speech')
        return
      }

      if (!newMessages || !oldMessages) {
        return
      }

      // Find newly added completed assistant messages (not placeholders)
      const oldLength = oldMessages.length
      const newAssistantMessages = newMessages
        .slice(oldLength)
        .filter(msg => 
          msg.role === 'assistant' && 
          !msg.metadata?.isPlaceholder &&
          msg.content &&
          msg.content.trim().length > 0
        )

      if (newAssistantMessages.length > 0) {
        const latestMessage = newAssistantMessages[newAssistantMessages.length - 1]
        console.log('🎤 [TTS] New assistant message detected, triggering TTS:', latestMessage.content)
        handleTextToSpeech(latestMessage.content)
      }
    },
    { deep: true }
  )

  async function handleTextToSpeech(text: string) {
    try {
      console.log('🎤 [TTS] Starting text-to-speech conversion...')
      
      // Synthesize the response text to speech
      const synthesizedAudio = await apiService.synthesizeText(
        text,
        'EXAVITQu4vr4xnSDxMaL' // Default voice ID
      )

      console.log('🎤 [TTS] Audio synthesis completed, starting playback...')
      
      // Play the response audio
      await playAudio(synthesizedAudio.audioData)
      
      console.log('🎤 [TTS] Audio playback finished successfully')
      
      // Clear the speech flag after successful TTS
      agentChatStore.setLastMessageWasSpeech(false)
      
    } catch (error) {
      console.error('🎤 [TTS] Failed to convert text to speech:', error)
      
      // Show error toast
      const toast = await toastController.create({
        message: 'Voice synthesis failed',
        duration: 3000,
        color: 'warning',
        position: 'bottom'
      })
      await toast.present()
      
      // Clear the speech flag even on error
      agentChatStore.setLastMessageWasSpeech(false)
    }
  }

  async function playAudio(audioData: string) {
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio()
      
      // Set up event handlers
      audio.onended = () => {
        console.log('🎤 [TTS] Audio playback ended naturally')
        resolve()
      }
      
      audio.onerror = (error) => {
        console.error('🎤 [TTS] Audio playback error:', error)
        reject(new Error('Audio playback failed'))
      }
      
      // Set the audio source and play
      audio.src = `data:audio/mp3;base64,${audioData}`
      audio.play().catch(reject)
    })
  }

  // Return cleanup function
  return {
    stopWatcher
  }
}