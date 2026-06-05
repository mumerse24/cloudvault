const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const File = require('../models/File');
const Folder = require('../models/Folder');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');
const { cloudinary, upload } = require('../config/cloudinary');
const { sendEmail } = require('../config/email');

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
      const user = await User.findById(req.user._id);

      // 1. Quota Check
      if (user.storageUsed + req.file.size > user.storageLimit) {
        // Cleanup Cloudinary file immediately
        try {
          await cloudinary.uploader.destroy(req.file.filename);
        } catch (destroyErr) {
          console.error('Failed to clean up Cloudinary file on quota failure:', destroyErr.message);
        }
        return res.status(400).json({ message: 'Storage quota exceeded. Please clear some files.' });
      }

      const parentId = parent && parent !== 'root' ? parent : null;
      const fileName = req.file.originalname;

      // 2. Versioning check: see if file with same name exists under same directory
      let existingFile = await File.findOne({
        name: fileName,
        parent: parentId,
        owner: user._id,
        isTrashed: false,
      });

      if (existingFile) {
        // Move current file details to versions array
        existingFile.versions.push({
          url: existingFile.url,
          publicId: existingFile.publicId,
          size: existingFile.size,
          type: existingFile.type,
          createdAt: existingFile.updatedAt || existingFile.createdAt,
        });

        // Update main file fields with the new upload
        existingFile.url = req.file.path;
        existingFile.publicId = req.file.filename;
        existingFile.size = req.file.size;
        existingFile.type = req.file.mimetype;
        await existingFile.save();

        // Add to user storage usage
        user.storageUsed += req.file.size;
        await user.save();

        // Log action
        await Activity.create({
          user: user._id,
          action: 'UPLOAD_VERSION',
          details: `Uploaded a new version of file: "${existingFile.name}"`,
        });

        return res.status(200).json(existingFile);
      } else {
        // Create new file document
        const newFile = await File.create({
          name: fileName,
          originalName: fileName,
          url: req.file.path,
          publicId: req.file.filename,
          size: req.file.size,
          type: req.file.mimetype,
          owner: user._id,
          parent: parentId,
        });

        // Add to user storage usage
        user.storageUsed += req.file.size;
        await user.save();

        // Log action
        await Activity.create({
          user: user._id,
          action: 'UPLOAD_FILE',
          details: `Uploaded file: "${newFile.name}"`,
        });

        return res.status(201).json(newFile);
      }
    } catch (dbError) {
      console.error('Save file metadata error:', dbError.message);
      
      // Cleanup Cloudinary file
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

    const oldName = file.name;
    file.name = name;
    await file.save();

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: 'RENAME_FILE',
      details: `Renamed file from "${oldName}" to "${name}"`,
    });

    res.json(file);
  } catch (error) {
    console.error('Rename file error:', error.message);
    res.status(500).json({ message: 'Server error renaming file' });
  }
});

// @desc    Star or unstar a file
// @route   POST /api/files/:fileId/star
// @access  Private
router.post('/:fileId/star', protect, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id });

    if (!file) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    file.isStarred = !file.isStarred;
    await file.save();

    await Activity.create({
      user: req.user._id,
      action: file.isStarred ? 'STAR_FILE' : 'UNSTAR_FILE',
      details: file.isStarred ? `Starred file "${file.name}"` : `Unstarred file "${file.name}"`,
    });

    res.json(file);
  } catch (error) {
    console.error('Star file error:', error.message);
    res.status(500).json({ message: 'Server error starring file' });
  }
});

// @desc    Restore a file from trash
// @route   POST /api/files/:fileId/restore
// @access  Private
router.post('/:fileId/restore', protect, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id });

    if (!file) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    file.isTrashed = false;
    file.trashedAt = null;
    await file.save();

    await Activity.create({
      user: req.user._id,
      action: 'RESTORE_FILE',
      details: `Restored file "${file.name}" from trash`,
    });

    res.json(file);
  } catch (error) {
    console.error('Restore file error:', error.message);
    res.status(500).json({ message: 'Server error restoring file' });
  }
});

// @desc    Move a file to another folder
// @route   POST /api/files/:fileId/move
// @access  Private
router.post('/:fileId/move', protect, async (req, res) => {
  const { parent } = req.body;

  try {
    const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id });

    if (!file) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    file.parent = parent && parent !== 'root' ? parent : null;
    await file.save();

    await Activity.create({
      user: req.user._id,
      action: 'MOVE_FILE',
      details: `Moved file "${file.name}"`,
    });

    res.json(file);
  } catch (error) {
    console.error('Move file error:', error.message);
    res.status(500).json({ message: 'Server error moving file' });
  }
});

