import { RepoManager } from "../../../shared/infrastructure/RepoManager.js";

export class AppointmentReminderHelper {
  static async process(repos: any) {
    const now = new Date();
    const appointments = await repos.appointment.loadDueReminders(now, new Date(now.getTime() + 24 * 60 * 60 * 1000));
    let sent = 0;
    for (const appointment of appointments) {
      const minutes = Math.round((new Date(appointment.start).getTime() - now.getTime()) / 60000);
      const preference = await repos.appointment.loadPreference(appointment.churchId, appointment.userPersonId);
      let field: "reminder24hSent" | "reminder1hSent" | "reminder30mSent";
      let enabled: boolean;
      if (minutes <= 30) { field = "reminder30mSent"; enabled = preference?.reminder30m === true; } else if (minutes <= 60) { field = "reminder1hSent"; enabled = preference?.reminder1h !== false; } else { field = "reminder24hSent"; enabled = preference?.reminder24h !== false; }
      if ((appointment as any)[field]) continue;
      if (enabled && preference?.inAppEnabled !== false) {
        const when = new Date(appointment.start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
        const messagingRepos = await RepoManager.getRepos<any>("messaging");
        const peopleIds = [appointment.userPersonId, appointment.leaderPersonId].filter(Boolean);
        await Promise.all(peopleIds.map(async (personId) => {
          const recipientPreference = await repos.appointment.loadPreference(appointment.churchId, personId);
          if (recipientPreference?.inAppEnabled === false) return;
          await messagingRepos.notification.save({ churchId: appointment.churchId, personId, contentType: "appointment", contentId: appointment.id, message: `Appointment reminder: ${appointment.userName} and ${appointment.leaderName} at ${when}`, link: "/mobile/calendar", deliveryMethod: recipientPreference?.emailEnabled === false ? "complete" : "email" });
        }));
        sent++;
      }
      await repos.appointment.markReminder(appointment.id, field);
    }
    return { checked: appointments.length, sent };
  }
}
