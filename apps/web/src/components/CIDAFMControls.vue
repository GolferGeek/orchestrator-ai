<template>
  <div class="cidafm-controls">
    <div class="cidafm-header">
      <h3>Behavior Modifiers</h3>
      <button 
        @click="showHelp = !showHelp" 
        class="help-toggle"
        :class="{ active: showHelp }"
      >
        ?
      </button>
    </div>
    <!-- Help Text -->
    <div v-if="showHelp" class="help-section">
      <p>
        <strong>Behavior Modifiers</strong> allow you to customize how the AI responds to your prompts:
      </p>
      <ul>
        <li>Choose modifiers that change the AI's tone, style, or approach</li>
        <li>Each modifier applies to the current conversation</li>
        <li>You can combine multiple modifiers for more specific results</li>
      </ul>
    </div>
    <!-- Built-in Commands by Type -->
    <div v-if="!llmStore.loadingCommands" class="command-sections">
      <div 
        v-for="(commands, type) in filteredCommandsByType" 
        :key="type"
        class="command-section"
      >
        <h4 class="command-type-header">
          {{ getCommandTypeLabel(String(type)) }}
          <span class="command-symbol">{{ type }}</span>
        </h4>
        <div class="command-table">
          <div class="command-table-header">
            <div class="header-select">Select</div>
            <div class="header-name">Modifier</div>
            <div class="header-description">Description</div>
          </div>
          <div 
            v-for="command in commands" 
            :key="command.id"
            class="command-row"
            :class="{ active: isCommandSelected(command.name) }"
          >
            <div class="command-select">
              <input 
                type="checkbox"
                :checked="isCommandSelected(command.name)"
                @change="toggleCommand(command.name)"
                class="command-checkbox"
              >
            </div>
            <div class="command-name">{{ command.name }}</div>
            <div class="command-description">
              {{ command.description }}
              <div v-if="command.example" class="command-example">
                Example: {{ command.example }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Loading State -->
    <div v-if="llmStore.loadingCommands" class="loading-state">
      Loading behavior modifiers...
    </div>
    <!-- Error State -->
    <div v-if="llmStore.commandError" class="error-state">
      Error loading commands: {{ llmStore.commandError }}
    </div>
    <!-- Additional Modifiers -->
    <div class="additional-modifiers-section">
      <h4>Additional Modifiers</h4>
      <!-- Modifier Selector -->
      <CIDAFMModifierSelector
        :available-commands="availableCommands"
        :loading-commands="llmStore.loadingCommands"
        :command-error="llmStore.commandError"
        @add-modifier="addSelectedModifier"
      />
      <!-- Modifier Tags -->
      <div class="modifier-tags-container">
        <CIDAFMModifierTags
          :modifiers="llmStore.customModifiers"
          @remove-modifier="removeCustomModifier"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLLMPreferencesStore } from '../stores/llmPreferencesStore';
import CIDAFMModifierSelector from './CIDAFMModifierSelector.vue';
import CIDAFMModifierTags from './CIDAFMModifierTags.vue';
const llmStore = useLLMPreferencesStore();
const showHelp = ref(false);
onMounted(async () => {
  if (llmStore.cidafmCommands.length === 0) {
    await llmStore.fetchCIDAFMCommands();
  }
});
import type { CIDAFMCommand } from '@/types/llm';

