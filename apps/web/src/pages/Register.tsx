import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Mail, Lock, AlertCircle, ArrowRight, User, Building } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tenantName, setTenantName] = useState('');
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
        tenant_name: tenantName || undefined
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Soft gradient backgrounds for glassmorphism depth */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#2563EB]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#3B82F6]/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10 py-12">
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#2563EB]/10 rounded-xl border border-[#2563EB]/20">
              <Activity className="w-8 h-8 text-[#2563EB]" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Uptime<span className="text-[#2563EB]">Monitor</span></span>
          </div>
        </div>

        <div className="glass-panel p-8 relative z-10">
          <h2 className="text-2xl font-semibold text-white mb-2">Create an account</h2>
          <p className="text-gray-400 mb-6 text-sm">Start monitoring your services in seconds.</p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="email">
                  Email Address *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#111827] border border-[#334155] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="password">
                  Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#111827] border border-[#334155] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                    placeholder="Min 8 characters"
                  />
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="name">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#111827] border border-[#334155] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="tenant">
                  Organization
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="tenant"
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#111827] border border-[#334155] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-[#2563EB] hover:bg-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2563EB] focus:ring-offset-[#0F172A] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
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

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-[#2563EB] hover:text-[#3B82F6] transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
