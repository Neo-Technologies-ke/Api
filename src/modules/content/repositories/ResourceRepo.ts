import { UniqueIdHelper } from "@churchapps/apihelper";
import { getDb } from "../db/index.js";
import { Resource } from "../models/index.js";
import { injectable } from "inversify";

@injectable()
export class ResourceRepo {
  public async save(model: Resource) {
    return model.id ? this.update(model) : this.create(model);
  }

  private async create(model: Resource): Promise<Resource> {
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("resources").values({
      id: model.id,
      churchId: model.churchId,
      name: model.name,
      description: model.description,
      quantity: model.quantity,
      requiresApproval: model.requiresApproval
    } as any).execute();
    return model;
  }

  private async update(model: Resource): Promise<Resource> {
    await getDb().updateTable("resources").set({
      name: model.name,
      description: model.description,
      quantity: model.quantity,
      requiresApproval: model.requiresApproval
    } as any).where("id", "=", model.id).execute();
    return model;
  }

  public async load(churchId: string): Promise<Resource[]> {
    return await getDb().selectFrom("resources").where("churchId", "=", churchId).selectAll().execute() as any;
  }

  public async loadById(id: string): Promise<Resource> {
    const result = await getDb().selectFrom("resources").where("id", "=", id).selectAll().execute();
    return result[0] as any;
  }

  public async delete(id: string) {
    await getDb().deleteFrom("resources").where("id", "=", id).execute();
  }
}
