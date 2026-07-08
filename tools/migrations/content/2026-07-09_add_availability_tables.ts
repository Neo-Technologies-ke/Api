import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create rooms table
  await db.schema
    .createTable("rooms")
    .addColumn("id", "varchar(20)", (col) => col.primaryKey())
    .addColumn("churchId", "varchar(20)", (col) => col.notNull())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("capacity", "integer")
    .addColumn("location", "varchar(255)")
    .addColumn("description", "text")
    .addColumn("photoId", "varchar(20)")
    .addColumn("requiresApproval", "boolean", (col) => col.defaultTo(false))
    .execute();

  // Create resources table
  await db.schema
    .createTable("resources")
    .addColumn("id", "varchar(20)", (col) => col.primaryKey())
    .addColumn("churchId", "varchar(20)", (col) => col.notNull())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("quantity", "integer")
    .addColumn("requiresApproval", "boolean", (col) => col.defaultTo(false))
    .execute();

  // Create eventBookings table
  await db.schema
    .createTable("eventBookings")
    .addColumn("id", "varchar(20)", (col) => col.primaryKey())
    .addColumn("churchId", "varchar(20)", (col) => col.notNull())
    .addColumn("eventId", "varchar(20)")
    .addColumn("eventTitle", "varchar(255)")
    .addColumn("eventStart", "datetime")
    .addColumn("eventEnd", "datetime")
    .addColumn("eventRecurrenceRule", "text")
    .addColumn("roomId", "varchar(20)")
    .addColumn("roomName", "varchar(255)")
    .addColumn("resourceId", "varchar(20)")
    .addColumn("resourceName", "varchar(255)")
    .addColumn("status", "varchar(20)", (col) => col.defaultTo("pending"))
    .addColumn("setupMinutes", "integer")
    .addColumn("teardownMinutes", "integer")
    .addColumn("personId", "varchar(20)")
    .addColumn("personName", "varchar(255)")
    .execute();

  // Create calendarBlockouts table
  await db.schema
    .createTable("calendarBlockouts")
    .addColumn("id", "varchar(20)", (col) => col.primaryKey())
    .addColumn("churchId", "varchar(20)", (col) => col.notNull())
    .addColumn("roomId", "varchar(20)")
    .addColumn("resourceId", "varchar(20)")
    .addColumn("startTime", "datetime", (col) => col.notNull())
    .addColumn("endTime", "datetime", (col) => col.notNull())
    .addColumn("reason", "text")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("calendarBlockouts").execute();
  await db.schema.dropTable("eventBookings").execute();
  await db.schema.dropTable("resources").execute();
  await db.schema.dropTable("rooms").execute();
}
