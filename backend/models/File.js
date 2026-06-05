const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    size: {
      type: Number, // in bytes
      required: true,
    },
    type: {
      type: String, // e.g. 'image/png', 'application/pdf'
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    shareLink: {
      type: String, // Random unique string for sharing
      default: null,
      index: { unique: true, sparse: true }, // Sparse unique index allows null duplicates
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
    isTrashed: {
      type: Boolean,
      default: false,
    },
    trashedAt: {
      type: Date,
      default: null,
    },
    originalName: {
      type: String,
    },
    versions: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        size: { type: Number, required: true },
        type: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('File', FileSchema);
