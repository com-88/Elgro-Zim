const path = require('path');
const target = path.join(__dirname, 'Front end', 'Back end', 'server.js');
console.log('Starting app via index.js ->', target);
require(target);
