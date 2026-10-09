/**
 * Event seat holds for the POS / Admin Booking cart.
 *
 *   POST   /events/holds          hold seats (or replace an existing hold - editing a cart line)
 *   POST   /events/holds/refresh  keep a cart's holds alive; re-take any that lapsed
 *   DELETE /events/holds/:id      give the seats back (line removed, cart cleared)
 *
 * Mounted on both route trees (registerCatalogueRoutes), so the POS counter
 * and the Admin Booking screen hold seats the same way. Every seat change is
 * one atomic update of the Event record - see common/utils/event-seats.js.
 */
const mongoose = require("mongoose");
const { responseHandler, exceptionHandler } = require("../../utilities/handlers");
const EventSeatHold = require("../../models/event-seat-holds");
const { acquireHold, releaseHold, extendHold, resizeHold, CART_HOLD_TTL_MS } = require("../../common/utils/event-seats");

const posOnlyFor = (req) => req.posPortal !== "admin";

function holdView(hold) {
  return hold ? { holdId: String(hold._id), expiresAt: hold.expiresAt, seats: hold.seats } : { holdId: null, expiresAt: null, seats: 0 };
}

/** Holds the seats - or, when `replaceHoldId` is given, swaps that hold for the new one without ever leaving the cart unprotected. */
async function holdSeats(req, res) {
  try {
    const { eventId, slotKey, seats, replaceHoldId, clientId } = req.body;
    const ownerId = req.auth?.userId ?? null;

    if (replaceHoldId) {
      const current = await EventSeatHold.findOne({ _id: replaceHoldId, status: "active", expiresAt: { $gt: new Date() } });
      // Same slot and not yet in checkout: keep the hold and just move its seat count (only the difference is taken).
      if (current && String(current.eventId) === eventId && current.slotKey === slotKey && !current.orderId) {
        const resized = current.seats === seats ? await extendHold(current._id, CART_HOLD_TTL_MS) : await resizeHold(current, seats, { posOnly: posOnlyFor(req) });
        if (resized) return responseHandler({ res, response: holdView(resized) });
      }
    }

    // Take the new seats FIRST; only then let the old ones go. If the new slot is full the cashier keeps the old hold.
    const hold = await acquireHold({ eventId, slotKey, seats, ownerId, clientId, posOnly: posOnlyFor(req) });
    if (replaceHoldId) await releaseHold(replaceHoldId);

    return responseHandler({ res, response: holdView(hold), statusCode: 201 });
  } catch (error) {
    return exceptionHandler({ res, error, statusCode: typeof error === "string" ? 409 : undefined });
  }
}

/**
 * Called on a timer while a cart is open. A hold still alive is extended; one
 * that lapsed is taken again if the seats are still free. Each entry reports
 * its own outcome so the POS can warn about exactly the line that lost its seats.
 */
async function refreshHolds(req, res) {
  try {
    const ownerId = req.auth?.userId ?? null;
    const results = [];
    for (const entry of req.body.holds) {
      const { holdId, eventId, slotKey, seats } = entry;
      try {
        const current = holdId
          ? await EventSeatHold.findOne({ _id: holdId, status: "active", expiresAt: { $gt: new Date() } })
          : null;
        if (current) {
          // A hold already tied to an order in checkout keeps that order's own 30-minute window.
          const alive = current.orderId ? current : await extendHold(current._id, CART_HOLD_TTL_MS);
          if (alive) {
            results.push({ ...holdView(alive), eventId, slotKey, ok: true });
            continue;
          }
        }
        const fresh = await acquireHold({ eventId, slotKey, seats, ownerId, clientId: req.body.clientId, posOnly: posOnlyFor(req) });
        results.push({ ...holdView(fresh), eventId, slotKey, ok: true, retaken: Boolean(fresh) });
      } catch (error) {
        results.push({ holdId: null, eventId, slotKey, ok: false, message: typeof error === "string" ? error : "Could not hold the seats." });
      }
    }
    return responseHandler({ res, response: { results } });
  } catch (error) {
    return exceptionHandler({ res, error });
  }
}

/**
 * A page that has just loaded has an empty cart, so any cart-stage hold its
 * own browser tab took earlier (before a refresh, a crash, a closed laptop
 * lid) is orphaned: nothing on screen can ever release it. This lets go of
 * them straight away instead of making the seats wait for their timeout.
 * Holds already tied to an order in checkout are left alone, and so is any
 * other tab's cart (each tab has its own clientId).
 */
async function releaseOrphanHolds(req, res) {
  try {
    const orphans = await EventSeatHold.find({
      clientId: req.body.clientId,
      ownerId: req.auth?.userId ?? null,
      status: "active",
      orderId: null,
    }).select("_id");
    let released = 0;
    for (const hold of orphans) if (await releaseHold(hold._id)) released += 1;
    return responseHandler({ res, response: { released } });
  } catch (error) {
    return exceptionHandler({ res, error });
  }
}

/** Gives the seats back. Idempotent: an already released, expired or consumed hold is simply a no-op. */
async function releaseHoldRoute(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw "Invalid hold id.";
    const released = await releaseHold(req.params.id);
    return responseHandler({ res, response: { released } });
  } catch (error) {
    return exceptionHandler({ res, error, statusCode: typeof error === "string" ? 400 : undefined });
  }
}

module.exports = { holdSeats, refreshHolds, releaseHoldRoute, releaseOrphanHolds };
