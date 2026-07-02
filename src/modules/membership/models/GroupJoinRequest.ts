import { Person, Group } from "./index.js";

export class GroupJoinRequest {
  public id?: string;
  public churchId?: string;
  public groupId?: string;
  public personId?: string;
  public requestDate?: Date;
  public status?: string;
  public message?: string;
  public declineReason?: string;
  public person?: Person;
  public group?: Group;
}
