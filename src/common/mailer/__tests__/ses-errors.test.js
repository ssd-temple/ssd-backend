const { describeSesError, EmailDeliveryError } = require("../transport");

const sesError = (name, message) => Object.assign(new Error(message), { name });
const TO = "tester@example.com";

describe("describeSesError", () => {
  it("says the recipient is not verified when SES lists the recipient (sandbox)", () => {
    const e = describeSesError(
      sesError("MessageRejected", `Email address is not verified. The following identities failed the check in region AP-SOUTHEAST-1: ${TO}`),
      TO
    );
    expect(e).toBeInstanceOf(EmailDeliveryError);
    expect(e.expose).toBe(true);
    expect(e.status).toBe(422);
    expect(e.message).toContain(TO);
    expect(e.message).toMatch(/not verified/i);
  });

  it("blames the sender, not the recipient, when only the sender fails the check", () => {
    const e = describeSesError(
      sesError("MessageRejected", "Email address is not verified. The following identities failed the check in region AP-SOUTHEAST-1: uat@example.org"),
      TO
    );
    expect(e.status).toBe(502);
    expect(e.message).toMatch(/sender/i);
    expect(e.message).not.toContain(TO);
  });

  it("reports a malformed address as not valid", () => {
    const e = describeSesError(sesError("BadRequestException", "Missing final '@domain'"), TO);
    expect(e.status).toBe(422);
    expect(e.message).toMatch(/not valid/i);
  });

  it("maps throttling and paused sending", () => {
    expect(describeSesError(sesError("TooManyRequestsException", "x"), TO).status).toBe(429);
    expect(describeSesError(sesError("SendingPausedException", "x"), TO).status).toBe(503);
  });

  it("returns null for errors without a friendly form, so they stay generic", () => {
    expect(describeSesError(sesError("SomethingElse", "boom"), TO)).toBeNull();
  });
});
