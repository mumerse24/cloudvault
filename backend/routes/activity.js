const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');

// @desc    Get user activity log
// @route   GET /api/activity
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const activities = await Activity.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json(activities);
  } catch (error) {
    console.error('Get activity error:', error.message);
    res.status(500).json({ message: 'Server error fetching activity log' });
  }
});

module.exports = router;
