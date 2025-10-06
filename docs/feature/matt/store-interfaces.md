# Store Interfaces - Strict Type Definitions

This document defines the strict interfaces for all Pinia stores in the application. Each store has a single responsibility and uses strict types from the a2a-protocol package.

---

## 1. authStore

**Responsibility:** Authentication, user session, and permissions management

### State
```typescript
interface AuthState {
  user: User | null;
  session: Session | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  permissions: string[];
  tokenExpiry: number | null;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface Session {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}
```

### Actions
```typescript
// Authentication
login(credentials: { email: string; password: string }): Promise<void>
logout(): Promise<void>
refreshSession(): Promise<void>

// User management
setUser(user: User): void
updateUser(updates: Partial<User>): void

// Permissions
setPermissions(permissions: string[]): void
checkPermission(permission: string): boolean
```

### Getters
```typescript
currentUser: ComputedRef<User | null>
isLoggedIn: ComputedRef<boolean>
hasPermission: (permission: string) => boolean
isTokenExpired: ComputedRef<boolean>
userRole: ComputedRef<string | null>
```

---

## 2. conversationStore

**Responsibility:** Conversation and message management

### State
```typescript
interface ConversationState {
  conversations: Map<string, Conversation>;
  messages: Map<string, Message[]>; // conversationId -> messages
  activeConversationId: string | null;
  loadingStates: Map<string, boolean>;
}

interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
```

### Actions
```typescript
// Conversation management
createConversation(title: string, metadata?: Record<string, any>): Promise<Conversation>
loadConversation(conversationId: string): Promise<void>
setActiveConversation(conversationId: string): void
updateConversation(conversationId: string, updates: Partial<Conversation>): void
deleteConversation(conversationId: string): Promise<void>

// Message management
addMessage(conversationId: string, message: Omit<Message, 'id'>): void
loadMessages(conversationId: string): Promise<void>
clearMessages(conversationId: string): void
```

### Getters
```typescript
activeConversation: ComputedRef<Conversation | null>
activeMessages: ComputedRef<Message[]>
conversationById: (id: string) => Conversation | undefined
messagesByConversation: (id: string) => Message[]
allConversations: ComputedRef<Conversation[]>
isLoading: (conversationId: string) => boolean
```

---

## 3. taskStore

**Responsibility:** Task lifecycle and execution state

### State
```typescript
interface TaskState {
  tasks: Map<string, Task>;
  taskResults: Map<string, TaskResult>;
  activeTaskId: string | null;
  tasksByConversation: Map<string, string[]>; // conversationId -> taskIds
}

interface Task {
  id: string;
  conversationId: string;
  mode: AgentTaskMode; // 'plan' | 'build' | 'converse' | 'orchestrate'
  action: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface TaskResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
  completedAt: string;
}
```

### Actions
```typescript
// Task lifecycle
createTask(conversationId: string, mode: AgentTaskMode, action: string, metadata?: Record<string, any>): Task
updateTaskStatus(taskId: string, status: TaskStatus): void
setTaskResult(taskId: string, result: Omit<TaskResult, 'taskId'>): void
setActiveTask(taskId: string): void

// Task queries
clearTasksByConversation(conversationId: string): void
cancelTask(taskId: string): void
```

### Getters
```typescript
activeTask: ComputedRef<Task | null>
taskById: (id: string) => Task | undefined
resultByTaskId: (id: string) => TaskResult | undefined
tasksByConversationId: (conversationId: string) => Task[]
runningTasks: ComputedRef<Task[]>
completedTasks: ComputedRef<Task[]>
```

---

## 4. planStore

**Responsibility:** Plan and plan version management

### State
```typescript
import type { PlanData, PlanVersionData } from '@orchestrator-ai/a2a-protocol';

interface PlanState {
  plans: Map<string, PlanData>;
  planVersions: Map<string, PlanVersionData[]>; // planId -> versions
  currentVersionId: Map<string, string>; // planId -> versionId
  plansByConversation: Map<string, string[]>; // conversationId -> planIds
}
```

