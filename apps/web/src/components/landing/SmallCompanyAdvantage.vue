<template>
  <section id="small-company-advantage" class="small-company-section landing-section animate-on-scroll">
    <div class="section-header">
      <h2>Why Small Companies Win with AI</h2>
      <p class="section-subtitle">
        While big companies focus on efficiency, small companies can use AI for something far more powerful: 
        <strong>growth of opportunity</strong>.
      </p>
    </div>
    <div class="advantage-grid">
      <!-- Growth vs Efficiency -->
      <div class="advantage-card highlight">
        <div class="advantage-icon">
          <ion-icon :icon="trendingUpOutline"></ion-icon>
        </div>
        <h3>Growth vs Efficiency Mindset</h3>
        <p>
          <strong>Big companies:</strong> "How can AI make our existing processes 10% faster?"<br>
          <strong>Small companies:</strong> "What new opportunities can AI unlock that we never had before?"
        </p>
        <div class="advantage-example">
          <span class="example-label">Example:</span>
          <span class="example-text">A small marketing agency uses AI to offer 24/7 customer service, 
          creating a competitive advantage that big agencies can't match.</span>
        </div>
      </div>
      <!-- Innovation Advantage -->
      <div class="advantage-card">
        <div class="advantage-icon">
          <ion-icon :icon="bulbOutline"></ion-icon>
        </div>
        <h3>Innovation vs Risk Aversion</h3>
        <p>
          <strong>Big companies:</strong> Innovation committees, months of approval processes, 
          "proven solutions only"<br>
          <strong>Small companies:</strong> "Let's try this tomorrow and see what happens"
        </p>
        <div class="advantage-example">
          <span class="example-label">Example:</span>
          <span class="example-text">A small law firm deploys AI contract review in a week, 
          while big firms spend months evaluating "enterprise solutions."</span>
        </div>
      </div>
      <!-- Speed Advantage -->
      <div class="advantage-card">
        <div class="advantage-icon">
          <ion-icon :icon="flashOutline"></ion-icon>
        </div>
        <h3>Speed of Implementation</h3>
        <p>
          <strong>Big companies:</strong> 18-month AI rollouts, vendor lock-in, 
          "we need to train 10,000 people"<br>
          <strong>Small companies:</strong> Deploy in days, customize in hours, 
          "let's see what works"
        </p>
        <div class="advantage-example">
          <span class="example-label">Example:</span>
          <span class="example-text">A small restaurant chain adds AI-powered inventory management 
          in a weekend, while big chains plan for years.</span>
        </div>
      </div>
      <!-- Personal Touch -->
      <div class="advantage-card">
        <div class="advantage-icon">
          <ion-icon :icon="peopleOutline"></ion-icon>
        </div>
        <h3>Personal + AI = Unstoppable</h3>
        <p>
          <strong>Big companies:</strong> "Replace human interaction with AI"<br>
          <strong>Small companies:</strong> "Use AI to make our human touch even more valuable"
        </p>
        <div class="advantage-example">
          <span class="example-label">Example:</span>
          <span class="example-text">A small consulting firm uses AI for research and analysis, 
          then delivers personalized insights that big firms can't match.</span>
        </div>
      </div>
    </div>
    <div class="advantage-cta">
      <div class="cta-content">
        <h3>Ready to Turn Your Size into an Advantage?</h3>
        <p>
          While big companies are stuck in "efficiency mode," you can be in "opportunity mode." 
          Let's build an AI workforce that grows with your business, not one that tries to replace it.
        </p>
        <ion-button 
          size="large" 
          class="cta-button"
          @click="$emit('scrollToPricing')"
        >
          <ion-icon slot="start" :icon="rocketOutline"></ion-icon>
          See Our Founding Partner Deal
        </ion-button>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { IonIcon, IonButton } from '@ionic/vue';
import { 
  trendingUpOutline, 
  bulbOutline, 
  flashOutline, 
  peopleOutline, 
  rocketOutline 
} from 'ionicons/icons';
defineEmits<{
  scrollToPricing: []
}>();
</script>
<style scoped>
.small-company-section {
  background: var(--landing-primary-50);
  padding: 4rem 0;
}
.section-header {
  text-align: center;
  margin-bottom: 3rem;
}
.section-header h2 {
  font-size: 2.5rem;
  color: var(--landing-dark);
  margin-bottom: 1rem;
  font-weight: 700;
}
.section-subtitle {
  font-size: 1.2rem;
  color: var(--landing-gray);
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.6;
}
.advantage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}
.advantage-card {
  background: var(--landing-white);
  border-radius: 16px;
  padding: 2rem;
  border: 2px solid transparent;
  transition: var(--transition-smooth);
  box-shadow: var(--shadow-sm);
}
.advantage-card.highlight {
  border-color: var(--landing-secondary);
  background: linear-gradient(135deg, var(--landing-secondary-light), var(--landing-white));
  box-shadow: var(--shadow-green);
}
.advantage-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--landing-secondary);
}
.advantage-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  background: var(--landing-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}
.advantage-icon ion-icon {
  font-size: 1.8rem;
  color: var(--landing-white);
}
.advantage-card h3 {
  font-size: 1.3rem;
  color: var(--landing-dark);
  margin-bottom: 1rem;
  font-weight: 600;
}
.advantage-card p {
  color: var(--landing-gray);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}
.advantage-example {
  background: var(--landing-primary-100);
  border-radius: 8px;
  padding: 1rem;
  border-left: 4px solid var(--landing-secondary);
}
.example-label {
  font-weight: 600;
  color: var(--landing-secondary);
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}
.example-text {
  color: var(--landing-dark);
  font-size: 0.9rem;
  line-height: 1.5;
}
.advantage-cta {
  background: var(--landing-white);
  border-radius: 20px;
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: var(--shadow-md);
  border: 2px solid var(--landing-secondary-light);
}
.cta-content h3 {
  font-size: 1.8rem;
  color: var(--landing-dark);
  margin-bottom: 1rem;
  font-weight: 700;
}
.cta-content p {
  font-size: 1.1rem;
  color: var(--landing-gray);
  margin-bottom: 2rem;
  line-height: 1.6;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}
.cta-button {
  --background: var(--landing-accent);
  --color: var(--landing-white);
  --border-radius: 8px;
  font-weight: 600;
}
@media (max-width: 768px) {
  .advantage-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .advantage-card {
    padding: 1.5rem;
  }
  .section-header h2 {
    font-size: 2rem;
  }
  .section-subtitle {
    font-size: 1rem;
  }
  .cta-content h3 {
    font-size: 1.5rem;
  }
}
</style>
