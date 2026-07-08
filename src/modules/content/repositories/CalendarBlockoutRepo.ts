import { DateHelper, UniqueIdHelper } from "@churchapps/apihelper";
import { getDb } from "../db/index.js";
import { CalendarBlockout } from "../models/index.js";
import { injectable } from "inversify";

@injectable()
export class CalendarBlockoutRepo {
  public async save(model: CalendarBlockout) {
    return model.id ? this.update(model) : this.create(model);
  }

  private async create(model: CalendarBlockout): Promise<CalendarBlockout> {
    model.id = UniqueIdHelper.shortId();
    const m: any = { ...model };
    if (m.startTime) m.startTime = DateHelper.toMysqlDate(m.startTime);
    if (m.endTime) m.endTime = DateHelper.toMysqlDate(m.endTime);
    await getDb().insertInto("calendarBlockouts").values({
      id: model.id,
      churchId: model.churchId,
      roomId: model.roomId,
      resourceId: model.resourceId,
      startTime: m.startTime,
      endTime: m.endTime,
      reason: model.reason
    } as any).execute();
    return model;
  }

  private async update(model: CalendarBlockout): Promise<CalendarBlockout> {
    const m: any = { ...model };
    if (m.startTime) m.startTime = DateHelper.toMysqlDate(m.startTime);
    if (m.endTime) m.endTime = DateHelper.toMysqlDate(m.endTime);
    await getDb().updateTable("calendarBlockouts").set({
      roomId: model.roomId,
      resourceId: model.resourceId,
      startTime: m.startTime,
      endTime: m.endTime,
      reason: model.reason
    } as any).where("id", "=", model.id).execute();
    return model;
  }

  public async load(churchId: string): Promise<CalendarBlockout[]> {
    return await getDb().selectFrom("calendarBlockouts").where("churchId", "=", churchId).selectAll().execute() as any;
  }

  public async loadById(id: string): Promise<CalendarBlockout> {
    const result = await getDb().selectFrom("calendarBlockouts").where("id", "=", id).selectAll().execute();
    return result[0] as any;
  }

  public async delete(id: string) {
    await getDb().deleteFrom("calendarBlockouts").where("id", "=", id).execute();
  }
}
