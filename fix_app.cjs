const fs = require('fs');
let appJs = fs.readFileSync('src/app.js', 'utf8');

if (appJs.includes('openEditOrderDrawer as openEditOrderDrawerModule')) {
    // Already good
}
