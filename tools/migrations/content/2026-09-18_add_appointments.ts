import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable("appointmentLeaders")
    .addColumn("id", sql`char(11)`, (col) => col.primaryKey())
    .addColumn("churchId", sql`char(11)`, (col) => col.notNull())
    .addColumn("personId", sql`char(11)`, (col) => col.notNull())
    .addColumn("displayName", "varchar(255)", (col) => col.notNull())
    .addColumn("email", "varchar(255)")
    .addColumn("title", "varchar(100)")
    .addColumn("isActive", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("appointmentDuration", "integer", (col) => col.notNull().defaultTo(30))
    .addColumn("bufferDuration", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("timezone", "varchar(100)", (col) => col.notNull().defaultTo("Africa/Nairobi"))
    .addColumn("createdAt", "datetime", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updatedAt", "datetime", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`))
    .addUniqueConstraint("uq_appointmentLeaders_church_person", ["churchId", "personId"])
    .execute();

  await db.schema.createTable("leaderAvailability")
    .addColumn("id", sql`char(11)`, (col) => col.primaryKey())
    .addColumn("churchId", sql`char(11)`, (col) => col.notNull())
    .addColumn("leaderId", sql`char(11)`, (col) => col.notNull())
    .addColumn("dayOfWeek", "integer", (col) => col.notNull())
    .addColumn("startTime", "time", (col) => col.notNull())
    .addColumn("endTime", "time", (col) => col.notNull())
    .addColumn("isActive", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("createdAt", "datetime", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addForeignKeyConstraint("fk_leaderAvailability_leader", ["leaderId"], "appointmentLeaders", ["id"], (cb) => cb.onDelete("cascade"))
    .execute();
  await db.schema.createIndex("idx_leaderAvailability_lookup").on("leaderAvailability").columns(["churchId", "leaderId", "dayOfWeek"]).execute();

  await db.schema.createTable("availabilityExceptions")
    .addColumn("id", sql`char(11)`, (col) => col.primaryKey())
    .addColumn("churchId", sql`char(11)`, (col) => col.notNull())
    .addColumn("leaderId", sql`char(11)`, (col) => col.notNull())
    .addColumn("start", "datetime", (col) => col.notNull())
    .addColumn("end", "datetime", (col) => col.notNull())
    .addColumn("type", "varchar(20)", (col) => col.notNull().defaultTo("blocked"))
    .addColumn("reason", "text")
    .addColumn("createdAt", "datetime", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addForeignKeyConstraint("fk_availabilityExceptions_leader", ["leaderId"], "appointmentLeaders", ["id"], (cb) => cb.onDelete("cascade"))
    .execute();
  await db.schema.createIndex("idx_availabilityExceptions_lookup").on("availabilityExceptions").columns(["churchId", "leaderId", "start", "end"]).execute();

  await db.schema.createTable("appointments")
    .addColumn("id", sql`char(11)`, (col) => col.primaryKey())
    .addColumn("churchId", sql`char(11)`, (col) => col.notNull())
    .addColumn("userPersonId", sql`char(11)`, (col) => col.notNull())
    .addColumn("userName", "varchar(255)", (col) => col.notNull())
    .addColumn("userEmail", "varchar(255)")
    .addColumn("leaderId", sql`char(11)`, (col) => col.notNull())
    .addColumn("reason", "varchar(500)", (col) => col.notNull())
    .addColumn("notes", "text")
    .addColumn("start", "datetime", (col) => col.notNull())
    .addColumn("end", "datetime", (col) => col.notNull())
    .addColumn("originalStart", "datetime", (col) => col.notNull())
    .addColumn("originalEnd", "datetime", (col) => col.notNull())
    .addColumn("status", "varchar(40)", (col) => col.notNull().defaultTo("pending"))
    .addColumn("rejectionReason", "text")
    .addColumn("rescheduleReason", "text")
    .addColumn("cancelledAt", "datetime")
    .addColumn("completedAt", "datetime")
    .addColumn("createdByPersonId", sql`char(11)`, (col) => col.notNull())
    .addColumn("updatedByPersonId", sql`char(11)`)
    .addColumn("reminder24hSent", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("reminder1hSent", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("reminder30mSent", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("createdAt", "datetime", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updatedAt", "datetime", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`))
    .addForeignKeyConstraint("fk_appointments_leader", ["leaderId"], "appointmentLeaders", ["id"])
    .execute();
  await db.schema.createIndex("idx_appointments_user").on("appointments").columns(["churchId", "userPersonId", "start"]).execute();
  await db.schema.createIndex("idx_appointments_leader_slot").on("appointments").columns(["churchId", "leaderId", "start", "end", "status"]).execute();

  await db.schema.createTable("appointmentNotificationPreferences")
    .addColumn("id", sql`char(11)`, (col) => col.primaryKey())
    .addColumn("churchId", sql`char(11)`, (col) => col.notNull())
    .addColumn("personId", sql`char(11)`, (col) => col.notNull())
    .addColumn("inAppEnabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("emailEnabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("newRequest", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("approved", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("rejected", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("rescheduled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("rescheduleResponse", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("cancelled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("reminder24h", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("reminder1h", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("reminder30m", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("createdAt", "datetime", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updatedAt", "datetime", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`))
    .addUniqueConstraint("uq_appointmentNotificationPreferences_person", ["churchId", "personId"])
    .execute();

  await db.schema.createTable("appointmentHistory")
    .addColumn("id", sql`char(11)`, (col) => col.primaryKey())
    .addColumn("churchId", sql`char(11)`, (col) => col.notNull())
    .addColumn("appointmentId", sql`char(11)`, (col) => col.notNull())
    .addColumn("action", "varchar(50)", (col) => col.notNull())
    .addColumn("fromStatus", "varchar(40)")
    .addColumn("toStatus", "varchar(40)")
    .addColumn("previousStart", "datetime")
    .addColumn("previousEnd", "datetime")
    .addColumn("proposedStart", "datetime")
    .addColumn("proposedEnd", "datetime")
    .addColumn("reason", "text")
    .addColumn("message", "text")
    .addColumn("actorPersonId", sql`char(11)`, (col) => col.notNull())
    .addColumn("createdAt", "datetime", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addForeignKeyConstraint("fk_appointmentHistory_appointment", ["appointmentId"], "appointments", ["id"], (cb) => cb.onDelete("cascade"))
    .execute();
  await db.schema.createIndex("idx_appointmentHistory_appointment").on("appointmentHistory").columns(["churchId", "appointmentId", "createdAt"]).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("appointmentHistory").execute();
  await db.schema.dropTable("appointmentNotificationPreferences").execute();
  await db.schema.dropTable("appointments").execute();
  await db.schema.dropTable("availabilityExceptions").execute();
  await db.schema.dropTable("leaderAvailability").execute();
  await db.schema.dropTable("appointmentLeaders").execute();
}
