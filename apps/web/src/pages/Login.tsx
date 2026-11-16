import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle telemetry radial glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container border border-surface-high flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-on-surface">Pulse</span>
              <span className="h-2 w-2 rounded-full bg-primary ring-2 ring-primary/20 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="bg-surface-low border border-surface-border shadow-2xl rounded-2xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-on-surface">Telemetry Console Access</h2>
            <p className="text-xs text-on-surface-muted font-mono mt-1">
              Sign in with your workspace credentials to access the edge mesh.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-tertiary/10 border border-tertiary/20 flex items-start gap-2.5 text-xs text-tertiary font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-on-surface-variant mb-1.5">
                Operator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-on-surface-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@pulse.mesh"
                  className="w-full bg-surface-container text-on-surface font-mono text-xs pl-9 pr-3 py-2.5 rounded-lg border border-surface-high focus:border-primary/50 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-on-surface-variant mb-1.5">
                Passphrase
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-on-surface-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-surface-container text-on-surface font-mono text-xs pl-9 pr-3 py-2.5 rounded-lg border border-surface-high focus:border-primary/50 outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 bg-primary hover:bg-primary-light text-black font-semibold text-xs rounded-lg shadow-glow-primary transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-surface-border text-center">
            <p className="text-xs text-on-surface-muted font-mono">
              Need a new workspace?{' '}
              <Link to="/register" className="text-primary hover:underline font-semibold ml-1">
                Provision Operator Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
