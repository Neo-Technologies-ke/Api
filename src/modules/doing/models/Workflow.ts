export class Workflow {
  public id?: string;
  public churchId?: string;
  public name?: string;
  public categoryId?: string;
  public active?: boolean;
  public sort?: number;
}

export class WorkflowCategory {
  public id?: string;
  public churchId?: string;
  public name?: string;
  public sort?: number;
}

export class WorkflowStep {
  public id?: string;
  public churchId?: string;
  public workflowId?: string;
  public name?: string;
  public sort?: number;
  public defaultAssignToType?: string;
  public defaultAssignToId?: string;
  public defaultAssignToLabel?: string;
  public expectedResponseDays?: number;
}

export class WorkflowStepRoute {
  public id?: string;
  public churchId?: string;
  public workflowId?: string;
  public stepId?: string;
  public sort?: number;
  public trigger?: string;
  public kind?: string;
  public label?: string;
  public targetStepId?: string;
  public targetWorkflowId?: string;
}

export class WorkflowStepAction {
  public id?: string;
  public churchId?: string;
  public stepId?: string;
  public actionType?: string;
  public config?: string;
  public sort?: number;
}

export class WorkflowTrigger {
  public id?: string;
  public churchId?: string;
  public name?: string;
  public triggerKind?: string;
  public eventType?: string;
  public recurs?: string;
  public workflowId?: string;
  public stepId?: string;
  public conditions?: string;
  public oncePerSubject?: boolean;
  public active?: boolean;
}

export class WorkflowTriggerExecution {
  public id?: string;
  public churchId?: string;
  public triggerId?: string;
  public workflowId?: string;
  public subjectType?: string;
  public subjectId?: string;
  public subjectLabel?: string;
  public eventType?: string;
  public status?: string;
  public attemptCount?: number;
  public nextAttemptAt?: Date;
  public lastError?: string;
  public dateCreated?: Date;
  public dateCompleted?: Date;
}
