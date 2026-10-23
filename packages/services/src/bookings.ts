// Room bookings: who may book what, when. Times are UTC ISO strings and every
// slot is [startsAt, endsAt), so back-to-back bookings do not clash.
import { bookings, type Database, isUniqueViolation } from "@repo/db";
import {
  cancelBooking,
  findOverlappingBookings,
  getBooking,
  insertBooking,
  listMemberBookings,
  listRoomBookings,
  updateBookingTimes,
} from "@repo/db/bookings";
import { getMembersByIds } from "@repo/db/members";
import { getRoom } from "@repo/db/rooms";
import {
  BOOKING_MAX_MINUTES,
  BOOKING_MIN_MINUTES,
  BOOKING_TITLE_MAX_LENGTH,
  type Booking,
  MAX_BOOKINGS_PER_MEMBER_PER_DAY,
  type Member,
} from "@repo/db/shared";
import { and, count, eq, gt, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "./errors.ts";
import { requireMember } from "./members.ts";
import { minutesBetween, toUtcIso, utcDayBounds } from "./time.ts";

export const createBookingInput = z.object({
  // Members the booker names as coming, not including the booker.
  attendeeIds: z.array(z.string().min(1)).default([]),
  attendees: z.int().min(1, "At least one person must attend."),
  endsAt: z.iso.datetime(),
  roomId: z.string().min(1),
  startsAt: z.iso.datetime(),
  title: z
    .string()
    .trim()
    .min(1, "Give the booking a title.")
    .max(
      BOOKING_TITLE_MAX_LENGTH,
      `Title must be at most ${BOOKING_TITLE_MAX_LENGTH} characters.`
    ),
});

export type CreateBookingInput = z.input<typeof createBookingInput>;

export const rescheduleBookingInput = z.object({
  endsAt: z.iso.datetime(),
  startsAt: z.iso.datetime(),
});

export type RescheduleBookingInput = z.input<typeof rescheduleBookingInput>;

export interface BookingsService {
  /** Throws ForbiddenError unless the actor owns the booking or is an admin. */
  cancel: (actorId: string, bookingId: string) => Promise<Booking>;
  create: (actorId: string, input: CreateBookingInput) => Promise<Booking>;
  /** A room's active bookings on the UTC day `day` falls on. */
  listForRoom: (roomId: string, day: string) => Promise<Booking[]>;
  /** The member's active bookings that have not ended by `now`. */
  listUpcoming: (memberId: string, now: string) => Promise<Booking[]>;
  /** Moves a booking to a new slot in the same room. */
  reschedule: (
    actorId: string,
    bookingId: string,
    input: RescheduleBookingInput
  ) => Promise<Booking>;
}

function canManage(actor: Member, booking: Booking): boolean {
  return actor.role === "admin" || booking.memberId === actor.id;
}

function checkSlot(startsAt: string, endsAt: string): void {
  const minutes = minutesBetween(startsAt, endsAt);
  if (minutes < BOOKING_MIN_MINUTES) {
    throw new ValidationError(
      `Bookings must be at least ${BOOKING_MIN_MINUTES} minutes.`
    );
  }
  if (minutes > BOOKING_MAX_MINUTES) {
    throw new ValidationError(
      `Bookings can be at most ${BOOKING_MAX_MINUTES} minutes.`
    );
  }
}

/**
 * Checks the named attendees: real members, no repeats, not the booker, and
 * no more of them than the headcount leaves room for besides the booker.
 */
async function checkAttendees(
  db: Database,
  actorId: string,
  attendeeIds: string[],
  headcount: number
): Promise<void> {
  if (new Set(attendeeIds).size !== attendeeIds.length) {
    throw new ValidationError("Each attendee can only be named once.");
  }
  if (attendeeIds.includes(actorId)) {
    throw new ValidationError("You're already attending your own booking.");
  }
  if (attendeeIds.length + 1 > headcount) {
    throw new ValidationError(
      `You named ${attendeeIds.length} ${attendeeIds.length === 1 ? "person" : "people"} besides yourself but booked for ${headcount}.`
    );
  }
  const found = await getMembersByIds(db, attendeeIds);
  if (found.length !== attendeeIds.length) {
    throw new ValidationError("Some attendees are not team members.");
  }
}

/** How many active bookings the member starts on the UTC day `iso` falls on. */
async function countBookingsOnDay(
  db: Database,
  memberId: string,
  iso: string
): Promise<number> {
  const { end, start } = utcDayBounds(iso);
  const [row] = await db
    .select({ total: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.memberId, Number(memberId)),
        isNull(bookings.cancelledAt),
        gt(bookings.startsAt, start),
        lt(bookings.startsAt, end)
      )
    );
  return row?.total ?? 0;
}

