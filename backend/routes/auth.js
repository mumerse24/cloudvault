const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendEmail } = require('../config/email');

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email and password' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create user (password is hashed in pre-save hook)
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @desc    Authenticate user & send 2FA code
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user
    const user = await User.findOne({ email });

    // Check password matches
    if (user && (await user.comparePassword(password))) {
      // Generate 2FA code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.twoFactorCode = verificationCode;
      user.twoFactorExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
      await user.save();

      // Send 2FA code via email
      await sendEmail({
        to: user.email,
        subject: 'CloudVault 2FA Verification Code',
        text: `Your CloudVault verification code is: ${verificationCode}. It is valid for 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; background-color: #f9f9f9;">
            <h2 style="color: #6366f1;">CloudVault Authentication</h2>
            <p>Hello ${user.name},</p>
            <p>Your two-factor authentication (2FA) code is:</p>
            <div style="font-size: 24px; font-weight: bold; letter-spacing: 2px; padding: 10px 20px; background: #e0e7ff; color: #4338ca; display: inline-block; border-radius: 4px; margin: 10px 0;">
              ${verificationCode}
            </div>
            <p>This code will expire in 10 minutes. If you did not request this, please ignore this email or contact support.</p>
            <p>Best regards,<br/>The CloudVault Team</p>
          </div>
        `,
      });

      res.json({
        email: user.email,
        twoFactorRequired: true,
        message: 'Verification code sent to email',
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @desc    Verify 2FA code & return token
// @route   POST /api/auth/verify-2fa
// @access  Public
router.post('/verify-2fa', async (req, res) => {
  const { email, code } = req.body;

  try {
    if (!email || !code) {
      return res.status(400).json({ message: 'Please provide email and verification code' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (!user.twoFactorCode || user.twoFactorCode !== code) {
      return res.status(401).json({ message: 'Invalid verification code' });
    }

    if (user.twoFactorExpires < Date.now()) {
      return res.status(401).json({ message: 'Verification code has expired' });
    }

    // Code is valid - clear fields and generate token
    user.twoFactorCode = null;
    user.twoFactorExpires = null;
    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('2FA verification error:', error.message);
    res.status(500).json({ message: 'Server error during 2FA verification' });
  }
});

// @desc    Get logged in user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({ message: 'Server error fetching user context' });
  }
});

module.exports = router;
