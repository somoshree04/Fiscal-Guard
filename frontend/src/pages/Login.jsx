import { useState } from 'react';
import {  useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { access_token } = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      setToken(access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-slate-400">Secure AI-Powered Finance Tracking</p>
        </div>

        {/* The Form - (Practice putting items on top of each other) */}
        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          
            {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Email Address
            </label>
            <input 
              id="email"
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            />
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <input 
              id="password"
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            />
          </div>
          
          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-cyan-900/20 transition-all active:scale-95"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>

        </form>

        {/* Footer Link */}
        <p className="text-center text-slate-500 mt-6 text-sm">
          Don't have an account? <span className="text-cyan-400 cursor-pointer hover:underline">Register</span>
        </p>
      </div>

    </div>
  )
}

export default Login