// @desc    Delete a file (Move to trash, or delete permanently if already in trash)
// @route   DELETE /api/files/:fileId
// @access  Private
router.delete('/:fileId', protect, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id });

    if (!file) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    const user = await User.findById(req.user._id);

    // If not in trash, send to trash
    if (!file.isTrashed) {
      file.isTrashed = true;
      file.trashedAt = Date.now();
      await file.save();

      await Activity.create({
        user: req.user._id,
        action: 'TRASH_FILE',
        details: `Moved file "${file.name}" to trash`,
      });

      return res.json({ message: 'File moved to trash bin', file });
    }

    // If already in trash, delete permanently
    let storageDeleted = file.size;

    // Delete primary file from Cloudinary
    const resourceType = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/') || file.type.startsWith('audio/')
      ? 'video'
      : 'raw';

    try {
      await cloudinary.uploader.destroy(file.publicId, { resource_type: resourceType });
    } catch (cloudinaryError) {
      console.error(`Error deleting from Cloudinary (${file.publicId}):`, cloudinaryError.message);
    }

    // Delete all versions from Cloudinary
    for (const ver of file.versions) {
      storageDeleted += ver.size;
      const verResType = ver.type.startsWith('image/') ? 'image' : ver.type.startsWith('video/') ? 'video' : 'raw';
      try {
        await cloudinary.uploader.destroy(ver.publicId, { resource_type: verResType });
      } catch (err) {
        console.error(`Error deleting version from Cloudinary (${ver.publicId}):`, err.message);
      }
    }

    // Delete db record
    await file.deleteOne();

    // Update user quota
    user.storageUsed = Math.max(0, user.storageUsed - storageDeleted);
    await user.save();

    await Activity.create({
      user: req.user._id,
      action: 'DELETE_FILE_PERMANENTLY',
      details: `Permanently deleted file "${file.name}"`,
    });

    res.json({ message: 'File permanently deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error.message);
    res.status(500).json({ message: 'Server error deleting file' });
  }
});

