import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, KeyRound } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, verify2FA } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.twoFactorRequired) {
        setTwoFactorRequired(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verify2FA(email, code);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-logo">CloudVault</h1>
          <p className="auth-subtitle">
            {twoFactorRequired ? 'Two-Factor Authentication' : 'Sign in to access your secure vault'}
          </p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {!twoFactorRequired ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              <LogIn size={18} />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify2FA}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', textAlign: 'center' }}>
              We have sent a 6-digit verification code to your email.<br/>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                (If SMTP is not configured, check the backend node console log)
              </span>
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="login-code">Verification Code</label>
              <input
                id="login-code"
                className="form-input"
                type="text"
                maxLength="6"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '4px', fontWeight: 'bold' }}
                autoFocus
              />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              <KeyRound size={18} />
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button 
              className="btn btn-secondary btn-full" 
              type="button" 
              onClick={() => setTwoFactorRequired(false)}
              style={{ marginTop: '0.75rem' }}
            >
              Back to Sign In
            </button>
          </form>
        )}

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">Create one</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
