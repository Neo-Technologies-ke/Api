import { injectable } from "inversify";
import { sql } from "kysely";
import { getDb } from "../db/index.js";
import { UniqueIdHelper } from "@churchapps/apihelper";
import { GroupJoinRequest } from "../models/index.js";
import { PersonHelper } from "../helpers/index.js";

@injectable()
export class GroupJoinRequestRepo {
  public async save(model: GroupJoinRequest) {
    return model.id ? this.update(model) : this.create(model);
  }

  private async create(model: GroupJoinRequest): Promise<GroupJoinRequest> {
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("groupJoinRequests" as any).values({
      id: model.id,
      churchId: model.churchId,
      groupId: model.groupId,
      personId: model.personId,
      requestDate: sql`NOW()`,
      status: model.status || "pending",
      message: model.message || null
    } as any).execute();
    return model;
  }

  private async update(model: GroupJoinRequest): Promise<GroupJoinRequest> {
    await (getDb() as any).updateTable("groupJoinRequests").set({
      status: model.status,
      declineReason: model.declineReason || null
    }).where("id", "=", model.id).where("churchId", "=", model.churchId).execute();
    return model;
  }

  public async delete(churchId: string, id: string) {
    await (getDb() as any).deleteFrom("groupJoinRequests").where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  public async load(churchId: string, id: string) {
    return ((await (getDb() as any).selectFrom("groupJoinRequests").selectAll().where("id", "=", id).where("churchId", "=", churchId).executeTakeFirst()) ?? null) as GroupJoinRequest | null;
  }

  public async loadForGroup(churchId: string, groupId: string) {
    const rows = await (getDb() as any)
      .selectFrom("groupJoinRequests as gjr")
      .leftJoin("people as p", "p.id", "gjr.personId")
      .selectAll("gjr")
      .select(["p.displayName", "p.photoUpdated"])
      .where("gjr.churchId", "=", churchId)
      .where("gjr.groupId", "=", groupId)
      .where("gjr.status", "=", "pending")
      .orderBy("gjr.requestDate", "asc")
      .execute();
    return this.convertAllToModel(churchId, rows);
  }

  public async loadPending(churchId: string) {
    const rows = await (getDb() as any)
      .selectFrom("groupJoinRequests as gjr")
      .leftJoin("people as p", "p.id", "gjr.personId")
      .leftJoin("groups as g", "g.id", "gjr.groupId")
      .selectAll("gjr")
      .select(["p.displayName", "p.photoUpdated", "g.name as groupName"])
      .where("gjr.churchId", "=", churchId)
      .where("gjr.status", "=", "pending")
      .orderBy("gjr.requestDate", "asc")
      .execute();
    return this.convertAllToModel(churchId, rows);
  }

  protected rowToModel(row: any): GroupJoinRequest {
    const result: GroupJoinRequest = {
      id: row.id,
      churchId: row.churchId,
      groupId: row.groupId,
      personId: row.personId,
      requestDate: row.requestDate,
      status: row.status,
      message: row.message,
      declineReason: row.declineReason
    };
    if (row.displayName !== undefined) {
      result.person = {
        id: result.personId,
        photoUpdated: row.photoUpdated,
        name: { display: row.displayName }
      };
      result.person.photo = PersonHelper.getPhotoPath(row.churchId, result.person);
    }
    if (row.groupName !== undefined) {
      result.group = { id: result.groupId, name: row.groupName };
    }
    return result;
  }

  public convertToModel(_churchId: string, data: any) {
    if (!data) return null;
    return this.rowToModel(data);
  }

  public convertAllToModel(_churchId: string, data: any[]) {
    if (!Array.isArray(data)) return [];
    return data.map((d) => this.rowToModel(d));
  }
}
