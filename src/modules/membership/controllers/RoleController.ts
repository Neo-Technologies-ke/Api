import { controller, httpPost, httpGet, requestParam, httpDelete } from "inversify-express-utils";
import { Role } from "../models/index.js";
import express from "express";
import { AuthenticatedUser } from "../auth/index.js";
import { MembershipBaseController } from "./MembershipBaseController.js";
import { Permissions, IPermission } from "../helpers/index.js";

@controller("/membership/roles")
export class RoleController extends MembershipBaseController {
  @httpGet("/church/:churchId")
  public async loadByChurchId(@requestParam("churchId") churchId: string, req: express.Request<{}, {}, []>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.roles.view)) return this.json({}, 401);
      else {
        return this.repos.role.convertAllToModel(churchId, await this.repos.role.loadByChurchId(churchId));
      }
    });
  }

  // Leader-type options for group promotion. Returns only "group-scoped" roles —
  // ones whose permissions are confined to Own Groups + People/Edit Self — so a
  // group leader assigning a type can never escalate beyond group admin.
  @httpGet("/groupleadertypes")
  public async leaderTypes(req: express.Request<{}, {}, []>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const canEdit = au.checkAccess(Permissions.groupMembers.edit) || au.checkAccess(Permissions.ownGroups.edit);
      if (!canEdit) return this.json({}, 401);
      const roles: Role[] = await this.repos.role.loadByChurchId(au.churchId);
      const perms: any[] = await this.repos.rolePermission.loadAll(au.churchId);
      const byRole = new Map<string, any[]>();
      perms.forEach((p) => {
        if (!byRole.has(p.roleId)) byRole.set(p.roleId, []);
        byRole.get(p.roleId).push(p);
      });
      const isGroupScoped = (list: any[]) => list.length > 0
        && list.some((p) => p.apiName === "MembershipApi" && p.contentType === "Own Groups")
        && list.every((p) => p.apiName === "MembershipApi"
          && (p.contentType === "Own Groups" || (p.contentType === "People" && p.action === "Edit Self")));
      const result = (roles || [])
        .filter((r) => isGroupScoped(byRole.get(r.id) || []))
        .map((r) => ({ id: r.id, name: r.name }));
      return this.json(result, 200);
    });
  }

  @httpGet("/:id")
  public async loadById(@requestParam("id") id: string, req: express.Request<{}, {}, []>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const role: Role = await this.repos.role.loadById(au.churchId, id);
      const roles: Role[] = [role];
      const hasAccess = await this.checkAccess(roles, Permissions.roles.view, au);
      if (!hasAccess) return this.json({}, 401);
      else return this.json(role, 200);
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, Role[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.roles.edit)) return this.json({}, 401);
      else {
        let roles: Role[] = req.body;
        const promises: Promise<Role>[] = [];
        roles.forEach((role) => {
          role.churchId = au.churchId;
          promises.push(this.repos.role.save(role));
        });
        roles = await Promise.all(promises);
        return this.json(roles, 200);
      }
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, []>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const role: Role = await this.repos.role.loadById(au.churchId, id);
      const roles: Role[] = [role];
      if (!this.checkAccess(roles, Permissions.roles.edit, au)) return this.json({}, 401);
      else {
        await this.repos.rolePermission.deleteForRole(au.churchId, id);
        await this.repos.roleMember.deleteForRole(au.churchId, id);
        await new Promise((resolve) => setTimeout(resolve, 500)); // I think it takes a split second for the FK restraints to see the members were deleted sometimes and the delete below fails if I don't wait.
        await this.repos.role.delete(au.churchId, id);
        return this.json([], 200);
      }
    });
  }

  private async checkAccess(_roles: Role[], permission: IPermission, au: AuthenticatedUser) {
    const hasAccess = au.checkAccess(permission);
    if (hasAccess && au.apiName !== "AccessManagement") {
      // roles.forEach(r => { if (r.appName !== au.appName) hasAccess = false; })
    }
    return hasAccess;
  }
}
