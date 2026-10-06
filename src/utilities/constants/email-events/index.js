/**
 * Events the platform actually sends. A mapping for anything else would
 * never fire, so the Email Template Mapping screen offers only this list.
 * `placeholders` are the Handlebars tokens sendTemplatedEmail passes in
 * `data` for that event — the editor shows them so the message can be
 * written without guessing the names.
 */
const EMAIL_EVENTS = [
  {
    key: "ACCOUNT_ACTIVATION",
    label: "Account Activation",
    description: "Sent when a new account is created and still needs a password.",
    placeholders: [
      { token: "name", label: "Recipient name" },
      { token: "activationUrl", label: "Set-password link" },
    ],
  },
  {
    key: "PASSWORD_RESET",
    label: "Password Reset",
    description: "Sent when someone asks to reset their password.",
    placeholders: [
      { token: "name", label: "Recipient name" },
      { token: "resetUrl", label: "Reset-password link" },
      { token: "expiresInMinutes", label: "Link expiry, in minutes" },
    ],
  },
];

const EMAIL_EVENT_KEYS = EMAIL_EVENTS.map((event) => event.key);

module.exports = { EMAIL_EVENTS, EMAIL_EVENT_KEYS };
