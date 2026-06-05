const express = require('express');
const router = express.Router();
const User = require('../models/User');
const File = require('../models/File');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');

// Middleware to check if user is admin
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden. Admin access required.' });
  }
};

// @desc    Get global stats for admin panel
// @route   GET /api/admin/stats
// @access  Private/Admin
router.get('/stats', protect, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalFiles = await File.countDocuments();

    const storageAggregate = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$storageUsed' } } },
    ]);
    const totalStorageUsed = storageAggregate[0]?.total || 0;

    const recentActivities = await Activity.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      totalUsers,
      totalFiles,
      totalStorageUsed,
      recentActivities,
    });
  } catch (error) {
    console.error('Admin stats error:', error.message);
    res.status(500).json({ message: 'Server error fetching admin stats' });
  }
});

// @desc    Get all users list
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Admin get users error:', error.message);
    res.status(500).json({ message: 'Server error fetching users list' });
  }
});

module.exports = router;
