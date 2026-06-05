import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, Image, Film, Download, CloudOff } from 'lucide-react';

const ShareView = () => {
  const { shareCode } = useParams();
  const { api } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchShared = async () => {
      try {
        const { data } = await api.get(`/files/shared/${shareCode}`);
        setFile(data);
      } catch (err) {
        setError(err.response?.data?.message || 'File not found or link is invalid.');
      } finally {
        setLoading(false);
      }
    };
    fetchShared();
  }, [shareCode, api]);

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getIcon = (type) => {
    if (!type) return <FileText size={48} />;
    if (type.startsWith('image/')) return <Image size={48} />;
    if (type.startsWith('video/')) return <Film size={48} />;
    return <FileText size={48} />;
  };

  if (loading) {
    return (
      <div className="share-layout">
        <div className="share-card">
          <div className="spinner" style={{ width: 40, height: 40 }} />
          <p>Loading shared file...</p>
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="share-layout">
        <div className="share-card">
          <CloudOff size={56} style={{ color: 'var(--text-muted)' }} />
          <h2 style={{ color: 'var(--text-primary)', marginTop: '1rem' }}>File Not Found</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error || 'This shared link is invalid or has expired.'}</p>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Go to CloudVault
          </Link>
        </div>
      </div>
    );
  }

  const isImage = file.type && file.type.startsWith('image/');
  const isVideo = file.type && file.type.startsWith('video/');

  return (
    <div className="share-layout">
      <div className="share-card">
        <div style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>
          {getIcon(file.type)}
        </div>
        <h2 className="share-file-name">{file.name}</h2>
        <div className="share-file-info">
          <span>{formatSize(file.size)}</span>
          <span>{file.type}</span>
        </div>
        {isImage && (
          <div className="share-file-preview">
            <img src={file.url} alt={file.name} />
          </div>
        )}
        {isVideo && (
          <div className="share-file-preview">
            <video src={file.url} controls style={{ maxWidth: '100%' }} />
          </div>
        )}
        <a href={file.url} className="btn btn-primary" target="_blank" rel="noopener noreferrer" style={{ marginTop: '1rem' }}>
          <Download size={18} /> View / Download
        </a>
      </div>
    </div>
  );
};

export default ShareView;
