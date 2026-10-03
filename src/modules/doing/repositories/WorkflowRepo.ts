import { injectable } from "inversify";
import { sql } from "kysely";
import { UniqueIdHelper } from "@churchapps/apihelper";
import { Workflow, WorkflowCategory, WorkflowStep, WorkflowStepRoute, WorkflowStepAction, WorkflowTrigger, WorkflowTriggerExecution } from "../models/index.js";
import { getDb } from "../db/index.js";

@injectable()
export class WorkflowRepo {
  // Workflows
  public async loadAllWorkflows(churchId: string): Promise<Workflow[]> {
    return getDb().selectFrom("workflows").selectAll().where("churchId", "=", churchId).orderBy("sort").execute() as Promise<Workflow[]>;
  }

  public async loadWorkflow(churchId: string, id: string): Promise<Workflow> {
    return ((await getDb().selectFrom("workflows").selectAll().where("id", "=", id).where("churchId", "=", churchId).executeTakeFirst()) ?? null) as Workflow;
  }

  public async saveWorkflow(model: Workflow): Promise<Workflow> {
    if (model.id) {
      await getDb().updateTable("workflows").set({ name: model.name, categoryId: model.categoryId, active: model.active, sort: model.sort }).where("id", "=", model.id).where("churchId", "=", model.churchId).execute();
      return model;
    }
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("workflows").values({ id: model.id, churchId: model.churchId, name: model.name, categoryId: model.categoryId, active: model.active, sort: model.sort }).execute();
    return model;
  }

