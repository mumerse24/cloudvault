import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import { History, CloudOff } from 'lucide-react';

const ActivityLog = () => {
  const { api } = useAuth();
  const toast = useToast();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/activity');
      setActivities(data);
    } catch (err) {
      toast.error('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <main className="dashboard-workspace">
        <div className="toolbar-container">
          <div className="breadcrumb-nav">
            <span className="breadcrumb-nav-active">
              <History size={18} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> User Activity Log
            </span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <p>Retrieving your logs...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="empty-state">
            <History size={56} className="empty-state-icon" style={{ color: 'var(--text-muted)' }} />
            <h3>No activity logged yet</h3>
            <p>Every action you take in your vault will be recorded here for auditing.</p>
          </div>
        ) : (
          <div className="activity-timeline">
            {activities.map((activity) => (
              <div className="activity-log-item" key={activity._id}>
                <div className="activity-log-header">
                  <span className="activity-action">{activity.action.replace('_', ' ')}</span>
                  <span className="activity-date">
                    {new Date(activity.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="activity-details">{activity.details}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ActivityLog;
