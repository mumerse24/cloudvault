const express = require('express');
const router = express.Router();
const Folder = require('../models/Folder');
const File = require('../models/File');
const { protect } = require('../middleware/auth');
const { cloudinary } = require('../config/cloudinary');

// Helper for recursive deletion of folder contents (db + Cloudinary)
const deleteFolderRecursive = async (folderId, userId) => {
  // 1. Find and delete all files in this folder
  const files = await File.find({ owner: userId, parent: folderId });
  for (const file of files) {
    const resourceType = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/') || file.type.startsWith('audio/')
      ? 'video'
      : 'raw';

    try {
      await cloudinary.uploader.destroy(file.publicId, { resource_type: resourceType });
    } catch (err) {
      console.error(`Error deleting file ${file.name} (${file.publicId}) from Cloudinary:`, err.message);
    }
    await file.deleteOne();
  }

  // 2. Find and delete subfolders recursively
  const subfolders = await Folder.find({ owner: userId, parent: folderId });
  for (const subfolder of subfolders) {
    await deleteFolderRecursive(subfolder._id, userId);
  }

  // 3. Delete the folder document itself
  await Folder.deleteOne({ _id: folderId, owner: userId });
};

// @desc    Create a new folder
// @route   POST /api/folders
// @access  Private
router.post('/', protect, async (req, res) => {
  const { name, parent } = req.body;

  try {
    if (!name) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    const folder = await Folder.create({
      name,
      owner: req.user._id,
      parent: parent || null,
    });

    res.status(201).json(folder);
  } catch (error) {
    console.error('Create folder error:', error.message);
    res.status(500).json({ message: 'Server error creating folder' });
  }
});

// @desc    Get subfolders under a specific parent folder ('root' or Folder ID)
// @route   GET /api/folders/:folderId/subfolders
// @access  Private
router.get('/:folderId/subfolders', protect, async (req, res) => {
  try {
    const parentId = req.params.folderId === 'root' ? null : req.params.folderId;

    const subfolders = await Folder.find({
      owner: req.user._id,
      parent: parentId,
    }).sort({ createdAt: -1 });

    res.json(subfolders);
  } catch (error) {
    console.error('Get subfolders error:', error.message);
    res.status(500).json({ message: 'Server error fetching subfolders' });
  }
});

// @desc    Get files under a specific parent folder ('root' or Folder ID)
// @route   GET /api/folders/:folderId/files
// @access  Private
router.get('/:folderId/files', protect, async (req, res) => {
  try {
    const parentId = req.params.folderId === 'root' ? null : req.params.folderId;

    const files = await File.find({
      owner: req.user._id,
      parent: parentId,
    }).sort({ createdAt: -1 });

    res.json(files);
  } catch (error) {
    console.error('Get files error:', error.message);
    res.status(500).json({ message: 'Server error fetching files' });
  }
});

// @desc    Rename a folder
// @route   PATCH /api/folders/:folderId
// @access  Private
router.patch('/:folderId', protect, async (req, res) => {
  const { name } = req.body;

  try {
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    const folder = await Folder.findOne({ _id: req.params.folderId, owner: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or unauthorized' });
    }

    folder.name = name;
    await folder.save();

    res.json(folder);
  } catch (error) {
    console.error('Rename folder error:', error.message);
    res.status(500).json({ message: 'Server error renaming folder' });
  }
});

// @desc    Delete a folder recursively (deletes all contents inside it)
// @route   DELETE /api/folders/:folderId
// @access  Private
router.delete('/:folderId', protect, async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.folderId, owner: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or unauthorized' });
    }

    // Call recursive deletion helper
    await deleteFolderRecursive(folder._id, req.user._id);

    res.json({ message: 'Folder and all contents deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error.message);
    res.status(500).json({ message: 'Server error deleting folder' });
  }
});

module.exports = router;