  public async deleteWorkflow(churchId: string, id: string) {
    const stepIds = (await getDb().selectFrom("workflowSteps").select("id").where("workflowId", "=", id).where("churchId", "=", churchId).execute()).map((r: any) => r.id);
    if (stepIds.length > 0) {
      await getDb().deleteFrom("workflowStepRoutes").where("stepId", "in", stepIds).where("churchId", "=", churchId).execute();
      await getDb().deleteFrom("workflowStepActions").where("stepId", "in", stepIds).where("churchId", "=", churchId).execute();
      await getDb().deleteFrom("workflowSteps").where("id", "in", stepIds).where("churchId", "=", churchId).execute();
    }
    await getDb().deleteFrom("workflowTriggers").where("workflowId", "=", id).where("churchId", "=", churchId).execute();
    await getDb().updateTable("tasks").set({ workflowId: null, stepId: null } as any).where("workflowId", "=", id).where("churchId", "=", churchId).execute();
    await getDb().deleteFrom("workflows").where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  // Categories
  public async loadAllCategories(churchId: string): Promise<WorkflowCategory[]> {
    return getDb().selectFrom("workflowCategories").selectAll().where("churchId", "=", churchId).orderBy("sort").execute() as Promise<WorkflowCategory[]>;
  }

  public async saveCategory(model: WorkflowCategory): Promise<WorkflowCategory> {
    if (model.id) {
      await getDb().updateTable("workflowCategories").set({ name: model.name, sort: model.sort }).where("id", "=", model.id).where("churchId", "=", model.churchId).execute();
      return model;
    }
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("workflowCategories").values({ id: model.id, churchId: model.churchId, name: model.name, sort: model.sort }).execute();
    return model;
  }

  public async deleteCategory(churchId: string, id: string) {
    await getDb().deleteFrom("workflowCategories").where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  // Steps
  public async loadSteps(churchId: string, workflowId: string): Promise<WorkflowStep[]> {
    return getDb().selectFrom("workflowSteps").selectAll().where("churchId", "=", churchId).where("workflowId", "=", workflowId).orderBy("sort").execute() as Promise<WorkflowStep[]>;
  }

  public async loadStep(churchId: string, id: string): Promise<WorkflowStep> {
    return ((await getDb().selectFrom("workflowSteps").selectAll().where("id", "=", id).where("churchId", "=", churchId).executeTakeFirst()) ?? null) as WorkflowStep;
  }

  public async saveStep(model: WorkflowStep): Promise<WorkflowStep> {
    const data = { workflowId: model.workflowId, name: model.name, sort: model.sort, defaultAssignToType: model.defaultAssignToType, defaultAssignToId: model.defaultAssignToId, defaultAssignToLabel: model.defaultAssignToLabel, expectedResponseDays: model.expectedResponseDays };
    if (model.id) {
      await getDb().updateTable("workflowSteps").set(data).where("id", "=", model.id).where("churchId", "=", model.churchId).execute();
      return model;
    }
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("workflowSteps").values({ id: model.id, churchId: model.churchId, ...data }).execute();
    return model;
  }

  public async deleteStep(churchId: string, id: string) {
    await getDb().deleteFrom("workflowStepRoutes").where("stepId", "=", id).where("churchId", "=", churchId).execute();
    await getDb().deleteFrom("workflowStepActions").where("stepId", "=", id).where("churchId", "=", churchId).execute();
    await getDb().updateTable("tasks").set({ stepId: null } as any).where("stepId", "=", id).where("churchId", "=", churchId).execute();
    await getDb().deleteFrom("workflowSteps").where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  // Step routes
  public async loadRoutesForWorkflow(churchId: string, workflowId: string): Promise<WorkflowStepRoute[]> {
    return getDb().selectFrom("workflowStepRoutes").selectAll().where("churchId", "=", churchId).where("workflowId", "=", workflowId).orderBy("sort").execute() as Promise<WorkflowStepRoute[]>;
  }

  public async loadRoutesForStep(churchId: string, stepId: string): Promise<WorkflowStepRoute[]> {
    return getDb().selectFrom("workflowStepRoutes").selectAll().where("churchId", "=", churchId).where("stepId", "=", stepId).orderBy("sort").execute() as Promise<WorkflowStepRoute[]>;
  }

  public async loadRoute(churchId: string, id: string): Promise<WorkflowStepRoute> {
    return ((await getDb().selectFrom("workflowStepRoutes").selectAll().where("id", "=", id).where("churchId", "=", churchId).executeTakeFirst()) ?? null) as WorkflowStepRoute;
  }

  public async saveRoute(model: WorkflowStepRoute): Promise<WorkflowStepRoute> {
    const data = { workflowId: model.workflowId, stepId: model.stepId, sort: model.sort, trigger: model.trigger, kind: model.kind, label: model.label, targetStepId: model.targetStepId, targetWorkflowId: model.targetWorkflowId };
    if (model.id) {
      await getDb().updateTable("workflowStepRoutes").set(data).where("id", "=", model.id).where("churchId", "=", model.churchId).execute();
      return model;
    }
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("workflowStepRoutes").values({ id: model.id, churchId: model.churchId, ...data }).execute();
    return model;
  }

  public async deleteRoute(churchId: string, id: string) {
    await getDb().deleteFrom("workflowStepRoutes").where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  // Step actions
  public async loadActionsForWorkflow(churchId: string, workflowId: string): Promise<WorkflowStepAction[]> {
    const stepIds = (await getDb().selectFrom("workflowSteps").select("id").where("workflowId", "=", workflowId).where("churchId", "=", churchId).execute()).map((r: any) => r.id);
    if (stepIds.length === 0) return [];
    return getDb().selectFrom("workflowStepActions").selectAll().where("churchId", "=", churchId).where("stepId", "in", stepIds).orderBy("sort").execute() as Promise<WorkflowStepAction[]>;
  }

  public async loadActionsForStep(churchId: string, stepId: string): Promise<WorkflowStepAction[]> {
    return getDb().selectFrom("workflowStepActions").selectAll().where("churchId", "=", churchId).where("stepId", "=", stepId).orderBy("sort").execute() as Promise<WorkflowStepAction[]>;
  }

  public async saveAction(model: WorkflowStepAction): Promise<WorkflowStepAction> {
    const data = { stepId: model.stepId, actionType: model.actionType, config: model.config, sort: model.sort };
    if (model.id) {
      await getDb().updateTable("workflowStepActions").set(data).where("id", "=", model.id).where("churchId", "=", model.churchId).execute();
      return model;
    }
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("workflowStepActions").values({ id: model.id, churchId: model.churchId, ...data }).execute();
    return model;
  }

  public async deleteAction(churchId: string, id: string) {
    await getDb().deleteFrom("workflowStepActions").where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  // Triggers
  public async loadTriggersForWorkflow(churchId: string, workflowId: string): Promise<WorkflowTrigger[]> {
    return getDb().selectFrom("workflowTriggers").selectAll().where("churchId", "=", churchId).where("workflowId", "=", workflowId).execute() as Promise<WorkflowTrigger[]>;
  }

  public async loadTrigger(churchId: string, id: string): Promise<WorkflowTrigger> {
    return ((await getDb().selectFrom("workflowTriggers").selectAll().where("id", "=", id).where("churchId", "=", churchId).executeTakeFirst()) ?? null) as WorkflowTrigger;
  }

  public async saveTrigger(model: WorkflowTrigger): Promise<WorkflowTrigger> {
    const data = { name: model.name, triggerKind: model.triggerKind, eventType: model.eventType, recurs: model.recurs, workflowId: model.workflowId, stepId: model.stepId, conditions: model.conditions, oncePerSubject: model.oncePerSubject, active: model.active };
    if (model.id) {
      await getDb().updateTable("workflowTriggers").set(data).where("id", "=", model.id).where("churchId", "=", model.churchId).execute();
      return model;
    }
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("workflowTriggers").values({ id: model.id, churchId: model.churchId, ...data }).execute();
    return model;
  }

  public async deleteTrigger(churchId: string, id: string) {
    await getDb().deleteFrom("workflowTriggerExecutions").where("triggerId", "=", id).where("churchId", "=", churchId).execute();
    await getDb().deleteFrom("workflowTriggers").where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  // Trigger executions
  public async loadExecutionsForWorkflow(churchId: string, workflowId: string): Promise<WorkflowTriggerExecution[]> {
    return getDb().selectFrom("workflowTriggerExecutions").selectAll().where("churchId", "=", churchId).where("workflowId", "=", workflowId).orderBy("dateCreated", "desc").execute() as Promise<WorkflowTriggerExecution[]>;
  }

  public async loadExecution(churchId: string, id: string): Promise<WorkflowTriggerExecution> {
    return ((await getDb().selectFrom("workflowTriggerExecutions").selectAll().where("id", "=", id).where("churchId", "=", churchId).executeTakeFirst()) ?? null) as WorkflowTriggerExecution;
  }

  public async saveExecution(model: WorkflowTriggerExecution): Promise<WorkflowTriggerExecution> {
    const data: any = { triggerId: model.triggerId, workflowId: model.workflowId, subjectType: model.subjectType, subjectId: model.subjectId, subjectLabel: model.subjectLabel, eventType: model.eventType, status: model.status, attemptCount: model.attemptCount, nextAttemptAt: model.nextAttemptAt, lastError: model.lastError, dateCompleted: model.dateCompleted };
    if (model.id) {
      await getDb().updateTable("workflowTriggerExecutions").set(data).where("id", "=", model.id).where("churchId", "=", model.churchId).execute();
      return model;
    }
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("workflowTriggerExecutions").values({ id: model.id, churchId: model.churchId, dateCreated: sql`now()` as any, ...data }).execute();
    return model;
  }

  // Board helpers
  public async loadCardsForWorkflow(churchId: string, workflowId: string) {
    return getDb().selectFrom("tasks").selectAll()
      .where("churchId", "=", churchId)
      .where("workflowId", "=", workflowId)
      .where("status", "=", "Open")
      .orderBy("sort")
      .orderBy("taskNumber")
      .execute();
  }

  public async getStepCounts(churchId: string, workflowId: string) {
    return getDb().selectFrom("tasks")
      .select(["stepId", sql`count(*)`.as("count")])
      .where("churchId", "=", churchId)
      .where("workflowId", "=", workflowId)
      .where("status", "=", "Open")
      .groupBy("stepId")
      .execute();
  }

  public async getOverdueCards(churchId: string, workflowId: string) {
    return getDb().selectFrom("tasks").selectAll()
      .where("churchId", "=", churchId)
      .where("workflowId", "=", workflowId)
      .where("status", "=", "Open")
      .where("dueDate", "<", sql`now()` as any)
      .execute();
  }

  public async getThroughput(churchId: string, workflowId: string) {
    return getDb().selectFrom("tasks")
      .select([sql`date(dateClosed)`.as("day"), sql`count(*)`.as("count")])
      .where("churchId", "=", churchId)
      .where("workflowId", "=", workflowId)
      .where("status", "=", "Closed")
      .where("dateClosed", "is not", null)
      .groupBy(sql`date(dateClosed)`)
      .orderBy(sql`date(dateClosed)`)
      .execute();
  }
}
