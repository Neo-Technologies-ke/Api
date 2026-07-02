import { injectable } from "inversify";
import { getDb } from "../db/index.js";
import { UniqueIdHelper } from "@churchapps/apihelper";
import { GroupReport } from "../models/index.js";

@injectable()
export class GroupReportRepo {
  public async save(report: GroupReport): Promise<GroupReport> {
    return report.id ? this.update(report) : this.create(report);
  }

  private async create(report: GroupReport): Promise<GroupReport> {
    report.id = UniqueIdHelper.shortId();
    await getDb().insertInto("groupReports" as any).values({
      id: report.id,
      churchId: report.churchId,
      groupId: report.groupId,
      personId: report.personId,
      title: report.title,
      content: report.content,
      reportDate: report.reportDate,
      status: report.status || "submitted"
    }).execute();
    return report;
  }

  private async update(report: GroupReport): Promise<GroupReport> {
    await getDb().updateTable("groupReports" as any).set({
      title: report.title,
      content: report.content,
      reportDate: report.reportDate,
      status: report.status
    }).where("id", "=", report.id).where("churchId", "=", report.churchId).execute();
    return report;
  }

  public async delete(churchId: string, id: string): Promise<void> {
    await getDb().deleteFrom("groupReports" as any).where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  public async load(churchId: string, id: string): Promise<any> {
    return (await getDb().selectFrom("groupReports" as any).selectAll().where("id", "=", id).where("churchId", "=", churchId).executeTakeFirst()) ?? null;
  }

  public async loadAll(churchId: string): Promise<any[]> {
    return getDb().selectFrom("groupReports" as any)
      .selectAll()
      .where("churchId" as any, "=", churchId)
      .orderBy("reportDate" as any, "desc")
      .execute();
  }

  public async loadForGroup(churchId: string, groupId: string): Promise<any[]> {
    return getDb().selectFrom("groupReports" as any)
      .selectAll()
      .where("churchId" as any, "=", churchId)
      .where("groupId" as any, "=", groupId)
      .orderBy("reportDate" as any, "desc")
      .execute();
  }

  public async loadForPerson(churchId: string, personId: string): Promise<any[]> {
    return getDb().selectFrom("groupReports" as any)
      .selectAll()
      .where("churchId" as any, "=", churchId)
      .where("personId" as any, "=", personId)
      .orderBy("reportDate" as any, "desc")
      .execute();
  }

  public convertToModel(_churchId: string, data: any): GroupReport {
    if (!data) return null;
    return {
      id: data.id,
      churchId: data.churchId,
      groupId: data.groupId,
      personId: data.personId,
      title: data.title,
      content: data.content,
      reportDate: data.reportDate,
      status: data.status,
      createdAt: data.createdAt
    };
  }

  public convertAllToModel(churchId: string, data: any[]): GroupReport[] {
    if (!Array.isArray(data)) return [];
    return data.map((d) => this.convertToModel(churchId, d));
  }
}
