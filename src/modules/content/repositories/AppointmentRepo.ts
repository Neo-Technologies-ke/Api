import { injectable } from "inversify";
import { sql } from "kysely";
import { DateHelper, UniqueIdHelper } from "@churchapps/apihelper";
import { getDb } from "../db/index.js";
import { Appointment, AppointmentHistory, AppointmentLeader, AppointmentNotificationPreference, AvailabilityException, LeaderAvailability } from "../models/index.js";

const reservedStatuses = ["pending", "confirmed", "awaitingUserConfirmation", "rescheduled"];
const mysqlDate = (value: Date | string) => DateHelper.toMysqlDate(new Date(value));

@injectable()
export class AppointmentRepo {
  async loadLeaders(churchId: string, includeInactive = false) {
    let query = getDb().selectFrom("appointmentLeaders" as any).selectAll().where("churchId", "=", churchId);
    if (!includeInactive) query = query.where("isActive", "=", 1 as any);
    return query.orderBy("displayName").execute() as Promise<AppointmentLeader[]>;
  }

  async loadLeader(churchId: string, id: string) {
    return (await getDb().selectFrom("appointmentLeaders" as any).selectAll().where("churchId", "=", churchId).where("id", "=", id).executeTakeFirst()) as AppointmentLeader | undefined;
  }

  async loadLeaderByPerson(churchId: string, personId: string) {
    return (await getDb().selectFrom("appointmentLeaders" as any).selectAll().where("churchId", "=", churchId).where("personId", "=", personId).executeTakeFirst()) as AppointmentLeader | undefined;
  }

  async saveLeader(model: AppointmentLeader) {
    if (!model.id) {
      model.id = UniqueIdHelper.shortId();
      await getDb().insertInto("appointmentLeaders" as any).values(model as any).execute();
    } else {
      const { id, churchId, createdAt: _createdAt, updatedAt: _updatedAt, ...values } = model;
      await getDb().updateTable("appointmentLeaders" as any).set(values as any).where("id", "=", id).where("churchId", "=", churchId).execute();
    }
    return model;
  }

  async loadAvailability(churchId: string, leaderId: string) {
    return getDb().selectFrom("leaderAvailability" as any).selectAll().where("churchId", "=", churchId).where("leaderId", "=", leaderId).orderBy("dayOfWeek").orderBy("startTime").execute() as Promise<LeaderAvailability[]>;
  }

  async replaceAvailability(churchId: string, leaderId: string, rows: LeaderAvailability[]) {
    await getDb().transaction().execute(async (trx) => {
      await trx.deleteFrom("leaderAvailability" as any).where("churchId", "=", churchId).where("leaderId", "=", leaderId).execute();
      if (rows.length) await trx.insertInto("leaderAvailability" as any).values(rows.map((row) => ({ ...row, id: UniqueIdHelper.shortId(), churchId, leaderId })) as any).execute();
    });
    return this.loadAvailability(churchId, leaderId);
  }

  async loadExceptions(churchId: string, leaderId: string, start?: Date, end?: Date) {
    let query = getDb().selectFrom("availabilityExceptions" as any).selectAll().where("churchId", "=", churchId).where("leaderId", "=", leaderId);
    if (start && end) query = query.where("start", "<", mysqlDate(end) as any).where("end", ">", mysqlDate(start) as any);
    return query.orderBy("start").execute() as Promise<AvailabilityException[]>;
  }

  async saveException(model: AvailabilityException) {
    model.id = model.id || UniqueIdHelper.shortId();
    const values = { ...model, start: mysqlDate(model.start), end: mysqlDate(model.end) };
    await getDb().insertInto("availabilityExceptions" as any).values(values as any).execute();
    return model;
  }

  async deleteException(churchId: string, leaderId: string, id: string) {
    await getDb().deleteFrom("availabilityExceptions" as any).where("churchId", "=", churchId).where("leaderId", "=", leaderId).where("id", "=", id).execute();
  }

  private appointmentQuery(churchId: string) {
    return (getDb() as any).selectFrom("appointments as a")
      .innerJoin("appointmentLeaders as l" as any, "l.id" as any, "a.leaderId" as any)
      .selectAll("a" as any)
      .select(["l.displayName as leaderName" as any, "l.personId as leaderPersonId" as any])
      .where("a.churchId" as any, "=", churchId);
  }

  async loadAppointment(churchId: string, id: string) {
    return (await this.appointmentQuery(churchId).where("a.id" as any, "=", id).executeTakeFirst()) as Appointment | undefined;
  }

  async loadForUser(churchId: string, personId: string) {
    return this.appointmentQuery(churchId).where("a.userPersonId" as any, "=", personId).orderBy("a.start" as any, "desc").execute() as Promise<Appointment[]>;
  }

  async loadForLeader(churchId: string, leaderId: string) {
    return this.appointmentQuery(churchId).where("a.leaderId" as any, "=", leaderId).orderBy("a.start" as any).execute() as Promise<Appointment[]>;
  }

  async loadAll(churchId: string) {
    return this.appointmentQuery(churchId).orderBy("a.start" as any, "desc").execute() as Promise<Appointment[]>;
  }

