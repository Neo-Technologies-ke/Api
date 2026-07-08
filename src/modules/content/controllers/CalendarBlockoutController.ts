import { controller, httpGet, httpPost, httpPut, httpDelete, requestParam, requestBody } from "inversify-express-utils";
import express from "express";
import { ContentBaseController } from "./ContentBaseController.js";
import { CalendarBlockout } from "../models/index.js";
import { Permissions } from "../helpers/index.js";

@controller("/content/calendarBlockouts")
export class CalendarBlockoutController extends ContentBaseController {
  @httpGet("/")
  public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.calendarBlockout.load(au.churchId);
    });
  }

  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.calendarBlockout.loadById(id);
    });
  }

  @httpPost("/")
  public async save(@requestBody() model: CalendarBlockout, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      model.churchId = au.churchId;
      return await this.repos.calendarBlockout.save(model);
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      await this.repos.calendarBlockout.delete(id);
      return { success: true };
    });
  }
}
