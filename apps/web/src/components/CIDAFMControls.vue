<template>
  <div class="cidafm-controls">
    <div class="cidafm-header">
      <h3>Behavior Modifiers (CIDAFM)</h3>
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
        <strong>CIDAFM (Context Import Document + AI Function Module)</strong> allows you to modify how the AI responds:
      </p>
      <ul>
        <li><code>^</code> <strong>Response Modifiers:</strong> Change how the AI formats its output</li>
        <li><code>&</code> <strong>State Modifiers:</strong> Adjust the AI's personality and tone</li>
        <li><code>!</code> <strong>Execution Commands:</strong> Trigger specific behaviors</li>
      </ul>
    </div>

    <!-- Built-in Commands by Type -->
    <div v-if="!llmStore.loadingCommands" class="command-sections">
      <div 
        v-for="(commands, type) in llmStore.builtinCommandsByType" 
        :key="type"
        class="command-section"
      >
        <h4 class="command-type-header">
          {{ getCommandTypeLabel(type) }}
          <span class="command-symbol">{{ type }}</span>
        </h4>
        
        <div class="command-grid">
          <label 
            v-for="command in commands" 
            :key="command.id"
            class="command-item"
            :class="{ active: isCommandSelected(command.name) }"
          >
            <input 
              type="checkbox"
              :checked="isCommandSelected(command.name)"
              @change="toggleCommand(command.name)"
              class="command-checkbox"
            >
            <div class="command-content">
              <div class="command-name">{{ command.name }}</div>
              <div class="command-description">{{ command.description }}</div>
              <div v-if="command.example" class="command-example">
                Example: {{ command.example }}
              </div>
            </div>
          </label>
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

    <!-- Custom Modifiers -->
    <div class="custom-modifiers-section">
      <h4>Custom Modifiers</h4>
      <div class="custom-input-group">
        <input 
          v-model="newCustomModifier"
          type="text" 
          placeholder="Enter custom behavior modifier..."
          class="custom-input"
          @keyup.enter="addCustomModifier"
        >
        <button 
          @click="addCustomModifier"
          :disabled="!newCustomModifier.trim()"
          class="add-button"
        >
          Add
        </button>
      </div>
      
      <!-- Custom Modifier Tags -->
      <div v-if="llmStore.customModifiers.length > 0" class="custom-tags">
        <span 
          v-for="modifier in llmStore.customModifiers" 
          :key="modifier"
          class="custom-tag"
        >
          {{ modifier }}
          <button 
            @click="removeCustomModifier(modifier)"
            class="remove-tag"
          >
            ×
          </button>
        </span>
      </div>
    </div>

    <!-- Selected Commands Summary -->
    <div v-if="hasActiveModifiers" class="active-summary">
      <h4>Active Modifiers</h4>
      <div class="active-list">
        <span 
          v-for="command in activeCommands" 
          :key="command"
          class="active-tag"
        >
          {{ command }}
        </span>
        <span 
          v-for="modifier in llmStore.customModifiers" 
          :key="modifier"
          class="active-tag custom"
        >
          {{ modifier }}
        </span>
      </div>
      <button @click="clearAll" class="clear-button">
        Clear All
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLLMStore } from '../stores/llmStore';

const llmStore = useLLMStore();
const showHelp = ref(false);
const newCustomModifier = ref('');

onMounted(async () => {
  if (llmStore.cidafmCommands.length === 0) {
    await llmStore.fetchCIDAFMCommands();
  }
});

// Computed properties
const hasActiveModifiers = computed(() => 
  llmStore.selectedCIDAFMCommands.length > 0 || llmStore.customModifiers.length > 0
);

const activeCommands = computed(() => 
  llmStore.selectedCIDAFMCommands
);

// Helper functions
const getCommandTypeLabel = (type: string): string => {
  switch (type) {
    case '^': return 'Response Modifiers';
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

const addCustomModifier = () => {
  if (newCustomModifier.value.trim()) {
    llmStore.addCustomModifier(newCustomModifier.value.trim());
    newCustomModifier.value = '';
    llmStore.saveToLocalStorage();
  }
};

const removeCustomModifier = (modifier: string) => {
  llmStore.removeCustomModifier(modifier);
  llmStore.saveToLocalStorage();
};

const clearAll = () => {
  llmStore.selectedCIDAFMCommands = [];
  llmStore.customModifiers = [];
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

.command-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 0.75rem;
}

.command-item {
  display: flex;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.command-item:hover {
  border-color: #3498db;
  background: #f8fbff;
}

.command-item.active {
  border-color: #3498db;
  background: #e8f4fd;
}

.command-checkbox {
  margin-right: 0.75rem;
  margin-top: 0.125rem;
}

.command-content {
  flex: 1;
}

.command-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 0.25rem;
}

.command-description {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.command-example {
  font-size: 0.8rem;
  color: #888;
  font-style: italic;
}

.custom-modifiers-section {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  margin-top: 1rem;
}

.custom-modifiers-section h4 {
  margin: 0 0 1rem 0;
  color: #34495e;
}

.custom-input-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.custom-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.add-button {
  background: #27ae60;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.add-button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.custom-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.custom-tag {
  background: #f39c12;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.remove-tag {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.active-summary {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  margin-top: 1rem;
}

.active-summary h4 {
  margin: 0 0 1rem 0;
  color: #34495e;
}

.active-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.active-tag {
  background: #3498db;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
}

.active-tag.custom {
  background: #f39c12;
}

.clear-button {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.clear-button:hover {
  background: #c0392b;
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