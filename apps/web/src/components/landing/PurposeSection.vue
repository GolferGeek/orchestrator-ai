<template>
  <section id="our-purpose" class="purpose-section landing-section animate-on-scroll">
    <div class="section-header">
      <h2>Our Purpose</h2>
      <p class="section-subtitle">
        I'm not building a unicorn. I'm not chasing VC funding. I'm not trying to "disrupt" anything.
        Here's what I'm actually doing and why.
      </p>
    </div>
    <div class="purpose-grid">
      <!-- What I'm Not Doing -->
      <div class="purpose-card not-doing">
        <div class="card-header">
          <div class="purpose-icon not">
            <ion-icon :icon="closeCircleOutline"></ion-icon>
          </div>
          <h3>What I'm NOT Doing</h3>
        </div>
        <ul class="purpose-list">
          <li>🚀 Building a "unicorn" SaaS company</li>
          <li>💰 Chasing venture capital funding</li>
          <li>📈 Optimizing for exponential growth</li>
          <li>🏢 Trying to "disrupt" entire industries</li>
          <li>🎯 Scaling to serve thousands of customers</li>
          <li>💼 Building an empire or legacy</li>
        </ul>
      </div>
      <!-- What I AM Doing -->
      <div class="purpose-card doing highlight">
        <div class="card-header">
          <div class="purpose-icon doing">
            <ion-icon :icon="heartOutline"></ion-icon>
          </div>
          <h3>What I AM Doing</h3>
        </div>
        <ul class="purpose-list">
          <li>🤝 Working with 5-10 like-minded small businesses</li>
          <li>👨‍💻 Building real software that solves real problems</li>
          <li>💰 Earning enough to support my family comfortably</li>
          <li>🎓 Mentoring interns in this weird economy</li>
          <li>🔧 Creating tools that actually work</li>
          <li>🌱 Growing sustainably, not exponentially</li>
        </ul>
      </div>
    </div>
    <div class="mission-section">
      <h3>The Mission</h3>
      <div class="mission-content">
        <p class="mission-statement">
          I want to work with a small group of businesses that are as excited about AI as I am. 
          Companies that see AI as a tool for growth and opportunity, not just efficiency. 
          Businesses that are willing to experiment, iterate, and build something amazing together.
        </p>
        <div class="mission-values">
          <div class="value-item">
            <div class="value-icon">
              <ion-icon :icon="peopleOutline"></ion-icon>
            </div>
            <div class="value-content">
              <h4>Partnership Over Transaction</h4>
              <p>We're building together, not just buying software. Your success is my success.</p>
            </div>
          </div>
          <div class="value-item">
            <div class="value-icon">
              <ion-icon :icon="shieldOutline"></ion-icon>
            </div>
            <div class="value-content">
              <h4>Authenticity Over Hype</h4>
              <p>No AI predictions, no "revolutionary" claims. Just honest work on real problems.</p>
            </div>
          </div>
          <div class="value-item">
            <div class="value-icon">
              <ion-icon :icon="leafOutline"></ion-icon>
            </div>
            <div class="value-content">
              <h4>Sustainability Over Growth</h4>
              <p>I want to build something that lasts, not something that burns out.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="success-section">
      <h3>What Success Looks Like</h3>
      <div class="success-grid">
        <div class="success-item">
          <div class="success-number">5-10</div>
          <div class="success-label">Happy Clients</div>
          <div class="success-desc">Small businesses using AI to grow and compete</div>
        </div>
        <div class="success-item">
          <div class="success-number">$150k</div>
          <div class="success-label">Annual Revenue</div>
          <div class="success-desc">Enough to support my family and invest in interns</div>
        </div>
        <div class="success-item">
          <div class="success-number">3-5</div>
          <div class="success-label">Interns Mentored</div>
          <div class="success-desc">Helping new CS grads in this challenging economy</div>
        </div>
        <div class="success-item">
          <div class="success-number">∞</div>
          <div class="success-label">Learning & Growth</div>
          <div class="success-desc">Building cutting-edge AI systems that actually work</div>
        </div>
      </div>
    </div>
    <div class="section-cta">
      <div class="cta-content">
        <h3>Ready to Build Something Real Together?</h3>
        <p>
          If you're a small business that sees AI as an opportunity for growth, not just efficiency, 
          and you want to work with someone who's building real software instead of chasing unicorns, 
          let's talk.
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
  closeCircleOutline,
  heartOutline,
  peopleOutline,
  shieldOutline,
  leafOutline,
  rocketOutline
} from 'ionicons/icons';
defineEmits<{
  scrollToPricing: []
}>();
</script>
<style scoped>
.purpose-section {
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
.purpose-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}
.purpose-card {
  background: var(--landing-white);
  border-radius: 16px;
  padding: 2rem;
  border: 2px solid transparent;
  transition: var(--transition-smooth);
  box-shadow: var(--shadow-sm);
}
.purpose-card.highlight {
  border-color: var(--landing-secondary);
  background: linear-gradient(135deg, var(--landing-secondary-light), var(--landing-white));
  box-shadow: var(--shadow-green);
}
.purpose-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.purpose-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--landing-white);
}
.purpose-icon.not {
  background: linear-gradient(135deg, #ef4444, #f87171);
}
.purpose-icon.doing {
  background: var(--landing-gradient);
}
.purpose-icon ion-icon {
  font-size: 1.5rem;
}
.card-header h3 {
  font-size: 1.3rem;
  color: var(--landing-dark);
  margin: 0;
  font-weight: 600;
}
.purpose-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.purpose-list li {
  margin-bottom: 0.75rem;
  color: var(--landing-dark);
  font-size: 0.95rem;
  line-height: 1.5;
}
.mission-section {
  text-align: center;
  margin-bottom: 4rem;
}
.mission-section h3 {
  font-size: 2rem;
  color: var(--landing-dark);
  margin-bottom: 2rem;
  font-weight: 700;
}
.mission-statement {
  font-size: 1.2rem;
  color: var(--landing-gray);
  line-height: 1.6;
  max-width: 800px;
  margin: 0 auto 3rem;
}
.mission-values {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}
.value-item {
  background: var(--landing-white);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--landing-primary-100);
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  text-align: left;
}
.value-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--landing-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--landing-white);
  flex-shrink: 0;
}
.value-icon ion-icon {
  font-size: 1.5rem;
}
.value-content h4 {
  font-size: 1.1rem;
  color: var(--landing-dark);
  margin-bottom: 0.5rem;
  font-weight: 600;
}
.value-content p {
  color: var(--landing-gray);
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
}
.success-section {
  text-align: center;
  margin-bottom: 4rem;
}
.success-section h3 {
  font-size: 2rem;
  color: var(--landing-dark);
  margin-bottom: 2rem;
  font-weight: 700;
}
.success-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
}
.success-item {
  background: var(--landing-white);
  border-radius: 16px;
  padding: 2rem 1.5rem;
  box-shadow: var(--shadow-sm);
  border: 2px solid var(--landing-primary-100);
}
.success-number {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--landing-secondary);
  margin-bottom: 0.5rem;
}
.success-label {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--landing-dark);
  margin-bottom: 0.75rem;
}
.success-desc {
  font-size: 0.9rem;
  color: var(--landing-gray);
  line-height: 1.5;
}
.section-cta {
  background: var(--landing-gradient);
  border-radius: 20px;
  padding: 3rem 2rem;
  text-align: center;
  color: var(--landing-white);
}
.cta-content h3 {
  font-size: 1.8rem;
  margin-bottom: 1rem;
  font-weight: 700;
}
.cta-content p {
  font-size: 1.1rem;
  margin-bottom: 2rem;
  opacity: 0.9;
  line-height: 1.6;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}
.cta-button {
  --background: var(--landing-white);
  --color: var(--landing-primary);
  --border-radius: 8px;
  font-weight: 600;
}
@media (max-width: 768px) {
  .purpose-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .purpose-card {
    padding: 1.5rem;
  }
  .mission-values {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .value-item {
    flex-direction: column;
    text-align: center;
  }
  .success-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  .success-item {
    padding: 1.5rem 1rem;
  }
  .success-number {
    font-size: 2rem;
  }
  .section-header h2 {
    font-size: 2rem;
  }
  .section-subtitle {
    font-size: 1rem;
  }
  .mission-statement {
    font-size: 1rem;
  }
}
</style>
