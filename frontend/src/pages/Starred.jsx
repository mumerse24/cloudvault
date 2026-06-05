import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import {
  Folder,
  FileText,
  Star,
  Trash2,
  ChevronRight,
  Home,
  CloudOff,
  Image as ImageIcon,
  Film,
  MoreVertical,
  Pencil,
  Move,
  Share2,
  Link2,
} from 'lucide-react';

const Starred = () => {
  const { api } = useAuth();
  const toast = useToast();

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);

  const fetchStarred = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/folders/starred');
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (err) {
      toast.error('Failed to load starred items');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchStarred();
  }, [fetchStarred]);

  const handleUnstarFolder = async (folderId) => {
    try {
      await api.post(`/folders/${folderId}/star`);
      toast.success('Folder removed from Starred');
      fetchStarred();
    } catch (err) {
      toast.error('Failed to unstar folder');
    }
  };

  const handleUnstarFile = async (fileId) => {
    try {
      await api.post(`/files/${fileId}/star`);
      toast.success('File removed from Starred');
      fetchStarred();
    } catch (err) {
      toast.error('Failed to unstar file');
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

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <main className="dashboard-workspace">
        <div className="toolbar-container">
          <div className="breadcrumb-nav">
            <span className="breadcrumb-nav-active">
              <Star size={18} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> Starred Items
            </span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <p>Loading your starred items...</p>
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="empty-state">
            <Star size={56} className="empty-state-icon" style={{ color: 'var(--text-muted)' }} />
            <h3>No starred items</h3>
            <p>Star important files or folders to access them quickly here.</p>
          </div>
        ) : (
          <>
            {/* Starred Folders */}
            {folders.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h2 className="section-title"><Folder size={20} /> Starred Folders</h2>
                <div className="grid-folders">
                  {folders.map((folder) => (
                    <div className="vault-card" key={folder._id}>
                      <div className="card-star-indicator">
                        <Star size={16} fill="currentColor" />
                      </div>
                      <div className="card-header">
                        <div className="card-icon folder-icon-wrapper">
                          <Folder size={22} />
                        </div>
                        <div className="dropdown-container">
                          <button className="dropdown-trigger" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === folder._id ? null : folder._id); }}>
                            <MoreVertical size={18} />
                          </button>
                          {openDropdown === folder._id && (
                            <div className="dropdown-menu">
                              <button className="dropdown-item" onClick={() => handleUnstarFolder(folder._id)}>
                                <Star size={14} /> Remove Star
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="card-title">{folder.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Starred Files */}
            {files.length > 0 && (
              <div>
                <h2 className="section-title"><FileText size={20} /> Starred Files</h2>
                <div className="grid-files">
                  {files.map((file) => (
                    <div className="vault-card" key={file._id}>
                      <div className="card-star-indicator">
                        <Star size={16} fill="currentColor" />
                      </div>
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
                              <button className="dropdown-item" onClick={() => handleUnstarFile(file._id)}>
                                <Star size={14} /> Remove Star
                              </button>
                              <a className="dropdown-item" href={file.url} download={file.name} target="_blank" rel="noopener noreferrer">
                                <Link2 size={14} /> Download
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      {file.type && file.type.startsWith('image/') && (
                        <div className="file-preview-container">
                          <img className="file-preview-image" src={file.url} alt={file.name} />
                        </div>
                      )}
                      <div className="card-title">{file.name}</div>
                      <div className="card-meta">
                        <span>{formatSize(file.size)}</span>
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

export default Starred;