// Computed properties
const filteredCommandsByType = computed(() => {
  // Only show ^ (caret) commands - per-prompt modifiers
  const filtered: { [key: string]: CIDAFMCommand[] } = {};
  for (const [type, commands] of Object.entries(llmStore.builtinCommandsByType)) {
    if (type === '^') {
      filtered[type] = commands;
    }
  }
  return filtered;
});
const availableCommands = computed(() => 
  llmStore.cidafmCommands.filter(command => 
    command.type === '^' && // Only show ^ commands
    !llmStore.selectedCIDAFMCommands.includes(command.name) &&
    !llmStore.customModifiers.includes(command.name)
  )
);
// Helper functions
const getCommandTypeLabel = (type: string): string => {
  switch (type) {
    case '^': return 'Per-Prompt Modifiers';
    case '&': return 'State Modifiers';
    case '!': return 'Execution Commands';
    default: return 'Commands';
  }
};
const isCommandSelected = (commandName: string): boolean => {
  return llmStore.selectedCIDAFMCommands.includes(commandName);
};
const toggleCommand = (commandName: string) => {
  llmStore.toggleCIDAFMCommand(commandName);
  llmStore.saveToLocalStorage();
};
const addSelectedModifier = (modifierName: string) => {
  llmStore.addCustomModifier(modifierName);
  llmStore.saveToLocalStorage();
};
const removeCustomModifier = (modifier: string) => {
  llmStore.removeCustomModifier(modifier);
  llmStore.saveToLocalStorage();
};
</script>
<style scoped>
.cidafm-controls {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
  margin-bottom: 1rem;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}
.cidafm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.cidafm-header h3 {
  margin: 0;
  color: #2c3e50;
}
.help-toggle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #3498db;
  background: white;
  color: #3498db;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.8rem;
}
.help-toggle.active {
  background: #3498db;
  color: white;
}
.help-section {
  background: #e8f4fd;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
.help-section ul {
  margin: 0.5rem 0 0 1rem;
}
.help-section code {
  background: #d5e8f5;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-family: monospace;
}
.command-sections {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.command-section {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}
.command-type-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 1rem 0;
  color: #34495e;
}
.command-symbol {
  background: #34495e;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9rem;
}
.command-table {
  display: flex !important;
  flex-direction: column !important;
  background: white !important;
  border-radius: 8px !important;
  border: 1px solid #e0e0e0 !important;
  overflow: hidden !important;
  width: 100% !important;
  max-width: 100% !important;
}
.command-table-header {
  display: grid !important;
  grid-template-columns: 60px 1fr 2fr !important;
  gap: 1rem !important;
  padding: 0.75rem !important;
  background: #f8f9fa !important;
  border-bottom: 1px solid #e0e0e0 !important;
  font-weight: 600 !important;
  color: #2c3e50 !important;
  font-size: 0.9rem !important;
}
.command-row {
  display: grid !important;
  grid-template-columns: 60px 1fr 2fr !important;
  gap: 1rem !important;
  padding: 0.75rem !important;
  border-bottom: 1px solid #f0f0f0 !important;
  transition: all 0.2s ease !important;
  cursor: pointer !important;
}
.command-row:hover {
  background: #f8fbff;
}
.command-row.active {
  background: #e8f4fd;
  border-color: #3498db;
}
.command-row:last-child {
  border-bottom: none;
}
.command-select {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0.125rem;
}
.command-checkbox {
  margin: 0;
  cursor: pointer;
}
.command-name {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
  align-self: flex-start;
  padding-top: 0.125rem;
}
.command-description {
  font-size: 0.85rem;
  color: #666;
  line-height: 1.4;
}
.command-example {
  font-size: 0.8rem;
  color: #888;
  font-style: italic;
  margin-top: 0.25rem;
}
/* Mobile responsive */
@media (max-width: 768px) {
  .command-table-header {
    grid-template-columns: 50px 1fr;
    gap: 0.5rem;
  }
  .command-row {
    grid-template-columns: 50px 1fr;
    gap: 0.5rem;
  }
  .header-description,
  .command-description {
    grid-column: 1 / -1;
    margin-top: 0.5rem;
    padding-left: 0.5rem;
  }
  .command-name {
    font-size: 0.85rem;
  }
}
.additional-modifiers-section {
  margin-top: 1rem;
}
.additional-modifiers-section h4 {
  margin: 0 0 1rem 0;
  color: #34495e;
}
.modifier-tags-container {
  margin-top: 1rem;
}
.loading-state, .error-state {
  text-align: center;
  padding: 2rem;
  color: #666;
}
.error-state {
  color: #e74c3c;
}
</style>