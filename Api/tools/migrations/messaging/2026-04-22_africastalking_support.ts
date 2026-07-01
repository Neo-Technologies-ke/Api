import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("textingProviders")
    .addColumn("username", sql`varchar(500)`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("textingProviders")
    .dropColumn("username")
    .execute();
}
