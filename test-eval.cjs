const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
  runScripts: "dangerously",
  url: "http://localhost/"
});
const code = fs.readFileSync('vendor/pdf-lib.min.js', 'utf8');
try {
  dom.window.eval(code);
  console.log("pdf-lib loaded OK");
} catch(e) {
  console.log("Error in pdf-lib:", e.message);
}
