const fs = require('fs');
const code = fs.readFileSync('src/app.js', 'utf8');
console.log("Checking src/app.js imports dynamically...");
