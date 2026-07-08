export class EventBooking {
  id?: string;
  churchId?: string;
  eventId?: string;
  eventTitle?: string;
  eventStart?: Date;
  eventEnd?: Date;
  eventRecurrenceRule?: string;
  roomId?: string;
  roomName?: string;
  resourceId?: string;
  resourceName?: string;
  status?: "approved" | "pending" | "rejected";
  setupMinutes?: number;
  teardownMinutes?: number;
  personId?: string;
  personName?: string;
}
