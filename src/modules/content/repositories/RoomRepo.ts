import { UniqueIdHelper } from "@churchapps/apihelper";
import { getDb } from "../db/index.js";
import { Room } from "../models/index.js";
import { injectable } from "inversify";

@injectable()
export class RoomRepo {
  public async save(model: Room) {
    return model.id ? this.update(model) : this.create(model);
  }

  private async create(model: Room): Promise<Room> {
    model.id = UniqueIdHelper.shortId();
    await getDb().insertInto("rooms").values({
      id: model.id,
      churchId: model.churchId,
      name: model.name,
      capacity: model.capacity,
      location: model.location,
      description: model.description,
      photoId: model.photoId,
      requiresApproval: model.requiresApproval
    } as any).execute();
    return model;
  }

  private async update(model: Room): Promise<Room> {
    await getDb().updateTable("rooms").set({
      name: model.name,
      capacity: model.capacity,
      location: model.location,
      description: model.description,
      photoId: model.photoId,
      requiresApproval: model.requiresApproval
    } as any).where("id", "=", model.id).execute();
    return model;
  }

  public async load(churchId: string): Promise<Room[]> {
    return await getDb().selectFrom("rooms").where("churchId", "=", churchId).selectAll().execute() as any;
  }

  public async loadById(id: string): Promise<Room> {
    const result = await getDb().selectFrom("rooms").where("id", "=", id).selectAll().execute();
    return result[0] as any;
  }

  public async delete(id: string) {
    await getDb().deleteFrom("rooms").where("id", "=", id).execute();
  }
}
