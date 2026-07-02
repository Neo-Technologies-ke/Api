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
  public createdAt?: Date;

  public person?: Person;
  public group?: Group;
}
