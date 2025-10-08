<template>
  <section id="pricing" class="pricing-section landing-section animate-on-scroll">
    <div class="section-header">
      <h2>Founding Partner Pricing</h2>
      <p class="section-subtitle">
        Transparent, partnership-oriented pricing. No hidden fees, no long-term lock-ins.
        We grow with you.
      </p>
    </div>
    <div class="pricing-grid">
      <!-- Setup Package -->
      <div class="pricing-card highlight">
        <h3 class="package-title">Founding Partner Setup</h3>
        <p class="package-price">$25,000 <span class="price-tag">one-time</span></p>
        <ul class="package-features">
          <li>🚀 Private fork deployed on your server</li>
          <li>🔐 Security-hardened Docker container</li>
          <li>⚙️ 80 hours customization credit</li>
          <li>📈 Priority roadmap influence</li>
        </ul>
        <ion-button size="large" class="cta-button" @click="$emit('scheduleCall')">
          Reserve Your Spot (5 left)
        </ion-button>
      </div>
      <!-- Ongoing Development -->
      <div class="pricing-card">
        <h3 class="package-title">Ongoing Development</h3>
        <p class="package-price">$100/hr <span class="price-tag">Founder</span></p>
        <p class="sub-price">$40/hr <span class="price-tag">Interns</span></p>
        <ul class="package-features">
          <li>🔧 Pay-as-you-go, billed weekly</li>
          <li>🧰 Mix founder & intern hours as needed</li>
          <li>📊 Time-tracking transparency</li>
          <li>📅 10 hrs/mo included retainer</li>
        </ul>
        <ion-button size="large" fill="outline" class="cta-button secondary" @click="$emit('scheduleCall')">
          Discuss Your Project
        </ion-button>
      </div>
      <!-- Updates & Separation -->
      <div class="pricing-card">
        <h3 class="package-title">Updates & Separation</h3>
        <p class="package-price">Continuous Updates <span class="price-tag">free while active</span></p>
        <p class="sub-price">$25,000 <span class="price-tag">separation fee*</span></p>
        <ul class="package-features">
          <li>📦 Automated merges of core system</li>
          <li>🔀 We avoid conflicts with your custom agents</li>
          <li>🛡️ You keep your code fork forever</li>
          <li>💡 *Waived after $50k development spend</li>
        </ul>
        <ion-button size="large" fill="outline" class="cta-button" @click="$emit('scheduleCall')">
          Learn More
        </ion-button>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { IonButton } from '@ionic/vue';
/**
 * Emits:
 *  - schedule-call: trigger parent to scroll to CTA or open Calendly
 */
defineEmits<{
  scheduleCall: []
}>();
</script>
<style scoped>
.pricing-section {
  background: var(--landing-white);
  padding: 4rem 0;
}
.section-header {
  text-align: center;
  margin-bottom: 3rem;
}
.section-header h2 {
  font-size: 2rem;
  color: var(--landing-dark);
  margin-bottom: 0.5rem;
  font-weight: 700;
}
.section-subtitle {
  font-size: 1.1rem;
  color: var(--landing-gray);
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 0 2rem;
}
.pricing-card {
  background: var(--landing-primary-50);
  border-radius: 20px;
  padding: 2rem 1.5rem;
  border: 2px solid transparent;
  position: relative;
  transition: var(--transition-smooth);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.pricing-card.highlight {
  border-color: var(--landing-secondary);
  background: linear-gradient(135deg, var(--landing-secondary-light), var(--landing-primary-50));
  box-shadow: var(--shadow-green);
}
.pricing-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--landing-secondary);
}
.package-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--landing-dark);
  margin-bottom: 0.75rem;
}
.package-price {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--landing-secondary);
  margin-bottom: 0.25rem;
}
.sub-price {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--landing-primary-dark);
  margin-bottom: 0.75rem;
}
.price-tag {
  font-size: 0.8rem;
  color: var(--landing-gray);
  font-weight: 500;
}
.package-features {
  list-style: none;
  padding: 0;
  margin: 1rem 0 2rem;
  text-align: left;
}
.package-features li {
  margin-bottom: 0.5rem;
  color: var(--landing-dark);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.cta-button {
  --background: var(--landing-accent);
  --color: white;
  --border-radius: 8px;
  font-weight: 600;
  width: 100%;
}
.cta-button.secondary {
  --background: var(--landing-white);
  --color: var(--landing-secondary);
  border: 2px solid var(--landing-secondary);
  --box-shadow: var(--shadow-sm);
}
@media (max-width: 768px) {
  .pricing-grid {
    grid-template-columns: 1fr;
    padding: 0 1rem;
  }
  .pricing-card {
    padding: 1.5rem 1.25rem;
  }
}
</style>
