import { controller, httpGet, httpPost, httpPut, httpDelete, requestParam, requestBody } from "inversify-express-utils";
import express from "express";
import { ContentBaseController } from "./ContentBaseController.js";
import { Room } from "../models/index.js";
import { Permissions } from "../helpers/index.js";

@controller("/content/rooms")
export class RoomController extends ContentBaseController {
  @httpGet("/")
  public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.room.load(au.churchId);
    });
  }

  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.room.loadById(id);
    });
  }

  @httpPost("/")
  public async save(@requestBody() model: Room, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      model.churchId = au.churchId;
      return await this.repos.room.save(model);
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      await this.repos.room.delete(id);
      return { success: true };
    });
  }
}
