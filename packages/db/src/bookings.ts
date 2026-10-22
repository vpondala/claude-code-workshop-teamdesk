import { and, asc, eq, gt, inArray, isNull, lt, ne } from "drizzle-orm";
import { bookingAttendees, bookings, type Database } from "./schema.ts";
import type { Booking } from "./shared.ts";

type BookingRow = typeof bookings.$inferSelect;

function toBooking(row: BookingRow, attendeeIds: string[]): Booking {
  return {
    attendeeIds,
    attendees: row.attendees,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    endsAt: row.endsAt,
    id: String(row.id),
    memberId: String(row.memberId),
    roomId: String(row.roomId),
    startsAt: row.startsAt,
    title: row.title,
  };
}

/** Converts rows, loading every booking's attendees in one query. */
async function withAttendees(
  db: Database,
  rows: BookingRow[]
): Promise<Booking[]> {
  if (rows.length === 0) {
    return [];
  }
  const links = await db
    .select()
    .from(bookingAttendees)
    .where(
      inArray(
        bookingAttendees.bookingId,
        rows.map((row) => row.id)
      )
    )
    .orderBy(asc(bookingAttendees.memberId));
  const byBooking = new Map<number, string[]>();
  for (const link of links) {
    const ids = byBooking.get(link.bookingId) ?? [];
    ids.push(String(link.memberId));
    byBooking.set(link.bookingId, ids);
  }
  return rows.map((row) => toBooking(row, byBooking.get(row.id) ?? []));
}

async function oneWithAttendees(
  db: Database,
  row: BookingRow | undefined
): Promise<Booking | null> {
  if (!row) {
    return null;
  }
  const [booking] = await withAttendees(db, [row]);
  return booking ?? null;
}

export async function getBooking(
  db: Database,
  id: string
): Promise<Booking | null> {
  const [row] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, Number(id)))
    .limit(1);
  return oneWithAttendees(db, row);
}

/** Active bookings of a room that start in [from, to), earliest first. */
export async function listRoomBookings(
  db: Database,
  roomId: string,
  range: { from: string; to: string }
): Promise<Booking[]> {
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.roomId, Number(roomId)),
        isNull(bookings.cancelledAt),
        lt(bookings.startsAt, range.to),
        gt(bookings.endsAt, range.from)
      )
    )
    .orderBy(asc(bookings.startsAt));
  return withAttendees(db, rows);
}

/** A member's active bookings that end after `from`, earliest first. */
export async function listMemberBookings(
  db: Database,
  memberId: string,
  from: string
): Promise<Booking[]> {
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.memberId, Number(memberId)),
        isNull(bookings.cancelledAt),
        gt(bookings.endsAt, from)
      )
    )
    .orderBy(asc(bookings.startsAt));
  return withAttendees(db, rows);
}

/**
 * Active bookings in the room that overlap [startsAt, endsAt). Ends are
 * exclusive, so a booking ending at 10:00 does not overlap one starting then.
 */
export async function findOverlappingBookings(
  db: Database,
  input: {
    endsAt: string;
    excludeId?: string;
    roomId: string;
    startsAt: string;
  }
): Promise<Booking[]> {
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.roomId, Number(input.roomId)),
        isNull(bookings.cancelledAt),
        lt(bookings.startsAt, input.endsAt),
        gt(bookings.endsAt, input.startsAt),
        input.excludeId ? ne(bookings.id, Number(input.excludeId)) : undefined
      )
    );
  return withAttendees(db, rows);
}

export async function insertBooking(
  db: Database,
  input: {
    attendeeIds: string[];
    attendees: number;
    endsAt: string;
    memberId: string;
    roomId: string;
    startsAt: string;
    title: string;
  }
): Promise<Booking> {
  const { attendeeIds, ...fields } = input;
  const [row] = await db
    .insert(bookings)
    .values({
      ...fields,
      createdAt: new Date().toISOString(),
      memberId: Number(input.memberId),
      roomId: Number(input.roomId),
    })
    .returning();
  if (!row) {
    throw new Error("Booking was inserted but could not be read back.");
  }
  // D1 has no interactive transactions, so this is a second statement. The
  // service validates everything first, so only a database failure between
  // the two can leave a booking without its attendees.
  if (attendeeIds.length > 0) {
    await db.insert(bookingAttendees).values(
      attendeeIds.map((memberId) => ({
        bookingId: row.id,
        memberId: Number(memberId),
      }))
    );
  }
  return toBooking(
    row,
    [...attendeeIds].sort((a, b) => Number(a) - Number(b))
  );
}

export async function updateBookingTimes(
  db: Database,
  id: string,
  times: { endsAt: string; startsAt: string }
): Promise<Booking | null> {
  const [row] = await db
    .update(bookings)
    .set(times)
    .where(eq(bookings.id, Number(id)))
    .returning();
  return oneWithAttendees(db, row);
}

export async function cancelBooking(
  db: Database,
  id: string
): Promise<Booking | null> {
  const [row] = await db
    .update(bookings)
    .set({ cancelledAt: new Date().toISOString() })
    .where(and(eq(bookings.id, Number(id)), isNull(bookings.cancelledAt)))
    .returning();
  return oneWithAttendees(db, row);
}
