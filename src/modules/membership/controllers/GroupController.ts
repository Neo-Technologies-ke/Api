import { controller, httpPost, httpGet, requestParam, httpDelete } from "inversify-express-utils";
import express from "express";
import { sql } from "kysely";
import { MembershipBaseController } from "./MembershipBaseController.js";
import { Group } from "../models/index.js";
import { Permissions } from "../helpers/index.js";
import { ArrayHelper, SlugHelper } from "@churchapps/apihelper";
import { getDb } from "../db/index.js";

@controller("/membership/groups")
export class GroupController extends MembershipBaseController {
  @httpGet("/health/summary")
  public async getHealthSummary(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupMembers.view)) return this.json([], 200);
      const db = getDb() as any;
      const rows = await sql<any>`
        SELECT gm.groupId, g.name, g.categoryName,
          COUNT(gm.id) AS memberCount,
          AVG(TIMESTAMPDIFF(YEAR, p.birthDate, NOW())) AS averageAge,
          SUM(CASE WHEN p.gender = 'Female' THEN 1 ELSE 0 END) AS femaleCount,
          SUM(CASE WHEN p.gender = 'Male' THEN 1 ELSE 0 END) AS maleCount,
          SUM(CASE WHEN gm.joinDate >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS joins90
        FROM groupMembers gm
        LEFT JOIN groups g ON g.id = gm.groupId
        LEFT JOIN people p ON p.id = gm.personId
        WHERE gm.churchId = ${au.churchId}
        GROUP BY gm.groupId, g.name, g.categoryName
      `.execute(db);

      return (rows.rows || []).map((r: any) => {
        const count = Number(r.memberCount) || 0;
        const joins90 = Number(r.joins90) || 0;
        const churnRate90 = 0;
        return {
          groupId: r.groupId, name: r.name, categoryName: r.categoryName || "",
          memberCount: count, averageAge: r.averageAge ? Math.round(Number(r.averageAge)) : null,
          femaleCount: Number(r.femaleCount) || 0, maleCount: Number(r.maleCount) || 0,
          joins90, leaves90: 0, churnRate90
        };
      });
    });
  }

  @httpGet("/:id/health")
  public async getHealth(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupMembers.view)) return this.json({}, 401);
      const db = getDb() as any;

      const result = await sql<any>`
        SELECT gm.id, gm.joinDate, p.birthDate, p.gender
        FROM groupMembers gm LEFT JOIN people p ON p.id = gm.personId
        WHERE gm.churchId = ${au.churchId} AND gm.groupId = ${id}
      `.execute(db);
      const members: any[] = result.rows || [];

      const memberCount = members.length;
      const ages = members.map((m: any) => m.birthDate ? Math.floor((Date.now() - new Date(m.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)) : null).filter((a: any) => a !== null) as number[];
      const averageAge = ages.length > 0 ? Math.round(ages.reduce((s: number, a: number) => s + a, 0) / ages.length) : null;

      const cutoff90 = new Date(); cutoff90.setDate(cutoff90.getDate() - 90);
      const joins90 = members.filter((m: any) => m.joinDate && new Date(m.joinDate) >= cutoff90).length;

      const monthly: Record<string, { joins: number; leaves: number }> = {};
      for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; monthly[k] = { joins: 0, leaves: 0 }; }
      members.forEach((m: any) => { if (m.joinDate) { const k = new Date(m.joinDate).toISOString().slice(0, 7); if (monthly[k]) monthly[k].joins++; } });

      const ageGroups: Record<string, { female: number; male: number; unassigned: number }> = { "0-17": { female: 0, male: 0, unassigned: 0 }, "18-34": { female: 0, male: 0, unassigned: 0 }, "35-54": { female: 0, male: 0, unassigned: 0 }, "55+": { female: 0, male: 0, unassigned: 0 } };
      const genderCount: Record<string, number> = { Male: 0, Female: 0, Unknown: 0 };
      members.forEach((m: any) => {
        const age = m.birthDate ? Math.floor((Date.now() - new Date(m.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
        const g = m.gender === "Male" ? "male" : m.gender === "Female" ? "female" : "unassigned";
        genderCount[m.gender === "Male" ? "Male" : m.gender === "Female" ? "Female" : "Unknown"]++;
        const bucket = age === null ? null : age < 18 ? "0-17" : age < 35 ? "18-34" : age < 55 ? "35-54" : "55+";
        if (bucket) ageGroups[bucket][g as "male" | "female" | "unassigned"]++;
      });

      return {
        memberCount, averageAge, joins90, leaves90: 0, churnRate90: 0,
        monthly: Object.entries(monthly).map(([month, v]) => ({ month, ...v })),
        demographics: {
          gender: Object.entries(genderCount).map(([name, count]) => ({ name, count })),
          ageGroups: Object.entries(ageGroups).map(([group, v]) => ({ group, ...v }))
        }
      };
    });
  }

  @httpGet("/search")
  public async search(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const campusId = req.query.campusId.toString();
      const serviceId = req.query.serviceId.toString();
      const serviceTimeId = req.query.serviceTimeId.toString();
      return this.repos.group.convertAllToModel(au.churchId, (await this.repos.group.search(au.churchId, campusId, serviceId, serviceTimeId)) as any[]);
    });
  }

  @httpGet("/my/:tag")
  public async getMyTag(@requestParam("tag") tag: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result = this.repos.group.convertAllToModel(au.churchId, (await this.repos.group.loadAllForPerson(au.personId)) as any[]);
      return result.filter((g) => g.tags.indexOf(tag) > -1);
    });
  }

  @httpGet("/my")
  public async getMy(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return this.repos.group.convertAllToModel(au.churchId, (await this.repos.group.loadForPerson(au.personId)) as any[]);
    });
  }

  @httpGet("/public/:churchId/slug/:slug")
  public async getPublicSlug(@requestParam("churchId") churchId: string, @requestParam("slug") slug: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapperAnon(req, res, async () => {
      return this.repos.group.convertToModel(churchId, await this.repos.group.loadPublicSlug(churchId, slug));
    });
  }

  @httpGet("/public/:churchId/label")
  public async getPublicLabel(@requestParam("churchId") churchId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapperAnon(req, res, async () => {
      const label = req.query.label.toString();
      return this.repos.group.convertAllToModel(churchId, (await this.repos.group.publicLabel(churchId, label)) as any[]);
    });
  }

  @httpGet("/public/:churchId/:id")
  public async getPublic(@requestParam("churchId") churchId: string, @requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapperAnon(req, res, async () => {
      return this.repos.group.convertToModel(churchId, await this.repos.group.load(churchId, id));
    });
  }

  @httpGet("/tag/:tag")
  public async getByTag(@requestParam("tag") tag: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return this.repos.group.convertAllToModel(au.churchId, (await this.repos.group.loadByTag(au.churchId, tag)) as any[]);
    });
  }

  @httpGet("/public/:churchId/tag/:tag")
  public async getPublicByTag(@requestParam("churchId") churchId: string, @requestParam("tag") tag: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapperAnon(req, res, async () => {
      return this.repos.group.convertAllToModel(churchId, (await this.repos.group.loadByTag(churchId, tag)) as any[]);
    });
  }

  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const data = await this.repos.group.load(au.churchId, id);
      return this.repos.group.convertToModel(au.churchId, data);
    });
  }

  @httpGet("/")
  public async getAll(req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const data = await this.repos.group.loadAll(au.churchId);
      return this.repos.group.convertAllToModel(au.churchId, data);
    });
  }

  // Custom POST implementation (slug generation)
  @httpPost("/")
  public async save(req: express.Request<{}, {}, Group[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groups.edit)) return this.json({}, 401);
      else {
        const promises: Promise<Group>[] = [];
        req.body.forEach((group) => {
          group.churchId = au.churchId;
          if (!group.slug) group.slug = SlugHelper.slugifyString(group.name);
          promises.push(this.repos.group.save(group));
        });
        const result = await Promise.all(promises);
        return this.repos.group.convertAllToModel(au.churchId, result);
      }
    });
  }

  // Custom DELETE implementation (ministry tag handling)
  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groups.edit)) return this.json({}, 401);
      else {
        const group: Group = await this.repos.group.load(au.churchId, id);
        if (group.tags.indexOf("ministry") > -1) {
          const AllTeams = (await this.repos.group.loadByTag(au.churchId, "team")) as any[];
          const ministryTeams = ArrayHelper.getAll(AllTeams, "categoryName", id);
          const ids = ArrayHelper.getIds(ministryTeams, "id");
          await this.repos.group.delete(au.churchId, id);
          await this.repos.group.deleteByIds(au.churchId, ids);
          return this.json({});
        } else {
          await this.repos.group.delete(au.churchId, id);
          return this.json({});
        }
      }
    });
  }
}
