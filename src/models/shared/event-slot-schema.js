const mongoose = require("mongoose");

/**
 * Frozen copy of the Event slot a booking line was made for. Stored on every
 * order/booking line whose refType is "Event" (null for Item/Service/General
 * Item lines), so the confirmed booking and its printed ticket keep showing
 * the slot as it was sold even if the Event master's slots are edited later.
 *
 * `slotKey` is the stable identity of a slot (name + day + start time — see
 * common/utils/event-line.js), since Event slots carry no _id of their own.
 */
const eventSlotSchema = new mongoose.Schema(
  {
    slotKey: { type: String, required: true },
    slotName: { type: String, default: "" },
    date: { type: Date, default: null },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
  },
  { _id: false }
);

module.exports = eventSlotSchema;
