import { ref } from 'vue';

export type NotificationSoundType = 'completion' | 'needsInput' | 'error';

export function useSoundNotifications() {
  const isEnabled = ref(true);
  const volume = ref(0.5);

  // Simple beep sounds using Web Audio API
  const playBeep = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!isEnabled.value) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;
      gainNode.gain.value = volume.value;

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.error('Failed to play sound:', error);
    }
  };

  // Play a pleasant completion sound (ascending notes)
  const playCompletionSound = () => {
    if (!isEnabled.value) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;

      // Three ascending notes for a pleasant "done" sound
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

      notes.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';

        const startTime = now + (index * 0.1);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume.value, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.15);
      });
    } catch (error) {
      console.error('Failed to play completion sound:', error);
    }
  };

  // Play an attention-getting sound for input needed
  const playNeedsInputSound = () => {
    if (!isEnabled.value) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;

      // Two alternating notes to get attention
      const notes = [880, 1046.5]; // A5, C6

      for (let i = 0; i < 2; i++) {
        notes.forEach((freq, noteIndex) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = freq;
          oscillator.type = 'square';

          const startTime = now + (i * 0.3) + (noteIndex * 0.15);
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(volume.value * 0.6, startTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);

          oscillator.start(startTime);
          oscillator.stop(startTime + 0.12);
        });
      }
    } catch (error) {
      console.error('Failed to play needs input sound:', error);
    }
  };

  // Play error sound (descending notes)
  const playErrorSound = () => {
    if (!isEnabled.value) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;

      // Descending notes for error
      const notes = [440, 369.99, 293.66]; // A4, F#4, D4

      notes.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sawtooth';

        const startTime = now + (index * 0.1);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume.value * 0.4, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.15);
      });
    } catch (error) {
      console.error('Failed to play error sound:', error);
    }
  };

  // Generic notification sound by type
  const playNotification = (type: NotificationSoundType) => {
    switch (type) {
      case 'completion':
        playCompletionSound();
        break;
      case 'needsInput':
        playNeedsInputSound();
        break;
      case 'error':
        playErrorSound();
        break;
    }
  };

  // Toggle sound on/off
  const toggleSound = () => {
    isEnabled.value = !isEnabled.value;
  };

  // Set volume (0 to 1)
  const setVolume = (newVolume: number) => {
    volume.value = Math.max(0, Math.min(1, newVolume));
  };

  return {
    isEnabled,
    volume,
    playCompletionSound,
    playNeedsInputSound,
    playErrorSound,
    playNotification,
    toggleSound,
    setVolume
  };
}
