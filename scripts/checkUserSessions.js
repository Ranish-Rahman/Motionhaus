import mongoose from 'mongoose';

async function checkUserSessions() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/motionhaus');

    console.log('Connected to MongoDB');

    // Get the sessions collection
    const sessionsCollection = mongoose.connection.collection('sessions');
    
    // Get all sessions
    const sessions = await sessionsCollection.find({}).toArray();
    console.log(`\nTotal sessions found: ${sessions.length}\n`);

    // Process each session
    for (const session of sessions) {
      try {
        console.log('Session ID:', session._id);
        console.log('Expires:', session.expires);
        console.log('Raw Session Data:', session.session);
        
        const sessionData = JSON.parse(session.session);
        console.log('\nParsed Session Data:');
        console.log(JSON.stringify(sessionData, null, 2));
        
        // Check for user data in different possible locations
        if (sessionData.user) {
          console.log('\nUser Information:');
          console.log('User ID:', sessionData.user.id || sessionData.user._id);
          console.log('User Email:', sessionData.user.email);
          console.log('User Role:', sessionData.user.role);
        } else if (sessionData.passport && sessionData.passport.user) {
          console.log('\nPassport User Information:');
          console.log('Passport User ID:', sessionData.passport.user);
        } else if (sessionData.admin) {
          console.log('\nAdmin Information:');
          console.log('Admin Email:', sessionData.admin.email);
          console.log('Admin Role:', sessionData.admin.role);
        } else {
          console.log('\nNo user/admin data found in session');
        }
        
        console.log('\n----------------------------------------\n');
      } catch (err) {
        console.log('Error parsing session:', err);
        console.log('Raw session data:', session);
        console.log('----------------------------------------');
      }
    }

    // Close the connection
    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUserSessions(); 