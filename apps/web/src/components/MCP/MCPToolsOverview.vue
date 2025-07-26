<template>
  <ion-card class="tools-overview-card">
    <ion-card-header>
      <ion-card-title>
        <ion-icon :icon="buildOutline" class="title-icon"></ion-icon>
        Available Tools
      </ion-card-title>
      <ion-card-subtitle v-if="tools">
        {{ tools.totalTools }} tools across {{ tools.mcpsIncluded }} MCPs
      </ion-card-subtitle>
    </ion-card-header>
    <ion-card-content>
      <!-- Loading State -->
      <div v-if="loading" class="loading-container">
        <ion-spinner name="circles"></ion-spinner>
      </div>

      <!-- No Tools State -->
      <div v-else-if="!tools || tools.totalTools === 0" class="no-tools">
        <ion-icon :icon="buildOutline" class="no-tools-icon"></ion-icon>
        <p>No tools available</p>
      </div>

      <!-- Tools List -->
      <div v-else class="tools-content">
        <!-- Quick Stats -->
        <div class="tools-stats">
          <div class="stat-item">
            <span class="stat-value">{{ tools.totalTools }}</span>
            <span class="stat-label">Total Tools</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ tools.mcpsIncluded }}</span>
            <span class="stat-label">MCPs</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ uniqueCategories.length }}</span>
            <span class="stat-label">Categories</span>
          </div>
        </div>

        <!-- Tools List -->
        <div class="tools-list">
          <div 
            v-for="tool in displayedTools" 
            :key="`${tool.mcpId}-${tool.name}`"
            class="tool-item"
            @click="$emit('execute-tool', findMCPById(tool.mcpId), tool)"
          >
            <div class="tool-header">
              <div class="tool-info">
                <h4 class="tool-name">{{ tool.name }}</h4>
                <p class="tool-description">{{ truncateDescription(tool.description) }}</p>
              </div>
              <ion-button 
                fill="clear" 
                size="small"
                @click.stop="$emit('execute-tool', findMCPById(tool.mcpId), tool)"
              >
                <ion-icon :icon="playOutline" slot="icon-only"></ion-icon>
              </ion-button>
            </div>
            
            <div class="tool-meta">
              <ion-badge color="tertiary" fill="outline" class="mcp-badge">
                {{ tool.mcpName }}
              </ion-badge>
              <span class="param-count">
                {{ getParameterCount(tool.parameters) }} parameters
              </span>
            </div>

            <!-- Tool Examples (if available) -->
            <div v-if="tool.examples && tool.examples.length > 0" class="tool-examples">
              <div class="examples-label">Examples:</div>
              <div class="examples-list">
                <span 
                  v-for="(example, index) in tool.examples.slice(0, 2)" 
                  :key="index"
                  class="example-item"
                >
                  {{ example }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Show More/Less Button -->
        <div v-if="tools.tools.length > 5" class="show-more-container">
          <ion-button 
            @click="toggleShowAll" 
            fill="clear" 
            size="small"
            color="medium"
          >
            {{ showAllTools ? 'Show Less' : `Show ${tools.tools.length - 5} More` }}
            <ion-icon 
              :icon="showAllTools ? chevronUpOutline : chevronDownOutline" 
              slot="end"
            ></ion-icon>
          </ion-button>
        </div>

        <!-- Category Breakdown -->
        <div v-if="uniqueCategories.length > 1" class="categories-section">
          <h5 class="categories-title">Tool Categories</h5>
          <div class="categories-grid">
            <div 
              v-for="category in categoryStats" 
              :key="category.name"
              class="category-item"
            >
              <span class="category-name">{{ category.name }}</span>
              <span class="category-count">{{ category.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonButton,
  IonSpinner
} from '@ionic/vue';
import {
  buildOutline,
  playOutline,
  chevronUpOutline,
  chevronDownOutline
} from 'ionicons/icons';

import type { MCPToolsInfo, MCPRegistration, MCPTool } from '@/types/mcp';

// Props
interface Props {
  tools?: MCPToolsInfo | null;
  loading?: boolean;
}

const props = defineProps<Props>();

// Emits
defineEmits<{
  'execute-tool': [mcp: MCPRegistration | null, tool: MCPTool];
}>();

// Local state
const showAllTools = ref(false);

// Computed properties
const displayedTools = computed(() => {
  if (!props.tools?.tools) return [];
  return showAllTools.value ? props.tools.tools : props.tools.tools.slice(0, 5);
});

const uniqueCategories = computed(() => {
  if (!props.tools?.tools) return [];
  const categories = new Set<string>();
  props.tools.tools.forEach(tool => {
    // Try to infer category from tool name or description
    const category = inferToolCategory(tool.name, tool.description);
    categories.add(category);
  });
  return Array.from(categories);
});

const categoryStats = computed(() => {
  if (!props.tools?.tools) return [];
  const stats: Record<string, number> = {};
  
  props.tools.tools.forEach(tool => {
    const category = inferToolCategory(tool.name, tool.description);
    stats[category] = (stats[category] || 0) + 1;
  });
  
  return Object.entries(stats)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
});

// Methods
const toggleShowAll = () => {
  showAllTools.value = !showAllTools.value;
};

const truncateDescription = (description: string, maxLength: number = 100): string => {
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength).trim() + '...';
};

const getParameterCount = (parameters: Record<string, any>): number => {
  if (!parameters || !parameters.properties) return 0;
  return Object.keys(parameters.properties).length;
};

const inferToolCategory = (name: string, description: string): string => {
  const text = (name + ' ' + description).toLowerCase();
  
  if (text.includes('sql') || text.includes('database') || text.includes('query') || text.includes('schema')) {
    return 'Database';
  }
  if (text.includes('file') || text.includes('read') || text.includes('write') || text.includes('storage')) {
    return 'File System';
  }
  if (text.includes('api') || text.includes('http') || text.includes('request') || text.includes('endpoint')) {
    return 'API';
  }
  if (text.includes('format') || text.includes('parse') || text.includes('convert') || text.includes('transform')) {
    return 'Data Processing';
  }
  if (text.includes('mail') || text.includes('email') || text.includes('message') || text.includes('communication')) {
    return 'Communication';
  }
  if (text.includes('compute') || text.includes('calculate') || text.includes('math') || text.includes('process')) {
    return 'Computation';
  }
  
  return 'General';
};

const findMCPById = (mcpId: string): MCPRegistration | null => {
  // This would typically come from a store or prop
  // For now, return null as we don't have access to the full MCP list
  return null;
};
</script>

<style scoped>
.tools-overview-card {
  height: fit-content;
}

.title-icon {
  margin-right: 8px;
  vertical-align: middle;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.no-tools {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: var(--ion-color-medium);
}

.no-tools-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.tools-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tools-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-value {
  font-size: 1.4em;
  font-weight: bold;
  color: var(--ion-color-primary);
  margin-bottom: 2px;
}

.stat-label {
  font-size: 0.8em;
  color: var(--ion-color-medium);
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-item {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--ion-color-light);
}

.tool-item:hover {
  border-color: var(--ion-color-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.tool-info {
  flex: 1;
}

.tool-name {
  margin: 0 0 4px 0;
  font-size: 1em;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.tool-description {
  margin: 0;
  font-size: 0.85em;
  color: var(--ion-color-medium);
  line-height: 1.3;
}

.tool-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.mcp-badge {
  font-size: 0.75em;
}

.param-count {
  font-size: 0.8em;
  color: var(--ion-color-medium);
}

.tool-examples {
  padding-top: 8px;
  border-top: 1px solid var(--ion-color-light-shade);
  font-size: 0.8em;
}

.examples-label {
  color: var(--ion-color-medium);
  margin-bottom: 4px;
  font-weight: 500;
}

.examples-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.example-item {
  color: var(--ion-color-dark);
  font-style: italic;
  padding-left: 8px;
}

.show-more-container {
  display: flex;
  justify-content: center;
  margin: 8px 0;
}

.categories-section {
  border-top: 1px solid var(--ion-color-light-shade);
  padding-top: 16px;
}

.categories-title {
  margin: 0 0 12px 0;
  font-size: 0.9em;
  color: var(--ion-color-dark);
  font-weight: 600;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--ion-color-light-tint);
  border-radius: 6px;
  font-size: 0.85em;
}

.category-name {
  color: var(--ion-color-dark);
}

.category-count {
  color: var(--ion-color-medium);
  font-weight: 600;
}

@media (max-width: 480px) {
  .tools-stats {
    grid-template-columns: 1fr;
  }
  
  .tool-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .categories-grid {
    grid-template-columns: 1fr;
  }
}
</style>