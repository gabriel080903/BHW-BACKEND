const mongoose = require('mongoose');

function isDbConnected() {
  // 1 = connected
  return mongoose.connection && mongoose.connection.readyState === 1;
}

module.exports = { isDbConnected };
