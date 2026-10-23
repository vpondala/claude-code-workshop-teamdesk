import { beforeEach, describe, expect, test } from "bun:test";
import { BOOKING_MAX_MINUTES } from "@repo/db/shared";
import { type BookingsService, createBookingsService } from "./bookings.ts";
import { at, createTeam, type Team } from "./fixtures.ts";

let team: Team;
let bookings: BookingsService;

beforeEach(async () => {
  team = await createTeam();
  bookings = createBookingsService(team.db);
});

const standUp = (
  roomId: string,
  startsAt = at("09:00"),
  endsAt = at("09:30")
) => ({
  attendees: 2,
  endsAt,
  roomId,
  startsAt,
  title: "Stand-up",
});

describe("bookings service", () => {
  test("create stores the booking for the acting member", async () => {
    const booking = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id)
    );

    expect(booking).toMatchObject({
      memberId: team.ana.id,
      roomId: team.bigRoom.id,
    });
    expect(await bookings.listForRoom(team.bigRoom.id, at("00:00"))).toEqual([
      booking,
    ]);
  });

  test("create refuses an overlapping slot but allows a touching one", async () => {
    await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id, at("09:00"), at("10:00"))
    );

    await expect(
      bookings.create(
        team.ben.id,
        standUp(team.bigRoom.id, at("09:30"), at("10:30"))
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await bookings.create(
      team.ben.id,
      standUp(team.bigRoom.id, at("10:00"), at("10:30"))
    );
  });

  test("create checks the room's capacity", async () => {
    await expect(
      bookings.create(team.ana.id, {
        ...standUp(team.smallRoom.id),
        attendees: 3,
      })
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  test("create enforces the minimum and maximum length", async () => {
    await expect(
      bookings.create(
        team.ana.id,
        standUp(team.bigRoom.id, at("09:00"), at("09:10"))
      )
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const tooLong = new Date(
      Date.parse(at("09:00")) + (BOOKING_MAX_MINUTES + 1) * 60_000
    );
    await expect(
      bookings.create(
        team.ana.id,
        standUp(team.bigRoom.id, at("09:00"), tooLong.toISOString())
      )
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  test("create rejects an unknown room", async () => {
    await expect(
      bookings.create(team.ana.id, standUp("999"))
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("only the owner or an admin can cancel", async () => {
    const booking = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id)
    );

    await expect(
      bookings.cancel(team.ben.id, booking.id)
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      (await bookings.cancel(team.admin.id, booking.id)).cancelledAt
    ).not.toBeNull();
    expect(await bookings.listUpcoming(team.ana.id, at("00:00"))).toEqual([]);
  });

  test("reschedule moves a booking within the same room", async () => {
    const booking = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id)
    );

    const moved = await bookings.reschedule(team.ana.id, booking.id, {
      endsAt: at("11:30"),
      startsAt: at("11:00"),
    });

    expect(moved).toMatchObject({ endsAt: at("11:30"), startsAt: at("11:00") });
  });

  test("reschedule refuses a slot that clashes with another booking", async () => {
    await bookings.create(
      team.ben.id,
      standUp(team.bigRoom.id, at("11:00"), at("12:00"))
    );
    const booking = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id)
    );

    await expect(
      bookings.reschedule(team.ana.id, booking.id, {
        endsAt: at("11:45"),
        startsAt: at("11:15"),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("bookings on another day do not count towards the daily limit", async () => {
    const nextDay = (time: string) =>
      at(time).replace("2026-10-23", "2026-10-24");
    await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id, at("09:00"), at("09:30"))
    );
    await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id, at("10:00"), at("10:30"))
    );
    await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id, at("11:00"), at("11:30"))
    );

    const tomorrow = await bookings.create(
      team.ana.id,
      standUp(team.bigRoom.id, nextDay("09:00"), nextDay("09:30"))
    );

    expect(tomorrow.startsAt).toBe(nextDay("09:00"));
  });

  describe("attendees", () => {
    test("named attendees are stored and listed with the booking", async () => {
      const booking = await bookings.create(team.ana.id, {
        ...standUp(team.bigRoom.id),
        attendeeIds: [team.ben.id, team.admin.id],
        attendees: 4,
      });

      const expected = [team.admin.id, team.ben.id].sort(
        (a, b) => Number(a) - Number(b)
      );
      expect(booking.attendeeIds).toEqual(expected);
      expect(await bookings.listForRoom(team.bigRoom.id, at("00:00"))).toEqual([
        booking,
      ]);
      expect(await bookings.listUpcoming(team.ana.id, at("00:00"))).toEqual([
        booking,
      ]);
    });

    test("naming nobody is fine", async () => {
      const booking = await bookings.create(
        team.ana.id,
        standUp(team.bigRoom.id)
      );

      expect(booking.attendeeIds).toEqual([]);
    });

    test("attendees only show on the booker's upcoming list", async () => {
      await bookings.create(team.ana.id, {
        ...standUp(team.bigRoom.id),
        attendeeIds: [team.ben.id],
      });

      expect(await bookings.listUpcoming(team.ben.id, at("00:00"))).toEqual([]);
    });

    test("create refuses a repeated attendee", async () => {
      await expect(
        bookings.create(team.ana.id, {
          ...standUp(team.bigRoom.id),
          attendeeIds: [team.ben.id, team.ben.id],
          attendees: 3,
        })
      ).rejects.toMatchObject({ code: "VALIDATION" });
    });

    test("create refuses the booker as a named attendee", async () => {
      await expect(
        bookings.create(team.ana.id, {
          ...standUp(team.bigRoom.id),
          attendeeIds: [team.ana.id],
        })
      ).rejects.toMatchObject({ code: "VALIDATION" });
    });

    test("create refuses someone who is not a member", async () => {
      await expect(
        bookings.create(team.ana.id, {
          ...standUp(team.bigRoom.id),
          attendeeIds: ["9999"],
        })
      ).rejects.toMatchObject({ code: "VALIDATION" });
    });

    test("named attendees plus the booker must fit the headcount", async () => {
      await expect(
        bookings.create(team.ana.id, {
          ...standUp(team.bigRoom.id),
          attendeeIds: [team.ben.id, team.admin.id],
          attendees: 2,
        })
      ).rejects.toMatchObject({ code: "VALIDATION" });

      const booking = await bookings.create(team.ana.id, {
        ...standUp(team.bigRoom.id),
        attendeeIds: [team.ben.id],
        attendees: 2,
      });
      expect(booking.attendeeIds).toEqual([team.ben.id]);
    });

    test("a cancelled booking keeps its attendees", async () => {
      const booking = await bookings.create(team.ana.id, {
        ...standUp(team.bigRoom.id),
        attendeeIds: [team.ben.id],
      });

      const cancelled = await bookings.cancel(team.ana.id, booking.id);

      expect(cancelled.attendeeIds).toEqual([team.ben.id]);
    });
  });
});
