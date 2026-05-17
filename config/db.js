const mongoose = require('mongoose');
const dns = require('dns');

// Override Node's default DNS resolver to use Google's public DNS (8.8.8.8)
// This fixes ECONNREFUSED errors when the system DNS cannot resolve MongoDB SRV records
dns.setDefaultResultOrder('ipv4first');
const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1']);
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.warn('MONGO_URI not set — skipping MongoDB connection (DB-disabled mode)');
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message || err);
    console.warn('Continuing without DB. Some endpoints will require a running MongoDB.');
  }
}

module.exports = connectDB;
