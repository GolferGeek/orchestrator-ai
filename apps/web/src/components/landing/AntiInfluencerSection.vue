<template>
  <section id="anti-influencer" class="anti-influencer-section landing-section animate-on-scroll">
    <div class="section-header">
      <h2>Why I'm Not a YouTube Influencer</h2>
      <p class="section-subtitle">
        I could be making viral videos about AI. Instead, I'm building real software for real businesses.
        Here's why that matters to you.
      </p>
    </div>
    <div class="comparison-grid">
      <!-- YouTube Influencer Path -->
      <div class="comparison-card influencer-path">
        <div class="card-header">
          <div class="path-icon influencer">
            <ion-icon :icon="videocamOutline"></ion-icon>
          </div>
          <h3>The YouTube Influencer Path</h3>
        </div>
        <div class="path-content">
          <ul class="path-list">
            <li>🎬 Create viral "AI will replace everything" videos</li>
            <li>📈 Build audience of 100k+ followers</li>
            <li>💰 Sell courses, memberships, consulting</li>
            <li>🎯 Focus on views, engagement, algorithm</li>
            <li>⏰ Spend 80% of time on content creation</li>
            <li>🔗 Promote affiliate products and sponsors</li>
          </ul>
          <div class="path-outcome">
            <strong>Outcome:</strong> You get entertained, I get rich, your business gets nothing.
          </div>
        </div>
      </div>
      <!-- Builder Path -->
      <div class="comparison-card builder-path highlight">
        <div class="card-header">
          <div class="path-icon builder">
            <ion-icon :icon="codeSlashOutline"></ion-icon>
          </div>
          <h3>The Builder Path (What I Actually Do)</h3>
        </div>
        <div class="path-content">
          <ul class="path-list">
            <li>🔧 Build real AI systems that actually work</li>
            <li>🤝 Work directly with 5-10 small businesses</li>
            <li>💼 Solve real problems, not hypothetical ones</li>
            <li>🎯 Focus on results, not views</li>
            <li>⏰ Spend 80% of time coding and customizing</li>
            <li>🔗 Integrate with your actual tools and systems</li>
          </ul>
          <div class="path-outcome">
            <strong>Outcome:</strong> You get a working AI workforce, I get to build cool stuff, we both win.
          </div>
        </div>
      </div>
    </div>
    <div class="authenticity-section">
      <h3>The Authenticity Gap</h3>
      <div class="authenticity-grid">
        <div class="authenticity-point">
          <div class="point-icon">
            <ion-icon :icon="checkmarkCircleOutline"></ion-icon>
          </div>
          <h4>Real Problems, Real Solutions</h4>
          <p>I'm not theorizing about AI - I'm building it for actual businesses with actual challenges.</p>
        </div>
        <div class="authenticity-point">
          <div class="point-icon">
            <ion-icon :icon="shieldCheckmarkOutline"></ion-icon>
          </div>
          <h4>No Hidden Agendas</h4>
          <p>I'm not trying to sell you courses, memberships, or affiliate products. Just real software.</p>
        </div>
        <div class="authenticity-point">
          <div class="point-icon">
            <ion-icon :icon="handLeftOutline"></ion-icon>
          </div>
          <h4>Hands-On Partnership</h4>
          <p>I'll be the one actually building and customizing your AI agents, not just talking about them.</p>
        </div>
      </div>
    </div>
    <div class="video-strategy">
      <h3>So Why the Videos?</h3>
      <p class="video-explanation">
        The videos I do create are <strong>unpolished, real demos</strong> - screen recordings with me in the corner 
        showing actual features working. No fancy editing, no clickbait titles, no "AI will replace everything" hype.
        Just honest demonstrations of what we're actually building.
      </p>
      <div class="video-types">
        <div class="video-type">
          <span class="video-icon">📊</span>
          <span class="video-title">Dashboard Tours</span>
          <span class="video-desc">See the actual interface</span>
        </div>
        <div class="video-type">
          <span class="video-icon">🤖</span>
          <span class="video-title">Agent Demos</span>
          <span class="video-desc">Watch agents in action</span>
        </div>
        <div class="video-type">
          <span class="video-icon">⚙️</span>
          <span class="video-title">Customization Process</span>
          <span class="video-desc">See how we adapt for you</span>
        </div>
      </div>
    </div>
    <div class="section-cta">
      <div class="cta-content">
        <h3>Ready to Work with a Builder, Not a Talker?</h3>
        <p>
          I'm not here to entertain you with AI predictions. I'm here to build you an AI workforce 
          that actually works for your business. Let's get started.
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
  videocamOutline,
  codeSlashOutline,
  checkmarkCircleOutline,
  shieldCheckmarkOutline,
  handLeftOutline,
  rocketOutline
} from 'ionicons/icons';
defineEmits<{
  scrollToPricing: []
}>();
</script>
<style scoped>
.anti-influencer-section {
  background: var(--landing-white);
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
.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}
.comparison-card {
  background: var(--landing-primary-50);
  border-radius: 16px;
  padding: 2rem;
  border: 2px solid transparent;
  transition: var(--transition-smooth);
}
.comparison-card.highlight {
  border-color: var(--landing-secondary);
  background: linear-gradient(135deg, var(--landing-secondary-light), var(--landing-primary-50));
  box-shadow: var(--shadow-green);
}
.comparison-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.path-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--landing-white);
}
.path-icon.influencer {
  background: linear-gradient(135deg, #ef4444, #f87171);
}
.path-icon.builder {
  background: var(--landing-gradient);
}
.path-icon ion-icon {
  font-size: 1.5rem;
}
.card-header h3 {
  font-size: 1.3rem;
  color: var(--landing-dark);
  margin: 0;
  font-weight: 600;
}
.path-list {
  list-style: none;
  padding: 0;
  margin-bottom: 1.5rem;
}
.path-list li {
  margin-bottom: 0.75rem;
  color: var(--landing-dark);
  font-size: 0.95rem;
  line-height: 1.5;
}
.path-outcome {
  background: var(--landing-white);
  border-radius: 8px;
  padding: 1rem;
  border-left: 4px solid var(--landing-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}
.authenticity-section {
  text-align: center;
  margin-bottom: 4rem;
}
.authenticity-section h3 {
  font-size: 2rem;
  color: var(--landing-dark);
  margin-bottom: 2rem;
  font-weight: 700;
}
.authenticity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}
.authenticity-point {
  background: var(--landing-white);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--landing-primary-100);
}
.point-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--landing-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  color: var(--landing-white);
}
.point-icon ion-icon {
  font-size: 1.5rem;
}
.authenticity-point h4 {
  font-size: 1.1rem;
  color: var(--landing-dark);
  margin-bottom: 0.75rem;
  font-weight: 600;
}
.authenticity-point p {
  color: var(--landing-gray);
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
}
.video-strategy {
  background: var(--landing-primary-50);
  border-radius: 20px;
  padding: 3rem 2rem;
  text-align: center;
  margin-bottom: 3rem;
}
.video-strategy h3 {
  font-size: 1.8rem;
  color: var(--landing-dark);
  margin-bottom: 1rem;
  font-weight: 700;
}
.video-explanation {
  font-size: 1.1rem;
  color: var(--landing-gray);
  margin-bottom: 2rem;
  line-height: 1.6;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}
.video-types {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}
.video-type {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.video-icon {
  font-size: 2rem;
}
.video-title {
  font-weight: 600;
  color: var(--landing-dark);
  font-size: 1rem;
}
.video-desc {
  color: var(--landing-gray);
  font-size: 0.85rem;
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
  .comparison-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .comparison-card {
    padding: 1.5rem;
  }
  .authenticity-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .video-types {
    flex-direction: column;
    gap: 1.5rem;
  }
  .section-header h2 {
    font-size: 2rem;
  }
  .section-subtitle {
    font-size: 1rem;
  }
}
</style>
