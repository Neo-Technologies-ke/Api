import { controller, httpGet, httpPost, httpDelete, requestParam } from "inversify-express-utils";
import express from "express";
import { MembershipBaseController } from "./MembershipBaseController.js";
import { Permissions } from "../helpers/index.js";
import { GroupJoinRequest } from "../models/index.js";
import { GroupMember } from "../models/index.js";

@controller("/membership/groupjoinrequests")
export class GroupJoinRequestController extends MembershipBaseController {
  @httpGet("/pending")
  public async getPending(req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupMembers.edit)) return this.json([], 200);
      return this.repos.groupJoinRequest.loadPending(au.churchId);
    });
  }

  @httpGet("/group/:groupId")
  public async getForGroup(@requestParam("groupId") groupId: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupMembers.view)) return this.json([], 200);
      return this.repos.groupJoinRequest.loadForGroup(au.churchId, groupId);
    });
  }

  @httpPost("/:id/approve")
  public async approve(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupMembers.edit)) return this.json({}, 401);
      const request: GroupJoinRequest = await this.repos.groupJoinRequest.load(au.churchId, id);
      if (!request) return this.json({ error: "Not found" }, 404);
      request.status = "approved";
      await this.repos.groupJoinRequest.save(request);
      const gm: GroupMember = { churchId: au.churchId, groupId: request.groupId, personId: request.personId, leader: false };
      await this.repos.groupMember.save(gm);
      return {};
    });
  }

  @httpPost("/:id/decline")
  public async decline(@requestParam("id") id: string, req: express.Request<{}, {}, { declineReason?: string }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupMembers.edit)) return this.json({}, 401);
      const request: GroupJoinRequest = await this.repos.groupJoinRequest.load(au.churchId, id);
      if (!request) return this.json({ error: "Not found" }, 404);
      request.status = "declined";
      request.declineReason = req.body?.declineReason || null;
      await this.repos.groupJoinRequest.save(request);
      return {};
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, GroupJoinRequest[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const promises: Promise<GroupJoinRequest>[] = [];
      req.body.forEach((item) => {
        item.churchId = au.churchId;
        promises.push(this.repos.groupJoinRequest.save(item));
      });
      return Promise.all(promises);
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupMembers.edit)) return this.json({}, 401);
      await this.repos.groupJoinRequest.delete(au.churchId, id);
      return {};
    });
  }
}
