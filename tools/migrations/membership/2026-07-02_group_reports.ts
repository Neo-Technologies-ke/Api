import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("groupReports")
    .ifNotExists()
    .addColumn("id", sql`char(11)`, (col) => col.notNull().primaryKey())
    .addColumn("churchId", sql`char(11)`, (col) => col.notNull())
    .addColumn("groupId", sql`char(11)`, (col) => col.notNull())
    .addColumn("personId", sql`char(11)`, (col) => col.notNull())
    .addColumn("title", sql`varchar(255)`, (col) => col.notNull())
    .addColumn("content", sql`text`, (col) => col.notNull())
    .addColumn("reportDate", sql`date`, (col) => col.notNull())
    .addColumn("status", sql`varchar(20)`, (col) => col.notNull().defaultTo("submitted"))
    .addColumn("createdAt", sql`datetime`, (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .modifyEnd(sql`ENGINE=InnoDB`)
    .execute();

  await db.schema.createIndex("idx_groupReports_churchId").on("groupReports").columns(["churchId"]).execute();
  await db.schema.createIndex("idx_groupReports_groupId").on("groupReports").columns(["groupId"]).execute();
  await db.schema.createIndex("idx_groupReports_personId").on("groupReports").columns(["personId"]).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("groupReports").execute();
}
