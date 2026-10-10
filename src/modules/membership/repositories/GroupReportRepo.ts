import { injectable } from "inversify";
import { getDb } from "../db/index.js";
import { UniqueIdHelper } from "@churchapps/apihelper";
import { GroupReport, GroupReportTemplate } from "../models/index.js";

@injectable()
export class GroupReportRepo {
  public async save(report: GroupReport): Promise<GroupReport> {
    return report.id ? this.update(report) : this.create(report);
  }

  private async create(report: GroupReport): Promise<GroupReport> {
    report.id = UniqueIdHelper.shortId();
    const submittedAt = report.status === "submitted" ? new Date() : null;
    await getDb().insertInto("groupReports" as any).values({
      id: report.id, churchId: report.churchId, groupId: report.groupId, personId: report.personId,
      templateId: report.templateId || null, title: report.title, content: report.content,
      answers: report.answers ? JSON.stringify(report.answers) : null,
      reportDate: report.reportDate, status: report.status || "draft", submittedAt
    }).execute();
    report.submittedAt = submittedAt;
    return report;
  }

  private async update(report: GroupReport): Promise<GroupReport> {
    await getDb().updateTable("groupReports" as any).set({
      templateId: report.templateId || null, title: report.title, content: report.content,
      answers: report.answers ? JSON.stringify(report.answers) : null,
      reportDate: report.reportDate, status: report.status, submittedAt: report.submittedAt,
      updatedAt: new Date()
    }).where("id", "=", report.id).where("churchId", "=", report.churchId).execute();
    return report;
  }

  public async markRead(churchId: string, id: string): Promise<void> {
    await getDb().updateTable("groupReports" as any).set({ status: "read", readAt: new Date(), updatedAt: new Date() })
      .where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  public async respond(churchId: string, id: string, response: string, personId: string): Promise<void> {
    await getDb().updateTable("groupReports" as any).set({ response, respondedAt: new Date(), respondedByPersonId: personId, status: "responded", readAt: new Date(), updatedAt: new Date() })
      .where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  public async delete(churchId: string, id: string): Promise<void> {
    await getDb().deleteFrom("groupReports" as any).where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  public async load(churchId: string, id: string): Promise<any> {
    return (await getDb().selectFrom("groupReports" as any).selectAll().where("id", "=", id).where("churchId", "=", churchId).executeTakeFirst()) ?? null;
  }

  private baseLoad(churchId: string) {
    return getDb().selectFrom("groupReports" as any).selectAll().where("churchId" as any, "=", churchId);
  }

  public async loadAll(churchId: string): Promise<any[]> {
    return this.baseLoad(churchId).where("status" as any, "!=", "draft").orderBy("submittedAt" as any, "desc").execute();
  }

  public async loadForGroup(churchId: string, groupId: string): Promise<any[]> {
    return this.baseLoad(churchId).where("groupId" as any, "=", groupId).orderBy("updatedAt" as any, "desc").execute();
  }

  public async loadForPerson(churchId: string, personId: string): Promise<any[]> {
    return this.baseLoad(churchId).where("personId" as any, "=", personId).orderBy("updatedAt" as any, "desc").execute();
  }

  private static parseJson(value: any): any {
    if (typeof value !== "string") return value ?? null;
    try { return JSON.parse(value); } catch { return null; }
  }

  private static parseTemplate(row: any): any {
    if (!row) return null;
    return { ...row, questions: GroupReportRepo.parseJson(row.questions) };
  }

  public async loadTemplates(churchId: string, includeInactive = false): Promise<any[]> {
    let query = getDb().selectFrom("groupReportTemplates" as any).selectAll().where("churchId" as any, "=", churchId);
    if (!includeInactive) query = query.where("active" as any, "=", true);
    const rows = await query.orderBy("name" as any).execute();
    return rows.map((r: any) => GroupReportRepo.parseTemplate(r));
  }

  public async loadTemplate(churchId: string, id: string): Promise<any> {
    const row = await getDb().selectFrom("groupReportTemplates" as any).selectAll().where("churchId" as any, "=", churchId).where("id" as any, "=", id).executeTakeFirst();
    return GroupReportRepo.parseTemplate(row) ?? null;
  }

  public async saveTemplate(template: GroupReportTemplate): Promise<GroupReportTemplate> {
    const questions = template.questions?.length ? JSON.stringify(template.questions) : null;
    if (!template.id) {
      template.id = UniqueIdHelper.shortId();
      await getDb().insertInto("groupReportTemplates" as any).values({ id: template.id, churchId: template.churchId, name: template.name, description: template.description || null, content: template.content, questions, active: template.active !== false }).execute();
    } else {
      await getDb().updateTable("groupReportTemplates" as any).set({ name: template.name, description: template.description || null, content: template.content, questions, active: template.active !== false, updatedAt: new Date() }).where("churchId" as any, "=", template.churchId).where("id" as any, "=", template.id).execute();
    }
    return template;
  }

  public async deleteTemplate(churchId: string, id: string): Promise<void> {
    await getDb().deleteFrom("groupReportTemplates" as any).where("churchId" as any, "=", churchId).where("id" as any, "=", id).execute();
  }

  public convertToModel(_churchId: string, data: any): GroupReport {
    if (!data) return null;
    return { ...data, active: data.active === true || data.active === 1, answers: GroupReportRepo.parseJson(data.answers) };
  }

  public convertAllToModel(churchId: string, data: any[]): GroupReport[] {
    if (!Array.isArray(data)) return [];
    return data.map((d) => this.convertToModel(churchId, d));
  }
}
