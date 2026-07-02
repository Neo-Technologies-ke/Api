import { controller, httpPost, httpGet, httpDelete, requestParam } from "inversify-express-utils";
import express from "express";
import { MembershipBaseController } from "./MembershipBaseController.js";
import { GroupReport } from "../models/index.js";
import { Permissions } from "../helpers/index.js";

@controller("/membership/groupReports")
export class GroupReportController extends MembershipBaseController {

  @httpGet("/")
  public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const canViewAll = au.checkAccess(Permissions.groupReports.view) || au.checkAccess(Permissions.groups.edit);
      let rows: any[];

      if (req.query.groupId) {
        rows = await this.repos.groupReport.loadForGroup(au.churchId, req.query.groupId.toString());
      } else if (!canViewAll) {
        rows = await this.repos.groupReport.loadForPerson(au.churchId, au.personId);
      } else {
        rows = await this.repos.groupReport.loadAll(au.churchId);
      }

      const reports = this.repos.groupReport.convertAllToModel(au.churchId, rows);

      const personIds = [...new Set(reports.map((r) => r.personId).filter(Boolean))];
      const groupIds = [...new Set(reports.map((r) => r.groupId).filter(Boolean))];

      const [people, groups] = await Promise.all([
        personIds.length ? this.repos.person.loadByIds(au.churchId, personIds) : [],
        groupIds.length ? this.repos.group.loadByIds(au.churchId, groupIds) : []
      ]);

      reports.forEach((r) => {
        r.person = (people as any[]).find((p: any) => p.id === r.personId) || null;
        r.group = (groups as any[]).find((g: any) => g.id === r.groupId) || null;
      });

      return reports;
    });
  }

  @httpGet("/:id")
  public async getOne(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const row = await this.repos.groupReport.load(au.churchId, id);
      if (!row) return this.json({ error: "Not found" }, 404);
      const report = this.repos.groupReport.convertToModel(au.churchId, row);

      const canViewAll = au.checkAccess(Permissions.groupReports.view) || au.checkAccess(Permissions.groups.edit);
      if (!canViewAll && report.personId !== au.personId) return this.json({ error: "Access denied" }, 401);

      report.person = (await this.repos.person.load(au.churchId, report.personId)) as any;
      report.group = (await this.repos.group.load(au.churchId, report.groupId)) as any;
      return report;
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, GroupReport>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const report: GroupReport = req.body;
      report.churchId = au.churchId;

      const canEditAll = au.checkAccess(Permissions.groupReports.edit) || au.checkAccess(Permissions.groups.edit);

      if (report.id) {
        const existing = await this.repos.groupReport.load(au.churchId, report.id);
        if (!existing) return this.json({ error: "Not found" }, 404);
        if (!canEditAll && existing.personId !== au.personId) return this.json({ error: "Access denied" }, 401);
        if (!canEditAll) report.status = existing.status;
      } else {
        report.personId = au.personId;
        if (!report.reportDate) report.reportDate = new Date().toISOString().split("T")[0];
      }

      return this.repos.groupReport.save(report);
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const existing = await this.repos.groupReport.load(au.churchId, id);
      if (!existing) return this.json({ error: "Not found" }, 404);
      const canEditAll = au.checkAccess(Permissions.groupReports.edit) || au.checkAccess(Permissions.groups.edit);
      if (!canEditAll && existing.personId !== au.personId) return this.json({ error: "Access denied" }, 401);
      await this.repos.groupReport.delete(au.churchId, id);
      return this.json({});
    });
  }
}
