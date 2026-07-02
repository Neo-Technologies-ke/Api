import { injectable } from "inversify";
import { UniqueIdHelper } from "@churchapps/apihelper";
import { getDb } from "../db/index.js";
import { List } from "../models/index.js";

@injectable()
export class ListRepo {
  public async save(model: List) {
    return model.id ? this.update(model) : this.create(model);
  }

  private async create(model: List): Promise<List> {
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("lists").values({
      id: model.id,
      churchId: model.churchId,
      createdByPersonId: model.createdByPersonId,
      name: model.name,
      category: model.category,
      conditions: model.conditions ? JSON.stringify(model.conditions) : null,
      rules: model.rules ? JSON.stringify(model.rules) : null,
      scope: model.scope || "org",
      autoRefresh: model.autoRefresh as any,
      householdInclusion: model.householdInclusion,
      notifyOnChange: model.notifyOnChange as any
    }).execute();
    return model;
  }

  private async update(model: List): Promise<List> {
    await getDb().updateTable("lists").set({
      name: model.name,
      category: model.category,
      conditions: model.conditions ? JSON.stringify(model.conditions) : null,
      rules: model.rules ? JSON.stringify(model.rules) : null,
      scope: model.scope,
      autoRefresh: model.autoRefresh as any,
      householdInclusion: model.householdInclusion,
      notifyOnChange: model.notifyOnChange as any
    }).where("id", "=", model.id)
      .where("churchId", "=", model.churchId)
      .execute();
    return model;
  }

  public async delete(churchId: string, id: string) {
    await getDb().deleteFrom("lists").where("id", "=", id).where("churchId", "=", churchId).execute();
  }

  public async load(churchId: string, id: string) {
    return (await getDb().selectFrom("lists").selectAll().where("id", "=", id).where("churchId", "=", churchId).executeTakeFirst()) ?? null;
  }

  public async loadAll(churchId: string) {
    return getDb().selectFrom("lists")
      .leftJoin("people", "people.id", "lists.createdByPersonId")
      .select([
        "lists.id", "lists.churchId", "lists.createdByPersonId",
        "lists.name", "lists.category", "lists.conditions", "lists.rules",
        "lists.scope", "lists.autoRefresh", "lists.householdInclusion", "lists.notifyOnChange",
        "people.displayName as createdByPersonName"
      ])
      .where("lists.churchId", "=", churchId)
      .orderBy("lists.name")
      .execute();
  }

  public async loadPeopleForList(churchId: string, listId: string) {
    const list = await this.load(churchId, listId);
    if (!list) return [];
    const rules = list.rules ? JSON.parse(list.rules as string) : null;
    if (!rules) return [];
    return [];
  }

  public convertToModel(data: any): List {
    return data ? this.rowToModel(data) : data;
  }

  public convertAllToModel(data: any[]): List[] {
    return (data || []).map(row => this.rowToModel(row));
  }

  protected rowToModel(data: any): List {
    return {
      id: data.id,
      churchId: data.churchId,
      createdByPersonId: data.createdByPersonId,
      createdByPersonName: data.createdByPersonName || undefined,
      name: data.name,
      category: data.category,
      conditions: data.conditions ? (typeof data.conditions === "string" ? JSON.parse(data.conditions) : data.conditions) : undefined,
      rules: data.rules ? (typeof data.rules === "string" ? JSON.parse(data.rules) : data.rules) : undefined,
      scope: data.scope,
      autoRefresh: data.autoRefresh === true || data.autoRefresh === 1,
      householdInclusion: data.householdInclusion,
      notifyOnChange: data.notifyOnChange === true || data.notifyOnChange === 1
    };
  }
}
