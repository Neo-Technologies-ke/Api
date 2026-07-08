import { DateHelper, UniqueIdHelper } from "@churchapps/apihelper";
import { sql } from "kysely";
import { getDb } from "../db/index.js";
import { EventBooking } from "../models/index.js";
import { injectable } from "inversify";

@injectable()
export class EventBookingRepo {
  public async save(model: EventBooking) {
    return model.id ? this.update(model) : this.create(model);
  }

  private async create(model: EventBooking): Promise<EventBooking> {
    model.id = UniqueIdHelper.shortId();
    const m: any = { ...model };
    if (m.eventStart) m.eventStart = DateHelper.toMysqlDate(m.eventStart);
    if (m.eventEnd) m.eventEnd = DateHelper.toMysqlDate(m.eventEnd);
    await getDb().insertInto("eventBookings").values({
      id: model.id,
      churchId: model.churchId,
      eventId: model.eventId,
      eventTitle: model.eventTitle,
      eventStart: m.eventStart,
      eventEnd: m.eventEnd,
      eventRecurrenceRule: model.eventRecurrenceRule,
      roomId: model.roomId,
      roomName: model.roomName,
      resourceId: model.resourceId,
      resourceName: model.resourceName,
      status: model.status,
      setupMinutes: model.setupMinutes,
      teardownMinutes: model.teardownMinutes,
      personId: model.personId,
      personName: model.personName
    } as any).execute();
    return model;
  }

  private async update(model: EventBooking): Promise<EventBooking> {
    const m: any = { ...model };
    if (m.eventStart) m.eventStart = DateHelper.toMysqlDate(m.eventStart);
    if (m.eventEnd) m.eventEnd = DateHelper.toMysqlDate(m.eventEnd);
    await getDb().updateTable("eventBookings").set({
      eventId: model.eventId,
      eventTitle: model.eventTitle,
      eventStart: m.eventStart,
      eventEnd: m.eventEnd,
      eventRecurrenceRule: model.eventRecurrenceRule,
      roomId: model.roomId,
      roomName: model.roomName,
      resourceId: model.resourceId,
      resourceName: model.resourceName,
      status: model.status,
      setupMinutes: model.setupMinutes,
      teardownMinutes: model.teardownMinutes,
      personId: model.personId,
      personName: model.personName
    } as any).where("id", "=", model.id).execute();
    return model;
  }

  public async load(churchId: string): Promise<EventBooking[]> {
    return await getDb().selectFrom("eventBookings").where("churchId", "=", churchId).selectAll().execute() as any;
  }

  public async loadForCalendar(churchId: string, startTime: Date, endTime: Date, roomId?: string, resourceId?: string): Promise<EventBooking[]> {
    let query = getDb().selectFrom("eventBookings").where("churchId", "=", churchId);
    
    if (roomId) {
      query = query.where("roomId", "=", roomId);
    }
    if (resourceId) {
      query = query.where("resourceId", "=", resourceId);
    }
    
    return await query.selectAll().execute() as any;
  }

  public async loadById(id: string): Promise<EventBooking> {
    const result = await getDb().selectFrom("eventBookings").where("id", "=", id).selectAll().execute();
    return result[0] as any;
  }

  public async delete(id: string) {
    await getDb().deleteFrom("eventBookings").where("id", "=", id).execute();
  }
}
