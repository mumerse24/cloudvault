import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import io from 'socket.io-client';
import {
  FolderPlus,
  Upload,
  Folder,
  FileText,
  Image as ImageIcon,
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
  Star,
  Eye,
  ArrowUpDown,
  Move,
  CornerDownRight,
  Clock,
  HardDrive,
} from 'lucide-react';

const Dashboard = () => {
  const { api, user, refreshUserContext } = useAuth();
  const toast = useToast();

  // State
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]); // [{ _id, name }, ...]
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Real-time Search, Sort & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'name' | 'size' | 'date'
  const [filterBy, setFilterBy] = useState('all'); // 'all' | 'image' | 'pdf' | 'video' | 'doc'

  // Selection & Bulk actions
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Drag and drop
  const [dragActive, setDragActive] = useState(false);

  // Modals
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRename, setShowRename] = useState(null); // { type: 'file'|'folder', item }
  const [renameValue, setRenameValue] = useState('');
  const [showShare, setShowShare] = useState(null); // file object
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  
  // New Modals: Preview and Move
  const [previewFile, setPreviewFile] = useState(null); // file object
  const [moveTarget, setMoveTarget] = useState(null); // { type: 'file'|'folder'|'bulk', items: [...] }
  const [allFoldersList, setAllFoldersList] = useState([]); // flat list for move select
  const [selectedDestFolder, setSelectedDestFolder] = useState(''); // folder ID

  // Dropdown
  const [openDropdown, setOpenDropdown] = useState(null);

  // Notifications Count
  const [notificationsCount, setNotificationsCount] = useState(0);

  const currentFolderId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1]._id : null;
  const folderParam = currentFolderId || 'root';

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, fileRes] = await Promise.all([
        api.get(`/folders/${folderParam}/subfolders`),
        api.get(`/folders/${folderParam}/files`),
      ]);
      setFolders(subRes.data);
      setFiles(fileRes.data);
      refreshUserContext(); // Sync sidebar storage
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load contents');
    } finally {
      setLoading(false);
    }
  }, [api, folderParam]);

  useEffect(() => {
    fetchContent();
    // Reset selection on folder change
    setSelectedFiles([]);
    setSelectedFolders([]);
  }, [fetchContent]);

  // --- Socket.io for Real-time Access Notifications ---
  useEffect(() => {
    if (!user) return;
    // Connect to WebSocket server (defaults to local host if dev, or deployment URL)
    const socket = io(window.location.origin);
    
    socket.emit('join', user._id);
    
    socket.on('notification', (data) => {
      toast.info(data.message);
      setNotificationsCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  // --- Image Compressor Helper (Canvas API) ---
  const compressImage = (file) => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(file); // Only compress images
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Downscale high resolution photos
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            0.75 // 75% quality compression
          );
        };
      };
    });
  };

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
      toast.success('Folder created successfully');
      fetchContent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create folder');
    }
  };

  // --- Upload core logic ---
  const uploadSingleFile = async (rawFile) => {
    setUploading(true);
    try {
      // Image compression check
      const file = rawFile.type.startsWith('image/') ? await compressImage(rawFile) : rawFile;
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('parent', currentFolderId || 'root');
      
      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Uploaded: "${file.name}"`);
      fetchContent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadInput = (e) => {
    const file = e.target.files[0];
    if (file) uploadSingleFile(file);
    e.target.value = '';
  };

  // --- Drag & Drop Upload Handlers ---
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadSingleFile(e.dataTransfer.files[0]);
    }
  };

  // --- Single Items Actions ---
  const handleStarFolder = async (folderId) => {
    try {
      await api.post(`/folders/${folderId}/star`);
      fetchContent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleStarFile = async (fileId) => {
    try {
      await api.post(`/files/${fileId}/star`);
      fetchContent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDeleteFolder = async (folderId) => {
    try {
      await api.delete(`/folders/${folderId}`);
      setOpenDropdown(null);
      toast.success('Folder moved to trash bin');
      fetchContent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete folder');
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await api.delete(`/files/${fileId}`);
      setOpenDropdown(null);
      toast.success('File moved to trash bin');
      fetchContent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete file');
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
      toast.success('Renamed successfully');
      fetchContent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rename failed');
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
      toast.error(err.response?.data?.message || 'Failed to share file');
    }
  };

  const handleUnshare = async (fileId) => {
    try {
      await api.post(`/files/${fileId}/unshare`);
      setShowShare(null);
      toast.success('Sharing disabled');
      fetchContent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unshare file');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success('Copied share link to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Move Dialog logic ---
  const openMoveDialog = async (type, item) => {
    setOpenDropdown(null);
    setMoveTarget({ type, items: [item] });
    setSelectedDestFolder('');
    try {
      const { data } = await api.get('/folders');
      // Remove self from destination selection if moving a folder
      const filtered = type === 'folder' ? data.filter(f => f._id !== item._id) : data;
      setAllFoldersList(filtered);
    } catch (err) {
      toast.error('Failed to retrieve directories');
    }
  };

  const handleMoveItem = async () => {
    if (!moveTarget) return;
    const isRoot = selectedDestFolder === 'root' || selectedDestFolder === '';
    const destId = isRoot ? 'root' : selectedDestFolder;
    const { type, items } = moveTarget;

    try {
      if (type === 'bulk') {
        await api.post('/files/bulk', {
          action: 'move',
          fileIds: selectedFiles,
          folderIds: selectedFolders,
          targetParentId: destId,
        });
        setSelectedFiles([]);
        setSelectedFolders([]);
      } else {
        const item = items[0];
        if (type === 'folder') {
          await api.post(`/folders/${item._id}/move`, { parent: destId });
        } else {
          await api.post(`/files/${item._id}/move`, { parent: destId });
        }
      }
      toast.success('Moved successfully');
      setMoveTarget(null);
      fetchContent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Move failed');
    }
  };

  const openBulkMoveDialog = async () => {
    setMoveTarget({ type: 'bulk', items: [] });
    setSelectedDestFolder('');
    try {
      const { data } = await api.get('/folders');
      // Filter out moving folder destinations that are currently selected in bulk
      const filtered = data.filter(f => !selectedFolders.includes(f._id));
      setAllFoldersList(filtered);
    } catch (err) {
      toast.error('Failed to load directories');
    }
  };

  // --- Bulk Actions ---
  const handleBulkAction = async (action) => {
    try {
      await api.post('/files/bulk', {
        action,
        fileIds: selectedFiles,
        folderIds: selectedFolders,
      });
      
      setSelectedFiles([]);
      setSelectedFolders([]);
      
      const successMsgs = {
        star: 'Selected items starred',
        unstar: 'Selected items unstarred',
        trash: 'Selected items moved to trash',
        restore: 'Selected items restored',
        delete: 'Selected items permanently deleted',
      };
      
      toast.success(successMsgs[action] || 'Action completed');
      fetchContent();
    } catch (err) {
      toast.error('Bulk operation failed');
    }
  };

  // --- Checkbox Helpers ---
  const toggleSelectFolder = (id) => {
    setSelectedFolders((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  const toggleSelectFile = (id) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  // --- UI Helpers ---
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

  // --- Filtering & Sorting ---
  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayFiles = filteredFiles.filter((file) => {
    if (filterBy === 'all') return true;
    if (filterBy === 'image') return file.type?.startsWith('image/');
    if (filterBy === 'pdf') return file.type === 'application/pdf';
    if (filterBy === 'video') return file.type?.startsWith('video/');
    if (filterBy === 'doc') {
      return (
        !file.type?.startsWith('image/') &&
        !file.type?.startsWith('video/') &&
        file.type !== 'application/pdf'
      );
    }
    return true;
  });

  const sortedFiles = [...displayFiles].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'size') return b.size - a.size;
    if (sortBy === 'date') return new Date(b.createdAt) - new Date(a.createdAt);
    return 0;
  });

  const isBulkSelected = selectedFiles.length > 0 || selectedFolders.length > 0;

  return (
    <div onDragEnter={handleDrag} style={{ minHeight: '100vh', position: 'relative' }}>
      <Navbar 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        notificationsCount={notificationsCount}
        onNotificationsClick={() => {
          setNotificationsCount(0);
          toast.info('Access alerts are sent to your sidebar history logs.');
        }}
      />
      
      <main className="dashboard-workspace">
        {/* Toolbar Section */}
        <div className="toolbar-container">
          <div className="toolbar-top">
            <div className="breadcrumb-nav">
              <span className="breadcrumb-nav-item" onClick={goToRoot}>
                <Home size={18} style={{ marginRight: '0.25rem', verticalAlign: 'text-bottom' }} /> My Drive
              </span>
              {breadcrumb.map((b, i) => (
                <React.Fragment key={b._id}>
                  <ChevronRight size={14} className="breadcrumb-separator" />
                  <span
                    className={
                      i === breadcrumb.length - 1
                        ? 'breadcrumb-nav-active'
                        : 'breadcrumb-nav-item'
                    }
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
                <input type="file" style={{ display: 'none' }} onChange={handleUploadInput} />
              </label>
            </div>
          </div>

          {/* Sort & Filter Controls */}
          <div className="toolbar-filters">
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Filter:</span>
            <span className={`filter-chip ${filterBy === 'all' ? 'active' : ''}`} onClick={() => setFilterBy('all')}>All</span>
            <span className={`filter-chip ${filterBy === 'image' ? 'active' : ''}`} onClick={() => setFilterBy('image')}>Images</span>
            <span className={`filter-chip ${filterBy === 'pdf' ? 'active' : ''}`} onClick={() => setFilterBy('pdf')}>PDFs</span>
            <span className={`filter-chip ${filterBy === 'video' ? 'active' : ''}`} onClick={() => setFilterBy('video')}>Videos</span>
            <span className={`filter-chip ${filterBy === 'doc' ? 'active' : ''}`} onClick={() => setFilterBy('doc')}>Documents</span>
            
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowUpDown size={16} className="text-secondary" />
              <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="date">Date Uploaded</option>
                <option value="size">File Size</option>
                <option value="name">File Name</option>
              </select>
            </div>
          </div>
        </div>

        {uploading && (
          <div className="uploading-overlay">
            <div className="spinner" />
            <span>Processing and uploading files...</span>
          </div>
        )}

        {/* Drag and Drop Zone Overlay */}
        {dragActive && (
          <div 
            className="drag-drop-overlay" 
            onDragEnter={handleDrag} 
            onDragLeave={handleDrag} 
            onDragOver={handleDrag} 
            onDrop={handleDrop}
          >
            <Upload size={64} style={{ animation: 'bounce 1s infinite' }} />
            <div className="drag-drop-text">Drop your files here</div>
            <p style={{ color: 'var(--text-secondary)' }}>Files will be uploaded to the current directory</p>
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <p>Loading your vault...</p>
          </div>
        ) : filteredFolders.length === 0 && sortedFiles.length === 0 ? (
          <div className="empty-state">
            <CloudOff size={56} className="empty-state-icon" />
            <h3>No folders or files found</h3>
            <p>Drag and drop or upload files to get started.</p>
          </div>
        ) : (
          <>
            {/* Folders List */}
            {filteredFolders.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h2 className="section-title"><Folder size={20} /> Folders</h2>
                <div className="grid-folders">
                  {filteredFolders.map((folder) => {
                    const isSel = selectedFolders.includes(folder._id);
                    return (
                      <div className={`vault-card ${isSel ? 'selected' : ''}`} key={folder._id}>
                        {/* Selector checkbox */}
                        <div className="select-checkbox-container" onClick={(e) => { e.stopPropagation(); toggleSelectFolder(folder._id); }}>
                          <div className={`checkbox-custom ${isSel ? 'checked' : ''}`}>
                            {isSel && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>

                        {folder.isStarred && (
                          <div className="card-star-indicator">
                            <Star size={16} fill="currentColor" />
                          </div>
                        )}

                        <div className="card-header">
                          <div className="card-icon folder-icon-wrapper" onClick={() => openFolder(folder)}>
                            <Folder size={22} />
                          </div>
                          <div className="dropdown-container">
                            <button className="dropdown-trigger" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === folder._id ? null : folder._id); }}>
                              <MoreVertical size={18} />
                            </button>
                            {openDropdown === folder._id && (
                              <div className="dropdown-menu">
                                <button className="dropdown-item" onClick={() => handleStarFolder(folder._id)}>
                                  <Star size={14} /> {folder.isStarred ? 'Unstar' : 'Star'}
                                </button>
                                <button className="dropdown-item" onClick={() => openRenameModal('folder', folder)}>
                                  <Pencil size={14} /> Rename
                                </button>
                                <button className="dropdown-item" onClick={() => openMoveDialog('folder', folder)}>
                                  <Move size={14} /> Move Folder
                                </button>
                                <button className="dropdown-item delete" onClick={() => handleDeleteFolder(folder._id)}>
                                  <Trash2 size={14} /> Move to Trash
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="card-title" onClick={() => openFolder(folder)}>{folder.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Files List */}
            {sortedFiles.length > 0 && (
              <div>
                <h2 className="section-title"><FileText size={20} /> Files</h2>
                <div className="grid-files">
                  {sortedFiles.map((file) => {
                    const isSel = selectedFiles.includes(file._id);
                    return (
                      <div className={`vault-card ${isSel ? 'selected' : ''}`} key={file._id}>
                        {/* Selector checkbox */}
                        <div className="select-checkbox-container" onClick={(e) => { e.stopPropagation(); toggleSelectFile(file._id); }}>
                          <div className={`checkbox-custom ${isSel ? 'checked' : ''}`}>
                            {isSel && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>

                        {file.isStarred && (
                          <div className="card-star-indicator">
                            <Star size={16} fill="currentColor" />
                          </div>
                        )}

                        <div className="card-header">
                          <div className="card-icon file-icon-wrapper" onClick={() => setPreviewFile(file)}>
                            {getFileIcon(file.type)}
                          </div>
                          <div className="dropdown-container">
                            <button className="dropdown-trigger" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === file._id ? null : file._id); }}>
                              <MoreVertical size={18} />
                            </button>
                            {openDropdown === file._id && (
                              <div className="dropdown-menu">
                                <button className="dropdown-item" onClick={() => setPreviewFile(file)}>
                                  <Eye size={14} /> Preview
                                </button>
                                <button className="dropdown-item" onClick={() => handleStarFile(file._id)}>
                                  <Star size={14} /> {file.isStarred ? 'Unstar' : 'Star'}
                                </button>
                                <button className="dropdown-item" onClick={() => openRenameModal('file', file)}>
                                  <Pencil size={14} /> Rename
                                </button>
                                <button className="dropdown-item" onClick={() => openMoveDialog('file', file)}>
                                  <Move size={14} /> Move File
                                </button>
                                <button className="dropdown-item" onClick={() => handleShare(file)}>
                                  <Share2 size={14} /> Share
                                </button>
                                <a className="dropdown-item" href={file.url} download={file.name} target="_blank" rel="noopener noreferrer">
                                  <Link2 size={14} /> Download
                                </a>
                                <button className="dropdown-item delete" onClick={() => handleDeleteFile(file._id)}>
                                  <Trash2 size={14} /> Move to Trash
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* File preview thumbnails */}
                        {file.type && file.type.startsWith('image/') && (
                          <div className="file-preview-container" onClick={() => setPreviewFile(file)}>
                            <img className="file-preview-image" src={file.url} alt={file.name} />
                          </div>
                        )}
                        
                        <div className="card-title" onClick={() => setPreviewFile(file)}>{file.name}</div>
                        <div className="card-meta">
                          <span>{formatSize(file.size)}</span>
                          {file.isShared && <span className="badge-shared">Shared</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* --- Floating Bulk Actions Bar --- */}
      {isBulkSelected && (
        <div className="bulk-actions-toolbar">
          <span className="bulk-count">
            Selected: {selectedFolders.length} Folders, {selectedFiles.length} Files
          </span>
          <div className="bulk-divider" />
          <div className="bulk-buttons">
            <button className="btn btn-secondary" onClick={() => handleBulkAction('star')} title="Add Star">
              <Star size={16} /> Star
            </button>
            <button className="btn btn-secondary" onClick={() => handleBulkAction('unstar')} title="Remove Star">
              Unstar
            </button>
            <button className="btn btn-secondary" onClick={openBulkMoveDialog} title="Move items">
              <Move size={16} /> Move
            </button>
            <button className="btn btn-secondary" onClick={() => handleBulkAction('trash')} title="Move to trash bin">
              <Trash2 size={16} /> Trash
            </button>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => { setSelectedFiles([]); setSelectedFolders([]); }} title="Clear Selection">
            <X size={16} />
          </button>
        </div>
      )}

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
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Anyone with this link can view and download the file. Access alerts will be sent instantly.
            </p>
            <div className="share-link-box">
              <input className="share-link-input" value={shareLink} readOnly />
              <button className="btn btn-primary" onClick={copyLink}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
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

      {/* --- Move Modal (Tree picker layout) --- */}
      {moveTarget && (
        <div className="modal-overlay" onClick={() => setMoveTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Move items to...</h3>
            <div style={{ maxHeight: '250px', overflowY: 'auto', margin: '1rem 0', paddingRight: '0.5rem' }}>
              <div 
                className={`folder-tree-item ${selectedDestFolder === 'root' ? 'selected' : ''}`}
                onClick={() => setSelectedDestFolder('root')}
              >
                <HardDrive size={16} />
                <span>My Drive (Root)</span>
              </div>
              {allFoldersList.map(folder => (
                <div 
                  key={folder._id} 
                  className={`folder-tree-item ${selectedDestFolder === folder._id ? 'selected' : ''}`}
                  onClick={() => setSelectedDestFolder(folder._id)}
                  style={{ marginLeft: '1rem', marginTop: '0.25rem' }}
                >
                  <CornerDownRight size={14} className="text-muted" />
                  <Folder size={14} style={{ color: 'var(--primary)' }} />
                  <span>{folder.name}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setMoveTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleMoveItem}>Move Here</button>
            </div>
          </div>
        </div>
      )}

      {/* --- File Preview Modal (Google Drive-like) --- */}
      {previewFile && (
        <div className="modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="modal-title" style={{ margin: 0, wordBreak: 'break-all' }}>{previewFile.name}</h3>
              <button className="theme-toggle-btn" onClick={() => setPreviewFile(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="preview-modal-body">
              {previewFile.type && previewFile.type.startsWith('image/') && (
                <img className="preview-media-img" src={previewFile.url} alt={previewFile.name} />
              )}
              {previewFile.type && previewFile.type.startsWith('video/') && (
                <video className="preview-media-video" src={previewFile.url} controls autoPlay />
              )}
              {previewFile.type && previewFile.type === 'application/pdf' && (
                <iframe className="preview-media-pdf" src={`${previewFile.url}#toolbar=0`} title={previewFile.name} />
              )}
              {/* Fallback for other files */}
              {previewFile.type && !previewFile.type.startsWith('image/') && !previewFile.type.startsWith('video/') && previewFile.type !== 'application/pdf' && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                  <p>No interactive preview available for this file type.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Type: {previewFile.type}</p>
                </div>
              )}
            </div>

            {/* Version History panel within Preview */}
            {previewFile.versions && previewFile.versions.length > 0 && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={16} /> Version History
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '120px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', background: 'var(--surface-glass)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--primary-glow)' }}>
                    <span>Current Version (uploaded {new Date(previewFile.createdAt).toLocaleDateString()})</span>
                    <span style={{ fontWeight: 600 }}>{formatSize(previewFile.size)}</span>
                  </div>
                  {previewFile.versions.map((ver, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.4rem 0.75rem', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                      <a href={ver.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                        Version {previewFile.versions.length - idx} ({new Date(ver.createdAt).toLocaleDateString()})
                      </a>
                      <span style={{ color: 'var(--text-muted)' }}>{formatSize(ver.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <a className="btn btn-primary" href={previewFile.url} download={previewFile.name} target="_blank" rel="noopener noreferrer">
                <Link2 size={16} /> Download File
              </a>
              <button className="btn btn-secondary" onClick={() => setPreviewFile(null)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
