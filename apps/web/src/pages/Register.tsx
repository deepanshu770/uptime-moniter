import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Mail, Lock, AlertCircle, ArrowRight, User, Building } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await register({ 
        email, 
        password,
        display_name: displayName || undefined,
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Soft gradient backgrounds for light depth */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-100 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-100 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10 py-12">
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <Activity className="w-8 h-8 text-light-accent" />
            </div>
            <span className="text-2xl font-bold text-light-textMain dark:text-zinc-100 tracking-tight">Uptime<span className="text-light-accent">Monitor</span></span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-light-border dark:border-zinc-800 shadow-xl rounded-2xl p-8 relative z-10">
          <h2 className="text-2xl font-semibold text-light-textMain dark:text-zinc-100 mb-2">Create an account</h2>
          <p className="text-light-textMuted dark:text-zinc-400 mb-6 text-sm">Start monitoring your services in seconds.</p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5" htmlFor="email">
                  Email Address *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-light-border dark:border-zinc-800 rounded-xl text-light-textMain dark:text-zinc-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-light-accent focus:border-transparent transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5" htmlFor="password">
                  Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-light-border dark:border-zinc-800 rounded-xl text-light-textMain dark:text-zinc-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-light-accent focus:border-transparent transition-all"
                    placeholder="Min 8 chars, uppercase, lowercase, number, special"
                  />
                </div>
              </div>

              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5" htmlFor="name">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-light-border dark:border-zinc-800 rounded-xl text-light-textMain dark:text-zinc-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-light-accent focus:border-transparent transition-all"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-light-accent hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-light-accent focus:ring-offset-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-light-textMuted dark:text-zinc-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-light-accent hover:text-indigo-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
