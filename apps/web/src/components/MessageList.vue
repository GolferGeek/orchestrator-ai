<template>
  <div class="message-list-container">
    <div v-if="messages.length === 0" class="empty-chat-placeholder">
      <p>No messages yet. Send a message to start the conversation!</p>
    </div>
    <transition-group name="message-fade" tag="div">
      <MessageItem
        v-for="message in messages"
        :key="message.id"
        :message="message"
      />
    </transition-group>
    <div ref="scrollTarget"></div> <!-- Element to scroll to -->
  </div>
</template>

<script setup lang="ts">
import { computed, watch, nextTick, ref } from 'vue';
import { useMessagesStore } from '../stores/messagesStore';
import MessageItem from './MessageItem.vue';

const messagesStore = useMessagesStore();
const messages = computed(() => messagesStore.getMessages);

const scrollTarget = ref<HTMLElement | null>(null);

// Watch for new messages and scroll to the bottom
watch(messages, async () => {
  await nextTick(); // Wait for DOM update
  if (scrollTarget.value) {
    scrollTarget.value.scrollIntoView({ behavior: 'smooth' });
  }
}, { deep: true });

</script>

<style scoped>
.message-list-container {
  display: flex;
  flex-direction: column;
  height: 100%; /* Ensure it tries to fill parent (ion-content) */
  overflow-y: auto; /* Should be handled by ion-content, but good as a fallback */
}

.empty-chat-placeholder {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-medium-shade);
  text-align: center;
  padding: 20px;
}

/* Basic fade transition for new messages */
.message-fade-enter-active {
  transition: opacity 0.5s ease;
}
.message-fade-enter-from {
  opacity: 0;
}

</style> 