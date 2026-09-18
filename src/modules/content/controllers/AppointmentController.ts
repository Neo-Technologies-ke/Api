import { controller, httpDelete, httpGet, httpPost, httpPut, requestParam } from "inversify-express-utils";
import express from "express";
import { ContentBaseController } from "./ContentBaseController.js";
import { Appointment, AppointmentLeader, AppointmentNotificationPreference, AvailabilityException, LeaderAvailability } from "../models/index.js";
import { Permissions } from "../../../shared/helpers/Permissions.js";
import { RepoManager } from "../../../shared/infrastructure/RepoManager.js";

const defaults: Omit<AppointmentNotificationPreference, "churchId" | "personId"> = {
  inAppEnabled: true,
  emailEnabled: true,
  newRequest: true,
  approved: true,
  rejected: true,
  rescheduled: true,
  rescheduleResponse: true,
  cancelled: true,
  reminder24h: true,
  reminder1h: true,
  reminder30m: false
};
const reservedStatuses = ["pending", "confirmed", "awaitingUserConfirmation", "rescheduled"];

@controller("/content/appointments")
export class AppointmentController extends ContentBaseController {
  private async notify(churchId: string, personId: string, appointmentId: string, event: keyof typeof defaults, message: string) {
    if (!personId) return;
    const pref = { ...defaults, ...(await this.repos.appointment.loadPreference(churchId, personId)) } as any;
    if (pref.inAppEnabled !== false && pref[event] !== false) {
      const messagingRepos = await RepoManager.getRepos<any>("messaging");
      await messagingRepos.notification.save({ churchId, personId, contentType: "appointment", contentId: appointmentId, message, link: "/mobile/calendar", deliveryMethod: pref.emailEnabled === false ? "complete" : "email" });
    }
  }

  private async leaderForActor(churchId: string, personId: string) {
    return this.repos.appointment.loadLeaderByPerson(churchId, personId);
  }

  private canAdmin(au: any) {
    return au.checkAccess(Permissions.content.edit) || au.checkAccess(Permissions.appointments.admin);
  }

  private canManage(au: any) {
    return this.canAdmin(au) || au.checkAccess(Permissions.appointments.manage);
  }

  private toLocalUtc(date: string, time: string, timezone: string) {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.slice(0, 5).split(":").map(Number);
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
    return new Date(guess - (represented - guess));
  }

  private async slots(churchId: string, leader: AppointmentLeader, date: string) {
    const timezone = leader.timezone || "Africa/Nairobi";
    const noon = this.toLocalUtc(date, "12:00", timezone);
    const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(noon);
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
    const availability = (await this.repos.appointment.loadAvailability(churchId, leader.id)).filter((row) => row.isActive !== false && row.dayOfWeek === weekday);
    const dayStart = this.toLocalUtc(date, "00:00", timezone);
    const dayEnd = this.toLocalUtc(date, "23:59", timezone);
    const [exceptions, appointments] = await Promise.all([
      this.repos.appointment.loadExceptions(churchId, leader.id, dayStart, dayEnd),
      this.repos.appointment.loadReserved(churchId, leader.id, dayStart, dayEnd)
    ]);
    const duration = Math.max(5, leader.appointmentDuration || 30);
    const buffer = Math.max(0, leader.bufferDuration || 0);
    const result: { start: string; end: string }[] = [];
    for (const period of availability) {
      let cursor = this.toLocalUtc(date, period.startTime, timezone);
      const end = this.toLocalUtc(date, period.endTime, timezone);
      while (cursor.getTime() + duration * 60000 <= end.getTime()) {
        const slotEnd = new Date(cursor.getTime() + duration * 60000);
        const blocked = [...exceptions, ...appointments].some((item: any) => new Date(item.start).getTime() < slotEnd.getTime() + buffer * 60000 && new Date(item.end).getTime() > cursor.getTime() - buffer * 60000);
        if (!blocked && cursor.getTime() > Date.now()) result.push({ start: cursor.toISOString(), end: slotEnd.toISOString() });
        cursor = new Date(slotEnd.getTime() + buffer * 60000);
      }
    }
    return result;
  }

