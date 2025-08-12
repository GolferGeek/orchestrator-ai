<template>
  <ion-app>
    <ion-router-outlet id="main-content"></ion-router-outlet>
  </ion-app>
</template>

<script lang="ts" setup>
import { IonApp, IonRouterOutlet } from '@ionic/vue';
</script>

<style>
@import '@/styles/landing.css';
@import '@/styles/components.css';
@import '@/styles/animations.css';
</style>
