import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("workflowCategories")
    .ifNotExists()
    .addColumn("id", sql`char(11)`, (col) => col.notNull().primaryKey())
    .addColumn("churchId", sql`char(11)`)
    .addColumn("name", sql`varchar(255)`)
    .addColumn("sort", sql`int`)
    .modifyEnd(sql`ENGINE=InnoDB`)
    .execute();

  await db.schema
    .createTable("workflows")
    .ifNotExists()
    .addColumn("id", sql`char(11)`, (col) => col.notNull().primaryKey())
    .addColumn("churchId", sql`char(11)`)
    .addColumn("name", sql`varchar(255)`)
    .addColumn("categoryId", sql`char(11)`)
    .addColumn("active", sql`bit(1)`, (col) => col.defaultTo(sql`b'1'`))
    .addColumn("sort", sql`int`)
    .modifyEnd(sql`ENGINE=InnoDB`)
    .execute();
  await db.schema.createIndex("idx_workflows_churchId").on("workflows").columns(["churchId"]).execute();

  await db.schema
    .createTable("workflowSteps")
    .ifNotExists()
    .addColumn("id", sql`char(11)`, (col) => col.notNull().primaryKey())
    .addColumn("churchId", sql`char(11)`)
    .addColumn("workflowId", sql`char(11)`)
    .addColumn("name", sql`varchar(255)`)
    .addColumn("sort", sql`int`)
    .addColumn("defaultAssignToType", sql`varchar(45)`)
    .addColumn("defaultAssignToId", sql`char(11)`)
    .addColumn("defaultAssignToLabel", sql`varchar(255)`)
    .addColumn("expectedResponseDays", sql`int`)
    .modifyEnd(sql`ENGINE=InnoDB`)
    .execute();
  await db.schema.createIndex("idx_workflowSteps_churchId_workflowId").on("workflowSteps").columns(["churchId", "workflowId"]).execute();

  await db.schema
    .createTable("workflowStepRoutes")
    .ifNotExists()
    .addColumn("id", sql`char(11)`, (col) => col.notNull().primaryKey())
    .addColumn("churchId", sql`char(11)`)
    .addColumn("workflowId", sql`char(11)`)
    .addColumn("stepId", sql`char(11)`)
    .addColumn("sort", sql`int`)
    .addColumn("trigger", sql`varchar(45)`)
    .addColumn("kind", sql`varchar(45)`)
    .addColumn("label", sql`varchar(255)`)
    .addColumn("targetStepId", sql`char(11)`)
    .addColumn("targetWorkflowId", sql`char(11)`)
    .modifyEnd(sql`ENGINE=InnoDB`)
    .execute();
  await db.schema.createIndex("idx_workflowStepRoutes_stepId").on("workflowStepRoutes").columns(["churchId", "stepId"]).execute();

  await db.schema
    .createTable("workflowStepActions")
    .ifNotExists()
    .addColumn("id", sql`char(11)`, (col) => col.notNull().primaryKey())
    .addColumn("churchId", sql`char(11)`)
    .addColumn("stepId", sql`char(11)`)
    .addColumn("actionType", sql`varchar(45)`)
    .addColumn("config", sql`mediumtext`)
    .addColumn("sort", sql`int`)
    .modifyEnd(sql`ENGINE=InnoDB`)
    .execute();
  await db.schema.createIndex("idx_workflowStepActions_stepId").on("workflowStepActions").columns(["churchId", "stepId"]).execute();

  await db.schema
    .createTable("workflowTriggers")
    .ifNotExists()
    .addColumn("id", sql`char(11)`, (col) => col.notNull().primaryKey())
    .addColumn("churchId", sql`char(11)`)
    .addColumn("name", sql`varchar(255)`)
    .addColumn("triggerKind", sql`varchar(45)`)
    .addColumn("eventType", sql`varchar(255)`)
    .addColumn("recurs", sql`varchar(45)`)
    .addColumn("workflowId", sql`char(11)`)
    .addColumn("stepId", sql`char(11)`)
    .addColumn("conditions", sql`mediumtext`)
    .addColumn("oncePerSubject", sql`bit(1)`, (col) => col.defaultTo(sql`b'1'`))
    .addColumn("active", sql`bit(1)`, (col) => col.defaultTo(sql`b'1'`))
    .modifyEnd(sql`ENGINE=InnoDB`)
    .execute();
  await db.schema.createIndex("idx_workflowTriggers_workflowId").on("workflowTriggers").columns(["churchId", "workflowId"]).execute();

  await db.schema
    .createTable("workflowTriggerExecutions")
    .ifNotExists()
    .addColumn("id", sql`char(11)`, (col) => col.notNull().primaryKey())
    .addColumn("churchId", sql`char(11)`)
    .addColumn("triggerId", sql`char(11)`)
    .addColumn("workflowId", sql`char(11)`)
    .addColumn("subjectType", sql`varchar(45)`)
    .addColumn("subjectId", sql`char(11)`)
    .addColumn("subjectLabel", sql`varchar(255)`)
    .addColumn("eventType", sql`varchar(255)`)
    .addColumn("status", sql`varchar(45)`)
    .addColumn("attemptCount", sql`int`)
    .addColumn("nextAttemptAt", sql`datetime`)
    .addColumn("lastError", sql`mediumtext`)
    .addColumn("dateCreated", sql`datetime`)
    .addColumn("dateCompleted", sql`datetime`)
    .modifyEnd(sql`ENGINE=InnoDB`)
    .execute();
  await db.schema.createIndex("idx_workflowTriggerExecutions_workflowId").on("workflowTriggerExecutions").columns(["churchId", "workflowId"]).execute();

  const taskColumns = ["workflowId", "stepId", "dueDate", "snoozedUntil", "sort", "pinnedAssignment"];
  const existing = await sql<{ Field: string }>`SHOW COLUMNS FROM tasks`.execute(db);
  const existingNames = new Set(existing.rows.map((r) => r.Field));
  if (!existingNames.has("workflowId")) await db.schema.alterTable("tasks").addColumn("workflowId", sql`char(11)`).execute();
  if (!existingNames.has("stepId")) await db.schema.alterTable("tasks").addColumn("stepId", sql`char(11)`).execute();
  if (!existingNames.has("dueDate")) await db.schema.alterTable("tasks").addColumn("dueDate", sql`datetime`).execute();
  if (!existingNames.has("snoozedUntil")) await db.schema.alterTable("tasks").addColumn("snoozedUntil", sql`datetime`).execute();
  if (!existingNames.has("sort")) await db.schema.alterTable("tasks").addColumn("sort", sql`int`).execute();
  if (!existingNames.has("pinnedAssignment")) await db.schema.alterTable("tasks").addColumn("pinnedAssignment", sql`bit(1)`, (col) => col.defaultTo(sql`b'0'`)).execute();
  if (!existingNames.has("workflowId") || !existingNames.has("stepId")) {
    await db.schema.createIndex("idx_tasks_workflowId").on("tasks").columns(["churchId", "workflowId"]).execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("workflowTriggerExecutions").ifExists().execute();
  await db.schema.dropTable("workflowTriggers").ifExists().execute();
  await db.schema.dropTable("workflowStepActions").ifExists().execute();
  await db.schema.dropTable("workflowStepRoutes").ifExists().execute();
  await db.schema.dropTable("workflowSteps").ifExists().execute();
  await db.schema.dropTable("workflows").ifExists().execute();
  await db.schema.dropTable("workflowCategories").ifExists().execute();
  for (const col of ["workflowId", "stepId", "dueDate", "snoozedUntil", "sort", "pinnedAssignment"]) {
    await db.schema.alterTable("tasks").dropColumn(col).execute();
  }
}