  @httpGet("/leaders")
  async getLeaders(req: express.Request, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      const leaders = await this.repos.appointment.loadLeaders(au.churchId, this.canAdmin(au));
      return leaders.map(({ email, ...leader }) => (leader.personId === au.personId || this.canAdmin(au)) ? { ...leader, email } : leader);
    });
  }

  @httpPost("/leaders")
  async saveLeader(req: express.Request<{}, {}, AppointmentLeader>, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      const model = req.body;
      const isSelf = !model.personId || model.personId === au.personId;
      const existingSelf = isSelf ? await this.repos.appointment.loadLeaderByPerson(au.churchId, au.personId) : null;
      if ((!existingSelf && !this.canManage(au)) || (!isSelf && !this.canAdmin(au))) return this.json({}, 401);
      model.churchId = au.churchId;
      model.personId = model.personId || au.personId;
      model.displayName = model.displayName || `${au.firstName || ""} ${au.lastName || ""}`.trim();
      model.email = model.email || au.email;
      model.timezone = model.timezone || "Africa/Nairobi";
      model.appointmentDuration = Math.max(5, Number(model.appointmentDuration) || 30);
      model.bufferDuration = Math.max(0, Number(model.bufferDuration) || 0);
      return this.repos.appointment.saveLeader(model);
    });
  }

  @httpGet("/leaders/:leaderId/availability")
  async getAvailability(@requestParam("leaderId") leaderId: string, req: express.Request, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => ({
      periods: await this.repos.appointment.loadAvailability(au.churchId, leaderId),
      exceptions: await this.repos.appointment.loadExceptions(au.churchId, leaderId)
    }));
  }

  @httpPut("/leaders/:leaderId/availability")
  async saveAvailability(@requestParam("leaderId") leaderId: string, req: express.Request<{}, {}, { periods: LeaderAvailability[] }>, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      const leader = await this.repos.appointment.loadLeader(au.churchId, leaderId);
      if (!leader || (leader.personId !== au.personId && !this.canAdmin(au))) return this.json({}, 401);
      const rows = req.body.periods || [];
      if (rows.some((row) => row.dayOfWeek < 0 || row.dayOfWeek > 6 || !row.startTime || !row.endTime || row.startTime >= row.endTime)) return this.json({ message: "Invalid availability period" }, 400);
      return this.repos.appointment.replaceAvailability(au.churchId, leaderId, rows);
    });
  }

  @httpPost("/leaders/:leaderId/exceptions")
  async saveException(@requestParam("leaderId") leaderId: string, req: express.Request<{}, {}, AvailabilityException>, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      const leader = await this.repos.appointment.loadLeader(au.churchId, leaderId);
      if (!leader || (leader.personId !== au.personId && !this.canAdmin(au))) return this.json({}, 401);
      if (!req.body.start || !req.body.end || new Date(req.body.start) >= new Date(req.body.end)) return this.json({ message: "Invalid exception range" }, 400);
      return this.repos.appointment.saveException({ ...req.body, churchId: au.churchId, leaderId });
    });
  }

  @httpDelete("/leaders/:leaderId/exceptions/:id")
  async deleteException(@requestParam("leaderId") leaderId: string, @requestParam("id") id: string, req: express.Request, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      const leader = await this.repos.appointment.loadLeader(au.churchId, leaderId);
      if (!leader || (leader.personId !== au.personId && !this.canAdmin(au))) return this.json({}, 401);
      await this.repos.appointment.deleteException(au.churchId, leaderId, id);
      return { success: true };
    });
  }

  @httpGet("/leaders/:leaderId/slots")
  async getSlots(@requestParam("leaderId") leaderId: string, req: express.Request, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      const date = String(req.query.date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return this.json({ message: "date must use YYYY-MM-DD" }, 400);
      const leader = await this.repos.appointment.loadLeader(au.churchId, leaderId);
      if (!leader?.isActive) return this.json({ message: "Leader not available" }, 404);
      return this.slots(au.churchId, leader, date);
    });
  }

  @httpGet("/my")
  async getMy(req: express.Request, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => this.repos.appointment.loadForUser(au.churchId, au.personId));
  }

  @httpGet("/leader")
  async getLeaderAppointments(req: express.Request, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      const leader = await this.leaderForActor(au.churchId, au.personId);
      if (!leader) return this.json({ message: "Leader profile not configured" }, 403);
      return this.repos.appointment.loadForLeader(au.churchId, leader.id);
    });
  }

  @httpGet("/all")
  async getAll(req: express.Request, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => this.canAdmin(au) ? this.repos.appointment.loadAll(au.churchId) : this.json({}, 401));
  }

  @httpGet("/:id")
  async getAppointment(@requestParam("id") id: string, req: express.Request, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      const appointment = await this.repos.appointment.loadAppointment(au.churchId, id);
      const allowed = appointment && (appointment.userPersonId === au.personId || appointment.leaderPersonId === au.personId || this.canAdmin(au));
      if (!allowed) return this.json({}, 404);
      return { ...appointment, history: await this.repos.appointment.loadHistory(au.churchId, id) };
    });
  }

  @httpPost("/")
  async create(req: express.Request<{}, {}, Appointment>, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      const model = req.body;
      const leader = await this.repos.appointment.loadLeader(au.churchId, model.leaderId);
      if (!leader?.isActive || !model.start || !model.end || !model.reason?.trim()) return this.json({ message: "Leader, available slot, and reason are required" }, 400);
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: leader.timezone || "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(model.start));
      const slots = await this.slots(au.churchId, leader, date);
      if (!slots.some((slot) => slot.start === new Date(model.start).toISOString() && slot.end === new Date(model.end).toISOString())) return this.json({ message: "This appointment slot is not available" }, 409);
      const saved = await this.repos.appointment.createAppointment({ ...model, churchId: au.churchId, userPersonId: au.personId, userName: `${au.firstName || ""} ${au.lastName || ""}`.trim(), userEmail: au.email, createdByPersonId: au.personId });
      await Promise.all([
        this.notify(au.churchId, leader.personId, saved.id, "newRequest", `New appointment request from ${saved.userName}`),
        this.notify(au.churchId, au.personId, saved.id, "newRequest", `Your appointment request with ${leader.displayName} was submitted`)
      ]);
      return saved;
    });
  }

  private async leaderAction(au: any, id: string, action: string, body: any) {
    const appointment = await this.repos.appointment.loadAppointment(au.churchId, id);
    if (!appointment) throw new Error("Appointment not found");
    const leader = await this.leaderForActor(au.churchId, au.personId);
    if ((!leader || leader.id !== appointment.leaderId) && !this.canAdmin(au)) throw new Error("Unauthorized");
    if (action === "approve") {
      if (appointment.status !== "pending") throw new Error("Only pending appointments can be approved");
      const updated = await this.repos.appointment.transition(au.churchId, id, au.personId, { status: "confirmed" }, { action: "approved" });
      await this.notify(au.churchId, appointment.userPersonId, id, "approved", `Your appointment with ${appointment.leaderName} is confirmed`);
      return updated;
    }
    if (action === "reject") {
      if (!body.reason?.trim()) throw new Error("A rejection reason is required");
      const updated = await this.repos.appointment.transition(au.churchId, id, au.personId, { status: "rejected", rejectionReason: body.reason }, { action: "rejected", reason: body.reason });
      await this.notify(au.churchId, appointment.userPersonId, id, "rejected", `Your appointment was rejected: ${body.reason}`);
      return updated;
    }
    if (action === "reschedule") {
      if (!body.reason?.trim() || !body.start || !body.end) throw new Error("A reason and alternative date are required");
      const appointmentLeader = await this.repos.appointment.loadLeader(au.churchId, appointment.leaderId);
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: appointmentLeader.timezone || "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(body.start));
      const available = await this.slots(au.churchId, appointmentLeader, date);
      if (!available.some((slot) => slot.start === new Date(body.start).toISOString() && slot.end === new Date(body.end).toISOString())) throw new Error("The proposed time is not available");
      const updated = await this.repos.appointment.transition(au.churchId, id, au.personId, { status: "awaitingUserConfirmation", start: new Date(body.start), end: new Date(body.end), rescheduleReason: body.reason, reminder24hSent: false, reminder1hSent: false, reminder30mSent: false }, { action: "rescheduleProposed", reason: body.reason });
      await this.notify(au.churchId, appointment.userPersonId, id, "rescheduled", `A new appointment time was proposed by ${appointment.leaderName}`);
      return updated;
    }
    if (action === "complete" || action === "noShow" || action === "cancel") {
      const status: any = action === "complete" ? "completed" : action === "noShow" ? "noShow" : "cancelled";
      const values: any = { status };
      if (status === "completed") values.completedAt = new Date();
      if (status === "cancelled") values.cancelledAt = new Date();
      const updated = await this.repos.appointment.transition(au.churchId, id, au.personId, values, { action, reason: body.reason });
      await this.notify(au.churchId, appointment.userPersonId, id, "cancelled", `Your appointment with ${appointment.leaderName} was ${status}`);
      return updated;
    }
    throw new Error("Invalid action");
  }

  @httpPost("/:id/leader-action/:action")
  async action(@requestParam("id") id: string, @requestParam("action") action: string, req: express.Request<{}, {}, any>, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      try { return await this.leaderAction(au, id, action, req.body || {}); } catch (error: any) { return this.json({ message: error.message }, error.message === "Unauthorized" ? 401 : 400); }
    });
  }

  @httpPost("/:id/respond")
  async respond(@requestParam("id") id: string, req: express.Request<{}, {}, { accept: boolean; reason?: string }>, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      const appointment = await this.repos.appointment.loadAppointment(au.churchId, id);
      if (!appointment || appointment.userPersonId !== au.personId || appointment.status !== "awaitingUserConfirmation") return this.json({}, 400);
      const values: any = req.body.accept ? { status: "rescheduled" } : { status: "rescheduleRequested" };
      const updated = await this.repos.appointment.transition(au.churchId, id, au.personId, values, { action: req.body.accept ? "rescheduleAccepted" : "rescheduleDeclined", reason: req.body.reason });
      await this.notify(au.churchId, appointment.leaderPersonId, id, "rescheduleResponse", `${appointment.userName} ${req.body.accept ? "accepted" : "declined"} the proposed appointment time`);
      return updated;
    });
  }

  @httpPost("/:id/cancel")
  async cancel(@requestParam("id") id: string, req: express.Request<{}, {}, { reason?: string }>, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => {
      const appointment = await this.repos.appointment.loadAppointment(au.churchId, id);
      if (!appointment || appointment.userPersonId !== au.personId || !reservedStatuses.includes(appointment.status)) return this.json({}, 400);
      const updated = await this.repos.appointment.transition(au.churchId, id, au.personId, { status: "cancelled", cancelledAt: new Date() }, { action: "cancelledByUser", reason: req.body.reason });
      await this.notify(au.churchId, appointment.leaderPersonId, id, "cancelled", `${appointment.userName} cancelled an appointment`);
      return updated;
    });
  }

  @httpGet("/preferences/my")
  async getPreferences(req: express.Request, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => ({ ...defaults, ...(await this.repos.appointment.loadPreference(au.churchId, au.personId)) }));
  }

  @httpPost("/preferences/my")
  async savePreferences(req: express.Request<{}, {}, AppointmentNotificationPreference>, res: express.Response) {
    return this.actionWrapper(req, res, async (au) => this.repos.appointment.savePreference({ ...defaults, ...req.body, churchId: au.churchId, personId: au.personId }));
  }
}
