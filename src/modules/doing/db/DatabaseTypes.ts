import type { Action, Assignment, Automation, BlockoutDate, Condition, Conjunction, ContentProviderAuth, Plan, PlanItem, PlanType, Position, Task, Time, Workflow, WorkflowCategory, WorkflowStep, WorkflowStepRoute, WorkflowStepAction, WorkflowTrigger, WorkflowTriggerExecution } from "../models/index.js";

export interface DoingDatabase {
  actions: Action;
  assignments: Assignment;
  automations: Automation;
  blockoutDates: BlockoutDate;
  conditions: Omit<Condition, "matchingIds">;
  conjunctions: Omit<Conjunction, "conjunctions" | "conditions" | "matchingIds">;
  contentProviderAuths: ContentProviderAuth;
  plans: Plan;
  planItems: Omit<PlanItem, "children">;
  planTypes: PlanType;
  positions: Position;
  tasks: Task;
  times: Time;
  workflows: Workflow;
  workflowCategories: WorkflowCategory;
  workflowSteps: WorkflowStep;
  workflowStepRoutes: WorkflowStepRoute;
  workflowStepActions: WorkflowStepAction;
  workflowTriggers: WorkflowTrigger;
  workflowTriggerExecutions: WorkflowTriggerExecution;
}
