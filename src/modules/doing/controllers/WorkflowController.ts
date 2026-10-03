import { controller, httpPost, httpGet, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { DoingBaseController } from "./DoingBaseController.js";
import { Workflow, WorkflowCategory, WorkflowStep, WorkflowStepRoute, WorkflowStepAction } from "../models/index.js";

const TEMPLATES = [
  {
    key: "visitorFollowUp",
    name: "First-Time Visitor Follow-up",
    description: "Welcome and follow up with first-time visitors",
    steps: ["Send Welcome Message", "Pastor Call", "Invite to Ministry", "Complete"]
  },
  {
    key: "memberCare",
    name: "Member Care",
    description: "Care and check-in workflow for members",
    steps: ["Initial Contact", "Follow Up", "Resolve"]
  }
];

@controller("/doing/workflows")
export class WorkflowController extends DoingBaseController {
  @httpGet("/templates")
  public async getTemplates(req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async () => {
      return TEMPLATES.map(({ key, name, description }) => ({ key, name, description }));
    });
  }

  @httpPost("/fromTemplate")
  public async createFromTemplate(req: express.Request<{}, {}, { templateKey: string }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const template = TEMPLATES.find((t) => t.key === req.body.templateKey);
      if (!template) return this.json({ error: "Template not found" }, 404);
      const workflow = await this.repos.workflow.saveWorkflow({ churchId: au.churchId, name: template.name, active: true });
      for (let i = 0; i < template.steps.length; i++) {
        await this.repos.workflow.saveStep({ churchId: au.churchId, workflowId: workflow.id, name: template.steps[i], sort: i + 1 });
      }
      return workflow;
    });
  }

  @httpPost("/:id/duplicate")
  public async duplicate(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const source = await this.repos.workflow.loadWorkflow(au.churchId, id);
      if (!source) return this.json({ error: "Not found" }, 404);
      const copy = await this.repos.workflow.saveWorkflow({ churchId: au.churchId, name: (source.name || "") + " (Copy)", categoryId: source.categoryId, active: source.active, sort: source.sort });
      const steps = await this.repos.workflow.loadSteps(au.churchId, id);
      const stepIdMap: Record<string, string> = {};
      for (const s of steps) {
        const newStep = await this.repos.workflow.saveStep({ churchId: au.churchId, workflowId: copy.id, name: s.name, sort: s.sort, defaultAssignToType: s.defaultAssignToType, defaultAssignToId: s.defaultAssignToId, defaultAssignToLabel: s.defaultAssignToLabel, expectedResponseDays: s.expectedResponseDays });
        stepIdMap[s.id] = newStep.id;
      }
      const routes = await this.repos.workflow.loadRoutesForWorkflow(au.churchId, id);
      for (const r of routes) {
        await this.repos.workflow.saveRoute({ churchId: au.churchId, workflowId: copy.id, stepId: stepIdMap[r.stepId], sort: r.sort, trigger: r.trigger, kind: r.kind, label: r.label, targetStepId: stepIdMap[r.targetStepId] || r.targetStepId, targetWorkflowId: r.targetWorkflowId });
      }
      const actions = await this.repos.workflow.loadActionsForWorkflow(au.churchId, id);
      for (const a of actions) {
        await this.repos.workflow.saveAction({ churchId: au.churchId, stepId: stepIdMap[a.stepId], actionType: a.actionType, config: a.config, sort: a.sort });
      }
      return copy;
    });
  }

  @httpGet("/:id/report")
  public async getReport(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const [stepCounts, overdue, throughput] = await Promise.all([
        this.repos.workflow.getStepCounts(au.churchId, id),
        this.repos.workflow.getOverdueCards(au.churchId, id),
        this.repos.workflow.getThroughput(au.churchId, id)
      ]);
      return { stepCounts, overdue, throughput };
    });
  }

  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.workflow.loadWorkflow(au.churchId, id);
    });
  }

  @httpGet("/")
  public async getAll(req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.workflow.loadAllWorkflows(au.churchId);
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, Workflow[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result: Workflow[] = [];
      for (const workflow of req.body) {
        workflow.churchId = au.churchId;
        result.push(await this.repos.workflow.saveWorkflow(workflow));
      }
      return result;
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      await this.repos.workflow.deleteWorkflow(au.churchId, id);
      return {};
    });
  }
}

@controller("/doing/workflowCategories")
export class WorkflowCategoryController extends DoingBaseController {
  @httpGet("/")
  public async getAll(req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.workflow.loadAllCategories(au.churchId);
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, WorkflowCategory[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result: WorkflowCategory[] = [];
      for (const category of req.body) {
        category.churchId = au.churchId;
        result.push(await this.repos.workflow.saveCategory(category));
      }
      return result;
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      await this.repos.workflow.deleteCategory(au.churchId, id);
      return {};
    });
  }
}

@controller("/doing/workflowSteps")
export class WorkflowStepController extends DoingBaseController {
  @httpGet("/workflow/:id")
  public async getForWorkflow(@requestParam("id") workflowId: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.workflow.loadSteps(au.churchId, workflowId);
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, WorkflowStep[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result: WorkflowStep[] = [];
      for (const step of req.body) {
        step.churchId = au.churchId;
        result.push(await this.repos.workflow.saveStep(step));
      }
      return result;
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      await this.repos.workflow.deleteStep(au.churchId, id);
      return {};
    });
  }
}

@controller("/doing/workflowStepRoutes")
export class WorkflowStepRouteController extends DoingBaseController {
  @httpGet("/step/:id")
  public async getForStep(@requestParam("id") stepId: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.workflow.loadRoutesForStep(au.churchId, stepId);
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, WorkflowStepRoute[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result: WorkflowStepRoute[] = [];
      for (const route of req.body) {
        route.churchId = au.churchId;
        result.push(await this.repos.workflow.saveRoute(route));
      }
      return result;
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      await this.repos.workflow.deleteRoute(au.churchId, id);
      return {};
    });
  }
}

@controller("/doing/workflowStepActions")
export class WorkflowStepActionController extends DoingBaseController {
  @httpGet("/step/:id")
  public async getForStep(@requestParam("id") stepId: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.workflow.loadActionsForStep(au.churchId, stepId);
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, WorkflowStepAction[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result: WorkflowStepAction[] = [];
      for (const action of req.body) {
        action.churchId = au.churchId;
        result.push(await this.repos.workflow.saveAction(action));
      }
      return result;
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      await this.repos.workflow.deleteAction(au.churchId, id);
      return {};
    });
  }
}
