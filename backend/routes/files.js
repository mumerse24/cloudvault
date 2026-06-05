const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const File = require('../models/File');
const { protect } = require('../middleware/auth');
const { cloudinary, upload } = require('../config/cloudinary');

// @desc    Upload file to Cloudinary & save metadata
// @route   POST /api/files/upload
// @access  Private
router.post('/upload', protect, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    // Handle Multer specific errors
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File is too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ message: `Server error during upload: ${err.message}` });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file was uploaded.' });
    }

    try {
      const { parent } = req.body;

      // Create new file document in database
      const newFile = await File.create({
        name: req.file.originalname,
        url: req.file.path,
        publicId: req.file.filename,
        size: req.file.size,
        type: req.file.mimetype,
        owner: req.user._id,
        parent: parent && parent !== 'root' ? parent : null,
      });

      res.status(201).json(newFile);
    } catch (dbError) {
      console.error('Save file metadata error:', dbError.message);
      
      // Attempt to clean up Cloudinary upload to avoid orphan files
      try {
        await cloudinary.uploader.destroy(req.file.filename);
      } catch (destroyErr) {
        console.error('Failed to clean up Cloudinary orphan file:', destroyErr.message);
      }

      res.status(500).json({ message: 'Failed to save file metadata to database' });
    }
  });
});

// @desc    Rename a file
// @route   PATCH /api/files/:fileId
// @access  Private
router.patch('/:fileId', protect, async (req, res) => {
  const { name } = req.body;

  try {
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'File name is required' });
    }

    const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id });

    if (!file) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    file.name = name;
    await file.save();

    res.json(file);
  } catch (error) {
    console.error('Rename file error:', error.message);
    res.status(500).json({ message: 'Server error renaming file' });
  }
});

// @desc    Delete a file from Cloudinary and DB
// @route   DELETE /api/files/:fileId
// @access  Private
router.delete('/:fileId', protect, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id });

    if (!file) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    // Determine resource type for Cloudinary deletion
    // Cloudinary categorizes resource types as 'image', 'video' or 'raw'
    const resourceType = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/') || file.type.startsWith('audio/')
      ? 'video'
      : 'raw';

    // 1. Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(file.publicId, { resource_type: resourceType });
    } catch (cloudinaryError) {
      console.error(`Error deleting from Cloudinary (${file.publicId}):`, cloudinaryError.message);
      // We still proceed with deleting from database so users don't see broken files
    }

    // 2. Delete database entry
    await file.deleteOne();

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error.message);
    res.status(500).json({ message: 'Server error deleting file' });
  }
});

// @desc    Generate a share code and enable public sharing for a file
// @route   POST /api/files/:fileId/share
// @access  Private
router.post('/:fileId/share', protect, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id });

    if (!file) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    // Generate unique code if not exists
    if (!file.shareLink) {
      file.shareLink = crypto.randomBytes(16).toString('hex');
    }
    file.isShared = true;
    await file.save();

    res.json({
      shareLink: file.shareLink,
      isShared: file.isShared,
    });
  } catch (error) {
    console.error('Share file error:', error.message);
    res.status(500).json({ message: 'Server error sharing file' });
  }
});

// @desc    Disable sharing for a file
// @route   POST /api/files/:fileId/unshare
// @access  Private
router.post('/:fileId/unshare', protect, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id });

    if (!file) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    file.isShared = false;
    await file.save();

    res.json({
      isShared: file.isShared,
    });
  } catch (error) {
    console.error('Unshare file error:', error.message);
    res.status(500).json({ message: 'Server error unsharing file' });
  }
});

// @desc    Retrieve file metadata by share link (Public endpoint)
// @route   GET /api/files/shared/:shareCode
// @access  Public
router.get('/shared/:shareCode', async (req, res) => {
  try {
    const file = await File.findOne({ shareLink: req.params.shareCode, isShared: true });

    if (!file) {
      return res.status(404).json({ message: 'Shared file not found or link has expired' });
    }

    res.json({
      _id: file._id,
      name: file.name,
      url: file.url,
      size: file.size,
      type: file.type,
      createdAt: file.createdAt,
    });
  } catch (error) {
    console.error('Get shared file error:', error.message);
    res.status(500).json({ message: 'Server error retrieving shared file' });
  }
});

module.exports = router;
