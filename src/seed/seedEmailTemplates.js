const EmailTemplate = require("../models/email-templates");
const EmailTemplateMapping = require("../models/email-template-mappings");

const button = (href, label) =>
  `<div align="center" style="margin:28px 0;text-align:center;"><a href="${href}" target="_blank" style="background-color:#7c1527;color:#ffffff;display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;line-height:20px;text-align:center;text-decoration:none;padding:14px 36px;border-radius:8px;">${label}</a></div>`;

/**
 * Inner message only. The logo and the card around it are added when the
 * mail is sent (see common/mailer/render-email.js), using the entity logo.
 */
const DEFAULT_TEMPLATES = [
  {
    name: "Account Activation",
    event: "ACCOUNT_ACTIVATION",
    subject: "Set your password — Sri Siva Durga Temple",
    htmlContent: `<p>Dear {{name}},</p>
<p>We are pleased to welcome you to the Sri Siva Durga Temple community.</p>
<p>Your account has been created successfully. Please set your password to get started and access your temple account.</p>
${button("{{activationUrl}}", "Set Your Password")}
<p>May the divine blessings of Lord Siva and Goddess Durga be with you and your family always.</p>
<p style="color:#7d6c4d;font-size:13px;">If you did not request this account, you may safely ignore this email.</p>`,
  },
  {
    name: "Password Reset",
    event: "PASSWORD_RESET",
    subject: "Reset your password — Sri Siva Durga Temple",
    htmlContent: `<p>Namaste {{name}},</p>
<p>We received a request to reset your password. Use the button below to choose a new one.</p>
${button("{{resetUrl}}", "Reset Password")}
<p style="color:#7d6c4d;font-size:13px;">This link expires in {{expiresInMinutes}} minutes. If you didn't request this, your password is still safe — just ignore this email.</p>`,
  },
];

function wasNeverEdited(doc) {
  if (!doc.updatedAt || !doc.createdAt) return true;
  return Math.abs(new Date(doc.updatedAt).getTime() - new Date(doc.createdAt).getTime()) < 5000;
}

/**
 * Idempotent — safe to run on every seed. Creates the template and copies
 * its subject and inner content onto the entity's mapping. An existing
 * mapping that already has its own content is left alone: that content is
 * what gets sent, and it is not the template master.
 */
async function ensureDefaultEmailTemplates(entityId) {
  for (const def of DEFAULT_TEMPLATES) {
    let template = await EmailTemplate.findOne(EmailTemplate.notDeletedFilter({ name: def.name }));
    if (!template) {
      template = await EmailTemplate.create({
        name: def.name,
        subject: def.subject,
        htmlContent: def.htmlContent,
        description: `Seeded default for the ${def.event} event.`,
      });
      console.log(`>>> Seed: email template "${def.name}" created`);
    } else if (
      wasNeverEdited(template) &&
      String(template.htmlContent || "").includes("font-family:Georgia,serif;background:#fbf6ea")
    ) {
      template.subject = def.subject;
      template.htmlContent = def.htmlContent;
      template.description = `Seeded default for the ${def.event} event.`;
      await template.save();
      console.log(`>>> Seed: email template "${def.name}" stored as inner content (logo comes from the entity)`);
    }

    const existingMapping = await EmailTemplateMapping.findOne(
      EmailTemplateMapping.notDeletedFilter({ entity: entityId, event: def.event })
    );
    if (!existingMapping) {
      await EmailTemplateMapping.create({
        entity: entityId,
        event: def.event,
        template: template._id,
        subject: template.subject,
        content: template.htmlContent,
        fromOverride: null,
        cc: [],
        bcc: [],
      });
      console.log(`>>> Seed: mapped event "${def.event}" → "${def.name}" for entity ${entityId}`);
    } else if (!String(existingMapping.content || "").trim()) {
      existingMapping.subject = template.subject;
      existingMapping.content = template.htmlContent;
      await existingMapping.save();
      console.log(`>>> Seed: copied "${def.name}" into the "${def.event}" mapping`);
    }
  }
}

module.exports = { ensureDefaultEmailTemplates, DEFAULT_TEMPLATES };
