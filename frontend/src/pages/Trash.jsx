import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import {
  Folder,
  FileText,
  Trash2,
  Undo2,
  MoreVertical,
  CloudOff,
  Image as ImageIcon,
  Film,
  HardDrive,
} from 'lucide-react';

const Trash = () => {
  const { api } = useAuth();
  const toast = useToast();

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/folders/trash');
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (err) {
      toast.error('Failed to load trash contents');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  // --- Restore ---
  const handleRestoreFolder = async (folderId) => {
    try {
      await api.post(`/folders/${folderId}/restore`);
      toast.success('Folder and contents restored');
      fetchTrash();
    } catch (err) {
      toast.error('Failed to restore folder');
    }
  };

  const handleRestoreFile = async (fileId) => {
    try {
      await api.post(`/files/${fileId}/restore`);
      toast.success('File restored successfully');
      fetchTrash();
    } catch (err) {
      toast.error('Failed to restore file');
    }
  };

  // --- Delete Permanently ---
  const handleDeleteFolderPerm = async (folderId) => {
    if (!window.confirm('Are you sure you want to permanently delete this folder and all its contents? This action cannot be undone.')) return;
    try {
      await api.delete(`/folders/${folderId}`);
      toast.success('Folder deleted permanently');
      fetchTrash();
    } catch (err) {
      toast.error('Failed to delete folder');
    }
  };

  const handleDeleteFilePerm = async (fileId) => {
    if (!window.confirm('Are you sure you want to permanently delete this file? This action cannot be undone.')) return;
    try {
      await api.delete(`/files/${fileId}`);
      toast.success('File deleted permanently');
      fetchTrash();
    } catch (err) {
      toast.error('Failed to delete file');
    }
  };

  // --- Empty Trash ---
  const handleEmptyTrash = async () => {
    if (!window.confirm('Are you sure you want to permanently delete all items in the Recycle Bin? This action cannot be undone.')) return;
    try {
      const fileIds = files.map(f => f._id);
      const folderIds = folders.map(f => f._id);
      await api.post('/files/bulk', {
        action: 'delete',
        fileIds,
        folderIds,
      });
      toast.success('Trash emptied successfully');
      fetchTrash();
    } catch (err) {
      toast.error('Failed to empty trash');
    }
  };

  const getFileIcon = (type) => {
    if (!type) return <FileText size={22} />;
    if (type.startsWith('image/')) return <ImageIcon size={22} />;
    if (type.startsWith('video/')) return <Film size={22} />;
    return <FileText size={22} />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const hasItems = folders.length > 0 || files.length > 0;

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <main className="dashboard-workspace">
        <div className="toolbar-container" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="breadcrumb-nav">
            <span className="breadcrumb-nav-active">
              <Trash2 size={18} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> Recycle Bin
            </span>
          </div>
          {hasItems && (
            <button className="btn btn-danger" onClick={handleEmptyTrash}>
              <Trash2 size={16} /> Empty Trash
            </button>
          )}
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <p>Loading trashed items...</p>
          </div>
        ) : !hasItems ? (
          <div className="empty-state">
            <Trash2 size={56} className="empty-state-icon" style={{ color: 'var(--text-muted)' }} />
            <h3>Your Recycle Bin is empty</h3>
            <p>Deleted files or folders will appear here for you to restore or delete permanently.</p>
          </div>
        ) : (
          <>
            {/* Trashed Folders */}
            {folders.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h2 className="section-title"><Folder size={20} /> Trashed Folders</h2>
                <div className="grid-folders">
                  {folders.map((folder) => (
                    <div className="vault-card" key={folder._id}>
                      <div className="card-header">
                        <div className="card-icon folder-icon-wrapper" style={{ opacity: 0.6 }}>
                          <Folder size={22} />
                        </div>
                        <div className="dropdown-container">
                          <button className="dropdown-trigger" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === folder._id ? null : folder._id); }}>
                            <MoreVertical size={18} />
                          </button>
                          {openDropdown === folder._id && (
                            <div className="dropdown-menu">
                              <button className="dropdown-item" onClick={() => handleRestoreFolder(folder._id)}>
                                <Undo2 size={14} /> Restore
                              </button>
                              <button className="dropdown-item delete" onClick={() => handleDeleteFolderPerm(folder._id)}>
                                <Trash2 size={14} /> Delete Permanently
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="card-title" style={{ opacity: 0.7 }}>{folder.name}</div>
                      {folder.trashedAt && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          Deleted: {new Date(folder.trashedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trashed Files */}
            {files.length > 0 && (
              <div>
                <h2 className="section-title"><FileText size={20} /> Trashed Files</h2>
                <div className="grid-files">
                  {files.map((file) => (
                    <div className="vault-card" key={file._id}>
                      <div className="card-header">
                        <div className="card-icon file-icon-wrapper" style={{ opacity: 0.6 }}>
                          {getFileIcon(file.type)}
                        </div>
                        <div className="dropdown-container">
                          <button className="dropdown-trigger" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === file._id ? null : file._id); }}>
                            <MoreVertical size={18} />
                          </button>
                          {openDropdown === file._id && (
                            <div className="dropdown-menu">
                              <button className="dropdown-item" onClick={() => handleRestoreFile(file._id)}>
                                <Undo2 size={14} /> Restore
                              </button>
                              <button className="dropdown-item delete" onClick={() => handleDeleteFilePerm(file._id)}>
                                <Trash2 size={14} /> Delete Permanently
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {file.type && file.type.startsWith('image/') && (
                        <div className="file-preview-container" style={{ opacity: 0.5 }}>
                          <img className="file-preview-image" src={file.url} alt={file.name} />
                        </div>
                      )}
                      <div className="card-title" style={{ opacity: 0.7 }}>{file.name}</div>
                      <div className="card-meta">
                        <span>{formatSize(file.size)}</span>
                        {file.trashedAt && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Deleted: {new Date(file.trashedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Trash;
