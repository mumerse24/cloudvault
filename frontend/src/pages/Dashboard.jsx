import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import {
  FolderPlus,
  Upload,
  Folder,
  FileText,
  Image,
  Film,
  MoreVertical,
  Trash2,
  Pencil,
  Share2,
  Link2,
  ChevronRight,
  Home,
  X,
  CloudOff,
  Copy,
  Check,
} from 'lucide-react';

const Dashboard = () => {
  const { api } = useAuth();

  // State
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]); // [{ _id, name }, ...]
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRename, setShowRename] = useState(null); // { type: 'file'|'folder', item }
  const [renameValue, setRenameValue] = useState('');
  const [showShare, setShowShare] = useState(null); // file object
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Dropdown
  const [openDropdown, setOpenDropdown] = useState(null);

  const currentFolderId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1]._id : null;
  const folderParam = currentFolderId || 'root';

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [subRes, fileRes] = await Promise.all([
        api.get(`/folders/${folderParam}/subfolders`),
        api.get(`/folders/${folderParam}/files`),
      ]);
      setFolders(subRes.data);
      setFiles(fileRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load contents');
    } finally {
      setLoading(false);
    }
  }, [api, folderParam]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // --- Navigation ---
  const openFolder = (folder) => {
    setBreadcrumb((prev) => [...prev, { _id: folder._id, name: folder.name }]);
  };

  const goToRoot = () => setBreadcrumb([]);
  const goToBreadcrumb = (index) => setBreadcrumb((prev) => prev.slice(0, index + 1));

  // --- Create Folder ---
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/folders', { name: newFolderName, parent: currentFolderId || null });
      setNewFolderName('');
      setShowNewFolder(false);
      fetchContent();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create folder');
    }
  };

  // --- Upload ---
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('parent', currentFolderId || 'root');
      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchContent();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = ''; // reset file input
    }
  };

  // --- Delete ---
  const handleDeleteFolder = async (folderId) => {
    try {
      await api.delete(`/folders/${folderId}`);
      setOpenDropdown(null);
      fetchContent();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete folder');
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await api.delete(`/files/${fileId}`);
      setOpenDropdown(null);
      fetchContent();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete file');
    }
  };

  // --- Rename ---
  const openRenameModal = (type, item) => {
    setShowRename({ type, item });
    setRenameValue(item.name);
    setOpenDropdown(null);
  };

  const handleRename = async () => {
    if (!renameValue.trim() || !showRename) return;
    const { type, item } = showRename;
    try {
      if (type === 'folder') {
        await api.patch(`/folders/${item._id}`, { name: renameValue });
      } else {
        await api.patch(`/files/${item._id}`, { name: renameValue });
      }
      setShowRename(null);
      setRenameValue('');
      fetchContent();
    } catch (err) {
      setError(err.response?.data?.message || 'Rename failed');
    }
  };

  // --- Share ---
  const handleShare = async (file) => {
    setOpenDropdown(null);
    try {
      const { data } = await api.post(`/files/${file._id}/share`);
      const link = `${window.location.origin}/share/${data.shareLink}`;
      setShareLink(link);
      setShowShare(file);
      setCopied(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to share file');
    }
  };

  const handleUnshare = async (fileId) => {
    try {
      await api.post(`/files/${fileId}/unshare`);
      setShowShare(null);
      fetchContent();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unshare file');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Helpers ---
  const getFileIcon = (type) => {
    if (!type) return <FileText size={24} />;
    if (type.startsWith('image/')) return <Image size={24} />;
    if (type.startsWith('video/')) return <Film size={24} />;
    return <FileText size={24} />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="dashboard-layout">
      <Navbar />
      <main className="dashboard-main">
        {error && (
          <div className="alert alert-danger">
            {error}
            <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Top bar: breadcrumb + actions */}
        <div className="dashboard-actions-bar">
          <div className="breadcrumb-container">
            <span className="breadcrumb-item" onClick={goToRoot}>
              <Home size={18} /> My Drive
            </span>
            {breadcrumb.map((b, i) => (
              <React.Fragment key={b._id}>
                <ChevronRight size={16} className="breadcrumb-separator" />
                <span
                  className={i === breadcrumb.length - 1 ? 'breadcrumb-active' : 'breadcrumb-item'}
                  onClick={() => goToBreadcrumb(i)}
                >
                  {b.name}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div className="action-buttons">
            <button className="btn btn-secondary" onClick={() => setShowNewFolder(true)}>
              <FolderPlus size={18} /> New Folder
            </button>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <Upload size={18} /> Upload File
              <input type="file" style={{ display: 'none' }} onChange={handleUpload} />
            </label>
          </div>
        </div>

        {uploading && (
          <div className="uploading-overlay">
            <div className="spinner" />
            Uploading...
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <p>Loading your vault...</p>
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="empty-state">
            <CloudOff size={56} className="empty-state-icon" />
            <h3>This folder is empty</h3>
            <p>Upload files or create a folder to get started.</p>
          </div>
        ) : (
          <>
            {/* Folders */}
            {folders.length > 0 && (
              <>
                <h2 className="section-title"><Folder size={20} /> Folders</h2>
                <div className="grid-folders">
                  {folders.map((folder) => (
                    <div className="vault-card" key={folder._id}>
                      <div className="card-header">
                        <div className="card-icon folder-icon-wrapper" onClick={() => openFolder(folder)}>
                          <Folder size={24} />
                        </div>
                        <div className="dropdown-container">
                          <button className="dropdown-trigger" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === folder._id ? null : folder._id); }}>
                            <MoreVertical size={18} />
                          </button>
                          {openDropdown === folder._id && (
                            <div className="dropdown-menu">
                              <button className="dropdown-item" onClick={() => openRenameModal('folder', folder)}>
                                <Pencil size={14} /> Rename
                              </button>
                              <button className="dropdown-item delete" onClick={() => handleDeleteFolder(folder._id)}>
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="card-title" onClick={() => openFolder(folder)}>{folder.name}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Files */}
            {files.length > 0 && (
              <>
                <h2 className="section-title"><FileText size={20} /> Files</h2>
                <div className="grid-files">
                  {files.map((file) => (
                    <div className="vault-card" key={file._id}>
                      <div className="card-header">
                        <div className="card-icon file-icon-wrapper">
                          {getFileIcon(file.type)}
                        </div>
                        <div className="dropdown-container">
                          <button className="dropdown-trigger" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === file._id ? null : file._id); }}>
                            <MoreVertical size={18} />
                          </button>
                          {openDropdown === file._id && (
                            <div className="dropdown-menu">
                              <button className="dropdown-item" onClick={() => openRenameModal('file', file)}>
                                <Pencil size={14} /> Rename
                              </button>
                              <button className="dropdown-item" onClick={() => handleShare(file)}>
                                <Share2 size={14} /> Share
                              </button>
                              <a className="dropdown-item" href={file.url} target="_blank" rel="noopener noreferrer">
                                <Link2 size={14} /> Open
                              </a>
                              <button className="dropdown-item delete" onClick={() => handleDeleteFile(file._id)}>
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Preview for images */}
                      {file.type && file.type.startsWith('image/') && (
                        <div className="file-preview-container">
                          <img className="file-preview-image" src={file.url} alt={file.name} />
                        </div>
                      )}
                      <div className="card-title">{file.name}</div>
                      <div className="card-meta">
                        <span>{formatSize(file.size)}</span>
                        {file.isShared && <span className="badge-shared">Shared</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* --- New Folder Modal --- */}
      {showNewFolder && (
        <div className="modal-overlay" onClick={() => setShowNewFolder(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Create New Folder</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="folder-name-input">Folder Name</label>
              <input
                id="folder-name-input"
                className="form-input"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="My Folder"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowNewFolder(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateFolder}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Rename Modal --- */}
      {showRename && (
        <div className="modal-overlay" onClick={() => setShowRename(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename {showRename.type === 'folder' ? 'Folder' : 'File'}</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="rename-input">New Name</label>
              <input
                id="rename-input"
                className="form-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRename(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRename}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Share Modal --- */}
      {showShare && (
        <div className="modal-overlay" onClick={() => setShowShare(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Share "{showShare.name}"</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Anyone with this link can view and download the file.
            </p>
            <div className="share-link-box">
              <input className="share-link-input" value={shareLink} readOnly />
              <button className="btn btn-primary" onClick={copyLink}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={() => handleUnshare(showShare._id)}>
                Disable Sharing
              </button>
              <button className="btn btn-secondary" onClick={() => setShowShare(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
