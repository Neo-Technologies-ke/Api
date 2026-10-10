import { controller, httpPost, httpGet, httpDelete, requestParam } from "inversify-express-utils";
import express from "express";
import { MembershipBaseController } from "./MembershipBaseController.js";
import { GroupReport, GroupReportTemplate } from "../models/index.js";
import { Permissions } from "../helpers/index.js";

@controller("/membership/groupReports")
export class GroupReportController extends MembershipBaseController {
  private async populate(reports: GroupReport[], churchId: string): Promise<GroupReport[]> {
    const personIds = [...new Set(reports.flatMap((r) => [r.personId, r.respondedByPersonId]).filter(Boolean))] as string[];
    const groupIds = [...new Set(reports.map((r) => r.groupId).filter(Boolean))] as string[];
    const [people, groups] = await Promise.all([
      personIds.length ? this.repos.person.loadByIds(churchId, personIds) : [],
      groupIds.length ? this.repos.group.loadByIds(churchId, groupIds) : []
    ]);
    reports.forEach((r) => {
      r.person = (people as any[]).find((p: any) => p.id === r.personId) || null;
      r.respondedByPerson = (people as any[]).find((p: any) => p.id === r.respondedByPersonId) || null;
      r.group = (groups as any[]).find((g: any) => g.id === r.groupId) || null;
    });
    return reports;
  }

  @httpGet("/templates")
  public async getTemplates(req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const includeInactive = au.checkAccess(Permissions.groupReports.edit);
      return this.repos.groupReport.loadTemplates(au.churchId, includeInactive);
    });
  }

  @httpPost("/templates")
  public async saveTemplate(req: express.Request<{}, {}, GroupReportTemplate>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupReports.edit)) return this.json({ error: "Access denied" }, 401);
      const template = req.body;
      if (!template.name?.trim() || (!template.content?.trim() && !template.questions?.length)) return this.json({ error: "Name and template content are required" }, 400);
      if (template.id && !(await this.repos.groupReport.loadTemplate(au.churchId, template.id))) return this.json({ error: "Not found" }, 404);
      template.churchId = au.churchId;
      return this.repos.groupReport.saveTemplate(template);
    });
  }

  @httpDelete("/templates/:id")
  public async deleteTemplate(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupReports.edit)) return this.json({ error: "Access denied" }, 401);
      await this.repos.groupReport.deleteTemplate(au.churchId, id);
      return this.json({});
    });
  }

  @httpGet("/")
  public async getAll(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const canViewAll = au.checkAccess(Permissions.groupReports.view);
      let rows: any[];
      if (req.query.groupId) {
        const groupId = req.query.groupId.toString();
        const isGroupLeader = au.leaderGroupIds?.includes(groupId);
        if (!canViewAll && !isGroupLeader) return this.json({ error: "Access denied" }, 401);
        rows = canViewAll ? await this.repos.groupReport.loadForGroup(au.churchId, groupId) : (await this.repos.groupReport.loadForPerson(au.churchId, au.personId)).filter((r) => r.groupId === groupId);
      } else {
        rows = canViewAll ? await this.repos.groupReport.loadAll(au.churchId) : await this.repos.groupReport.loadForPerson(au.churchId, au.personId);
      }
      return this.populate(this.repos.groupReport.convertAllToModel(au.churchId, rows), au.churchId);
    });
  }

  @httpGet("/:id")
  public async getOne(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const row = await this.repos.groupReport.load(au.churchId, id);
      if (!row) return this.json({ error: "Not found" }, 404);
      const report = this.repos.groupReport.convertToModel(au.churchId, row);
      const canViewAll = au.checkAccess(Permissions.groupReports.view);
      if (!canViewAll && report.personId !== au.personId) return this.json({ error: "Access denied" }, 401);
      return (await this.populate([report], au.churchId))[0];
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, GroupReport>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const report = req.body;
      report.churchId = au.churchId;
      const canEditAll = au.checkAccess(Permissions.groupReports.edit);
      if (report.id) {
        const existing = await this.repos.groupReport.load(au.churchId, report.id);
        if (!existing) return this.json({ error: "Not found" }, 404);
        if (existing.personId !== au.personId) return this.json({ error: "Access denied" }, 401);
        if (existing.status !== "draft") return this.json({ error: "Submitted reports cannot be edited" }, 400);
        report.personId = existing.personId;
        report.groupId = existing.groupId;
        report.status = report.status === "submitted" ? "submitted" : "draft";
        report.submittedAt = report.status === "submitted" ? new Date() : null;
      } else {
        report.personId = au.personId;
        report.status = report.status === "submitted" ? "submitted" : "draft";
        if (!report.reportDate) report.reportDate = new Date().toISOString().split("T")[0];
        if (!report.groupId || (!canEditAll && !au.leaderGroupIds?.includes(report.groupId))) return this.json({ error: "Access denied" }, 401);
      }
      if (!report.title?.trim() || (!report.content?.trim() && !report.answers)) return this.json({ error: "Title and report content are required" }, 400);
      if (report.templateId) {
        const template = await this.repos.groupReport.loadTemplate(au.churchId, report.templateId);
        const groupQuestions = (template?.questions || []).filter((q: any) => q.type === "group");
        if (groupQuestions.length) {
          const group = await this.repos.group.load(au.churchId, report.groupId);
          report.answers = report.answers || {};
          groupQuestions.forEach((q: any) => { report.answers[q.id] = group?.name || ""; });
        }
      }
      return this.repos.groupReport.save(report);
    });
  }

  @httpPost("/:id/read")
  public async markRead(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupReports.view)) return this.json({ error: "Access denied" }, 401);
      const existing = await this.repos.groupReport.load(au.churchId, id);
      if (!existing || existing.status === "draft") return this.json({ error: "Not found" }, 404);
      await this.repos.groupReport.markRead(au.churchId, id);
      return this.json({ success: true });
    });
  }

  @httpPost("/:id/respond")
  public async respond(@requestParam("id") id: string, req: express.Request<{}, {}, { response?: string }>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      if (!au.checkAccess(Permissions.groupReports.view)) return this.json({ error: "Access denied" }, 401);
      const existing = await this.repos.groupReport.load(au.churchId, id);
      if (!existing || existing.status === "draft") return this.json({ error: "Not found" }, 404);
      if (!req.body.response?.trim()) return this.json({ error: "Response is required" }, 400);
      await this.repos.groupReport.respond(au.churchId, id, req.body.response.trim(), au.personId);
      return this.json({ success: true });
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const existing = await this.repos.groupReport.load(au.churchId, id);
      if (!existing) return this.json({ error: "Not found" }, 404);
      if (existing.personId !== au.personId || existing.status !== "draft") return this.json({ error: "Only your drafts can be deleted" }, 401);
      await this.repos.groupReport.delete(au.churchId, id);
      return this.json({});
    });
  }
}
