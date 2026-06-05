const express = require('express');
const router = express.Router();
const Folder = require('../models/Folder');
const File = require('../models/File');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');
const { cloudinary } = require('../config/cloudinary');

// Helper for recursive deletion of folder contents (db + Cloudinary)
const deleteFolderRecursivePermanent = async (folderId, userId) => {
  let storageFreed = 0;

  // 1. Find and delete all files in this folder permanently
  const files = await File.find({ owner: userId, parent: folderId });
  for (const file of files) {
    storageFreed += file.size;
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

    // Delete versions
    for (const ver of file.versions) {
      storageFreed += ver.size;
      const verResType = ver.type.startsWith('image/') ? 'image' : ver.type.startsWith('video/') ? 'video' : 'raw';
      try {
        await cloudinary.uploader.destroy(ver.publicId, { resource_type: verResType });
      } catch (err) {}
    }

    await file.deleteOne();
  }

  // 2. Find and delete subfolders recursively
  const subfolders = await Folder.find({ owner: userId, parent: folderId });
  for (const subfolder of subfolders) {
    storageFreed += await deleteFolderRecursivePermanent(subfolder._id, userId);
  }

  // 3. Delete the folder document itself
  await Folder.deleteOne({ _id: folderId, owner: userId });

  return storageFreed;
};

// Helper for recursive trashing of folder contents
const trashFolderRecursive = async (folderId, userId, trashState = true) => {
  const trashedAtValue = trashState ? Date.now() : null;

  // Trash all files directly in this folder
  await File.updateMany(
    { owner: userId, parent: folderId },
    { isTrashed: trashState, trashedAt: trashedAtValue }
  );

  // Find subfolders and trash them recursively
  const subfolders = await Folder.find({ owner: userId, parent: folderId });
  for (const subfolder of subfolders) {
    subfolder.isTrashed = trashState;
    subfolder.trashedAt = trashedAtValue;
    await subfolder.save();
    await trashFolderRecursive(subfolder._id, userId, trashState);
  }
};

// @desc    Get all starred files and folders
// @route   GET /api/folders/starred
// @access  Private
router.get('/starred', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const starredFolders = await Folder.find({ owner: userId, isStarred: true, isTrashed: false });
    const starredFiles = await File.find({ owner: userId, isStarred: true, isTrashed: false });

    res.json({
      folders: starredFolders,
      files: starredFiles,
    });
  } catch (error) {
    console.error('Get starred error:', error.message);
    res.status(500).json({ message: 'Server error fetching starred items' });
  }
});

// @desc    Get all trashed files and folders (Recycle Bin)
// @route   GET /api/folders/trash
// @access  Private
router.get('/trash', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    // We only fetch top-level trashed items (items whose parent is not also trashed, or just all of them to make restore easy)
    const trashedFolders = await Folder.find({ owner: userId, isTrashed: true }).sort({ trashedAt: -1 });
    const trashedFiles = await File.find({ owner: userId, isTrashed: true }).sort({ trashedAt: -1 });

    res.json({
      folders: trashedFolders,
      files: trashedFiles,
    });
  } catch (error) {
    console.error('Get trash error:', error.message);
    res.status(500).json({ message: 'Server error fetching trash items' });
  }
});

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

    await Activity.create({
      user: req.user._id,
      action: 'CREATE_FOLDER',
      details: `Created folder: "${name}"`,
    });

    res.status(201).json(folder);
  } catch (error) {
    console.error('Create folder error:', error.message);
    res.status(500).json({ message: 'Server error creating folder' });
  }
});

// @desc    Get all folders flat list (useful for move picker)
// @route   GET /api/folders
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const folders = await Folder.find({
      owner: req.user._id,
      isTrashed: false,
    }).sort({ name: 1 });
    res.json(folders);
  } catch (error) {
    console.error('Get all folders error:', error.message);
    res.status(500).json({ message: 'Server error fetching all folders' });
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
      isTrashed: false,
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
      isTrashed: false,
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

    const oldName = folder.name;
    folder.name = name;
    await folder.save();

    await Activity.create({
      user: req.user._id,
      action: 'RENAME_FOLDER',
      details: `Renamed folder from "${oldName}" to "${name}"`,
    });

    res.json(folder);
  } catch (error) {
    console.error('Rename folder error:', error.message);
    res.status(500).json({ message: 'Server error renaming folder' });
  }
});

