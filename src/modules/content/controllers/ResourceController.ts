import { controller, httpGet, httpPost, httpPut, httpDelete, requestParam, requestBody } from "inversify-express-utils";
import express from "express";
import { ContentBaseController } from "./ContentBaseController.js";
import { Resource } from "../models/index.js";
import { Permissions } from "../helpers/index.js";

@controller("/content/resources")
export class ResourceController extends ContentBaseController {
  @httpGet("/")
  public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.resource.load(au.churchId);
    });
  }

  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.resource.loadById(id);
    });
  }

  @httpPost("/")
  public async save(@requestBody() model: Resource, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      model.churchId = au.churchId;
      return await this.repos.resource.save(model);
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      await this.repos.resource.delete(id);
      return { success: true };
    });
  }
}
