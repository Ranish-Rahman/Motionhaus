import mongoose from 'mongoose';

async function checkConnection() {
  try {
    // Get the current connection
    const connection = mongoose.connection;
    
    console.log('Current Database Connection Details:');
    console.log('-----------------------------------');
    console.log('Host:', connection.host);
    console.log('Port:', connection.port);
    console.log('Database:', connection.name);
    console.log('State:', connection.readyState === 1 ? 'Connected' : 'Disconnected');
    console.log('Connection String:', connection._connectionString);
    
    // Close the connection
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error checking connection:', error);
  }
}

// Connect to local MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/motionhaus', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Successfully connected to MongoDB');
  checkConnection();
})
.catch(err => {
  console.error('Connection error:', err);
}); 