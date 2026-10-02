import { Person } from "./index.js";
import { Group } from "./index.js";

export class GroupReport {
  public id?: string;
  public churchId?: string;
  public groupId?: string;
  public personId?: string;
  public title?: string;
  public content?: string;
  public reportDate?: Date | string;
  public status?: string;
  public templateId?: string;
  public createdAt?: Date;
  public updatedAt?: Date;
  public submittedAt?: Date | null;
  public readAt?: Date | null;
  public response?: string;
  public respondedAt?: Date;
  public respondedByPersonId?: string;

  public person?: Person;
  public respondedByPerson?: Person;
  public group?: Group;
}
