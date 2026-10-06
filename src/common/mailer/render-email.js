const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

const compiledShell = handlebars.compile(
  fs.readFileSync(path.join(__dirname, "base-template.html"), "utf8")
);

/**
 * A message that already carries its own document (an older seeded
 * template, or HTML someone pasted in full) must not be wrapped a second
 * time. New templates store only the inner text; the shell adds the logo.
 */
function isAlreadyWrapped(html) {
  const value = String(html || "");
  return (
    /<!doctype html/i.test(value) ||
    /<html[\s>]/i.test(value) ||
    value.includes("ssd-email-shell") ||
    value.includes("font-family:Georgia,serif;background:#fbf6ea")
  );
}

/**
 * Puts the mapping's inner HTML into the standard email layout.
 * `body` is inserted raw (`{{{body}}}`) because it is already HTML.
 * The logo comes from the entity; this function does not look one up.
 */
function renderEmailHtml({ body, entityLogo = "", templeName = "Sri Siva Durga Temple" }) {
  const inner = String(body || "");
  if (isAlreadyWrapped(inner)) return inner;
  return compiledShell({
    body: inner,
    entityLogo: entityLogo || "",
    templeName: templeName || "Sri Siva Durga Temple",
  });
}

module.exports = { renderEmailHtml, isAlreadyWrapped };
