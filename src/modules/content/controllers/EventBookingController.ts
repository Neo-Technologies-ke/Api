import { controller, httpGet, httpPost, httpPut, httpDelete, requestParam, requestBody } from "inversify-express-utils";
import express from "express";
import { ContentBaseController } from "./ContentBaseController.js";
import { EventBooking } from "../models/index.js";
import { Permissions } from "../helpers/index.js";

@controller("/content/eventBookings")
export class EventBookingController extends ContentBaseController {
  @httpGet("/")
  public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.eventBooking.load(au.churchId);
    });
  }

  @httpGet("/calendar")
  public async getCalendar(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const startTime = req.query.startTime ? new Date(req.query.startTime.toString()) : new Date();
      const endTime = req.query.endTime ? new Date(req.query.endTime.toString()) : new Date();
      const roomId = req.query.roomId?.toString();
      const resourceId = req.query.resourceId?.toString();
      return await this.repos.eventBooking.loadForCalendar(au.churchId, startTime, endTime, roomId, resourceId);
    });
  }

  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.eventBooking.loadById(id);
    });
  }

  @httpPost("/")
  public async save(@requestBody() model: EventBooking, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      model.churchId = au.churchId;
      model.personId = au.id;
      model.personName = `${au.firstName} ${au.lastName}`;
      return await this.repos.eventBooking.save(model);
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      await this.repos.eventBooking.delete(id);
      return { success: true };
    });
  }
}
