
import React, { useState } from 'react';
import { UserRole, Nurse, AdminUser, WardType } from '../types';
import { ShieldCheck, Lock, Mail, Stethoscope, ArrowLeft, Send, UserCircle, Briefcase } from 'lucide-react';

interface LoginProps {
  onLogin: (role: UserRole, user: Nurse | AdminUser) => void;
  nurses: Nurse[];
}

const Login: React.FC<LoginProps> = ({ onLogin, nurses }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [loginRole, setLoginRole] = useState<UserRole>('nurse');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Administrative account definitions mapping to the new hospital unit structure
  const adminAccounts: Record<string, { ward: WardType, name: string }> = {
    'admin.ward1@tumutumu.org': { ward: 'Ward 1', name: 'Ward 1 Manager' },
    'admin.ward2@tumutumu.org': { ward: 'Ward 2', name: 'Ward 2 Manager' },
    'admin.ward3@tumutumu.org': { ward: 'Ward 3', name: 'Ward 3 Manager' },
    'admin.ward4@tumutumu.org': { ward: 'Ward 4', name: 'Ward 4 Manager' },
    'admin.ward56@tumutumu.org': { ward: 'Ward 5/6', name: 'Ward 5/6 Manager' },
    'admin.icu@tumutumu.org': { ward: 'ICU', name: 'ICU Manager' },
    'admin.theatre@tumutumu.org': { ward: 'Theatre', name: 'Theatre Manager' },
    'cno@tumutumu.org': { ward: 'All', name: 'Chief Nursing Officer' }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        onLogin(data.role, data.user);
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection to hospital server failed. Please try again.');
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const nurse = nurses.find(n => n.email === email);
    const isAdmin = adminAccounts[email.toLowerCase()];

    if (nurse || isAdmin) {
      setResetSuccess(true);
    } else {
      setError('No personnel record found with that email address.');
    }
  };

  const resetState = () => {
    setView('login');
    setResetSuccess(false);
    setError('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-500">
        <div className="bg-indigo-900 p-10 text-white text-center relative">
          <div className="absolute top-4 right-4 bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">Secure Ward Access</div>
          <div className="flex justify-center mb-6"><div className="bg-white/20 p-4 rounded-[1.5rem] backdrop-blur-sm shadow-inner"><Stethoscope size={48} className="text-indigo-200" /></div></div>
          <h1 className="text-2xl font-black tracking-tight uppercase leading-none">PCEA Tumutumu</h1>
          <p className="text-indigo-300 text-sm mt-2 font-medium">Hospital Roster Management</p>
        </div>
        
        <div className="p-10">
          {view === 'login' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
                <button onClick={() => { setLoginRole('nurse'); setError(''); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${loginRole === 'nurse' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><UserCircle size={18} /> Staff</button>
                <button onClick={() => { setLoginRole('admin'); setError(''); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${loginRole === 'admin' ? 'bg-indigo-600 shadow-md text-white' : 'text-slate-500 hover:text-slate-700'}`}><Briefcase size={18} /> HOD / CNO</button>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100 animate-pulse">{error}</div>}
                
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Unit Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={loginRole === 'admin' ? "admin.icu@tumutumu.org" : "staff@tumutumu.org"} required className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 pl-12 outline-none focus:bg-white focus:border-indigo-600 transition-all font-medium text-slate-800" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Key</label><button type="button" onClick={() => { setView('forgot'); setError(''); }} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">Recovery</button></div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 pl-12 outline-none focus:bg-white focus:border-indigo-600 transition-all font-medium text-slate-800" />
                  </div>
                </div>

                <button type="submit" className={`w-full text-white font-black py-5 rounded-2xl transition-all shadow-xl tracking-widest uppercase text-sm ${loginRole === 'admin' ? 'bg-indigo-900 hover:bg-black shadow-indigo-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}>Authorize Access</button>
              </form>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
              {resetSuccess ? (
                <div className="py-6 space-y-8">
                  <div className="flex justify-center"><div className="bg-emerald-100 p-6 rounded-3xl shadow-lg shadow-emerald-50"><Send size={40} className="text-emerald-600" /></div></div>
                  <div className="space-y-2"><h3 className="text-2xl font-black text-slate-900">Recovery Sent</h3><p className="text-slate-500 text-sm leading-relaxed px-4">Check hospital email <span className="font-bold text-slate-800 italic">({email})</span> for reset link.</p></div>
                  <button onClick={resetState} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-black transition-all shadow-xl uppercase text-sm tracking-widest">Return to Login</button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-8 text-left">
                  <button type="button" onClick={resetState} className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors mb-4 group"><ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back</button>
                  <div className="space-y-2"><h2 className="text-3xl font-black text-slate-900">Account Recovery</h2><p className="text-slate-500 text-sm leading-relaxed">Enter unit email for security verification.</p></div>
                  {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100">{error}</div>}
                  <div className="space-y-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email</label><div className="relative group"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. admin.icu@tumutumu.org" required className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 pl-12 outline-none focus:bg-white focus:border-indigo-600 transition-all font-medium text-slate-800" /></div></div>
                  <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl tracking-widest uppercase text-sm">Send Recovery</button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
