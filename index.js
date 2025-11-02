const path = require('path');
// Using renamed directories without spaces
const target = path.join(__dirname, 'frontend', 'backend', 'server.js');
console.log('Starting app via index.js ->', target);
require(target);
