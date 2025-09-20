<template>
  <section id="cta-section" class="cta-section">
    <div class="landing-section">
      <div class="cta-content">
        <h2>Ready to Build Something Real Together?</h2>
        <p class="cta-subtitle">
          Let's have an honest conversation about your business needs and see if we're the right fit.
          No pressure, no sales pitch - just two people figuring out if we can help each other grow.
        </p>
        <div class="cta-options">
          <div class="cta-option">
            <h3>📞 Schedule a Call</h3>
            <p>30-minute conversation to discuss your business challenges and see if our AI workforce could help.</p>
            <ion-button 
              size="large" 
              class="cta-button primary"
              @click="openCalendly"
            >
              <ion-icon slot="start" :icon="calendarOutline"></ion-icon>
              Book Free Consultation
            </ion-button>
          </div>
          <div class="cta-option">
            <h3>📧 Send Us a Message</h3>
            <p>Prefer email? Tell us about your business and we'll get back to you within 24 hours.</p>
            <ion-button 
              size="large" 
              fill="outline" 
              class="cta-button secondary"
              @click="openEmailForm"
            >
              <ion-icon slot="start" :icon="mailOutline"></ion-icon>
              Send Message
            </ion-button>
          </div>
        </div>
        <div class="cta-note">
          <p>
            <strong>What to expect:</strong> We'll ask about your current challenges, show you a live demo of our platform, 
            and discuss how we could customize it for your specific needs. If it's not a good fit, we'll tell you upfront.
          </p>
          <ion-button 
            fill="clear" 
            size="small" 
            class="view-video-button"
            @click="openVideoModal"
          >
            <ion-icon slot="start" :icon="playCircleOutline"></ion-icon>
            View Video
          </ion-button>
        </div>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { IonButton, IonIcon } from '@ionic/vue';
import { calendarOutline, mailOutline, playCircleOutline } from 'ionicons/icons';

const emit = defineEmits<{
  openVideoModal: [videoId: string];
}>();

function openVideoModal() {
  emit('openVideoModal', 'how-we-work');
}
function openCalendly() {
  // Open Calendly in a new window/tab
  window.open('https://calendly.com/orchestrator-ai/founding-partner-consultation', '_blank');
}
function openEmailForm() {
  // Open email form or trigger email modal
  window.location.href = 'mailto:hello@orchestrator-ai.com?subject=Founding Partner AI Workforce Consultation&body=Hi there,%0D%0A%0D%0AI\'m interested in learning more about your AI workforce platform and the founding partner opportunity.%0D%0A%0D%0AHere\'s a bit about my business:%0D%0A%0D%0A%0D%0A%0D%0AWhat specific challenges are you hoping AI could help with?%0D%0A%0D%0AThanks!';
}
</script>
<style scoped>
.cta-section {
  background: var(--landing-gradient);
  color: var(--landing-white);
  padding: 4rem 0;
}
.cta-content {
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
}
.cta-content h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  font-weight: 700;
}
.cta-subtitle {
  font-size: 1.2rem;
  margin-bottom: 3rem;
  opacity: 0.9;
  line-height: 1.6;
}
.cta-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}
.cta-option {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.cta-option h3 {
  font-size: 1.3rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
}
.cta-option p {
  margin-bottom: 1.5rem;
  opacity: 1;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.95);
}
.cta-button {
  --background: var(--landing-white);
  --color: var(--landing-primary);
  --border-radius: 8px;
  font-weight: 600;
  width: 100%;
}
.cta-button.secondary {
  --background: transparent;
  --color: var(--landing-white);
  border: 2px solid var(--landing-white);
}
.cta-note {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.cta-note p {
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
  opacity: 1;
  color: rgba(255, 255, 255, 0.95);
}

.view-video-button {
  --color: rgba(255, 255, 255, 0.9);
  --background: rgba(255, 255, 255, 0.1);
  --border-radius: 8px;
  font-weight: 500;
  margin-top: 0.5rem;
}

.view-video-button:hover {
  --color: white;
  --background: rgba(255, 255, 255, 0.2);
}
@media (max-width: 768px) {
  .cta-content h2 {
    font-size: 2rem;
  }
  .cta-subtitle {
    font-size: 1rem;
  }
  .cta-options {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .cta-option {
    padding: 1.5rem;
  }
}
</style>
