<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Function Agents</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="grid">
        <div class="list">
          <ion-list>
            <ion-item v-for="a in agents" :key="a.id" @click="select(a)" button>
              <ion-label>
                <h2>{{ a.display_name }} <small>({{ a.slug }})</small></h2>
                <p>{{ a.description }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </div>
        <div class="editor" v-if="selected">
          <h3>Edit Function: {{ selected.display_name }}</h3>
          <ion-item>
            <ion-label position="stacked">Timeout (ms)</ion-label>
            <ion-input v-model.number="fnTimeout" type="number" />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Code (handler)</ion-label>
            <ion-textarea :rows="16" v-model="fnCode" class="code-editor" />
          </ion-item>
          <div class="actions">
            <ion-button color="primary" @click="save">Save</ion-button>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonInput, IonTextarea, IonButton } from '@ionic/vue';
import { apiService } from '@/services/apiService';

const agents = ref<Record<string, unknown>[]>([]);
const selected = ref<Record<string, unknown> | null>(null);
const fnCode = ref('');
const fnTimeout = ref(20000);

async function loadAgents() {
  const res = await apiService.get('/api/admin/agents?type=function');
  agents.value = res?.data?.data || res?.data || [];
}

function select(a: Record<string, unknown>) {
  selected.value = a;
  const cfg = a?.config || {};
  const fn = cfg?.configuration?.function || cfg?.function || {};
  fnCode.value = fn.code || '';
  fnTimeout.value = fn.timeout_ms || 20000;
}

async function save() {
  if (!selected.value) return;
  await apiService.patch(`/api/admin/agents/${selected.value.id}`, {
    configuration: { function: { code: fnCode.value, timeout_ms: fnTimeout.value } },
  });
  await loadAgents();
}

onMounted(loadAgents);
</script>

<style scoped>
.grid { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; }
.editor .code-editor { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; }
.actions { margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>

