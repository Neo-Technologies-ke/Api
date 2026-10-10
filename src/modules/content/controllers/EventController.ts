import { controller, httpPost, httpGet, requestParam, httpDelete, httpPut } from "inversify-express-utils";
import express from "express";
import * as ics from "ics";
import { ContentBaseController } from "./ContentBaseController.js";
import { Event } from "../models/index.js";
import { CalendarHelper, Permissions } from "../helpers/index.js";

@controller("/content/events")
export class EventController extends ContentBaseController {
  @httpGet("/timeline/group/:groupId")
  public async getPostsForGroup(@requestParam("groupId") groupId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const eventIds = req.query.eventIds ? req.query.eventIds.toString().split(",") : [];
      return await this.repos.event.loadTimelineGroup(au.churchId, groupId, eventIds);
    });
  }

  @httpGet("/timeline")
  public async getPosts(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const eventIds = req.query.eventIds ? req.query.eventIds.toString().split(",") : [];
      return await this.repos.event.loadTimeline(au.churchId, au.groupIds, eventIds);
    });
  }

  @httpGet("/registerable")
  public async getRegisterable(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.event.loadRegistrationEnabled(au.churchId);
    });
  }

  @httpGet("/subscribe")
  public async subscribe(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapperAnon(req, res, async () => {
      let newEvents: any[] = [];
      if (req.query.groupId) {
        const groupEvents = await this.repos.event.loadForGroup(req.query.churchId.toString(), req.query.groupId.toString());
        if (groupEvents && groupEvents.length > 0) {
          await CalendarHelper.addExceptionDates(groupEvents, this.repos);
          newEvents = this.populateEventsForICS(groupEvents);
        }
      } else if (req.query.curatedCalendarId) {
        const curatedEvents = await this.repos.curatedEvent.loadForEvents(req.query.curatedCalendarId.toString(), req.query.churchId.toString());
        if (curatedEvents && curatedEvents.length > 0) {
          await CalendarHelper.addExceptionDates(curatedEvents, this.repos);
          newEvents = this.populateEventsForICS(curatedEvents);
        }
      }
      const { error, value } = ics.createEvents(newEvents);

      if (error) {
        res.status(500).send("Error generating calendar.");
        return;
      }

      res.set("Content-Type", "text/calendar");
      res.send(value);
    });
  }

  @httpGet("/holidays")
  public async getHolidays(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapperAnon(req, res, async () => {
      const start = new Date(req.query.start?.toString() || "");
      const end = new Date(req.query.end?.toString() || "");
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
      const pad = (n: number) => n.toString().padStart(2, "0");
      const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const easter = (y: number) => {
        const a = y % 19, b = Math.floor(y / 100), c = y % 100;
        const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(y, month - 1, day);
      };
      const holidays: { date: string; name: string }[] = [];
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
        const entries: [number, number, string][] = [
          [0, 1, "New Year's Day"],
          [4, 1, "Labour Day"],
          [5, 1, "Madaraka Day"],
          [9, 10, "Huduma Day"],
          [9, 20, "Mashujaa Day"],
          [11, 12, "Jamhuri Day"],
          [11, 25, "Christmas Day"],
          [11, 26, "Boxing Day"]
        ];
        const e = easter(y);
        const goodFriday = new Date(e); goodFriday.setDate(e.getDate() - 2);
        const easterMonday = new Date(e); easterMonday.setDate(e.getDate() + 1);
        const all = [...entries.map(([m, d, n]) => ({ date: new Date(y, m, d), name: n })), { date: goodFriday, name: "Good Friday" }, { date: easterMonday, name: "Easter Monday" }];
        all.forEach((h) => { if (h.date >= start && h.date <= end) holidays.push({ date: key(h.date), name: h.name }); });
      }
      return holidays;
    });
  }

  @httpGet("/group/:groupId")
  public async getForGroup(@requestParam("groupId") groupId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result = await this.repos.event.loadForGroup(au.churchId, groupId);
      await CalendarHelper.addExceptionDates(result, this.repos);
      return result;
    });
  }

  @httpGet("/public/tag/:churchId/:tag")
  public async getPublicByTag(@requestParam("churchId") churchId: string, @requestParam("tag") tag: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapperAnon(req, res, async () => {
      return await this.repos.event.loadByTag(churchId, tag);
    });
  }

  @httpGet("/public/registerable/:churchId")
  public async getPublicRegisterable(@requestParam("churchId") churchId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapperAnon(req, res, async () => {
      return await this.repos.event.loadRegistrationEnabled(churchId);
    });
  }

  @httpGet("/public/:churchId/:id")
  public async getPublicById(@requestParam("churchId") churchId: string, @requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapperAnon(req, res, async () => {
      return await this.repos.event.load(churchId, id);
    });
  }

  @httpGet("/public/group/:churchId/:groupId")
  public async getPublicForGroup(@requestParam("churchId") churchId: string, @requestParam("groupId") groupId: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapperAnon(req, res, async () => {
      const result = await this.repos.event.loadPublicForGroup(churchId, groupId);
      await CalendarHelper.addExceptionDates(result, this.repos);
      return result;
    });
  }

  @httpGet("/church")
  public async getChurchCalendar(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result = await this.repos.event.loadAll(au.churchId);
      await CalendarHelper.addExceptionDates(result, this.repos);
      return result;
    });
  }

  @httpGet("/my")
  public async getMyCalendar(req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const result = await this.repos.event.loadForGroups(au.churchId, au.groupIds || []);
      await CalendarHelper.addExceptionDates(result, this.repos);
      return result;
    });
  }

  @httpGet("/:id")
  public async get(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      return await this.repos.event.load(au.churchId, id);
    });
  }

  @httpPost("/")
  public async save(req: express.Request<{}, {}, Event[]>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      // if (!au.checkAccess(Permissions.content.edit)) return this.json({}, 401);
      // else {
      const promises: Promise<Event>[] = [];
      req.body.forEach((event) => {
        event.churchId = au.churchId;
        promises.push(this.repos.event.save(event));
      });
      const result = await Promise.all(promises);
      return result;
      // }
    });
  }

  @httpPut("/:id")
  public async update(@requestParam("id") id: string, req: express.Request<{}, {}, Event>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const scopedEdit = req.body.groupId && au.checkAccess(Permissions.ownGroups.edit) && au.leaderGroupIds?.includes(req.body.groupId);
      if (!au.checkAccess(Permissions.content.edit) && !scopedEdit) return this.json({}, 401);
      else {
        const event = req.body;
        event.churchId = au.churchId;
        event.id = id;
        const result = await this.repos.event.save(event);
        return result;
      }
    });
  }

  @httpDelete("/:id")
  public async delete(@requestParam("id") id: string, req: express.Request<{}, {}, null>, res: express.Response): Promise<any> {
    return this.actionWrapper(req, res, async (au) => {
      const event = await this.repos.event.load(au.churchId, id);
      const scopedEdit = event?.groupId && au.checkAccess(Permissions.ownGroups.edit) && au.leaderGroupIds?.includes(event.groupId);
      if (!au.checkAccess(Permissions.content.edit) && !scopedEdit) return this.json({}, 401);
      else {
        await this.repos.event.delete(au.churchId, id);
        return this.json({});
      }
    });
  }

  private populateEventsForICS(events: Event[]) {
    const result: any[] = [];
    events.forEach((ev: Event) => {
      const newEv: any = {};
      newEv.start = ev.start.getTime();
      newEv.end = ev.end.getTime();
      newEv.title = ev.title;
      newEv.description = ev.description || "";
      newEv.recurrenceRule = ev.recurrenceRule || "";
      newEv.exclusionDates = ev.exceptionDates || [];
      result.push(newEv);
    });
    return result;
  }
}
