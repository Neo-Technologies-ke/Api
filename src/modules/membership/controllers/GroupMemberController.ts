import { controller, httpGet, httpPost, httpDelete, requestParam } from "inversify-express-utils";
import express from "express";
import { MembershipBaseController } from "./MembershipBaseController.js";
import { Permissions, UserChurchHelper } from "../helpers/index.js";
import { GroupMember } from "../models/index.js";

@controller("/membership/groupmembers")
export class GroupMemberController extends MembershipBaseController {
  @httpGet("/my")
  public async getMy(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return this.repos.groupMember.loadForPerson(au.churchId, au.personId);
    });
  }

  @httpGet("/public/leaders/:churchId/:groupId")
  public async getPublicLeaders(@requestParam("churchId") churchId: string, @requestParam("groupId") groupId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapperAnon(req, res, async () => {
      const result = (await this.repos.groupMember.loadLeadersForGroup(churchId, groupId)) as any[];
      return this.repos.groupMember.convertAllToModel(churchId, result);
    });
  }

  @httpGet("/basic/:groupId")
  public async getbasic(@requestParam("groupId") groupId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result = (await this.repos.groupMember.loadForGroup(au.churchId, groupId)) as any[];
      return this.repos.groupMember.convertAllToBasicModel(au.churchId, result);
    });
  }

  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupMembers.view)) return this.json({}, 401);
      const data = await this.repos.groupMember.load(au.churchId, id);
      return this.repos.groupMember.convertToModel(au.churchId, data);
    });
  }

  @httpGet("/")
  public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      let hasAccess = false;
      if (au.checkAccess(Permissions.groupMembers.view)) hasAccess = true;
      else if (req.query.groupId && au.groupIds && au.groupIds.includes(req.query.groupId.toString())) hasAccess = true;
      else if (req.query.groupId && au.checkAccess(Permissions.ownGroups.view) && au.leaderGroupIds?.includes(req.query.groupId.toString())) hasAccess = true;
      else if (req.query.personId && au.personId === req.query.personId.toString()) hasAccess = true;
      if (!hasAccess) return this.json({}, 401);
      else {
        let result = null;
        if (req.query.groupId !== undefined) result = await this.repos.groupMember.loadForGroup(au.churchId, req.query.groupId.toString());
        else if (req.query.groupIds !== undefined) result = await this.repos.groupMember.loadForGroups(au.churchId, req.query.groupIds.toString().split(","));
        else if (req.query.personId !== undefined) result = await this.repos.groupMember.loadForPerson(au.churchId, req.query.personId.toString());
        else result = await this.repos.groupMember.loadAll(au.churchId);
        return this.repos.groupMember.convertAllToModel(au.churchId, result);
      }
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, GroupMember[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupMembers.edit)) {
        const scopedEdit = au.checkAccess(Permissions.ownGroups.edit) && req.body.every((gm) => gm.groupId && au.leaderGroupIds?.includes(gm.groupId));
        if (!scopedEdit) return this.json({ error: "Unauthorized" }, 401);
      }

      const promises: Promise<GroupMember>[] = [];
      req.body.forEach((gm) => {
        gm.churchId = au.churchId;
        promises.push(this.repos.groupMember.save(gm));
      });
      const result = await Promise.all(promises);

      // Create userChurch records for members with matching users
      for (const gm of result) {
        await UserChurchHelper.createForGroupMember(au.churchId, gm.personId);
        if (gm.leader) await this.assignRoleForLeaderTitle(au, gm);
      }

      return this.repos.groupMember.convertAllToModel(au.churchId, result);
    });
  }

  // When a leader is promoted, grant them the role matching their title (e.g.
  // "Village Coordinator" -> "Village Coordinators") so scoped admin permissions
  // apply without a separate role-assignment step. Leaders whose title has no
  // matching role fall back to the baseline "Group Leaders" role — still scoped
  // to their own groups only via leaderGroupIds.
  private async assignRoleForLeaderTitle(au: any, gm: GroupMember) {
    try {
      const norm = (s: string) => (s || "").toLowerCase().replace(/s\b/g, "").replace(/\s+/g, " ").trim();
      const roles: any[] = await this.repos.role.loadByChurchId(au.churchId);
      const role = (roles || []).find((r) => gm.leaderTitle && norm(r.name) === norm(gm.leaderTitle))
        || (roles || []).find((r) => norm(r.name) === "group leader");
      if (!role) return;
      const person: any = await this.repos.person.load(au.churchId, gm.personId);
      if (!person?.userId) return;
      const existing = await this.repos.roleMember.loadByRoleId(role.id, au.churchId);
      if (existing.some((m: any) => m.userId === person.userId)) return;
      await this.repos.roleMember.save({ churchId: au.churchId, roleId: role.id, userId: person.userId, addedBy: au.id } as any);
    } catch { /* role assignment is best-effort; membership save already succeeded */ }
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupMembers.edit)) {
        const member = await this.repos.groupMember.load(au.churchId, id);
        const scopedEdit = member && au.checkAccess(Permissions.ownGroups.edit) && au.leaderGroupIds?.includes(member.groupId);
        if (!scopedEdit) return this.json({}, 401);
      }
      await this.repos.groupMember.delete(au.churchId, id);
      return {};
    });
  }
}
