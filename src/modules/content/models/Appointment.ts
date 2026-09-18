export type AppointmentStatus = "pending" | "confirmed" | "rejected" | "rescheduleRequested" | "awaitingUserConfirmation" | "rescheduled" | "cancelled" | "completed" | "noShow";

export class AppointmentLeader {
  id?: string;
  churchId?: string;
  personId?: string;
  displayName?: string;
  email?: string;
  title?: string;
  isActive?: boolean;
  appointmentDuration?: number;
  bufferDuration?: number;
  timezone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class LeaderAvailability {
  id?: string;
  churchId?: string;
  leaderId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
  createdAt?: Date;
}

export class AvailabilityException {
  id?: string;
  churchId?: string;
  leaderId?: string;
  start?: Date;
  end?: Date;
  type?: string;
  reason?: string;
  createdAt?: Date;
}

export class Appointment {
  id?: string;
  churchId?: string;
  userPersonId?: string;
  userName?: string;
  userEmail?: string;
  leaderId?: string;
  leaderName?: string;
  leaderPersonId?: string;
  reason?: string;
  notes?: string;
  start?: Date;
  end?: Date;
  originalStart?: Date;
  originalEnd?: Date;
  status?: AppointmentStatus;
  rejectionReason?: string;
  rescheduleReason?: string;
  cancelledAt?: Date;
  completedAt?: Date;
  createdByPersonId?: string;
  updatedByPersonId?: string;
  reminder24hSent?: boolean;
  reminder1hSent?: boolean;
  reminder30mSent?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AppointmentHistory {
  id?: string;
  churchId?: string;
  appointmentId?: string;
  action?: string;
  fromStatus?: string;
  toStatus?: string;
  previousStart?: Date;
  previousEnd?: Date;
  proposedStart?: Date;
  proposedEnd?: Date;
  reason?: string;
  message?: string;
  actorPersonId?: string;
  createdAt?: Date;
}

export class AppointmentNotificationPreference {
  id?: string;
  churchId?: string;
  personId?: string;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  newRequest?: boolean;
  approved?: boolean;
  rejected?: boolean;
  rescheduled?: boolean;
  rescheduleResponse?: boolean;
  cancelled?: boolean;
  reminder24h?: boolean;
  reminder1h?: boolean;
  reminder30m?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
