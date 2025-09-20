<template>
  <div class="section-navigation" :class="{ 'is-sticky': isSticky }">
    <div class="nav-content">
      <div class="nav-buttons">
        <button 
          v-for="section in navigationSections" 
          :key="section.id"
          class="nav-section-button"
          @click="toggleSection(section.id)"
        >
          <ion-icon :icon="section.icon"></ion-icon>
          <span>{{ section.title }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { IonIcon } from '@ionic/vue';
import { 
  constructOutline,
  trendingUpOutline,
  micOutline,
  cardOutline,
  heartOutline
} from 'ionicons/icons';

interface NavigationSection {
  id: string;
  title: string;
  icon: string;
}

const navigationSections: NavigationSection[] = [
  {
    id: 'what-we-built',
    title: 'What We\'ve Built',
    icon: constructOutline
  },
  {
    id: 'small-company-advantage',
    title: 'Why Small Companies Win',
    icon: trendingUpOutline
  },
  {
    id: 'anti-influencer',
    title: 'Why I\'m Not a YouTuber',
    icon: micOutline
  },
  {
    id: 'pricing',
    title: 'Founding Partner Deal',
    icon: cardOutline
  },
  {
    id: 'our-purpose',
    title: 'Our Purpose',
    icon: heartOutline
  }
];

const isSticky = ref(false);

const emit = defineEmits<{
  sectionToggled: [sectionId: string, isActive: boolean];
}>();

function toggleSection(sectionId: string) {
  // Always scroll to the section when clicked
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  
  // Emit event for any parent components that need it
  emit('sectionToggled', sectionId, true);
}

// Handle scroll to make navigation sticky
function handleScroll() {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  isSticky.value = scrollTop > 50; // Start sticking after 50px scroll
  
  // Add/remove body class for padding
  if (isSticky.value) {
    document.body.classList.add('sticky-nav');
  } else {
    document.body.classList.remove('sticky-nav');
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<style scoped>
.section-navigation {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem 0;
  transition: all 0.3s ease;
  z-index: 50;
  position: relative;
}

.section-navigation.is-sticky {
  position: fixed;
  top: 60px; /* Position below the main header */
  left: 0;
  right: 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 90; /* Lower than main header but higher than content */
}

.nav-content {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: 0 2rem;
}

.nav-buttons {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.nav-section-button {
  background: none;
  border: 1px solid var(--landing-primary);
  color: var(--landing-primary);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-smooth);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}

.nav-section-button:hover {
  background: var(--landing-primary);
  color: white;
  transform: translateY(-1px);
}

.nav-section-button.active {
  background: var(--landing-primary);
  color: white;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
}

.nav-section-button ion-icon {
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .section-navigation {
    padding: 0.75rem 0;
  }
  
  .nav-content {
    padding: 0 1rem;
  }
  
  .nav-buttons {
    gap: 0.25rem;
  }
  
  .nav-section-button {
    padding: 0.4rem 0.75rem;
    font-size: 0.75rem;
  }
  
  .nav-section-button span {
    display: none;
  }
}

/* Add top padding to body when sticky */
:global(body.sticky-nav) {
  padding-top: 140px; /* 60px for main header + 80px for sticky nav */
}
</style>
