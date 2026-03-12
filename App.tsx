
import React, { useState, useEffect } from 'react';
import { UserRole, Nurse, Duty, Message, ShiftType, AdminUser, WardType } from './types';
import AdminDashboard from './components/AdminDashboard';
import NurseDashboard from './components/NurseDashboard';
import Login from './components/Login';
import { LayoutDashboard, Users, Calendar, MessageSquare, ShieldCheck, LogOut, Menu, X, Crown, Settings, Download, CloudCheck } from 'lucide-react';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<UserRole>('admin');
  const [currentUser, setCurrentUser] = useState<Nurse | AdminUser | null>(null);
  
  // Persistence State
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isSynced, setIsSynced] = useState(true);

  // Initial Data Fetching & WebSocket Setup
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nursesRes, dutiesRes, messagesRes] = await Promise.all([
          fetch('/api/nurses'),
          fetch('/api/duties'),
          fetch('/api/messages')
        ]);
        
        const nursesData = await nursesRes.json();
        const dutiesData = await dutiesRes.json();
        const messagesData = await messagesRes.json();
        
        setNurses(nursesData);
        setDuties(dutiesData);
        setMessages(messagesData);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };

    fetchData();

    // WebSocket setup for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Real-time update received:', message.type);

        switch (message.type) {
          case 'nurse_added':
            setNurses(prev => prev.some(n => n.id === message.data.id) ? prev : [...prev, message.data]);
            break;
          case 'nurse_updated':
            setNurses(prev => prev.map(n => n.id === message.data.id ? message.data : n));
            break;
          case 'duties_added':
            setDuties(prev => {
              const newDuties = message.data.filter((d: Duty) => !prev.some(p => p.id === d.id));
              return [...prev, ...newDuties];
            });
            break;
          case 'duty_updated':
            setDuties(prev => prev.map(d => d.id === message.data.id ? message.data : d));
            break;
          case 'duty_deleted':
            setDuties(prev => prev.filter(d => d.id !== message.data));
            break;
          case 'duties_deleted':
            setDuties(prev => prev.filter(d => !message.data.includes(d.id)));
            break;
          case 'message_added':
            setMessages(prev => prev.some(m => m.id === message.data.id) ? prev : [...prev, message.data]);
            break;
          case 'message_updated':
            setMessages(prev => prev.map(m => m.id === message.data.id ? message.data : m));
            break;
        }
      } catch (err) {
        console.error('Failed to process WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed. Real-time updates disabled.');
      setIsSynced(false);
    };

    socket.onopen = () => {
      console.log('WebSocket connected. Real-time updates active.');
      setIsSynced(true);
    };
    
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) setActiveTab(tabParam);

    return () => {
      socket.close();
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleLogin = (loginRole: UserRole, user: Nurse | AdminUser) => {
    setRole(loginRole);
    setCurrentUser(user);
    setIsLoggedIn(true);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setIsSidebarOpen(false);
  };

  const handleAddNurse = async (nurse: Omit<Nurse, 'id'>) => {
    try {
      const response = await fetch('/api/nurses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nurse)
      });
      const newNurse = await response.json();
      setNurses([...nurses, newNurse]);
    } catch (err) {
      console.error('Failed to add nurse:', err);
    }
  };

  const handleUpdateNurse = async (id: number, updates: Partial<Nurse>) => {
    try {
      const response = await fetch(`/api/nurses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const updatedNurse = await response.json();
      setNurses(prev => prev.map(n => n.id === id ? updatedNurse : n));
    } catch (err) {
      console.error('Failed to update nurse:', err);
    }
  };

  const handleUpdateAdmin = (updates: Partial<AdminUser> & { password?: string }) => {
    setCurrentUser(prev => ({ ...prev!, ...updates } as AdminUser));
  };

  const handleAssignDuty = async (duty: Omit<Duty, 'id'>) => {
    try {
      const response = await fetch('/api/duties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duty)
      });
      const newDuty = await response.json();
      setDuties([...duties, newDuty]);
    } catch (err) {
      console.error('Failed to assign duty:', err);
    }
  };

  const handleSendMessage = async (msg: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage = { ...msg, timestamp: new Date().toLocaleTimeString() };
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMessage)
      });
      const savedMessage = await response.json();
      setMessages([...messages, savedMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleProcessLeave = async (messageId: number, status: 'approved' | 'rejected') => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !msg.metadata) return;

    try {
      const updatedMetadata = { ...msg.metadata, status };
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: updatedMetadata })
      });
      const savedMsg = await response.json();
      
      setMessages(prev => prev.map(m => m.id === messageId ? savedMsg : m));

      if (status === 'approved' && msg.metadata.startDate && msg.metadata.endDate) {
        const start = new Date(msg.metadata.startDate);
        const end = new Date(msg.metadata.endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          await handleAssignDuty({ 
            nurseId: msg.senderId, 
            date: d.toISOString().split('T')[0], 
            shift: ShiftType.LEAVE 
          });
        }
      }
    } catch (err) {
      console.error('Failed to process leave:', err);
    }
  };

  const NavItem = ({ id, label, icon: Icon, adminOnly = false }: { id: string, label: string, icon: any, adminOnly?: boolean }) => {
    const isAdminType = role === 'admin' || role === 'cno';
    if (adminOnly && !isAdminType) return null;
    const active = activeTab === id;
    return (
      <button onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40 font-bold' : 'text-indigo-200 hover:bg-white/5 hover:text-white'}`}>
        <Icon size={20} className={active ? 'text-white' : 'text-indigo-400'} />
        <span className="text-sm">{label}</span>
      </button>
    );
  };

  if (!isLoggedIn) return <Login onLogin={handleLogin} nurses={nurses} />;

  const isAdminType = role === 'admin' || role === 'cno';
  const currentAdmin = isAdminType ? (currentUser as AdminUser) : null;
  const filteredNurses = role === 'cno' ? nurses : (role === 'admin' ? nurses.filter(n => n.ward === currentAdmin?.ward) : nurses);
  const filteredDuties = role === 'cno' ? duties : (role === 'admin' ? duties.filter(d => nurses.find(n => n.id === d.nurseId)?.ward === currentAdmin?.ward) : duties);

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden text-slate-900 font-sans">
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-indigo-950 text-white flex flex-col z-40 lg:relative lg:translate-x-0 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 border-b border-white/10 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-1"><ShieldCheck className="text-emerald-400" size={28} /><h1 className="text-lg font-black uppercase italic">Tumutumu</h1></div>
            <p className="text-[9px] text-indigo-400 uppercase tracking-widest font-black">Medical Services v2.5</p>
          </div>
          <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}><X size={24} className="text-indigo-400" /></button>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <NavItem id="dashboard" label="Command Center" icon={LayoutDashboard} />
          <NavItem id="roster" label="Duty Schedule" icon={Calendar} />
          <NavItem id="messages" label="Secure Comms" icon={MessageSquare} />
          <NavItem id="staff" label="Practitioner Registry" icon={Users} adminOnly={true} />
          <NavItem id="security" label="Account Security" icon={Settings} />
          {deferredPrompt && (
            <button onClick={handleInstallClick} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-emerald-600 text-white font-bold mt-4 shadow-lg animate-pulse">
              <Download size={20} /> <span className="text-sm">Install System App</span>
            </button>
          )}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-4 bg-white/5 rounded-[2rem] mb-4 border border-white/5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-black text-white text-lg shadow-lg uppercase">{role === 'cno' ? <Crown size={24} /> : 'AD'}</div>
            <div className="flex-1 min-w-0 text-white">
              <p className="font-bold text-sm truncate">{role === 'cno' ? 'Chief Nursing Officer' : (role === 'admin' ? `${currentAdmin?.ward} Admin` : (currentUser as Nurse)?.name)}</p>
              <span className="text-indigo-400 text-[8px] uppercase">{role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-[10px] text-red-400 font-black bg-red-500/10 py-4 rounded-2xl border border-red-500/20 hover:bg-red-500/20 transition-all uppercase tracking-widest"><LogOut size={16} /> Terminate Session</button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-12 sticky top-0 z-20">
          <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl"><Menu size={24} /></button>
             <div>
               <h2 className="text-2xl font-black text-slate-900 capitalize tracking-tight">{activeTab.replace('-', ' ')}</h2>
               <p className="hidden sm:block text-slate-400 text-xs font-medium uppercase tracking-widest mt-0.5">{new Date().toDateString()}</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
             {isSynced && <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-in fade-in duration-500"><CloudCheck size={16} /> Local Sync Active</div>}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-12 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-12 pb-12">
            {isAdminType ? (
              <AdminDashboard activeTab={activeTab} nurses={filteredNurses} duties={filteredDuties} messages={messages} onAddNurse={handleAddNurse} onAssignDuty={handleAssignDuty} setDuties={setDuties} onSwitchTab={setActiveTab} currentUser={currentAdmin!} onUpdateAdmin={handleUpdateAdmin} onProcessLeave={handleProcessLeave} />
            ) : (
              <NurseDashboard activeTab={activeTab} nurse={currentUser as Nurse} duties={duties.filter(d => d.nurseId === (currentUser as Nurse)?.id)} messages={messages.filter(m => m.senderId === (currentUser as Nurse)?.id || m.ward === (currentUser as Nurse)?.ward)} onSendMessage={handleSendMessage} onUpdateProfile={(updates) => handleUpdateNurse((currentUser as Nurse).id, updates)} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