export const createBookingsService = (db: Database): BookingsService => ({
  cancel: async (actorId, bookingId) => {
    const actor = await requireMember(db, actorId);
    const booking = await getBooking(db, bookingId);
    if (!booking || booking.cancelledAt) {
      throw new NotFoundError("Booking", bookingId);
    }
    if (!canManage(actor, booking)) {
      throw new ForbiddenError(
        "Only the person who booked or an admin can cancel."
      );
    }
    const cancelled = await cancelBooking(db, bookingId);
    if (!cancelled) {
      throw new NotFoundError("Booking", bookingId);
    }
    return cancelled;
  },
  create: async (actorId, input) => {
    await requireMember(db, actorId);
    const data = createBookingInput.parse(input);
    const startsAt = toUtcIso(data.startsAt);
    const endsAt = toUtcIso(data.endsAt);
    checkSlot(startsAt, endsAt);
    await checkAttendees(db, actorId, data.attendeeIds, data.attendees);

    const room = await getRoom(db, data.roomId);
    if (!room || room.archived) {
      throw new NotFoundError("Room", data.roomId);
    }
    if (data.attendees > room.capacity) {
      throw new ValidationError(
        `${room.name} holds at most ${room.capacity} people.`
      );
    }

    const clashes = await findOverlappingBookings(db, {
      endsAt,
      roomId: room.id,
      startsAt,
    });
    if (clashes.length > 0) {
      throw new ConflictError(
        `${room.name} is already booked for part of that time.`
      );
    }

    const sameDay = await countBookingsOnDay(db, actorId, startsAt);
    if (sameDay >= MAX_BOOKINGS_PER_MEMBER_PER_DAY) {
      throw new ConflictError(
        `You can hold at most ${MAX_BOOKINGS_PER_MEMBER_PER_DAY} bookings on one day.`
      );
    }

    // The overlap check above can race with another request for the same
    // slot. The unique index on (room, start) catches that case.
    try {
      return await insertBooking(db, {
        attendeeIds: data.attendeeIds,
        attendees: data.attendees,
        endsAt,
        memberId: actorId,
        roomId: room.id,
        startsAt,
        title: data.title,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`${room.name} was just booked for that time.`, {
          cause: error,
        });
      }
      throw error;
    }
  },
  listForRoom: (roomId, day) => {
    const { end, start } = utcDayBounds(day);
    return listRoomBookings(db, roomId, { from: start, to: end });
  },
  listUpcoming: (memberId, now) => listMemberBookings(db, memberId, now),
  reschedule: async (actorId, bookingId, input) => {
    await requireMember(db, actorId);
    const data = rescheduleBookingInput.parse(input);
    const booking = await getBooking(db, bookingId);
    if (!booking || booking.cancelledAt) {
      throw new NotFoundError("Booking", bookingId);
    }
    const member = await requireMember(db, booking.memberId);
    if (!canManage(member, booking)) {
      throw new ForbiddenError(
        "Only the person who booked or an admin can reschedule."
      );
    }
    const startsAt = toUtcIso(data.startsAt);
    const endsAt = toUtcIso(data.endsAt);
    checkSlot(startsAt, endsAt);

    const clashes = await findOverlappingBookings(db, {
      endsAt,
      excludeId: booking.id,
      roomId: booking.roomId,
      startsAt,
    });
    if (clashes.length > 0) {
      throw new ConflictError(
        "The room is already booked for part of that time."
      );
    }

    const moved = await updateBookingTimes(db, bookingId, { endsAt, startsAt });
    if (!moved) {
      throw new NotFoundError("Booking", bookingId);
    }
    return moved;
  },
});
