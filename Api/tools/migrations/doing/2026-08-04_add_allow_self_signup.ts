import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add allowSelfSignup column to positions table if it doesn't exist
  await db.schema
    .alterTable("positions")
    .addColumn("allowSelfSignup", sql`bit(1)`, (col) => col.defaultTo(sql`b'0'`))
    .execute();

  // Add description column to positions table if it doesn't exist
  await db.schema
    .alterTable("positions")
    .addColumn("description", sql`text`)
    .execute();

  // Add signupDeadlineHours column to plans table if it doesn't exist
  await db.schema
    .alterTable("plans")
    .addColumn("signupDeadlineHours", sql`int`)
    .execute();

  // Add showVolunteerNames column to plans table if it doesn't exist
  await db.schema
    .alterTable("plans")
    .addColumn("showVolunteerNames", sql`bit(1)`, (col) => col.defaultTo(sql`b'1'`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("positions")
    .dropColumn("allowSelfSignup")
    .execute();

  await db.schema
    .alterTable("positions")
    .dropColumn("description")
    .execute();

  await db.schema
    .alterTable("plans")
    .dropColumn("signupDeadlineHours")
    .execute();

  await db.schema
    .alterTable("plans")
    .dropColumn("showVolunteerNames")
    .execute();
}
