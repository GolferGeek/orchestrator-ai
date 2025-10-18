<template>
  <section class="disclosure-section">
    <div class="landing-section">
      <div class="disclosure-intro">
        <h2>Ready to Learn More?</h2>
        <p>Choose what you'd like to see first. No overwhelming info dumps.</p>
      </div>
      <div class="disclosure-buttons">
        <button 
          v-for="section in sections" 
          :key="section.id"
          class="disclosure-trigger"
          :class="{ active: activeSections.includes(section.id) }"
          :data-section="section.id"
          @click="toggleSection(section.id)"
        >
          <ion-icon :icon="section.icon" slot="start"></ion-icon>
          {{ section.title }}
          <span class="section-indicator" v-if="activeSections.includes(section.id)">✓</span>
        </button>
      </div>
      <div class="progress-indicator">
        <div class="progress-text">
          {{ activeSections.length }} of {{ sections.length }} sections explored
        </div>
        <div class="progress-dots">
          <div 
            v-for="section in sections"
            :key="section.id"
            class="progress-dot"
            :class="{ active: activeSections.includes(section.id) }"
          ></div>
        </div>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { 
  constructOutline, 
  trendingUpOutline, 
  micOutline, 
  cardOutline, 
  heartOutline 
} from 'ionicons/icons';
import { useLandingStore } from '@/stores/landingStore';
const landingStore = useLandingStore();
interface Section {
  id: string;
  title: string;
  icon: string;
  description: string;
}
const sections: Section[] = [
  {
    id: 'what-we-built',
    title: 'What We\'ve Built',
    icon: constructOutline,
    description: '39 AI agents, real-time orchestration, and cutting-edge features'
  },
  {
    id: 'small-company-advantage',
    title: 'Why Small Companies Win',
    icon: trendingUpOutline,
    description: 'Growth vs efficiency mindset and innovation advantages'
  },
  {
    id: 'anti-influencer',
    title: 'Why I\'m Not a YouTuber',
    icon: micOutline,
    description: 'Building real software vs creating viral content'
  },
  {
    id: 'pricing',
    title: 'Founding Partner Deal',
    icon: cardOutline,
    description: 'Transparent pricing and exclusive early access terms'
  },
  {
    id: 'our-purpose',
    title: 'Our Purpose',
    icon: heartOutline,
    description: 'Why we\'re doing this and what success looks like'
  }
];
const activeSections = ref<string[]>([]);
const emit = defineEmits<{
  sectionToggled: [sectionId: string, isActive: boolean]
}>();
function toggleSection(sectionId: string) {
  const isCurrentlyActive = activeSections.value.includes(sectionId);
  if (isCurrentlyActive) {
    // Remove from active sections
    activeSections.value = activeSections.value.filter(id => id !== sectionId);
  } else {
    // Add to active sections
    activeSections.value.push(sectionId);
    // Track section activation
    landingStore.trackSectionView(sectionId);
  }
  // Emit event to parent component
  emit('sectionToggled', sectionId, !isCurrentlyActive);
  // Scroll to section if activating
  if (!isCurrentlyActive) {
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }
}
// Computed property for completion percentage
// const completionPercentage = computed(() => 
//   (activeSections.value.length / sections.length) * 100
// );
</script>
<style scoped>
.disclosure-section {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 3rem 0;
}
.disclosure-intro {
  text-align: center;
  margin-bottom: 2rem;
}
.disclosure-intro h2 {
  font-size: 2rem;
  color: var(--landing-dark);
  margin-bottom: 0.5rem;
}
.disclosure-intro p {
  color: #6b7280;
  font-size: 1.1rem;
}
.disclosure-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
}
.disclosure-trigger {
  background: none;
  border: 2px solid var(--landing-primary);
  color: var(--landing-primary);
  padding: 1rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-smooth);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  position: relative;
}
.disclosure-trigger:hover {
  background: var(--landing-primary);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
}
.disclosure-trigger.active {
  background: var(--landing-primary);
  color: white;
  box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
}
.section-indicator {
  background: var(--landing-accent);
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}
.progress-indicator {
  text-align: center;
}
.progress-text {
  color: #6b7280;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}
.progress-dots {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}
.progress-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #d1d5db;
  transition: var(--transition-smooth);
}
.progress-dot.active {
  background: var(--landing-primary);
  transform: scale(1.2);
}
@media (max-width: 768px) {
  .disclosure-buttons {
    flex-direction: column;
    align-items: center;
  }
  .disclosure-trigger {
    width: 100%;
    max-width: 300px;
    justify-content: center;
  }
  .disclosure-intro h2 {
    font-size: 1.5rem;
  }
}
</style>
