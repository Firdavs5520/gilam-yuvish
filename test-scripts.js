const fs = require("node:fs");
const assert = require("node:assert/strict");

const htmlFiles = [
  "index.html",
  "cheklar.html",
  "hisobot.html",
  "print.html",
  "login.html",
  "settings.html",
];
const dangerousHtmlApi = ["inner", "HTML"].join("");

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];

  for (const [index, script] of scripts.map((match) => match[1]).entries()) {
    assert.doesNotThrow(
      () => new Function(script),
      `${file} inline script ${index + 1} should compile`
    );
  }

  assert.equal(
    html.includes(`.${dangerousHtmlApi}`),
    false,
    `${file} should render user data with DOM APIs instead of ${dangerousHtmlApi}`
  );
}

const shared = fs.readFileSync("shared.js", "utf8");
assert.doesNotThrow(() => new Function(shared), "shared.js should compile");
assert.match(shared, /Authorization/);

console.log("Frontend scripts OK");
