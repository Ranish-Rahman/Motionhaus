import mongoose from 'mongoose';

async function checkSessions() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/motionhaus', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Get the sessions collection
    const sessionsCollection = mongoose.connection.collection('sessions');
    
    // Count all sessions
    const count = await sessionsCollection.countDocuments();
    console.log(`Total number of sessions: ${count}`);

    // Get all sessions
    const sessions = await sessionsCollection.find({}).toArray();
    console.log('\nSession details:');
    sessions.forEach((session, index) => {
      try {
        const sessionData = JSON.parse(session.session);
        console.log(`\nSession ${index + 1}:`);
        console.log('User ID:', sessionData.user?.id || 'No user ID');
        console.log('Expires:', session.expires);
      } catch (err) {
        console.log(`\nSession ${index + 1}: Could not parse session data`);
      }
    });

    // Close the connection
    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSessions(); 