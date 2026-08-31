const mod = require("../tinHelm/extensions/oops-plugin-excel-to-json/dist/main.js");

console.log("exports:", Object.keys(mod));
console.log("methods:", mod.methods && Object.keys(mod.methods));
