<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { onMounted } from 'vue';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

onMounted(async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      // Set a default style (e.g., adapts to system theme)
      // You can choose Style.Dark or Style.Light for fixed styles
      await StatusBar.setStyle({ style: Style.Default });
      
      // Example: To make status bar translucent and content draw behind it (requires careful CSS handling for header padding)
      // await StatusBar.setOverlaysWebView({ overlay: true });
      // await StatusBar.setBackgroundColor({ color: '#RRGGBBCC' }); // If overlay is true, set a translucent color

      console.log('StatusBar style set.');
    } catch (e) {
      console.error('Failed to set StatusBar style', e);
    }
  }
});
</script>
