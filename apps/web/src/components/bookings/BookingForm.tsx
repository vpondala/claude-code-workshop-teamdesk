import { BOOKING_TITLE_MAX_LENGTH, type Member } from "@repo/db/shared";
import { type FormEvent, useCallback } from "react";
import FormError from "#/components/form-error";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { isoFromDayAndTime } from "#/lib/datetime";

export interface BookingDraft {
  attendeeIds: string[];
  attendees: number;
  endsAt: string;
  startsAt: string;
  title: string;
}

interface BookingFormProps {
  capacity: number;
  /** The chosen UTC day, YYYY-MM-DD. */
  day: string;
  error: string | null;
  onSubmit: (draft: BookingDraft) => Promise<boolean>;
  /** Members who can be named as coming; the booker is left out. */
  others: Member[];
  pending: boolean;
}

export default function BookingForm({
  capacity,
  day,
  error,
  onSubmit,
  others,
  pending,
}: BookingFormProps) {
  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const ok = await onSubmit({
        attendeeIds: data.getAll("attendeeIds").map(String),
        attendees: Number(data.get("attendees")),
        endsAt: isoFromDayAndTime(day, String(data.get("endsAt"))),
        startsAt: isoFromDayAndTime(day, String(data.get("startsAt"))),
        title: String(data.get("title") ?? ""),
      });
      if (ok) {
        form.reset();
      }
    },
    [day, onSubmit]
  );

  return (
    <form className="island-shell p-6 sm:p-8" onSubmit={handleSubmit}>
      <p className="island-kicker mb-3">New booking on {day} (times in UTC)</p>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-sm" htmlFor="booking-title">
          Title
          <Input
            id="booking-title"
            maxLength={BOOKING_TITLE_MAX_LENGTH}
            name="title"
            required
          />
        </label>
        <label className="grid gap-1 text-sm" htmlFor="booking-start">
          Start
          <Input
            defaultValue="09:00"
            id="booking-start"
            name="startsAt"
            required
            step={900}
            type="time"
          />
        </label>
        <label className="grid gap-1 text-sm" htmlFor="booking-end">
          End
          <Input
            defaultValue="10:00"
            id="booking-end"
            name="endsAt"
            required
            step={900}
            type="time"
          />
        </label>
        <label className="grid gap-1 text-sm" htmlFor="booking-attendees">
          Attendees
          <Input
            defaultValue={1}
            id="booking-attendees"
            max={capacity}
            min={1}
            name="attendees"
            required
            type="number"
          />
        </label>
        <Button disabled={pending} type="submit">
          {pending ? "Booking…" : "Book"}
        </Button>
      </div>
      {others.length > 0 ? (
        <fieldset className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <legend className="mb-2">Who's coming (besides you)</legend>
          {others.map((member) => (
            <label
              className="flex items-center gap-2"
              htmlFor={`booking-attendee-${member.id}`}
              key={member.id}
            >
              <Checkbox
                id={`booking-attendee-${member.id}`}
                name="attendeeIds"
                value={member.id}
              />
              {member.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <FormError message={error} />
    </form>
  );
}
