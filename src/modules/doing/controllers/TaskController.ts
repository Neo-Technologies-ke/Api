import { controller, httpPost, httpGet, requestParam } from "inversify-express-utils";
import express from "express";
import { CustomFileStorageHelper } from "../../../shared/helpers/CustomFileStorageHelper.js";
import { DoingBaseController } from "./DoingBaseController.js";
import { Task } from "../models/index.js";
import { Environment } from "../helpers/index.js";

@controller("/doing/tasks")
export class TaskController extends DoingBaseController {
  @httpGet("/timeline")
  public async getTimeline(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const taskIds = typeof req.query.taskIds === "string" ? req.query.taskIds.split(",") : req.query.taskIds ? [String(req.query.taskIds)] : [];
      return await this.repos.task.loadTimeline(au.churchId, au.personId, taskIds);
    });
  }

  @httpGet("/closed")
  public async getForPersonClosed(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.task.loadForPerson(au.churchId, au.personId, "Closed");
    });
  }

  @httpGet("/directoryUpdate/:personId")
  public async getPersonDirectoryUpdate(@requestParam("personId") personId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.task.loadForDirectoryUpdate(au.churchId, personId);
    });
  }

  @httpGet("/board/:id")
  public async getBoard(@requestParam("id") workflowId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const [workflow, steps, cards, routes, actions] = await Promise.all([
        this.repos.workflow.loadWorkflow(au.churchId, workflowId),
        this.repos.workflow.loadSteps(au.churchId, workflowId),
        this.repos.workflow.loadCardsForWorkflow(au.churchId, workflowId),
        this.repos.workflow.loadRoutesForWorkflow(au.churchId, workflowId),
        this.repos.workflow.loadActionsForWorkflow(au.churchId, workflowId)
      ]);
      if (!workflow) return this.json({ error: "Not found" }, 404);
      return { workflow, steps, cards, routes, actions };
    });
  }

  @httpPost("/addToWorkflow")
  public async addToWorkflow(req: express.Request<{}, {}, { workflowId: string; stepId: string; associatedWith: { type: string; id: string; label: string } }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.createCard(au, req.body.workflowId, req.body.stepId, req.body.associatedWith);
    });
  }

  @httpPost("/bulkAddToWorkflow")
  public async bulkAddToWorkflow(req: express.Request<{}, {}, { workflowId: string; stepId: string; people: { id: string; label: string }[] }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result = [];
      for (const p of req.body.people || []) {
        result.push(await this.createCard(au, req.body.workflowId, req.body.stepId, { type: "person", id: p.id, label: p.label }));
      }
      return result;
    });
  }

  @httpPost("/bulk/complete")
  public async bulkComplete(req: express.Request<{}, {}, { ids: string[] }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      for (const id of req.body.ids || []) await this.completeCard(au.churchId, id);
      return { success: true };
    });
  }

  @httpPost("/bulk/moveStep")
  public async bulkMoveStep(req: express.Request<{}, {}, { ids: string[]; stepId: string }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      for (const id of req.body.ids || []) await this.moveCardStep(au.churchId, id, req.body.stepId);
      return { success: true };
    });
  }

  @httpPost("/bulk/snooze")
  public async bulkSnooze(req: express.Request<{}, {}, { ids: string[]; days: number }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      for (const id of req.body.ids || []) await this.snoozeCard(au.churchId, id, req.body.days);
      return { success: true };
    });
  }

  @httpPost("/bulk/reassign")
  public async bulkReassign(req: express.Request<{}, {}, { ids: string[]; assignedToType: string; assignedToId: string; assignedToLabel: string }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      for (const id of req.body.ids || []) await this.reassignCard(au.churchId, id, req.body);
      return { success: true };
    });
  }

  @httpPost("/:id/moveStep")
  public async moveStep(@requestParam("id") id: string, req: express.Request<{}, {}, { stepId: string }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.moveCardStep(au.churchId, id, req.body.stepId);
    });
  }

  @httpPost("/:id/complete")
  public async complete(@requestParam("id") id: string, req: express.Request<{}, {}, { routeId?: string }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.completeCard(au.churchId, id, req.body?.routeId);
    });
  }

  @httpPost("/:id/snooze")
  public async snooze(@requestParam("id") id: string, req: express.Request<{}, {}, { days: number }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.snoozeCard(au.churchId, id, req.body.days);
    });
  }

  @httpPost("/:id/reassign")
  public async reassign(@requestParam("id") id: string, req: express.Request<{}, {}, { assignedToType: string; assignedToId: string; assignedToLabel: string }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.reassignCard(au.churchId, id, req.body);
    });
  }

  @httpPost("/:id/pin")
  public async pin(@requestParam("id") id: string, req: express.Request<{}, {}, { pinned: boolean }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const task = await this.repos.task.load(au.churchId, id);
      if (!task) return this.json({ error: "Not found" }, 404);
      task.pinnedAssignment = req.body.pinned;
      return await this.repos.task.save(task);
    });
  }

  @httpPost("/:id/skip")
  public async skip(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.shiftCardStep(au.churchId, id, 1);
    });
  }

  @httpPost("/:id/sendBack")
  public async sendBack(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.shiftCardStep(au.churchId, id, -1);
    });
  }

  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.task.load(au.churchId, id);
    });
  }

  @httpGet("/")
  public async getForPerson(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.task.loadForPerson(au.churchId, au.personId, "Open");
    });
  }

  @httpPost("/loadForGroups")
  public async loadForGroups(req: express.Request<{}, {}, { groupIds: string[]; status: string }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.task.loadForGroups(au.churchId, req.body.groupIds, req.body.status);
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, Task[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result: Task[] = [];
      for (const task of req.body) {
        task.churchId = au.churchId;
        if (req.query?.type === "directoryUpdate") await this.handleDirectoryUpdate(au.churchId, task);
        result.push(await this.repos.task.save(task));
      }
      return result;
    });
  }

  private async createCard(au: any, workflowId: string, stepId: string, associatedWith: { type: string; id: string; label: string }) {
    const step = stepId ? await this.repos.workflow.loadStep(au.churchId, stepId) : null;
    const creatorName = `${au.firstName || ""} ${au.lastName || ""}`.trim();
    const task: Task = {
      churchId: au.churchId,
      taskType: "workflowCard",
      status: "Open",
      workflowId,
      stepId: step?.id || null,
      associatedWithType: associatedWith?.type,
      associatedWithId: associatedWith?.id,
      associatedWithLabel: associatedWith?.label,
      title: associatedWith?.label,
      createdByType: "person",
      createdById: au.personId,
      createdByLabel: creatorName,
      assignedToType: step?.defaultAssignToType || "person",
      assignedToId: step?.defaultAssignToId || au.personId,
      assignedToLabel: step?.defaultAssignToLabel || creatorName
    } as Task;
    if (step?.expectedResponseDays) {
      const due = new Date();
      due.setDate(due.getDate() + step.expectedResponseDays);
      task.dueDate = due;
    }
    return await this.repos.task.save(task);
  }

  private async applyAutoRoutes(churchId: string, task: Task, depth = 0): Promise<any> {
    if (depth >= 5 || !task.stepId) return task;
    const routes = await this.repos.workflow.loadRoutesForStep(churchId, task.stepId);
    const auto = routes.find((r) => r.trigger === "onEnter" && (r.kind === "always" || !r.kind));
    if (!auto) return task;
    if (auto.targetStepId) {
      task.stepId = auto.targetStepId;
      await this.repos.task.save(task);
      return this.applyAutoRoutes(churchId, task, depth + 1);
    }
    if (auto.targetWorkflowId) {
      const steps = await this.repos.workflow.loadSteps(churchId, auto.targetWorkflowId);
      task.workflowId = auto.targetWorkflowId;
      task.stepId = steps[0]?.id || null;
      await this.repos.task.save(task);
      return this.applyAutoRoutes(churchId, task, depth + 1);
    }
    return this.completeCard(churchId, task.id);
  }

  private async moveCardStep(churchId: string, id: string, stepId: string) {
    const task = await this.repos.task.load(churchId, id);
    if (!task) return { error: "Not found" };
    task.stepId = stepId;
    const step = await this.repos.workflow.loadStep(churchId, stepId);
    if (step && !task.pinnedAssignment) {
      if (step.defaultAssignToId) {
        task.assignedToType = step.defaultAssignToType;
        task.assignedToId = step.defaultAssignToId;
        task.assignedToLabel = step.defaultAssignToLabel;
      }
      if (step.expectedResponseDays) {
        const due = new Date();
        due.setDate(due.getDate() + step.expectedResponseDays);
        task.dueDate = due;
      }
    }
    task.snoozedUntil = null;
    await this.repos.task.save(task);
    return await this.applyAutoRoutes(churchId, task);
  }

  private async completeCard(churchId: string, id: string, routeId?: string): Promise<any> {
    const task = await this.repos.task.load(churchId, id);
    if (!task) return { error: "Not found" };
    if (routeId) {
      const route = await this.repos.workflow.loadRoute(churchId, routeId);
      if (route) {
        if (route.targetStepId) return await this.moveCardStep(churchId, id, route.targetStepId);
        if (route.targetWorkflowId) {
          const steps = await this.repos.workflow.loadSteps(churchId, route.targetWorkflowId);
          task.workflowId = route.targetWorkflowId;
          task.stepId = steps[0]?.id || null;
          await this.repos.task.save(task);
          return await this.applyAutoRoutes(churchId, task);
        }
      }
    }
    task.status = "Closed";
    task.dateClosed = new Date();
    await this.repos.task.save(task);
    return task;
  }

  private async snoozeCard(churchId: string, id: string, days: number) {
    const task = await this.repos.task.load(churchId, id);
    if (!task) return { error: "Not found" };
    const until = new Date();
    until.setDate(until.getDate() + (Number(days) || 1));
    task.snoozedUntil = until;
    await this.repos.task.save(task);
    return task;
  }

  private async reassignCard(churchId: string, id: string, body: { assignedToType: string; assignedToId: string; assignedToLabel: string }) {
    const task = await this.repos.task.load(churchId, id);
    if (!task) return { error: "Not found" };
    task.assignedToType = body.assignedToType;
    task.assignedToId = body.assignedToId;
    task.assignedToLabel = body.assignedToLabel;
    await this.repos.task.save(task);
    return task;
  }

  private async shiftCardStep(churchId: string, id: string, direction: number) {
    const task = await this.repos.task.load(churchId, id);
    if (!task) return { error: "Not found" };
    const steps = await this.repos.workflow.loadSteps(churchId, task.workflowId);
    const index = steps.findIndex((s) => s.id === task.stepId);
    const target = steps[index + direction];
    if (!target) return task;
    return await this.moveCardStep(churchId, id, target.id);
  }

  private async savePhoto(churchId: string, base64Str: string, task: Task) {
    const base64Parts = base64Str.split(",");
    const base64 = base64Parts.length > 1 ? base64Parts[1] : "";
    const key = "/" + churchId + "/membership/people/" + task.associatedWithId + ".png";
    await CustomFileStorageHelper.store(key, "image/png", Buffer.from(base64, "base64"));
    const photoUpdated = new Date();
    const photo: string = Environment.contentRoot + key + "?dt=" + photoUpdated.getTime().toString();
    return photo;
  }

  private async handleDirectoryUpdate(churchId: string, task: Task) {
    if (task.status === "Open") {
      const data = task.data
        ? (() => {
          try {
            return JSON.parse(task.data);
          } catch {
            return [];
          }
        })()
        : [];
      for (const d of data) {
        if (d.field === "photo" && d.value !== undefined) {
          const photoUrl = await this.savePhoto(churchId, d.value, task);
          d.value = photoUrl;
          // Photos apply immediately on submit — no approval gate. The stored
          // URL still remains in the task data as a record of the change.
          try {
            const photoUpdated = new Date();
            await this.repos.membership.updatePersonPhoto(churchId, task.associatedWithId, photoUpdated);
          } catch (e) {
            console.error("Failed to apply photo immediately:", e);
          }
        }
      }
      task.data = JSON.stringify(data);
      task.taskType = "directoryUpdate";
    }
  }
}