### Actions
```typescript
// Plan management
addPlan(plan: PlanData, version: PlanVersionData): void
updatePlan(planId: string, updates: Partial<PlanData>): void
deletePlan(planId: string): void

// Version management
addVersion(planId: string, version: PlanVersionData): void
setCurrentVersion(planId: string, versionId: string): void
deleteVersion(planId: string, versionId: string): void
mergeVersions(planId: string, sourceVersionId: string, targetVersionId: string): void
copyVersion(planId: string, versionId: string): PlanVersionData

// Association
associatePlanWithConversation(planId: string, conversationId: string): void
```

### Getters
```typescript
planById: (id: string) => PlanData | undefined
currentVersion: (planId: string) => PlanVersionData | undefined
versionsByPlanId: (planId: string) => PlanVersionData[]
plansByConversationId: (conversationId: string) => PlanData[]
allPlans: ComputedRef<PlanData[]>
```

---

## 5. deliverableStore

**Responsibility:** Deliverable (build) and version management

### State
```typescript
import type { DeliverableData, DeliverableVersionData } from '@orchestrator-ai/a2a-protocol';

interface DeliverableState {
  deliverables: Map<string, DeliverableData>;
  deliverableVersions: Map<string, DeliverableVersionData[]>; // deliverableId -> versions
  currentVersionId: Map<string, string>; // deliverableId -> versionId
  deliverablesByPlan: Map<string, string[]>; // planId -> deliverableIds
}
```

### Actions
```typescript
// Deliverable management
addDeliverable(deliverable: DeliverableData, version: DeliverableVersionData): void
updateDeliverable(deliverableId: string, updates: Partial<DeliverableData>): void
deleteDeliverable(deliverableId: string): void

// Version management
addVersion(deliverableId: string, version: DeliverableVersionData): void
setCurrentVersion(deliverableId: string, versionId: string): void
deleteVersion(deliverableId: string, versionId: string): void
mergeVersions(deliverableId: string, sourceVersionId: string, targetVersionId: string): void
copyVersion(deliverableId: string, versionId: string): DeliverableVersionData

// Association
associateDeliverableWithPlan(deliverableId: string, planId: string): void

// Execution
updateExecutionStatus(deliverableId: string, versionId: string, status: string): void
```

### Getters
```typescript
deliverableById: (id: string) => DeliverableData | undefined
currentVersion: (deliverableId: string) => DeliverableVersionData | undefined
versionsByDeliverableId: (deliverableId: string) => DeliverableVersionData[]
deliverablesByPlanId: (planId: string) => DeliverableData[]
allDeliverables: ComputedRef<DeliverableData[]>
```

---

## 6. agentStore

**Responsibility:** Agent configurations, capabilities, and status

### State
```typescript
interface AgentState {
  agents: Map<string, Agent>;
  agentCapabilities: Map<string, AgentCapability[]>; // agentId -> capabilities
  agentStatus: Map<string, AgentStatus>;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

interface AgentCapability {
  mode: AgentTaskMode;
  actions: string[];
  metadata?: Record<string, any>;
}

interface AgentStatus {
  agentId: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTaskId?: string;
  lastActiveAt: string;
}
```

### Actions
```typescript
// Agent management
registerAgent(agent: Agent, capabilities: AgentCapability[]): void
updateAgent(agentId: string, updates: Partial<Agent>): void
deactivateAgent(agentId: string): void

// Status management
updateAgentStatus(agentId: string, status: Omit<AgentStatus, 'agentId'>): void
setAgentBusy(agentId: string, taskId: string): void
setAgentIdle(agentId: string): void

// Capabilities
setCapabilities(agentId: string, capabilities: AgentCapability[]): void
addCapability(agentId: string, capability: AgentCapability): void
```

### Getters
```typescript
agentById: (id: string) => Agent | undefined
agentStatus: (id: string) => AgentStatus | undefined
availableAgents: ComputedRef<Agent[]>
agentsByCapability: (mode: AgentTaskMode, action?: string) => Agent[]
idleAgents: ComputedRef<Agent[]>
activeAgents: ComputedRef<Agent[]>
```

---

## 7. orchestratorStore

**Responsibility:** Orchestration workflow coordination

