const mongoose = require("mongoose");

/**
 * One record per seat allocation on an Event slot - the full history of who
 * took which seats and how it ended. (Summing the "consumed" rows of a slot
 * always equals its bookedSeats counter, and summing the "active" rows equals
 * its heldSeats.)
 *
 * A temporary claim on seats of one Event slot - what "add to cart" creates.
 *
 *   active   -> the seats are held: they are counted in the slot's `heldSeats`
 *               on the Event record and cannot be sold to anyone else.
 *   consumed -> the booking was confirmed; the held seats turned into booked
 *               seats (`bookedSeats`) on the Event record.
 *   released -> the cart line was removed / edited / the cart was cleared.
 *   expired  -> nobody confirmed it in time; the cleanup job gave the seats back.
 *
 * Only an "active" hold counts towards `heldSeats`, and a hold leaves
 * "active" exactly once (a conditional findOneAndUpdate) - that is what makes
 * releasing/consuming/expiring safe to run twice or from two places at once.
 *
 * `orderId` is set when checkout starts: the hold is then tied to that order,
 * its expiry is pushed out to the order's 30-minute window, and confirming the
 * order consumes it.
 *
 * Like InventoryReservation this is a transient operational record, not
 * master data - no soft delete, no audit plugin.
 */
const eventSeatHoldSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    // Slot identity - see slotKeyOf in common/utils/event-seats.js.
    slotKey: { type: String, required: true },
    seats: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["active", "consumed", "released", "expired"], default: "active" },
    expiresAt: { type: Date, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Random id of the browser TAB that took the hold (see the POS's lib/eventHolds).
    // A page refresh empties the cart but keeps the tab's id, so the new page can
    // find and release the seats its previous cart was holding.
    clientId: { type: String, default: null },
    // Set when the hold became a confirmed booking: which booking took these seats.
    bookingNumber: { type: String, default: null },
    // true when a paid order's hold had already lapsed and its seats were booked directly (see countEventSeats).
    forced: { type: Boolean, default: false },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

// The cleanup job: every active hold that has run out of time.
eventSeatHoldSchema.index({ status: 1, expiresAt: 1 });
// Confirming / cancelling an order finds the holds tied to it.
eventSeatHoldSchema.index({ orderId: 1, status: 1 });
// A refreshed page finds the holds its old cart left behind.
eventSeatHoldSchema.index({ clientId: 1, status: 1 });
// "Who is holding seats on this slot?"
eventSeatHoldSchema.index({ eventId: 1, slotKey: 1, status: 1 });

module.exports = mongoose.model("EventSeatHold", eventSeatHoldSchema);
