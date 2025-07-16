<template>
  <div class="modifier-tags">
    <div v-if="modifiers.length > 0" class="tags-container">
      <div 
        v-for="modifier in modifiers" 
        :key="modifier"
        class="modifier-tag"
      >
        <span class="tag-text">{{ modifier }}</span>
        <button 
          @click="removeModifier(modifier)"
          class="remove-button"
          :aria-label="`Remove ${modifier} modifier`"
        >
          ×
        </button>
      </div>
    </div>
    
    <div v-else class="no-modifiers">
      No additional modifiers selected
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modifiers: string[];
}

interface Emits {
  (e: 'remove-modifier', modifierName: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const removeModifier = (modifierName: string) => {
  emit('remove-modifier', modifierName);
};
</script>

<style scoped>
.modifier-tags {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.modifier-tag {
  background: #e8f4fd;
  color: #3498db;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #d5e8f5;
  transition: all 0.2s ease;
}

.modifier-tag:hover {
  background: #d5e8f5;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tag-text {
  user-select: none;
}

.remove-button {
  background: rgba(52, 152, 219, 0.2);
  border: none;
  color: #3498db;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.remove-button:hover {
  background: rgba(52, 152, 219, 0.3);
  transform: scale(1.1);
}

.remove-button:active {
  transform: scale(0.95);
}

.no-modifiers {
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 1rem;
}
</style>