# Booking attendees

Let the person booking a room name which team members are coming. Sized to
build in about 20 minutes.

## Decisions

| Question | Decision |
| --- | --- |
| Named members vs. the existing `attendees` headcount | **Alongside.** The headcount stays as the number of people and still drives the capacity check. Named members are an optional subset (the rest can be guests or unnamed). |
| When attendees can be set | **At creation only.** No editing afterwards; cancel and rebook to change them. |
| Where attendees show | **On the booking only.** In the room's day view and the booker's upcoming list. A member's own upcoming list does *not* gain bookings they're attending. |
| The booker | Implicitly attending, and not pickable as a named attendee. |

## Rules

Enforced in `createBookingsService.create`, after the existing checks:

1. `attendeeIds` is optional and defaults to `[]`. Existing callers and
   existing bookings keep working unchanged.
2. No duplicate ids, or the request fails with `ValidationError`.
3. The booker (`actorId`) may not be in the list. Fails with `ValidationError`
   ("You're already attending your own booking.").
4. Every id must be an existing member. An unknown id fails with
   `ValidationError`, not `NotFoundError`, because it's form input.
5. `attendeeIds.length + 1 <= attendees` (the +1 is the booker). Otherwise it
   fails with `ValidationError`, e.g. "You named 3 people but booked for 2."
6. Rescheduling and cancelling leave attendee rows untouched. Cancelled
   bookings keep their attendees for history, like everything else.

## Data

New table in `packages/db/src/schema.ts`:

```ts
export const bookingAttendees = sqliteTable(
  "booking_attendees",
  {
    bookingId: integer("booking_id").notNull().references(() => bookings.id),
    memberId: integer("member_id").notNull().references(() => members.id),
  },
  (table) => [primaryKey({ columns: [table.bookingId, table.memberId] })]
);
```

Then run `bun run generate` in `packages/db` and commit the new migration plus
`migrations/meta/`.

The `Booking` type in `packages/db/src/shared.ts` gets
`attendeeIds: string[]` (member ids, excluding the booker). The `attendees`
number is unchanged.

## Layers

- **`packages/db/src/bookings.ts`**
  - `insertBooking` accepts `attendeeIds: string[]`. It inserts the booking,
    then the attendee rows (none if the list is empty), and returns the
    booking with `attendeeIds`.
  - Every function returning `Booking` (`getBooking`, `listRoomBookings`,
    `listMemberBookings`, `findOverlappingBookings`, `updateBookingTimes`,
    `cancelBooking`) fills `attendeeIds`. Lists load them with one extra
    `where booking_id in (...)` query, not one query per booking.
  - The two inserts aren't wrapped in a transaction (D1 has no interactive
    transactions). All validation runs before the first insert, so a
    half-written booking needs a DB failure between two statements. That's
    acceptable here.
- **`packages/services/src/bookings.ts`**
  - `createBookingInput` adds
    `attendeeIds: z.array(z.string().min(1)).default([])`.
  - Apply the rules above. Check that members exist with one query (e.g. a
    `listMembersByIds` in `@repo/db/members`, or reuse the members list).
- **Router** (`apps/web/src/server/trpc/routers/bookings.ts`): no change beyond
  picking up the wider input schema.
- **UI** (`apps/web/src/routes/bookings.tsx`)
  - The create form gets a multi-select of members, labelled "Who's coming",
    that leaves out the acting member. The "attendees" headcount input stays.
  - The booking rows in the day view and the upcoming list show named
    attendees after "booked by …", e.g. "booked by Ana · with Ben, Chloe".
    Rows with no named attendees look as they do today.

## Tests (`packages/services/src/bookings.test.ts`)

- Create with attendees: they're returned, and `listForRoom` /
  `listUpcoming` return them too.
- Create without `attendeeIds`: `attendeeIds` is `[]`.
- Rejected: duplicate id, booker in the list, unknown member id, more named
  people than the headcount allows (`headcount 2` + 2 named fails; 1 named
  passes).
- A cancelled booking still has its `attendeeIds` (via `getBooking`).

## Out of scope

- Adding or removing attendees after creation.
- Attendees seeing bookings they're invited to in their own upcoming list.
- Attending counting toward `MAX_BOOKINGS_PER_MEMBER_PER_DAY`.
- Clash detection for an attendee double-booked across rooms.
- Notifications, RSVPs, and external guests by name or email.

## Done when

`bun test` and `bun run check` pass, the migration and `meta/` are committed,
and in `bun run dev` a booking created with two named members shows them in
the day view.
