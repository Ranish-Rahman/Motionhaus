import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/userModel.js';
import dotenv from 'dotenv';

dotenv.config();

// Validate environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
  throw new Error('Missing Google OAuth credentials in environment variables');
}

// Local Strategy
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      return done(null, false, { message: 'No user found with that email' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return done(null, false, { message: 'Password incorrect' });
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  passReqToCallback: true
},
async (req, accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth Flow Started');
    console.log('Profile received:', {
      id: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName
    });
    
    if (!profile.emails || !profile.emails[0] || !profile.emails[0].value) {
      console.error('No email found in Google profile');
      return done(new Error('No email found in Google profile'));
    }

    // Check if user exists
    let user = await User.findOne({ 
      $or: [
        { googleId: profile.id },
        { email: profile.emails[0].value }
      ]
    });
    
    if (user) {
      console.log('Existing user found:', {
        id: user._id,
        email: user.email,
        googleId: user.googleId
      });
      
      // Update googleId if not present
      if (!user.googleId) {
        user.googleId = profile.id;
        await user.save();
        console.log('Updated user with Google ID');
      }
      
      return done(null, user);
    }
    
    // Create new user for signup
    user = new User({
      googleId: profile.id,
      email: profile.emails[0].value,
      username: profile.displayName.replace(/\s+/g, '').toLowerCase(),
      name: profile.displayName,
      isVerified: true,
      role: 'user',
      status: 'active',
      lastLogin: new Date()
    });
    
    await user.save();
    console.log('New user created:', {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role
    });
    
    return done(null, user);
    
  } catch (error) {
    console.error('Error in Google Strategy:', {
      message: error.message,
      stack: error.stack
    });
    return done(error);
  }
}));

// Serialize user for the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