### State
```typescript
interface OrchestratorState {
  orchestrations: Map<string, Orchestration>;
  orchestrationSteps: Map<string, OrchestrationStep[]>; // orchestrationId -> steps
  activeOrchestrationId: string | null;
}

interface Orchestration {
  id: string;
  conversationId: string;
  type: string;
  status: OrchestrationStatus;
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

type OrchestrationStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

interface OrchestrationStep {
  id: string;
  orchestrationId: string;
  stepNumber: number;
  mode: AgentTaskMode;
  action: string;
  agentId?: string;
  taskId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
}
```

### Actions
```typescript
// Orchestration lifecycle
startOrchestration(conversationId: string, type: string, steps: Omit<OrchestrationStep, 'id' | 'orchestrationId' | 'status'>[]): Orchestration
updateOrchestrationStatus(orchestrationId: string, status: OrchestrationStatus): void
advanceToNextStep(orchestrationId: string): void
setActiveOrchestration(orchestrationId: string): void

// Step management
updateStepStatus(orchestrationId: string, stepId: string, status: OrchestrationStep['status']): void
setStepOutput(orchestrationId: string, stepId: string, output: Record<string, any>): void
setStepError(orchestrationId: string, stepId: string, error: string): void
assignStepToAgent(orchestrationId: string, stepId: string, agentId: string, taskId: string): void

// Control flow
pauseOrchestration(orchestrationId: string): void
resumeOrchestration(orchestrationId: string): void
cancelOrchestration(orchestrationId: string): void
```

### Getters
```typescript
activeOrchestration: ComputedRef<Orchestration | null>
orchestrationById: (id: string) => Orchestration | undefined
stepsByOrchestrationId: (id: string) => OrchestrationStep[]
currentStep: (orchestrationId: string) => OrchestrationStep | undefined
orchestrationProgress: (id: string) => { current: number; total: number; percentage: number }
runningOrchestrations: ComputedRef<Orchestration[]>
```

---

## Handler → Store Action Mapping

### Plan Handlers → planStore
```typescript
PlanCreateResult → planStore.addPlan(result.plan, result.version)
PlanReadResult → planStore.addPlan(result.plan, result.version)
PlanEditResult → planStore.addPlan(result.plan, result.version)
PlanListResult → result.plans.forEach(plan => planStore.addPlan(plan))
PlanDeleteResult → planStore.deletePlan(result.planId)
```

### Build Handlers → deliverableStore
```typescript
BuildExecuteResult → deliverableStore.addDeliverable(result.deliverable, result.version)
BuildReadResult → deliverableStore.addDeliverable(result.deliverable, result.version)
BuildRerunResult → deliverableStore.addDeliverable(result.deliverable, result.version)
BuildEditResult → deliverableStore.addDeliverable(result.deliverable, result.version)
BuildListResult → result.deliverables.forEach(d => deliverableStore.addDeliverable(d))
BuildDeleteResult → deliverableStore.deleteDeliverable(result.deliverableId)
```

### Converse Handlers → conversationStore
```typescript
ConverseResult → conversationStore.addMessage(conversationId, {
  role: 'assistant',
  content: result.message,
  timestamp: result.metadata?.timestamp || new Date().toISOString(),
  metadata: result.metadata
})
```

---

## Implementation Pattern

All stores should follow this pattern:

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useStoreName = defineStore('storeName', () => {
  // State (using ref for reactivity)
  const stateItem = ref<Type>(initialValue);

  // Actions (functions that mutate state)
  function actionName(params: ParamType): ReturnType {
    // Validate params
    // Mutate state
    // Return result if needed
  }

  // Getters (computed properties)
  const getterName = computed(() => {
    // Derive value from state
    return derivedValue;
  });

  // Return public API
  return {
    // State (read-only exposure)
    stateItem: readonly(stateItem),

    // Actions
    actionName,

    // Getters
    getterName,
  };
});
```

---

## Notes

- All stores use strict types from `@orchestrator-ai/a2a-protocol` where applicable
- State is kept minimal - no duplicated data across stores
- Actions are the ONLY way to mutate state
- Getters use `computed()` for automatic reactivity
- Stores never call API directly - that's the API client's job
- Handlers validate, stores mutate, Vue reactivity updates UI