// @desc    Star or unstar a folder
// @route   POST /api/folders/:folderId/star
// @access  Private
router.post('/:folderId/star', protect, async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.folderId, owner: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or unauthorized' });
    }

    folder.isStarred = !folder.isStarred;
    await folder.save();

    await Activity.create({
      user: req.user._id,
      action: folder.isStarred ? 'STAR_FOLDER' : 'UNSTAR_FOLDER',
      details: folder.isStarred ? `Starred folder "${folder.name}"` : `Unstarred folder "${folder.name}"`,
    });

    res.json(folder);
  } catch (error) {
    console.error('Star folder error:', error.message);
    res.status(500).json({ message: 'Server error starring folder' });
  }
});

// @desc    Restore a folder from trash
// @route   POST /api/folders/:folderId/restore
// @access  Private
router.post('/:folderId/restore', protect, async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.folderId, owner: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or unauthorized' });
    }

    folder.isTrashed = false;
    folder.trashedAt = null;
    await folder.save();

    // Restore contents recursively
    await trashFolderRecursive(folder._id, req.user._id, false);

    await Activity.create({
      user: req.user._id,
      action: 'RESTORE_FOLDER',
      details: `Restored folder "${folder.name}" from trash`,
    });

    res.json(folder);
  } catch (error) {
    console.error('Restore folder error:', error.message);
    res.status(500).json({ message: 'Server error restoring folder' });
  }
});

// @desc    Move a folder to another folder
// @route   POST /api/folders/:folderId/move
// @access  Private
router.post('/:folderId/move', protect, async (req, res) => {
  const { parent } = req.body;

  try {
    // Prevent moving a folder inside itself
    if (parent === req.params.folderId) {
      return res.status(400).json({ message: 'Cannot move folder inside itself' });
    }

    const folder = await Folder.findOne({ _id: req.params.folderId, owner: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or unauthorized' });
    }

    folder.parent = parent && parent !== 'root' ? parent : null;
    await folder.save();

    await Activity.create({
      user: req.user._id,
      action: 'MOVE_FOLDER',
      details: `Moved folder "${folder.name}"`,
    });

    res.json(folder);
  } catch (error) {
    console.error('Move folder error:', error.message);
    res.status(500).json({ message: 'Server error moving folder' });
  }
});

// @desc    Delete a folder (Move to trash, or delete permanently if already in trash)
// @route   DELETE /api/folders/:folderId
// @access  Private
router.delete('/:folderId', protect, async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.folderId, owner: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or unauthorized' });
    }

    const user = await User.findById(req.user._id);

    // If not trashed, move to trash recursively
    if (!folder.isTrashed) {
      folder.isTrashed = true;
      folder.trashedAt = Date.now();
      await folder.save();

      // Trash contents recursively
      await trashFolderRecursive(folder._id, req.user._id, true);

      await Activity.create({
        user: req.user._id,
        action: 'TRASH_FOLDER',
        details: `Moved folder "${folder.name}" and its contents to trash`,
      });

      return res.json({ message: 'Folder moved to trash bin', folder });
    }

    // If already in trash, delete permanently from Cloudinary & DB
    const storageFreed = await deleteFolderRecursivePermanent(folder._id, req.user._id);

    // Update user quota
    user.storageUsed = Math.max(0, user.storageUsed - storageFreed);
    await user.save();

    await Activity.create({
      user: req.user._id,
      action: 'DELETE_FOLDER_PERMANENTLY',
      details: `Permanently deleted folder "${folder.name}" and all its contents`,
    });

    res.json({ message: 'Folder and all contents permanently deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error.message);
    res.status(500).json({ message: 'Server error deleting folder' });
  }
});

module.exports = router;
