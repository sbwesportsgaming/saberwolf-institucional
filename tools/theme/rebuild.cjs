/* Regenerates color adapters; keeps source CSS and artwork unchanged. */
const fs = require("node:fs");
const path = require("node:path");
const { compile } = require("./compiler.cjs");
const root = path.resolve(__dirname, "../..");
const cssBase = "css";
const common = cssBase + "/core/sbw-theme.css";
const themeJs = 'js/core/sbw-theme.js';
const excluded = new Set(["node_modules", ".git", "tools", "tests"]);
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry =>
    excluded.has(entry.name) ? [] : entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
  );
}
let styles = 0, pages = 0;
for (const file of walk(path.join(root, cssBase))) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  if (!relative.endsWith(".css") || relative === common || relative.startsWith(cssBase + "/themes/")) continue;
  const output = path.join(root, cssBase, "themes/dark", relative.slice(cssBase.length + 1));
  fs.mkdirSync(path.dirname(output), {recursive:true});
  fs.writeFileSync(output, compile(fs.readFileSync(file, "utf8"), relative));
  styles++;
}
for (const file of walk(root)) {
  if (!file.endsWith(".html")) continue;
  const original = fs.readFileSync(file, "utf8");
  if (!original.includes("data-sbw-theme-page=")) continue;
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const clean = original.replace(/  <style data-sbw-theme-inline>[\s\S]*?<\/style>\r?\n/i, "");
  const isOffline = /data-sbw-theme-page="offline"/.test(clean);
  const current = isOffline ? clean
    .replace(/(<script\b[^>]*data-sbw-theme-offline[^>]*>)[\s\S]*?<\/script>/i,
      (_, tag) => tag + fs.readFileSync(path.join(root, themeJs), "utf8") + "</script>")
    .replace(/<style data-sbw-theme-common>[\s\S]*?<\/style>/i,
      "<style data-sbw-theme-common>" + newline + fs.readFileSync(path.join(root, common), "utf8") + newline + "  </style>") : clean;
  const inline = [];
  current.replace(/<style\b(?![^>]*data-sbw-theme-common)[^>]*>([\s\S]*?)<\/style>/gi, (tag, css) => { inline.push(css); return tag; });
  const relative = path.relative(root, file).split(path.sep).join("/");
  const extra = inline.length ? "  <style data-sbw-theme-inline>" + newline +
    compile(inline.join("\n"), relative + " inline styles").trim() + newline + "  </style>" + newline : "";
  const output = current.replace(/  (?:<style data-sbw-theme-common>|<link\b[^>]*href=["'][^"']*core\/sbw-theme\.css[^"']*["'][^>]*>)/i, tag => extra + tag);
  if (extra && output === current) throw new Error("Theme stylesheet missing: " + relative);
  if (output !== original) fs.writeFileSync(file, output);
  pages++;
}
console.log("Theme adapters rebuilt: " + styles + " stylesheets; " + pages + " pages.");
