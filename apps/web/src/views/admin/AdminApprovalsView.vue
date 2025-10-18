<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Human Approvals</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="filters">
        <ion-select v-model="status" label="Status" interface="popover">
          <ion-select-option value="pending">Pending</ion-select-option>
          <ion-select-option value="approved">Approved</ion-select-option>
          <ion-select-option value="rejected">Rejected</ion-select-option>
        </ion-select>
        <ion-input v-model="agentFilter" label="Agent" placeholder="agent slug"></ion-input>
        <ion-input v-model="conversationFilter" label="Conversation" placeholder="conversation id"></ion-input>
        <ion-button @click="load" :disabled="loading">Refresh</ion-button>
      </div>

      <ion-list>
        <ion-item v-for="rec in records" :key="rec.id">
          <ion-label class="ion-text-wrap">
            <h2>{{ rec.agent_slug }} <ion-chip size="small" :color="chipColor(rec.status)" outline>{{ rec.status }}</ion-chip></h2>
            <p>
              <strong>Org:</strong> {{ rec.organization_slug ?? 'global' }} ·
              <strong>Mode:</strong> {{ rec.mode }} ·
              <strong>Conversation:</strong> {{ rec.conversation_id ?? 'n/a' }} ·
              <strong>Created:</strong> {{ formatTime(rec.created_at) }}
            </p>
          </ion-label>
          <ion-buttons slot="end">
            <ion-button color="success" @click="approve(rec)" :disabled="rec.status !== 'pending' || loading">Approve</ion-button>
            <ion-button color="warning" @click="approveContinue(rec)" :disabled="rec.status !== 'pending' || loading">Approve & Continue</ion-button>
            <ion-button color="danger" @click="reject(rec)" :disabled="rec.status !== 'pending' || loading">Reject</ion-button>
          </ion-buttons>
        </ion-item>
      </ion-list>

      <ion-infinite-scroll threshold="100px" @ionInfinite="doInfinite">
        <ion-infinite-scroll-content loading-text="Loading more..."></ion-infinite-scroll-content>
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonButtons, IonSelect, IonSelectOption, IonInput, IonChip, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/vue';
import approvalsService, { type HumanApprovalRecord } from '@/services/approvalsService';
import { useAuthStore } from '@/stores/authStore';

const status = ref<'pending' | 'approved' | 'rejected'>('pending');
const agentFilter = ref('');
const conversationFilter = ref('');
const records = ref<HumanApprovalRecord[]>([]);
const loading = ref(false);

const formatTime = (iso?: string) => {
  try {
    return iso ? new Date(iso).toLocaleString() : '';
  } catch { return iso ?? ''; }
};

const chipColor = (s: string) => (s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'warning');

async function load() {
  loading.value = true;
  try {
    const res = await approvalsService.list({ status: status.value, agentSlug: agentFilter.value || undefined, conversationId: conversationFilter.value || undefined });
    // The API returns { success, data } shape from controller; handle both shapes
    records.value = Array.isArray(res) ? res as HumanApprovalRecord[] : (res?.data ?? []);
  } catch (e) {
    console.error('Failed to load approvals', e);
  } finally {
    loading.value = false;
  }
}

async function approve(rec: HumanApprovalRecord) {
  loading.value = true;
  try {
    await approvalsService.approve(rec.id);
    await load();
  } catch (e) {
    console.error('Approve failed', e);
  } finally {
    loading.value = false;
  }
}

async function reject(rec: HumanApprovalRecord) {
  loading.value = true;
  try {
    await approvalsService.reject(rec.id);
    await load();
  } catch (e) {
    console.error('Reject failed', e);
  } finally {
    loading.value = false;
  }
}

async function approveContinue(rec: HumanApprovalRecord) {
  loading.value = true;
  try {
    const auth = useAuthStore();
    const orgSlug = rec.organization_slug ?? auth.currentNamespace ?? 'global';
    const streamId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const response = await approvalsService.approveAndContinue(orgSlug, rec.agent_slug, rec.id, { options: { stream: true }, metadata: { stream: true, streamId } });
    const assignedStream = response?.payload?.metadata?.streamId || streamId;
    console.info('Approved & continued, streamId:', assignedStream);
    await load();
  } catch (e) {
    console.error('Approve & Continue failed', e);
  } finally {
    loading.value = false;
  }
}

async function doInfinite(ev: CustomEvent) {
  await load();
  (ev.target as { complete: () => void }).complete();
}

onMounted(load);
</script>

<style scoped>
.filters {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 12px;
}
.approval-status {
  margin: 6px 0 0 0;
}
</style>