  async createAppointment(model: Appointment) {
    model.id = UniqueIdHelper.shortId();
    model.status = "pending";
    model.originalStart = new Date(model.start);
    model.originalEnd = new Date(model.end);
    const values = { ...model, start: mysqlDate(model.start), end: mysqlDate(model.end), originalStart: mysqlDate(model.originalStart), originalEnd: mysqlDate(model.originalEnd) };
    await getDb().transaction().execute(async (trx) => {
      await sql`SELECT id FROM appointmentLeaders WHERE id=${model.leaderId} AND churchId=${model.churchId} FOR UPDATE`.execute(trx);
      const conflict = await trx.selectFrom("appointments" as any).select("id")
        .where("churchId", "=", model.churchId).where("leaderId", "=", model.leaderId)
        .where("status", "in", reservedStatuses as any).where("start", "<", values.end as any).where("end", ">", values.start as any).executeTakeFirst();
      if (conflict) throw new Error("This appointment slot is no longer available");
      await trx.insertInto("appointments" as any).values(values as any).execute();
      await trx.insertInto("appointmentHistory" as any).values({ id: UniqueIdHelper.shortId(), churchId: model.churchId, appointmentId: model.id, action: "created", toStatus: "pending", proposedStart: values.start, proposedEnd: values.end, actorPersonId: model.createdByPersonId } as any).execute();
    });
    return model;
  }

  async transition(churchId: string, id: string, actorPersonId: string, values: Partial<Appointment>, history: Partial<AppointmentHistory>) {
    return getDb().transaction().execute(async (trx) => {
      const current = (await sql<any>`SELECT * FROM appointments WHERE id=${id} AND churchId=${churchId} FOR UPDATE`.execute(trx)).rows[0];
      if (!current) throw new Error("Appointment not found");
      const update: any = { ...values, updatedByPersonId: actorPersonId };
      for (const key of ["start", "end", "cancelledAt", "completedAt"] as const) if (update[key]) update[key] = mysqlDate(update[key]);
      if (update.start && update.end && reservedStatuses.includes(update.status || current.status)) {
        const conflict = await trx.selectFrom("appointments" as any).select("id").where("churchId", "=", churchId).where("leaderId", "=", current.leaderId).where("id", "!=", id).where("status", "in", reservedStatuses as any).where("start", "<", update.end).where("end", ">", update.start).executeTakeFirst();
        if (conflict) throw new Error("This appointment slot is no longer available");
      }
      await trx.updateTable("appointments" as any).set(update).where("id", "=", id).where("churchId", "=", churchId).execute();
      await trx.insertInto("appointmentHistory" as any).values({ id: UniqueIdHelper.shortId(), churchId, appointmentId: id, action: history.action, fromStatus: current.status, toStatus: update.status || current.status, previousStart: current.start, previousEnd: current.end, proposedStart: update.start || current.start, proposedEnd: update.end || current.end, reason: history.reason, message: history.message, actorPersonId } as any).execute();
      return { ...current, ...update } as Appointment;
    });
  }

  async loadHistory(churchId: string, appointmentId: string) {
    return getDb().selectFrom("appointmentHistory" as any).selectAll().where("churchId", "=", churchId).where("appointmentId", "=", appointmentId).orderBy("createdAt").execute() as Promise<AppointmentHistory[]>;
  }

  async loadReserved(churchId: string, leaderId: string, start: Date, end: Date) {
    return getDb().selectFrom("appointments" as any).select(["id", "start", "end", "status"]).where("churchId", "=", churchId).where("leaderId", "=", leaderId).where("status", "in", reservedStatuses as any).where("start", "<", mysqlDate(end) as any).where("end", ">", mysqlDate(start) as any).execute() as any;
  }

  async loadPreference(churchId: string, personId: string) {
    return (await getDb().selectFrom("appointmentNotificationPreferences" as any).selectAll().where("churchId", "=", churchId).where("personId", "=", personId).executeTakeFirst()) as AppointmentNotificationPreference | undefined;
  }

  async loadDueReminders(now: Date, through: Date) {
    return (getDb() as any).selectFrom("appointments as a")
      .innerJoin("appointmentLeaders as l" as any, "l.id" as any, "a.leaderId" as any)
      .selectAll("a" as any)
      .select(["l.displayName as leaderName" as any, "l.personId as leaderPersonId" as any])
      .where("a.status" as any, "in", ["confirmed", "rescheduled"] as any)
      .where("a.start" as any, ">", mysqlDate(now) as any)
      .where("a.start" as any, "<=", mysqlDate(through) as any)
      .execute() as Promise<Appointment[]>;
  }

  async markReminder(id: string, field: "reminder24hSent" | "reminder1hSent" | "reminder30mSent") {
    await getDb().updateTable("appointments" as any).set({ [field]: true } as any).where("id", "=", id).execute();
  }

  async savePreference(model: AppointmentNotificationPreference) {
    const existing = await this.loadPreference(model.churchId, model.personId);
    if (existing) {
      model.id = existing.id;
      const { id, churchId, personId, createdAt: _createdAt, updatedAt: _updatedAt, ...values } = model;
      await getDb().updateTable("appointmentNotificationPreferences" as any).set(values as any).where("id", "=", id).where("churchId", "=", churchId).where("personId", "=", personId).execute();
    } else {
      model.id = UniqueIdHelper.shortId();
      await getDb().insertInto("appointmentNotificationPreferences" as any).values(model as any).execute();
    }
    return model;
  }
}
