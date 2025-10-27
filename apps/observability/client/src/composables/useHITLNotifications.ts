import { ref } from 'vue';
import type { HookEvent } from '../types';
import { useSoundNotifications } from './useSoundNotifications';

export function useHITLNotifications() {
  const hasPermission = ref(false);
  const soundNotifications = useSoundNotifications();

  // Request notification permission
  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      hasPermission.value = permission === 'granted';
    }
  };

  // Show notification for HITL request
  const notifyHITLRequest = (event: HookEvent) => {
    // Play sound notification
    soundNotifications.playNeedsInputSound();

    if (!hasPermission.value || !event.humanInTheLoop) return;

    const notification = new Notification('Agent Needs Your Input', {
      body: event.humanInTheLoop.question.slice(0, 100),
      icon: '/vite.svg',
      tag: `hitl-${event.id}`,
      requireInteraction: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  };

  // Notify when agent completes
  const notifyAgentCompletion = (event: HookEvent) => {
    // Play completion sound
    soundNotifications.playCompletionSound();

    if (!hasPermission.value) return;

    const notification = new Notification('Agent Task Completed', {
      body: `${event.eventType} completed successfully`,
      icon: '/vite.svg',
      tag: `complete-${event.id}`
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  };

  return {
    hasPermission,
    requestPermission,
    notifyHITLRequest,
    notifyAgentCompletion,
    soundNotifications
  };
}
