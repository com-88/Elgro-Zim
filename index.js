const path = require('path');
// Adjusted to use the renamed `frontend` directory. The backend folder still contains a space 'Back end'.
const target = path.join(__dirname, 'frontend', 'Back end', 'server.js');
console.log('Starting app via index.js ->', target);
require(target);
