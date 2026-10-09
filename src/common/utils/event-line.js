/**
 * Event cart lines — the third kind of thing a POS/Admin cart can hold, next
 * to Items and Services. Kept in one module so the booking summary, both
 * createOrder implementations, the seat reservations and the ticket printer
 * all apply exactly the same rules.
 *
 * What an Event line is:
 *   - Priced per booking (Event.salePrice, GST-inclusive like every other
 *     master), never per deity — effectiveQuantity() always returns 1 for it.
 *   - Tied to one slot when the event needs slots (isSlotRequired), chosen by
 *     `slotKey`.
 *   - Carries the deities picked from the event's own deity mapping, and —
 *     when the event asks for family members — the named devotees.
 *   - Takes SEATS from its slot: one seat per named devotee when the event
 *     asks for family members, otherwise one per booking. Seats are held
 *     like stock (a 30-minute InventoryReservation) and counted into the
 *     slot's bookedSeats when the booking is confirmed.
 */
const Event = require("../../models/events");
const InventoryReservation = require("../../models/inventory-reservations");
const mongoose = require("mongoose");

/** Event.gstClassification -> the GST Master "type" every other line resolves a rate from. */
const GST_TYPE_BY_CLASSIFICATION = {
  APPLICABLE: "Standard Rated",
  EXEMPTED: "Exempt",
  OUT_OF_SCOPE: "Out of Scope",
};

/** Slots have no _id, so name + day + start time is their identity. */
function slotKeyOf(slot) {
  const day = new Date(slot.date).toISOString().slice(0, 10);
  return `${slot.slotName}|${day}|${slot.startTime}`;
}

/** Start of today's calendar day in Singapore, as the UTC midnight event dates are stored at. */
function todayStart() {
  const sgDay = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return new Date(`${sgDay}T00:00:00.000Z`);
}

/** Seats currently held by other active (unexpired) reservations on one slot. */
async function sumActiveSlotReservations(eventId, slotKey) {
  const rows = await InventoryReservation.aggregate([
    {
      $match: {
        refType: "Event",
        refId: typeof eventId === "string" ? mongoose.Types.ObjectId.createFromHexString(eventId) : eventId,
        slotKey,
        status: "active",
        expiresAt: { $gt: new Date() },
      },
    },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);
  return rows[0]?.total ?? 0;
}

/** Seats still free on a slot (Infinity when the slot has no seat limit). */
async function slotSeatsLeft(event, slot) {
  if (!slot || !slot.totalSeats) return Infinity;
  const held = await sumActiveSlotReservations(event._id, slotKeyOf(slot));
  return Math.max(0, slot.totalSeats - (slot.bookedSeats || 0) - held);
}

function seatsFor(event, devotees) {
  return event.isFamilyMembersRequired ? Math.max(1, (devotees || []).length) : 1;
}

/**
 * Validates one Event cart line against the live Event master and returns
 * everything the summary/order writers need. Throws a plain string on any
 * rule a cashier has to fix (caught by exceptionHandler, shown as a toast).
 *
 * @param {{ refId, slotKey?, deities?, devotees? }} line
 * @param {{ portal: "pos" | "admin" }} opts
 */
async function resolveEventLine(line, { portal }) {
  const filter = Event.notDeletedFilter({ _id: line.refId, status: 1, endDate: { $gte: todayStart() } });
  if (portal !== "admin") filter.posVisibility = true;

  const event = await Event.findOne(filter).select(
    "name code salePrice gstClassification deityMapping isSlotRequired slotDetails isFamilyMembersRequired maxFamilyMembers"
  );
  if (!event) throw "An event in the cart is no longer available.";

  // ── slot ──────────────────────────────────────────────────────────────
  let slot = null;
  if (event.isSlotRequired) {
    if (!line.slotKey) throw `Choose a slot for "${event.name}".`;
    slot = event.slotDetails.find((s) => s.status === 1 && slotKeyOf(s) === line.slotKey && new Date(s.date) >= todayStart());
    if (!slot) throw `The selected slot for "${event.name}" is no longer available.`;
  }

  // ── deities ───────────────────────────────────────────────────────────
  const mapped = event.deityMapping.map(String);
  if (mapped.length === 0) {
    throw `"${event.name}" has no deities mapped in the Event master, so it cannot be booked here yet.`;
  }
  const deities = line.deities || [];
  if (deities.length === 0) throw `Select at least one deity for "${event.name}".`;
  if (deities.some((d) => !mapped.includes(String(d)))) {
    throw `A selected deity does not belong to "${event.name}".`;
  }

  // ── devotees ──────────────────────────────────────────────────────────
  let devotees = line.devotees || [];
  if (event.isFamilyMembersRequired) {
    if (devotees.length === 0) throw `Add at least one devotee for "${event.name}".`;
    if (devotees.length > event.maxFamilyMembers) {
      throw `"${event.name}" allows at most ${event.maxFamilyMembers} family member(s).`;
    }
  } else {
    devotees = [];
  }

  const seats = seatsFor(event, devotees);
  const seatsLeft = await slotSeatsLeft(event, slot);

  return {
    event,
    name: event.name,
    code: event.code,
    unitPrice: event.salePrice,
    gstType: GST_TYPE_BY_CLASSIFICATION[event.gstClassification] ?? null,
    deities,
    devotees,
    seats,
    seatsLeft,
    seatsExceeded: seats > seatsLeft,
    eventSlot: slot
      ? {
          slotKey: slotKeyOf(slot),
          slotName: slot.slotName,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        }
      : null,
  };
}

module.exports = {
  slotKeyOf,
  todayStart,
  sumActiveSlotReservations,
  slotSeatsLeft,
  seatsFor,
  resolveEventLine,
  GST_TYPE_BY_CLASSIFICATION,
};
