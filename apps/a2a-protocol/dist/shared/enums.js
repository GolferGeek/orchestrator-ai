"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTaskMode = void 0;
/**
 * Agent Task Modes
 * Defines the operational mode of the agent
 */
var AgentTaskMode;
(function (AgentTaskMode) {
    /** Conversational interaction */
    AgentTaskMode["CONVERSE"] = "converse";
    /** Planning phase */
    AgentTaskMode["PLAN"] = "plan";
    /** Building/execution phase */
    AgentTaskMode["BUILD"] = "build";
    /** Human response required */
    AgentTaskMode["HUMAN_RESPONSE"] = "human_response";
    /** Orchestration creation */
    AgentTaskMode["ORCHESTRATE_CREATE"] = "orchestrate_create";
    /** Orchestration execution */
    AgentTaskMode["ORCHESTRATE_EXECUTE"] = "orchestrate_execute";
    /** Orchestration continuation */
    AgentTaskMode["ORCHESTRATE_CONTINUE"] = "orchestrate_continue";
    /** Save orchestration recipe */
    AgentTaskMode["ORCHESTRATE_SAVE_RECIPE"] = "orchestrate_save_recipe";
    /** Orchestrator plan creation */
    AgentTaskMode["ORCHESTRATOR_PLAN_CREATE"] = "orchestrator_plan_create";
    /** Orchestrator plan update */
    AgentTaskMode["ORCHESTRATOR_PLAN_UPDATE"] = "orchestrator_plan_update";
    /** Orchestrator plan review */
    AgentTaskMode["ORCHESTRATOR_PLAN_REVIEW"] = "orchestrator_plan_review";
    /** Orchestrator plan approval */
    AgentTaskMode["ORCHESTRATOR_PLAN_APPROVE"] = "orchestrator_plan_approve";
    /** Orchestrator plan rejection */
    AgentTaskMode["ORCHESTRATOR_PLAN_REJECT"] = "orchestrator_plan_reject";
    /** Orchestrator plan archival */
    AgentTaskMode["ORCHESTRATOR_PLAN_ARCHIVE"] = "orchestrator_plan_archive";
    /** Orchestrator run start */
    AgentTaskMode["ORCHESTRATOR_RUN_START"] = "orchestrator_run_start";
    /** Orchestrator run continuation */
    AgentTaskMode["ORCHESTRATOR_RUN_CONTINUE"] = "orchestrator_run_continue";
    /** Orchestrator run pause */
    AgentTaskMode["ORCHESTRATOR_RUN_PAUSE"] = "orchestrator_run_pause";
    /** Orchestrator run resume */
    AgentTaskMode["ORCHESTRATOR_RUN_RESUME"] = "orchestrator_run_resume";
    /** Orchestrator human response */
    AgentTaskMode["ORCHESTRATOR_RUN_HUMAN_RESPONSE"] = "orchestrator_run_human_response";
    /** Orchestrator step rollback */
    AgentTaskMode["ORCHESTRATOR_RUN_ROLLBACK_STEP"] = "orchestrator_run_rollback_step";
    /** Orchestrator run cancellation */
    AgentTaskMode["ORCHESTRATOR_RUN_CANCEL"] = "orchestrator_run_cancel";
    /** Orchestrator run evaluation */
    AgentTaskMode["ORCHESTRATOR_RUN_EVALUATE"] = "orchestrator_run_evaluate";
    /** Orchestrator recipe save */
    AgentTaskMode["ORCHESTRATOR_RECIPE_SAVE"] = "orchestrator_recipe_save";
    /** Orchestrator recipe update */
    AgentTaskMode["ORCHESTRATOR_RECIPE_UPDATE"] = "orchestrator_recipe_update";
    /** Orchestrator recipe validation */
    AgentTaskMode["ORCHESTRATOR_RECIPE_VALIDATE"] = "orchestrator_recipe_validate";
    /** Orchestrator recipe deletion */
    AgentTaskMode["ORCHESTRATOR_RECIPE_DELETE"] = "orchestrator_recipe_delete";
    /** Orchestrator recipe load */
    AgentTaskMode["ORCHESTRATOR_RECIPE_LOAD"] = "orchestrator_recipe_load";
    /** Orchestrator recipe list */
    AgentTaskMode["ORCHESTRATOR_RECIPE_LIST"] = "orchestrator_recipe_list";
})(AgentTaskMode || (exports.AgentTaskMode = AgentTaskMode = {}));
