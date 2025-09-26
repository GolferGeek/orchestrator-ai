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
        <ion-buttons slot="end" v-if="isAdmin">
          <ion-button @click="showAddVideoModal = true" fill="outline">
            <ion-icon slot="start" :icon="addOutline"></ion-icon>
            Add Video
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
                <span v-if="hasTranscript(result.video.id)" class="transcript-badge">
                  <ion-icon :icon="documentTextOutline"></ion-icon>
                  Transcript
                </span>
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
                  <span v-if="hasTranscript(video.id)" class="transcript-badge">
                    <ion-icon :icon="documentTextOutline"></ion-icon>
                    Transcript
                  </span>
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

    <!-- Add Video Admin Modal -->
    <ion-modal :is-open="showAddVideoModal" @did-dismiss="closeAddVideoModal" class="add-video-modal">
      <ion-header>
        <ion-toolbar>
          <ion-title>Add New Video</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeAddVideoModal" fill="clear">
              <ion-icon :icon="closeOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <form @submit.prevent="submitVideo">
          <ion-item>
            <ion-label position="stacked">Video ID*</ion-label>
            <ion-input v-model="newVideo.id" placeholder="agent-demo-example" required></ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Title*</ion-label>
            <ion-input v-model="newVideo.title" placeholder="Demo Title" required></ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Description*</ion-label>
            <ion-textarea v-model="newVideo.description" placeholder="Video description..." required></ion-textarea>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Video URL*</ion-label>
            <ion-input v-model="newVideo.url" placeholder="https://www.loom.com/embed/..." required></ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Duration*</ion-label>
            <ion-input v-model="newVideo.duration" placeholder="5:30" required></ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Category*</ion-label>
            <ion-select v-model="newVideo.categoryKey" placeholder="Select category" required>
              <ion-select-option v-for="category in availableCategories" :key="category.key" :value="category.key">
                {{ category.title }}
              </ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Order</ion-label>
            <ion-input v-model="newVideo.order" type="number" placeholder="1" required></ion-input>
          </ion-item>

          <ion-item>
            <ion-checkbox v-model="newVideo.featured"></ion-checkbox>
            <ion-label class="ion-margin-start">Featured Video</ion-label>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Transcript ID (optional)</ion-label>
            <ion-input v-model="newVideo.transcriptId" placeholder="Same as video ID"></ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Recording Status</ion-label>
            <ion-select v-model="newVideo.recordingStatus" placeholder="Select status">
              <ion-select-option value="ready_for_recording">Ready for Recording</ion-select-option>
              <ion-select-option value="in_production">In Production</ion-select-option>
              <ion-select-option value="completed">Completed</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-button expand="block" type="submit" :disabled="isSubmitting" class="submit-button">
            <ion-spinner v-if="isSubmitting" size="small"></ion-spinner>
            {{ isSubmitting ? 'Creating...' : 'Create Video' }}
          </ion-button>
        </form>

        <ion-toast 
          :is-open="showToast" 
          :message="toastMessage" 
          :color="toastColor"
          :duration="3000"
          @did-dismiss="showToast = false"
        ></ion-toast>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon, IonButton, IonSearchbar,
  IonModal, IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption, IonCheckbox, IonSpinner, IonToast
} from '@ionic/vue';
import { arrowBackOutline, playCircleOutline, calendarOutline, addOutline, closeOutline, documentTextOutline } from 'ionicons/icons';
import VideoModal from '@/components/landing/VideoModal.vue';
import { videoService, type Video } from '@/services/videoService';
import { useAuthStore } from '@/stores/authStore';
import { analyticsService } from '@/services/analyticsService';

// Auth store
const authStore = useAuthStore();

// Video modal state
const isVideoModalOpen = ref(false);
const currentVideo = ref<Video | null>(null);

// Search state
const searchQuery = ref('');
const searchResults = ref<Array<{ video: Video; category: any; categoryKey: string }>>([]);

// Admin modal state
const showAddVideoModal = ref(false);
const isSubmitting = ref(false);
const showToast = ref(false);
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger'>('success');
const availableCategories = ref<Array<{key: string, title: string}>>([]);

// New video form data
const newVideo = ref({
  id: '',
  title: '',
  description: '',
  url: '',
  duration: '',
  categoryKey: '',
  order: 1,
  featured: false,
  transcriptId: '',
  recordingStatus: 'ready_for_recording',
  createdAt: new Date().toISOString().split('T')[0]
});

// Get video data from service
const videoCategories = computed(() => videoService.getCategoriesInOrder());
const videoStats = computed(() => videoService.getStats());

// Check admin permissions
const isAdmin = computed(() => authStore.isAdmin);

