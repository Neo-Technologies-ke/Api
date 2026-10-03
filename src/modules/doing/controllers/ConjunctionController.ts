import { controller, httpPost, httpGet, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { DoingBaseController } from "./DoingBaseController.js";
import { Conjunction } from "../models/index.js";

@controller("/doing/conjunctions")
export class ConjunctionController extends DoingBaseController {
  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.conjunction.load(au.churchId, id);
    });
  }

  @httpGet("/automation/:id")
  public async getForAutomation(@requestParam("id") automationId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.conjunction.loadForAutomation(au.churchId, automationId);
    });
  }

  @httpGet("/stepRoute/:id")
  public async getForStepRoute(@requestParam("id") stepRouteId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      let conjunctions: any[] = await this.repos.conjunction.loadForAutomation(au.churchId, stepRouteId);
      if (conjunctions.length === 0) {
        const root = await this.repos.conjunction.save({ churchId: au.churchId, automationId: stepRouteId, groupType: "and" } as Conjunction);
        conjunctions = [root];
      }
      return conjunctions;
    });
  }

  @httpGet("/trigger/:id")
  public async getForTrigger(@requestParam("id") triggerId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.conjunction.loadForAutomation(au.churchId, triggerId);
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, Conjunction[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const promises: Promise<Conjunction>[] = [];
      req.body.forEach((conjunction) => {
        conjunction.churchId = au.churchId;
        promises.push(this.repos.conjunction.save(conjunction));
      });
      const result = await Promise.all(promises);
      return result;
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      await this.repos.conjunction.delete(au.churchId, id);
      return {};
    });
  }
}
