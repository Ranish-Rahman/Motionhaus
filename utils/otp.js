import nodemailer from "nodemailer";
import { config } from "dotenv";
config(); // Load environment variables

// Setup transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Confirm transporter is ready
transporter.verify((error, success) => {
  if (error) {
    console.error(" Transporter error:", error);
  } else {
    console.log(" Transporter ready");
  }
});

// Generate a 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via email
export const sendOTPEmail = async (email, otp) => {
  console.log(`📩 Sending OTP ${otp} to ${email}`); // Log for debugging
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your OTP for Account Verification',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #333;">Account Verification</h2>
        <p style="color: #555;">Your One-Time Password (OTP) is:</p>
        <div style="font-size: 24px; font-weight: bold; margin: 20px 0; background: #eee; padding: 10px; text-align: center;">
          ${otp}
        </div>
        <p>This OTP is valid for 2 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ OTP Email sent:", info.response);
    return true;
  } catch (error) {
    console.error("❌ Failed to send OTP Email:", error);
    throw error;
  }
};
