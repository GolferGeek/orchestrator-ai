<template>
  <ion-page class="video-gallery-page">
    <ion-header>
      <ion-toolbar>
        <ion-title>Video Gallery - Building AI Together</ion-title>
        <ion-buttons slot="start">
          <ion-button @click="$router.push('/')">
            <ion-icon :icon="arrowBackOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    
    <ion-content class="ion-padding">
      <div class="gallery-intro">
        <h1>The Complete Picture</h1>
        <p>Raw, unpolished demos showing exactly how our AI workforce platform works. No marketing fluff - just real functionality.</p>
      </div>

      <!-- Video Categories -->
      <div class="video-categories">
        <!-- Quick Demos -->
        <div class="category-section">
          <h2>Quick Demos (2-3 min)</h2>
          <div class="video-grid">
            <div class="video-card">
              <div class="video-placeholder">
                <h3>🎬 Here's What We Built</h3>
                <p>Dashboard tour + 3 agent demos</p>
                <p><em>Recording in progress...</em></p>
              </div>
            </div>
            
            <div class="video-card">
              <div class="video-placeholder">
                <h3>🗣️ Voice + Agent Builder Demo</h3>
                <p>STT/TTS + agent-building-agent</p>
                <p><em>Recording in progress...</em></p>
              </div>
            </div>
            
            <div class="video-card">
              <div class="video-placeholder">
                <h3>📊 SQL Generation Live</h3>
                <p>Natural language to SQL queries</p>
                <p><em>Recording in progress...</em></p>
              </div>
            </div>
          </div>
        </div>

        <!-- Deep Dives -->
        <div class="category-section">
          <h2>Deep Dives (5+ min)</h2>
          <div class="video-grid">
            <div class="video-card">
              <div class="video-placeholder">
                <h3>🚀 Deployment in Real Time</h3>
                <p>Docker deploy process from start to finish</p>
                <p><em>Recording in progress...</em></p>
              </div>
            </div>
            
            <div class="video-card">
              <div class="video-placeholder">
                <h3>⚙️ Agent Customization Process</h3>
                <p>Edit context files live for client needs</p>
                <p><em>Recording in progress...</em></p>
              </div>
            </div>
            
            <div class="video-card">
              <div class="video-placeholder">
                <h3>🔄 Project Orchestration Preview</h3>
                <p>Multi-agent workflow concepts</p>
                <p><em>Recording in progress...</em></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="gallery-cta">
        <h2>Ready to See This Running for Your Business?</h2>
        <ion-button size="large" @click="$router.push('/#pricing')">
          <ion-icon slot="start" :icon="rocketOutline"></ion-icon>
          Become a Founding Partner
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon } from '@ionic/vue';
import { arrowBackOutline, rocketOutline } from 'ionicons/icons';
</script>

<style scoped>
.video-gallery-page {
  --ion-background-color: var(--landing-light);
}

.gallery-intro {
  text-align: center;
  margin-bottom: 3rem;
}

.gallery-intro h1 {
  font-size: 2.5rem;
  color: var(--landing-dark);
  margin-bottom: 1rem;
}

.gallery-intro p {
  font-size: 1.1rem;
  color: #6b7280;
  max-width: 600px;
  margin: 0 auto;
}

.category-section {
  margin-bottom: 3rem;
}

.category-section h2 {
  color: var(--landing-primary);
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--landing-primary);
  padding-bottom: 0.5rem;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
}

.video-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  transition: var(--transition-smooth);
}

.video-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
}

.video-placeholder {
  padding: 2rem;
  text-align: center;
  background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
  border: 2px dashed #d1d5db;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.video-placeholder h3 {
  color: var(--landing-dark);
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.video-placeholder p {
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.video-placeholder em {
  color: var(--landing-primary);
  font-style: italic;
}

.gallery-cta {
  text-align: center;
  padding: 3rem 0;
  background: var(--landing-gradient);
  border-radius: 16px;
  color: white;
  margin-top: 3rem;
}

.gallery-cta h2 {
  margin-bottom: 1.5rem;
}

.gallery-cta ion-button {
  --background: var(--landing-accent);
  --color: white;
  font-weight: 600;
}
</style>
