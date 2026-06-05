import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ShareView from './pages/ShareView';
import Starred from './pages/Starred';
import Trash from './pages/Trash';
import ActivityLog from './pages/ActivityLog';
import AdminDashboard from './pages/AdminDashboard';
import Sidebar from './components/Sidebar';

// Simple guard component
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null; // you could add a spinner here
  return user ? children : <Navigate to="/login" replace />;
};

// Admin route guard
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user && user.role === 'admin' ? children : <Navigate to="/" replace />;
};

// Layout wrap for dashboard pages
const AppLayout = ({ children }) => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="app-content">
        {children}
      </div>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </PrivateRoute>
              }
            />
            
            <Route
              path="/starred"
              element={
                <PrivateRoute>
                  <AppLayout>
                    <Starred />
                  </AppLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/trash"
              element={
                <PrivateRoute>
                  <AppLayout>
                    <Trash />
                  </AppLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/activity"
              element={
                <PrivateRoute>
                  <AppLayout>
                    <ActivityLog />
                  </AppLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AppLayout>
                    <AdminDashboard />
                  </AppLayout>
                </AdminRoute>
              }
            />
            
            <Route path="/share/:shareCode" element={<ShareView />} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
