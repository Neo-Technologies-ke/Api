import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("groupReportTemplates")
    .ifNotExists()
    .addColumn("id", sql`char(11)`, (col) => col.notNull().primaryKey())
    .addColumn("churchId", sql`char(11)`, (col) => col.notNull())
    .addColumn("name", sql`varchar(255)`, (col) => col.notNull())
    .addColumn("description", sql`varchar(500)`)
    .addColumn("content", sql`text`, (col) => col.notNull())
    .addColumn("active", sql`bit`, (col) => col.notNull().defaultTo(1))
    .addColumn("createdAt", sql`datetime`, (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updatedAt", sql`datetime`, (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .modifyEnd(sql`ENGINE=InnoDB`)
    .execute();

  await db.schema.createIndex("idx_groupReportTemplates_churchId").on("groupReportTemplates").columns(["churchId"]).execute();
  await db.schema.alterTable("groupReports").addColumn("templateId", sql`char(11)`).execute();
  await db.schema.alterTable("groupReports").addColumn("updatedAt", sql`datetime`, (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)).execute();
  await db.schema.alterTable("groupReports").addColumn("submittedAt", sql`datetime`).execute();
  await db.schema.alterTable("groupReports").addColumn("readAt", sql`datetime`).execute();
  await db.schema.alterTable("groupReports").addColumn("response", sql`text`).execute();
  await db.schema.alterTable("groupReports").addColumn("respondedAt", sql`datetime`).execute();
  await db.schema.alterTable("groupReports").addColumn("respondedByPersonId", sql`char(11)`).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("groupReports").dropColumn("respondedByPersonId").dropColumn("respondedAt").dropColumn("response").dropColumn("readAt").dropColumn("submittedAt").dropColumn("updatedAt").dropColumn("templateId").execute();
  await db.schema.dropTable("groupReportTemplates").execute();
}
