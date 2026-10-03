import { controller, httpPost, httpGet, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { DoingBaseController } from "./DoingBaseController.js";
import { WorkflowTrigger } from "../models/index.js";

const EVENT_FIELDS = [
  {
    eventType: "personAdded",
    label: "Person Added",
    recordType: "person",
    fields: [
      { key: "membershipStatus", label: "Membership Status", type: "string" },
      { key: "groupId", label: "Group", type: "select", optionsSource: "groups" }
    ]
  },
  {
    eventType: "formSubmission",
    label: "Form Submitted",
    recordType: "form",
    fields: [{ key: "formId", label: "Form", type: "select", optionsSource: "forms" }]
  },
  {
    eventType: "donation",
    label: "Donation Made",
    recordType: "donation",
    fields: [
      { key: "amount", label: "Amount", type: "number" },
      { key: "fundId", label: "Fund", type: "select", optionsSource: "funds" }
    ]
  },
  {
    eventType: "eventRegistration",
    label: "Event Registration",
    recordType: "eventRegistration",
    fields: [{ key: "eventId", label: "Event", type: "select", optionsSource: "events" }]
  }
];

@controller("/doing/workflowTriggers")
export class WorkflowTriggerController extends DoingBaseController {
  @httpGet("/fields")
  public async getFields(req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async () => {
      return EVENT_FIELDS;
    });
  }

  @httpGet("/workflow/:id")
  public async getForWorkflow(@requestParam("id") workflowId: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.workflow.loadTriggersForWorkflow(au.churchId, workflowId);
    });
  }

  @httpGet("/executions/workflow/:id")
  public async getExecutionsForWorkflow(@requestParam("id") workflowId: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.workflow.loadExecutionsForWorkflow(au.churchId, workflowId);
    });
  }

  @httpPost("/executions/:id/:action")
  public async actOnExecution(@requestParam("id") id: string, @requestParam("action") action: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const execution = await this.repos.workflow.loadExecution(au.churchId, id);
      if (!execution) return this.json({ error: "Not found" }, 404);
      switch (action) {
        case "retry":
          execution.status = "pending";
          execution.nextAttemptAt = new Date();
          break;
        case "pause":
          execution.status = "paused";
          break;
        case "resume":
          execution.status = "pending";
          break;
        default:
          return this.json({ error: "Unknown action" }, 400);
      }
      await this.repos.workflow.saveExecution(execution);
      return { success: true };
    });
  }

  @httpPost("/:id/runNow")
  public async runNow(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const trigger = await this.repos.workflow.loadTrigger(au.churchId, id);
      if (!trigger) return this.json({ error: "Not found" }, 404);
      const execution = await this.repos.workflow.saveExecution({
        churchId: au.churchId,
        triggerId: trigger.id,
        workflowId: trigger.workflowId,
        eventType: trigger.eventType || trigger.recurs,
        status: "success",
        attemptCount: 1,
        dateCompleted: new Date()
      });
      return execution;
    });
  }

  @httpPost("/:id/:action")
  public async actOnTrigger(@requestParam("id") id: string, @requestParam("action") action: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const trigger = await this.repos.workflow.loadTrigger(au.churchId, id);
      if (!trigger) return this.json({ error: "Not found" }, 404);
      if (action === "pauseAll" || action === "resumeAll") {
        trigger.active = action === "resumeAll";
        await this.repos.workflow.saveTrigger(trigger);
        return { success: true };
      }
      return this.json({ error: "Unknown action" }, 400);
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, WorkflowTrigger[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result: WorkflowTrigger[] = [];
      for (const trigger of req.body) {
        trigger.churchId = au.churchId;
        result.push(await this.repos.workflow.saveTrigger(trigger));
      }
      return result;
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      await this.repos.workflow.deleteTrigger(au.churchId, id);
      return {};
    });
  }
}
