process.env.DRY_RUN_NOTIFICATIONS = "false";
process.env.BREVO_API_KEY = "";
process.env.GMAIL_USER = "";
process.env.GMAIL_APP_PASSWORD = "";
process.env.EMAIL_MAX_PER_SECOND = "10"; // one email every 100 ms

const { SESv2Client } = require("@aws-sdk/client-sesv2");
const sent = [];
SESv2Client.prototype.send = async (cmd) => {
  sent.push({ at: Date.now(), to: cmd.input.Destination.ToAddresses[0] });
  return {};
};
const { sendRawEmail } = require("../transport");

describe("email pacing", () => {
  it("sends a burst one after another, in order, instead of all at once", async () => {
    const started = Date.now();
    const results = await Promise.all(
      ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"].map((to) => sendRawEmail({ to, subject: "s", html: "h" }))
    );
    expect(results.every((r) => r.sent)).toBe(true);
    expect(sent.map((m) => m.to)).toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"]);
    // 5 emails at 10/second need at least ~400 ms in total, and each is about 100 ms after the previous one
    expect(Date.now() - started).toBeGreaterThanOrEqual(380);
    for (let i = 1; i < sent.length; i += 1) expect(sent[i].at - sent[i - 1].at).toBeGreaterThanOrEqual(80);
  });

  it("refuses with a clear message when the line is longer than 20 seconds", async () => {
    // 250 emails queued at 10/second would take 25 s, so the later ones are refused immediately
    const burst = Array.from({ length: 250 }, (_, i) => sendRawEmail({ to: `u${i}@x.com`, subject: "s", html: "h" }).catch((e) => e));
    const refused = [];
    const timer = setTimeout(() => {}, 0);
    // do not wait for all 20 s of sending: check only the refused ones, which settle at once
    const settled = await Promise.race([
      Promise.all(burst.slice(-5)),
      new Promise((r) => setTimeout(() => r(null), 2000)),
    ]);
    clearTimeout(timer);
    expect(settled).not.toBeNull();
    settled.forEach((e) => refused.push(e));
    expect(refused.every((e) => e.expose === true && e.status === 429)).toBe(true);
    expect(refused[0].message).toMatch(/too many emails are waiting/i);
  });
});
