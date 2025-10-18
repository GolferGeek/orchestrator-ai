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
        <h1>Video Library</h1>
        <p>All our demos and behind-the-scenes videos in one place.</p>
        
        <!-- Stats -->
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-number">{{ videoStats.totalVideos }}</span>
            <span class="stat-label">Videos</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ videoStats.totalCategories }}</span>
            <span class="stat-label">Categories</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ videoStats.totalDurationFormatted }}</span>
            <span class="stat-label">Total Duration</span>
          </div>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="search-section">
        <ion-searchbar 
          v-model="searchQuery" 
          placeholder="Search videos..."
          @ion-input="handleSearch"
          class="custom-searchbar"
        ></ion-searchbar>
      </div>

      <!-- Search Results -->
      <div v-if="searchResults.length > 0" class="search-results">
        <h2>Search Results ({{ searchResults.length }})</h2>
        <div class="video-list">
          <div 
            v-for="result in searchResults" 
            :key="result.video.id"
            class="video-list-item"
            @click="openVideoModal(result.video)"
          >
            <div class="video-info">
              <h3>{{ result.video.title }}</h3>
              <p>{{ result.video.description }}</p>
              <div class="video-meta">
                <span class="duration">{{ result.video.duration }}</span>
                <span class="category">{{ result.category.title }}</span>
                <span v-if="result.video.featured" class="featured-badge">Featured</span>
              </div>
            </div>
            <div class="video-action">
              <ion-icon :icon="playCircleOutline" class="play-icon"></ion-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- Categories -->
      <div v-else>
        <div 
          v-for="item in videoCategories" 
          :key="item.key"
          class="category-section"
        >
          <h2>{{ item.category.title }}</h2>
          <p class="category-description">{{ item.category.description }}</p>
          
          <div class="video-list">
            <div 
              v-for="video in videoService.getVideosByCategory(item.key)" 
              :key="video.id"
              class="video-list-item"
              :class="{ featured: video.featured }"
              @click="openVideoModal(video)"
            >
              <div class="video-info">
                <h3>{{ video.title }}</h3>
                <p>{{ video.description }}</p>
                <div class="video-meta">
                  <span class="duration">{{ video.duration }}</span>
                  <span v-if="video.featured" class="featured-badge">Featured</span>
                </div>
              </div>
              <div class="video-action">
                <ion-icon :icon="playCircleOutline" class="play-icon"></ion-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CTA Section -->
      <div class="gallery-cta">
        <h2>Want to See More?</h2>
        <p>Schedule a call to see live demos and discuss your specific needs.</p>
        <ion-button size="large" @click="$router.push('/')">
          <ion-icon slot="start" :icon="calendarOutline"></ion-icon>
          Schedule a Call
        </ion-button>
      </div>
    </ion-content>

    <!-- Video Modal -->
    <VideoModal 
      :is-open="isVideoModalOpen"
      :video-title="currentVideo?.title || ''"
      :video-description="currentVideo?.description || ''"
      :video-url="currentVideo?.url"
      @close="closeVideoModal"
    />
  </ion-page>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon, IonButton, IonSearchbar } from '@ionic/vue';
import { arrowBackOutline, playCircleOutline, calendarOutline } from 'ionicons/icons';
import VideoModal from '@/components/landing/VideoModal.vue';
import { videoService, type Video } from '@/services/videoService';

// Video modal state
const isVideoModalOpen = ref(false);
const currentVideo = ref<Video | null>(null);

// Search state
const searchQuery = ref('');
const searchResults = ref<Array<{ video: Video; category: unknown; categoryKey: string }>>([]);

// Get video data from service
const videoCategories = computed(() => videoService.getCategoriesInOrder());
const videoStats = computed(() => videoService.getStats());

function openVideoModal(video: Video) {
  currentVideo.value = video;
  isVideoModalOpen.value = true;
}

function closeVideoModal() {
  isVideoModalOpen.value = false;
  currentVideo.value = null;
}