// @desc    Perform bulk actions on files and folders
// @route   POST /api/files/bulk
// @access  Private
router.post('/bulk', protect, async (req, res) => {
  const { action, fileIds = [], folderIds = [], targetParentId } = req.body;
  const userId = req.user._id;

  try {
    const user = await User.findById(userId);

    if (action === 'star') {
      await File.updateMany({ _id: { $in: fileIds }, owner: userId }, { isStarred: true });
      await Folder.updateMany({ _id: { $in: folderIds }, owner: userId }, { isStarred: true });
      await Activity.create({
        user: userId,
        action: 'BULK_STAR',
        details: `Starred ${fileIds.length} files and ${folderIds.length} folders`,
      });
      return res.json({ message: 'Items starred' });
    }

    if (action === 'unstar') {
      await File.updateMany({ _id: { $in: fileIds }, owner: userId }, { isStarred: false });
      await Folder.updateMany({ _id: { $in: folderIds }, owner: userId }, { isStarred: false });
      await Activity.create({
        user: userId,
        action: 'BULK_UNSTAR',
        details: `Unstarred ${fileIds.length} files and ${folderIds.length} folders`,
      });
      return res.json({ message: 'Items unstarred' });
    }

    if (action === 'trash') {
      await File.updateMany({ _id: { $in: fileIds }, owner: userId }, { isTrashed: true, trashedAt: Date.now() });
      await Folder.updateMany({ _id: { $in: folderIds }, owner: userId }, { isTrashed: true, trashedAt: Date.now() });
      await Activity.create({
        user: userId,
        action: 'BULK_TRASH',
        details: `Moved ${fileIds.length} files and ${folderIds.length} folders to trash`,
      });
      return res.json({ message: 'Items moved to trash' });
    }

    if (action === 'restore') {
      await File.updateMany({ _id: { $in: fileIds }, owner: userId }, { isTrashed: false, trashedAt: null });
      await Folder.updateMany({ _id: { $in: folderIds }, owner: userId }, { isTrashed: false, trashedAt: null });
      await Activity.create({
        user: userId,
        action: 'BULK_RESTORE',
        details: `Restored ${fileIds.length} files and ${folderIds.length} folders`,
      });
      return res.json({ message: 'Items restored' });
    }

    if (action === 'move') {
      const newParent = targetParentId && targetParentId !== 'root' ? targetParentId : null;
      // Filter out moving folder into itself
      const validFolderIds = folderIds.filter(id => id !== targetParentId);

      await File.updateMany({ _id: { $in: fileIds }, owner: userId }, { parent: newParent });
      await Folder.updateMany({ _id: { $in: validFolderIds }, owner: userId }, { parent: newParent });

      await Activity.create({
        user: userId,
        action: 'BULK_MOVE',
        details: `Moved ${fileIds.length} files and ${validFolderIds.length} folders`,
      });
      return res.json({ message: 'Items moved successfully' });
    }

    if (action === 'delete') {
      let storageDeleted = 0;

      // 1. Permanently delete files
      const filesToDelete = await File.find({ _id: { $in: fileIds }, owner: userId });
      for (const file of filesToDelete) {
        storageDeleted += file.size;
        const resType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'raw';
        try {
          await cloudinary.uploader.destroy(file.publicId, { resource_type: resType });
        } catch (err) {}
        
        for (const v of file.versions) {
          storageDeleted += v.size;
          const vType = v.type.startsWith('image/') ? 'image' : v.type.startsWith('video/') ? 'video' : 'raw';
          try {
            await cloudinary.uploader.destroy(v.publicId, { resource_type: vType });
          } catch (err) {}
        }
        await file.deleteOne();
      }

      // 2. Permanently delete folders recursively
      const deleteFolderRecursive = async (fid) => {
        const files = await File.find({ owner: userId, parent: fid });
        for (const f of files) {
          storageDeleted += f.size;
          const resType = f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'raw';
          try { await cloudinary.uploader.destroy(f.publicId, { resource_type: resType }); } catch (err) {}
          
          for (const v of f.versions) {
            storageDeleted += v.size;
            const vType = v.type.startsWith('image/') ? 'image' : v.type.startsWith('video/') ? 'video' : 'raw';
            try { await cloudinary.uploader.destroy(v.publicId, { resource_type: vType }); } catch (err) {}
          }
          await f.deleteOne();
        }
        const subs = await Folder.find({ owner: userId, parent: fid });
        for (const sub of subs) {
          await deleteFolderRecursive(sub._id);
        }
        await Folder.deleteOne({ _id: fid, owner: userId });
      };

      for (const folderId of folderIds) {
        await deleteFolderRecursive(folderId);
      }

      // Update user storage
      user.storageUsed = Math.max(0, user.storageUsed - storageDeleted);
      await user.save();

      await Activity.create({
        user: userId,
        action: 'BULK_DELETE',
        details: `Permanently deleted ${fileIds.length} files and ${folderIds.length} folders`,
      });

      return res.json({ message: 'Items permanently deleted' });
    }

    res.status(400).json({ message: 'Invalid bulk action' });
  } catch (error) {
    console.error('Bulk action error:', error.message);
    res.status(500).json({ message: 'Server error during bulk operation' });
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

    if (!file.shareLink) {
      file.shareLink = crypto.randomBytes(16).toString('hex');
    }
    file.isShared = true;
    await file.save();

    await Activity.create({
      user: req.user._id,
      action: 'SHARE_FILE',
      details: `Enabled public sharing for: "${file.name}"`,
    });

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

    await Activity.create({
      user: req.user._id,
      action: 'UNSHARE_FILE',
      details: `Disabled public sharing for: "${file.name}"`,
    });

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
    const file = await File.findOne({ shareLink: req.params.shareCode, isShared: true }).populate('owner', 'email name');

    if (!file) {
      return res.status(404).json({ message: 'Shared file not found or link has expired' });
    }

    // 1. Log activity for the owner
    await Activity.create({
      user: file.owner._id,
      action: 'VIEW_SHARED_FILE',
      details: `Shared file "${file.name}" was viewed/accessed.`,
    });

    // 2. Send email notification to the file owner
    await sendEmail({
      to: file.owner.email,
      subject: `🔓 Shared File Viewed: ${file.name}`,
      text: `Hello ${file.owner.name},\n\nSomeone recently accessed your shared file "${file.name}".\n\nTimestamp: ${new Date().toLocaleString()}\n\nBest regards,\nCloudVault Team`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; background-color: #f9f9f9;">
          <h2 style="color: #4f46e5;">Shared File Accessed</h2>
          <p>Hello <strong>${file.owner.name}</strong>,</p>
          <p>Your shared file <strong>${file.name}</strong> was viewed or downloaded.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 13px; color: #666;">
            <strong>Accessed Date:</strong> ${new Date().toLocaleString()}<br/>
            <strong>File Size:</strong> ${(file.size / (1024 * 1024)).toFixed(2)} MB
          </p>
          <p>Best regards,<br/>The CloudVault Team</p>
        </div>
      `,
    });

    // 3. Socket event emission will be handled in server.js by hooking into this route,
    // or by emitting directly via a global io object. We will setup global.io in server.js!
    if (global.io) {
      global.io.to(file.owner._id.toString()).emit('notification', {
        message: `Your file "${file.name}" was viewed just now!`,
        timestamp: new Date(),
      });
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
