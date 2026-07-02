import { controller, httpGet, httpPost, httpDelete, requestParam } from "inversify-express-utils";
import express from "express";
import { MembershipBaseController } from "./MembershipBaseController.js";
import { List } from "../models/index.js";
import { Permissions } from "../helpers/index.js";

@controller("/membership/lists")
export class ListController extends MembershipBaseController {
  @httpGet("/:id/people")
  public async getPeople(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const list = await this.repos.list.load(au.churchId, id);
      if (!list) return [];
      const conditions = list.conditions ? JSON.parse(list.conditions as string) : null;
      if (!conditions || !Array.isArray(conditions) || conditions.length === 0) return [];
      const people = await this.repos.person.loadAll(au.churchId);
      return this.repos.person.convertAllToModel(au.churchId, people);
    });
  }

  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const data = await this.repos.list.load(au.churchId, id);
      return this.repos.list.convertToModel(data);
    });
  }

  @httpGet("/")
  public async getAll(req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const data = await this.repos.list.loadAll(au.churchId);
      return this.repos.list.convertAllToModel(data);
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, List[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.people.edit)) return this.json({}, 401);
      const promises: Promise<List>[] = [];
      req.body.forEach((item) => {
        item.churchId = au.churchId;
        if (!item.createdByPersonId) item.createdByPersonId = au.personId;
        promises.push(this.repos.list.save(item));
      });
      const result = await Promise.all(promises);
      return this.repos.list.convertAllToModel(result);
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.people.edit)) return this.json({}, 401);
      await this.repos.list.delete(au.churchId, id);
      return {};
    });
  }
}