function handleSearch() {
  if (searchQuery.value.trim()) {
    searchResults.value = videoService.searchVideos(searchQuery.value);
  } else {
    searchResults.value = [];
  }
}
</script>
<style scoped>
.video-gallery-page {
  --ion-background-color: var(--landing-light);
}
.gallery-intro {
  text-align: center;
  margin-bottom: 1.5rem;
}
.gallery-intro h1 {
  font-size: 2rem;
  color: var(--landing-dark);
  margin-bottom: 0.5rem;
}
.gallery-intro p {
  font-size: 1rem;
  color: var(--ion-color-medium);
  max-width: 600px;
  margin: 0 auto;
}

/* Stats Bar */
.stats-bar {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.stat-item {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--landing-primary);
}

.stat-label {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Search Section */
.search-section {
  margin: 2rem 0;
}

.custom-searchbar {
  --background: white;
  --border-radius: 12px;
  --box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

/* Search Results */
.search-results h2 {
  color: var(--landing-primary);
  margin-bottom: 1.5rem;
}

/* Video Links Styles */
.video-links {
  max-width: 600px;
  margin: 0 auto;
}

.video-link-item {
  margin-bottom: 1rem;
}

.video-link-item button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: white;
  border: 2px solid var(--ion-color-light-shade);
  border-radius: 12px;
  color: var(--landing-dark);
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-smooth);
  text-align: left;
}

.video-link-item button:hover {
  border-color: var(--landing-primary);
  background: var(--landing-primary-50);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.video-link-item button ion-icon {
  font-size: 1.3rem;
  color: var(--landing-primary);
}

.video-link-item button span {
  flex: 1;
}
.category-section {
  margin-bottom: 1.5rem;
}
.category-section h2 {
  color: var(--landing-primary);
  font-size: 1.2rem;
  margin-bottom: 0.25rem;
  border-bottom: 1px solid var(--landing-primary);
  padding-bottom: 0.25rem;
  font-weight: 600;
}
.category-description {
  color: var(--ion-color-medium);
  margin-bottom: 0.5rem;
  font-style: italic;
  font-size: 0.85rem;
}
/* Compact Video List Styles */
.video-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 1000px;
  margin: 0 auto;
}

.video-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 6px;
  cursor: pointer;
  transition: var(--transition-smooth);
  min-height: 48px;
}

.video-list-item:hover {
  border-color: var(--landing-primary);
  background: var(--landing-primary-50);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.video-list-item.featured {
  border-color: var(--landing-accent);
  background: var(--landing-accent-50);
}

.video-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.video-info h3 {
  color: var(--landing-dark);
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.2;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-info p {
  display: none; /* Hide description to save space */
}

.video-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.video-meta span {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
}

.duration {
  background: var(--ion-color-light);
  color: var(--ion-color-dark);
}

.category {
  background: var(--landing-primary-50);
  color: var(--landing-primary);
}

.featured-badge {
  background: var(--landing-accent);
  color: white;
}

.video-action {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.5rem;
  flex-shrink: 0;
}

.play-icon {
  font-size: 1.1rem;
  color: var(--landing-primary);
  transition: var(--transition-smooth);
}

.video-list-item:hover .play-icon {
  color: var(--landing-accent);
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

/* Mobile Responsive */
@media (max-width: 768px) {
  .video-list {
    gap: 0.2rem;
  }
  
  .video-list-item {
    padding: 0.4rem 0.6rem;
    min-height: 44px;
  }
  
  .video-info {
    gap: 0.5rem;
  }
  
  .video-info h3 {
    font-size: 0.9rem;
  }
  
  .video-meta {
    gap: 0.3rem;
  }
  
  .video-meta span {
    font-size: 0.65rem;
    padding: 0.1rem 0.3rem;
  }
  
  .play-icon {
    font-size: 1rem;
  }
  
  .category-section {
    margin-bottom: 1rem;
  }
  
  .category-section h2 {
    font-size: 1.1rem;
  }
  
  .category-description {
    font-size: 0.8rem;
    margin-bottom: 0.4rem;
  }
  
  .stats-bar {
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }
  
  .stat-item {
    text-align: center;
  }
  
  .stat-number {
    font-size: 1.4rem;
  }
}
</style>
