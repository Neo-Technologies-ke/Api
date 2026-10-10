import { BaseController } from "../../../shared/infrastructure/index.js";
import { Repos } from "../repositories/index.js";
import { Permissions } from "../helpers/index.js";
import { AuthenticatedUser } from "@churchapps/apihelper";

export class MembershipBaseController extends BaseController {
  public repos: Repos;

  constructor() {
    super("membership");
  }

  // Church-wide view of groups/members, or the "Own Groups" role scoped to groups the user leads
  public canViewGroup(au: AuthenticatedUser, groupId: string): boolean {
    return au.checkAccess(Permissions.groupMembers.view) || (au.checkAccess(Permissions.ownGroups.view) && !!au.leaderGroupIds?.includes(groupId));
  }

  public canEditGroup(au: AuthenticatedUser, groupId: string): boolean {
    return au.checkAccess(Permissions.groupMembers.edit) || (au.checkAccess(Permissions.ownGroups.edit) && !!au.leaderGroupIds?.includes(groupId));
  }

  // True when the user has the scoped role but NOT church-wide group access
  public isScopedGroupAdmin(au: AuthenticatedUser): boolean {
    return !au.checkAccess(Permissions.groupMembers.view) && au.checkAccess(Permissions.ownGroups.view);
  }

  public async formAccess(au: AuthenticatedUser, formId: string, access?: string): Promise<boolean> {
    if (au.checkAccess(Permissions.forms.admin)) return true;
    if (!formId) return false;

    const formData = (await this.repos.form.loadWithMemberPermissions(au.churchId, formId, au.personId)) as any;
    if (formData?.contentType === "form") return (formData as any).action === "admin" || (formData as any).action === access;
    if (au.checkAccess(Permissions.forms.edit)) return true;
    return false;
  }
}
