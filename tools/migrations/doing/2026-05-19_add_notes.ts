import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("notes")
    .ifNotExists()
    .addColumn("id", sql`char(11)`, (col) => col.notNull().primaryKey())
    .addColumn("churchId", sql`char(11)`)
    .addColumn("contentType", sql`varchar(45)`)
    .addColumn("contentId", sql`char(11)`)
    .addColumn("noteType", sql`varchar(45)`)
    .addColumn("addedBy", sql`char(11)`)
    .addColumn("createdAt", sql`datetime`)
    .addColumn("updatedAt", sql`datetime`)
    .addColumn("contents", sql`mediumtext`)
    .modifyEnd(sql`ENGINE=InnoDB`)
    .execute();

  await db.schema.createIndex("idx_notes_churchId_contentType_contentId").on("notes").columns(["churchId", "contentType", "contentId"]).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("notes").ifExists().execute();
}
