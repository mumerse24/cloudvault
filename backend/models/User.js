const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    storageLimit: {
      type: Number,
      default: 100 * 1024 * 1024, // 100 MB default
    },
    storageUsed: {
      type: Number,
      default: 0,
    },
    twoFactorCode: {
      type: String,
      default: null,
    },
    twoFactorExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving to database
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password input with hashed password
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
