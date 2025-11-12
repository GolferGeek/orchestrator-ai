/**
 * Agent2Agent Actions
 * Orchestrator functions for all mode × action combinations
 *
 * Import pattern:
 * import { createPlan, rerunPlan } from '@/services/agent2agent/actions';
 */

// Plan actions
export {
  createPlan,
  rerunPlan,
  setCurrentPlanVersion,
  deletePlanVersion,
} from './plan.actions';

// Build actions (Deliverables)
export {
  createDeliverable,
  readDeliverable,
  editDeliverable,
  listDeliverables,
  rerunDeliverable,
  setCurrentVersion,
  deleteVersion,
  deleteDeliverable,
} from './build.actions';

// Converse actions
export {
  sendMessage,
  createConversation,
  loadConversation,
  deleteConversation,
} from './converse.actions';
