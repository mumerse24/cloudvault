import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import {
  Shield,
  Users,
  File,
  HardDrive,
  Clock,
  UserCheck,
} from 'lucide-react';

const AdminDashboard = () => {
  const { api } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
      ]);
      setStats(statsRes.data);
      setUsersList(usersRes.data);
    } catch (err) {
      toast.error('Failed to load administrative analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const formatSize = (bytes) => {
    if (!bytes) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <main className="dashboard-workspace">
        <div className="toolbar-container">
          <div className="breadcrumb-nav">
            <span className="breadcrumb-nav-active">
              <Shield size={18} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> Admin Dashboard Panel
            </span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <p>Gathering system statistics...</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
                  <Users size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Total Users</span>
                  <span className="stat-value">{stats?.totalUsers || 0}</span>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-icon-wrapper" style={{ background: 'rgba(236, 72, 153, 0.15)', color: 'var(--accent-pink)' }}>
                  <File size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Total Files</span>
                  <span className="stat-value">{stats?.totalFiles || 0}</span>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                  <HardDrive size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Total Storage Used</span>
                  <span className="stat-value">{formatSize(stats?.totalStorageUsed)}</span>
                </div>
              </div>
            </div>

            {/* Layout Split: Users & System Logs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', flexWrap: 'wrap' }}>
              
              {/* Users List Section */}
              <div>
                <h3 className="section-title"><UserCheck size={20} /> User List & Storage Usage</h3>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Storage Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map((usr) => {
                        const used = usr.storageUsed || 0;
                        const limit = usr.storageLimit || 100 * 1024 * 1024;
                        const pct = Math.min(100, (used / limit) * 100);
                        return (
                          <tr key={usr._id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{usr.name}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{usr.email}</div>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: usr.role === 'admin' ? 'var(--primary-glow)' : 'var(--border-glass)', color: usr.role === 'admin' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600 }}>
                                {usr.role}
                              </span>
                            </td>
                            <td>
                              <div style={{ width: '120px' }}>
                                <div style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <span>{pct.toFixed(0)}%</span>
                                  <span>{formatSize(used)}</span>
                                </div>
                                <div className="storage-progress-bg">
                                  <div className="storage-progress-fill" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* System Audit Trails Section */}
              <div>
                <h3 className="section-title"><Clock size={20} /> Recent Global Operations</h3>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Action</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.recentActivities?.map((act) => (
                        <tr key={act._id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{act.user?.name || 'Deleted User'}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {new Date(act.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {act.action.replace('_', ' ')}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{act.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