function openVideoModal(video: Video) {
  currentVideo.value = video;
  isVideoModalOpen.value = true;
  
  // Track video modal open from gallery
  trackVideoGalleryClick(video);
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

// Admin functionality
function hasTranscript(videoId: string): boolean {
  // For now, assume transcript exists for videos with IDs that match known patterns
  // This will be enhanced when transcript API is fully integrated
  const videoTextsPattern = [
    'agent-default-overview',
    'metrics-agent-walkthrough', 
    'marketing-swarm-demo',
    'requirements-writer-tutorial',
    'golf-rules-coach-demo',
    'jokes-agent-demo'
  ];
  return videoTextsPattern.includes(videoId);
}

async function loadCategories() {
  try {
    const response = await fetch('/api/videos/categories');
    if (response.ok) {
      availableCategories.value = await response.json();
    } else {
      // Fallback to service categories
      availableCategories.value = videoService.getCategoriesInOrder().map(item => ({
        key: item.key,
        title: item.category.title
      }));
    }
  } catch (error) {
    console.error('Error loading categories:', error);
    // Fallback to service categories
    availableCategories.value = videoService.getCategoriesInOrder().map(item => ({
      key: item.key,
      title: item.category.title
    }));
  }
}

function closeAddVideoModal() {
  showAddVideoModal.value = false;
  resetForm();
}

function resetForm() {
  newVideo.value = {
    id: '',
    title: '',
    description: '',
    url: '',
    duration: '',
    categoryKey: '',
    order: 1,
    featured: false,
    transcriptId: '',
    recordingStatus: 'ready_for_recording',
    createdAt: new Date().toISOString().split('T')[0]
  };
}

async function submitVideo() {
  if (!authStore.token) {
    showToastMessage('Authentication required', 'danger');
    return;
  }

  isSubmitting.value = true;

  try {
    const videoData = {
      ...newVideo.value,
      createdAt: new Date().toISOString().split('T')[0]
    };

    const response = await fetch('/api/videos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify(videoData)
    });

    if (response.ok) {
      showToastMessage('Video created successfully!', 'success');
      
      // Track successful video creation
      await trackVideoCreationSuccess(videoData);
      
      closeAddVideoModal();
      
      // Refresh the page to show new video
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      const error = await response.json();
      showToastMessage(error.message || 'Failed to create video', 'danger');
      
      // Track failed video creation
      await trackVideoCreationFailure(videoData, error.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Error creating video:', error);
    showToastMessage('Error creating video', 'danger');
  } finally {
    isSubmitting.value = false;
  }
}

function showToastMessage(message: string, color: 'success' | 'danger') {
  toastMessage.value = message;
  toastColor.value = color;
  showToast.value = true;
}

// Analytics tracking functions
async function trackVideoGalleryClick(video: Video) {
  try {
    await analyticsService.trackEvent({
      eventType: 'video_gallery_click',
      category: 'video_gallery',
      action: 'video_click',
      label: video.title,
      metadata: {
        videoId: video.id,
        videoTitle: video.title,
        featured: video.featured || false,
        source: 'video_gallery_page',
        category: 'unknown' // Could be enhanced to include video category
      }
    });
  } catch (error) {
    console.warn('Failed to track video gallery click:', error);
  }
}

async function trackVideoCreationSuccess(videoData: any) {
  try {
    await analyticsService.trackEvent({
      eventType: 'admin_video_created',
      category: 'admin_actions',
      action: 'video_created',
      label: videoData.title,
      metadata: {
        videoId: videoData.id,
        videoTitle: videoData.title,
        categoryKey: videoData.categoryKey,
        featured: videoData.featured || false,
        recordingStatus: videoData.recordingStatus,
        hasTranscript: !!videoData.transcriptId,
        source: 'admin_modal',
        adminUserId: authStore.user?.id,
        success: true
      }
    });
  } catch (error) {
    console.warn('Failed to track video creation success:', error);
  }
}

async function trackVideoCreationFailure(videoData: any, errorMessage: string) {
  try {
    await analyticsService.trackEvent({
      eventType: 'admin_video_creation_failed',
      category: 'admin_actions',
      action: 'video_creation_failed',
      label: videoData.title,
      metadata: {
        videoId: videoData.id,
        videoTitle: videoData.title,
        categoryKey: videoData.categoryKey,
        errorMessage: errorMessage,
        source: 'admin_modal',
        adminUserId: authStore.user?.id,
        success: false
      }
    });
  } catch (error) {
    console.warn('Failed to track video creation failure:', error);
  }
}

// Initialize categories on mount
onMounted(() => {
  loadCategories();
});
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

.transcript-badge {
  background: var(--ion-color-secondary);
  color: white;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.transcript-badge ion-icon {
  font-size: 0.6rem;
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

/* Add Video Admin Modal */
.add-video-modal {
  --width: 90%;
  --max-width: 600px;
  --height: 80%;
  --border-radius: 12px;
}

.add-video-modal ion-content {
  --padding-top: 0;
  --padding-bottom: 0;
}

.add-video-modal form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.add-video-modal ion-item {
  --padding-start: 0;
  --inner-padding-end: 0;
  --border-radius: 8px;
  --background: var(--ion-color-light);
  margin-bottom: 0.5rem;
}

.add-video-modal ion-label {
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-bottom: 0.5rem;
}

.add-video-modal ion-input,
.add-video-modal ion-textarea,
.add-video-modal ion-select {
  --padding-start: 12px;
  --padding-end: 12px;
}

.submit-button {
  margin-top: 1rem;
  --background: var(--ion-color-primary);
  --color: white;
  --border-radius: 8px;
  height: 48px;
  font-weight: 600;
}

.submit-button:disabled {
  --background: var(--ion-color-medium);
  opacity: 0.6;
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

  .add-video-modal {
    --width: 95%;
    --height: 90%;
  }

  .add-video-modal ion-item {
    margin-bottom: 0.75rem;
  }

  .add-video-modal ion-label {
    font-size: 0.9rem;
  }

  .submit-button {
    height: 44px;
    font-size: 1rem;
  }
}
</style>
