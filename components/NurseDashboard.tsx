
import React, { useState, useMemo } from 'react';
import { Nurse, Duty, Message, ShiftType } from '../types';
import { Calendar as CalendarIcon, MessageSquare, Send, Clock, User, Briefcase, MapPin, Sparkles, ShieldAlert, Lock, Save, CheckCircle, Info, FileText, PlaneTakeoff, X, ChevronLeft, ChevronRight, LayoutList, Grid, Printer } from 'lucide-react';

interface NurseDashboardProps {
  activeTab: string;
  nurse: Nurse;
  duties: Duty[];
  messages: Message[];
  onSendMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => void;
  onUpdateProfile: (updates: Partial<Nurse>) => void;
}

const NurseDashboard: React.FC<NurseDashboardProps> = ({ 
  activeTab, nurse, duties, messages, onSendMessage, onUpdateProfile 
}) => {
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const isDefaultPassword = nurse.password === 'TTNURSING123' || !nurse.password;

  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const duty = duties.find(d => d.date === dateStr);
      days.push({ day: i, date: dateStr, duty });
    }
    return days;
  }, [currentMonth, duties]);

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (passwordForm.current !== nurse.password && !(nurse.password === undefined && passwordForm.current === 'TTNURSING123')) {
      setPasswordError('Current password authentication failed.');
      return;
    }
    if (passwordForm.new.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('Password confirmation does not match.');
      return;
    }
    if (passwordForm.new === 'TTNURSING123') {
      setPasswordError('Cannot reuse the system default password.');
      return;
    }

    onUpdateProfile({ password: passwordForm.new });
    setPasswordSuccess(true);
    setPasswordForm({ current: '', new: '', confirm: '' });
  };

  const handleLeaveRequest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const start = formData.get('start') as string;
    const end = formData.get('end') as string;
    const reason = formData.get('reason') as string;

    onSendMessage({
      senderId: nurse.id,
      senderRole: 'nurse',
      ward: nurse.ward,
      content: `Annual Leave Request: ${start} to ${end}. Reason: ${reason}`,
      category: 'leave_request',
      metadata: {
        startDate: start,
        endDate: end,
        status: 'pending'
      }
    });
    setShowLeaveForm(false);
  };

  if (activeTab === 'dashboard') {
    const today = new Date().toISOString().split('T')[0];
    const todayShift = duties.find(d => d.date === today);

    return (
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {isDefaultPassword && (
          <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2.5rem] flex items-center justify-between gap-6 shadow-lg shadow-amber-100 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="bg-amber-100 p-3 rounded-2xl text-amber-600"><ShieldAlert size={28} /></div>
              <div>
                <p className="font-black text-amber-900 uppercase tracking-tight">Security Alert: Default Credentials Detected</p>
                <p className="text-xs text-amber-700 font-bold opacity-80 uppercase tracking-widest mt-1">Please update your access key in the security tab immediately.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-[3.5rem] border border-indigo-100 shadow-2xl shadow-indigo-50 bg-gradient-to-br from-indigo-50/50 to-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <CalendarIcon size={120} className="text-indigo-900" />
            </div>
            <h3 className="text-indigo-950 font-black text-2xl mb-8 flex items-center gap-3 tracking-tighter">
              <Clock className="text-indigo-600" size={28} />
              Current Duty Status
            </h3>
            {todayShift ? (
              <div className="space-y-8 relative z-10">
                <div className="flex flex-col gap-2">
                   <p className="text-slate-500 font-bold uppercase text-[11px] tracking-widest">Active Deployment</p>
                   <p className="text-4xl font-black text-indigo-950 tracking-tight leading-none">
                     {todayShift.shift} <span className="text-indigo-400 italic">Shift</span>
                   </p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-indigo-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] mb-2">Check-in</p>
                    <p className="text-2xl font-black text-slate-900">
                      {todayShift.shift === ShiftType.MORNING ? '07:00' : 
                       todayShift.shift === ShiftType.AFTERNOON ? '14:00' :
                       todayShift.shift === ShiftType.NIGHT ? '18:30' : '08:00'}
                    </p>
                  </div>
                  <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-indigo-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] mb-2">Checkout</p>
                    <p className="text-2xl font-black text-slate-900">
                      {todayShift.shift === ShiftType.MORNING ? '15:00' : 
                       todayShift.shift === ShiftType.AFTERNOON ? '22:00' :
                       todayShift.shift === ShiftType.NIGHT ? '07:30' : '17:00'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                 <div className="bg-slate-100 p-6 rounded-full"><Sparkles className="text-slate-400" size={40} /></div>
                 <div>
                    <p className="text-slate-900 font-black text-xl">Standby Mode</p>
                    <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">No active shift today.</p>
                 </div>
              </div>
            )}
          </div>

          <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <h3 className="text-slate-900 font-black text-2xl mb-8 flex items-center gap-3 tracking-tighter"><User className="text-slate-400" size={28} /> Professional Profile</h3>
            <div className="space-y-6">
              {[
                { label: 'NCK Reg Number', val: nurse.nckNo, icon: FileText },
                { label: 'Ward Assignment', val: nurse.ward, icon: MapPin },
                { label: 'Clinical Specialty', val: nurse.specialty, icon: Briefcase },
                { label: 'Upcoming Duties', val: duties.length, icon: CalendarIcon }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                     <item.icon size={20} className="text-indigo-400" />
                     <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">{item.label}</span>
                  </div>
                  <span className="font-black text-slate-900 text-sm">{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'messages') {
    return (
      <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in duration-500">
        <div className="bg-white p-8 lg:p-12 rounded-[4rem] border border-slate-200 shadow-2xl flex flex-col h-[750px] relative">
          <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-8">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-3"><MessageSquare className="text-indigo-600" /> Administrative Line</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Direct contact with ward manager</p>
            </div>
            <button onClick={() => setShowLeaveForm(!showLeaveForm)} className="bg-indigo-50 text-indigo-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-100 transition-all shadow-sm">
              <PlaneTakeoff size={18} /> Request Leave
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto mb-10 space-y-6 pr-4 custom-scrollbar relative">
            {showLeaveForm && (
              <div className="mb-8 p-8 bg-indigo-900 text-white rounded-[2.5rem] shadow-2xl animate-in slide-in-from-top-4 duration-500">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-lg flex items-center gap-2 uppercase tracking-tight"><PlaneTakeoff size={20} /> Annual Leave Request</h3>
                  <button onClick={() => setShowLeaveForm(false)} className="p-2 hover:bg-white/10 rounded-xl"><X size={20} /></button>
                </div>
                <form onSubmit={handleLeaveRequest} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-[10px] font-black text-indigo-300 uppercase">Start Date</label><input type="date" name="start" required className="w-full bg-white/10 border border-white/20 p-4 rounded-xl outline-none focus:bg-white focus:text-slate-900 transition-all font-bold" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-indigo-300 uppercase">End Date</label><input type="date" name="end" required className="w-full bg-white/10 border border-white/20 p-4 rounded-xl outline-none focus:bg-white focus:text-slate-900 transition-all font-bold" /></div>
                  </div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-indigo-300 uppercase">Reason for Request</label><textarea name="reason" placeholder="Brief explanation..." className="w-full bg-white/10 border border-white/20 p-4 rounded-xl outline-none focus:bg-white focus:text-slate-900 transition-all font-bold min-h-[100px]"></textarea></div>
                  <button type="submit" className="w-full bg-white text-indigo-900 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-indigo-50 transition-all">Submit Protocol Request</button>
                </form>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
                 <MessageSquare size={64} /><p className="font-black uppercase tracking-widest text-xs">No active threads</p>
              </div>
            ) : (
              messages.map(msg => {
                const isLeaveRequest = msg.category === 'leave_request';
                const status = msg.metadata?.status;
                return (
                  <div key={msg.id} className={`flex flex-col ${msg.senderRole === 'nurse' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-6 rounded-[2.5rem] max-w-[85%] shadow-md border ${isLeaveRequest ? (status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : status === 'rejected' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-indigo-50 border-indigo-200 text-indigo-900') : (msg.senderRole === 'nurse' ? 'bg-indigo-600 text-white border-indigo-700 rounded-tr-none' : 'bg-slate-100 text-slate-800 border-slate-200 rounded-tl-none')}`}>
                      {isLeaveRequest && <p className="text-[9px] font-black uppercase tracking-widest mb-2 opacity-60">Professional Leave Protocol: {status || 'pending'}</p>}
                      <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                      <p className={`text-[9px] font-black mt-3 uppercase tracking-tighter opacity-40`}>{msg.timestamp}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem('msg') as HTMLInputElement;
            if (input.value.trim()) {
              onSendMessage({ senderId: nurse.id, senderRole: 'nurse', ward: nurse.ward, content: input.value, category: 'general' });
              input.value = '';
            }
          }} className="flex gap-4 bg-slate-50 p-3 rounded-[2.5rem] border border-slate-100 shadow-inner">
            <input name="msg" placeholder="Compose message to manager..." className="flex-1 bg-transparent px-6 py-4 rounded-3xl outline-none font-bold text-slate-800 text-sm" />
            <button type="submit" className="bg-indigo-600 text-white p-5 rounded-full hover:bg-indigo-700 transition-all shadow-xl group"><Send size={24} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" /></button>
          </form>
        </div>
      </div>
    );
  }

  if (activeTab === 'roster') {
    return (
      <div className="space-y-10 animate-in fade-in duration-500 print:m-0 print:p-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 print:hidden">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Personal Duty Cycle</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
              {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button 
              onClick={handlePrint}
              className="bg-white border-2 border-slate-100 text-slate-700 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Printer size={16} />
              Print Roster
            </button>
            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1 border-r border-slate-100 pr-2 mr-2">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"><ChevronLeft size={20} /></button>
                <button onClick={() => setCurrentMonth(new Date())} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">Today</button>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"><ChevronRight size={20} /></button>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-xl transition-all ${viewMode === 'calendar' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}><Grid size={20} /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}><LayoutList size={20} /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden print:block mb-10 text-center">
          <h1 className="text-2xl font-black uppercase tracking-widest text-indigo-900">PCEA Tumutumu Hospital</h1>
          <h2 className="text-xl font-bold text-slate-600 mt-2">Personal Duty Roster - {nurse.name}</h2>
          <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mt-1">{currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} • {nurse.ward} Ward</p>
        </div>

        {viewMode === 'calendar' ? (
          <div className="bg-white rounded-[4rem] border border-slate-200 shadow-xl overflow-hidden p-8 lg:p-12 print:border-none print:shadow-none print:p-0">
            <div className="grid grid-cols-7 gap-4 mb-8">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-4">
              {calendarData.map((item, idx) => (
                <div key={idx} className={`aspect-square rounded-3xl border transition-all flex flex-col p-4 print:rounded-none print:border-slate-100 ${
                  !item ? 'bg-slate-50/50 border-transparent' : 
                  item.duty ? (
                    item.duty.shift === ShiftType.LEAVE ? 'bg-rose-500 border-rose-600 text-white print:bg-rose-100 print:text-rose-900' :
                    item.duty.shift === ShiftType.MORNING ? 'bg-yellow-400 border-yellow-500 text-yellow-950 print:bg-yellow-100 print:text-yellow-900' :
                    item.duty.shift === ShiftType.AFTERNOON ? 'bg-orange-500 border-orange-600 text-white print:bg-orange-100 print:text-orange-900' :
                    item.duty.shift === ShiftType.NIGHT ? 'bg-indigo-600 border-indigo-700 text-white print:bg-indigo-100 print:text-indigo-900' :
                    item.duty.shift === ShiftType.STRAIGHT ? 'bg-emerald-600 border-emerald-700 text-white print:bg-emerald-100 print:text-emerald-900' :
                    'bg-slate-100 border-slate-200 text-slate-400'
                  ) : 'bg-white border-slate-100 hover:border-indigo-200'
                }`}>
                  {item && (
                    <>
                      <span className={`text-sm font-black ${item.duty ? 'text-inherit' : 'text-slate-400'}`}>{item.day}</span>
                      {item.duty && (
                        <div className="mt-auto">
                          <div className={`text-[8px] font-black uppercase tracking-tighter truncate ${
                            item.duty.shift === ShiftType.LEAVE ? 'text-white print:text-rose-900' :
                            item.duty.shift === ShiftType.MORNING ? 'text-yellow-950 print:text-yellow-900' :
                            'text-white print:text-indigo-900'
                          }`}>
                            {item.duty.shift}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-12 flex flex-wrap gap-6 justify-center border-t border-slate-100 pt-10 print:mt-6 print:pt-4">
              {Object.values(ShiftType).map(type => (
                <div key={type} className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-lg border ${
                    type === ShiftType.MORNING ? 'bg-yellow-400 border-yellow-500' :
                    type === ShiftType.AFTERNOON ? 'bg-orange-500 border-orange-600' :
                    type === ShiftType.NIGHT ? 'bg-indigo-600 border-indigo-700' :
                    type === ShiftType.STRAIGHT ? 'bg-emerald-600 border-emerald-700' :
                    'bg-rose-500 border-rose-600'
                  }`} />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{type} Shift</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[4rem] border border-slate-200 shadow-xl overflow-hidden print:border-none print:shadow-none">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-[0.25em] border-b border-slate-100">
                <tr><th className="px-10 py-8">Deployment Date</th><th className="px-10 py-8">Shift Type</th><th className="px-10 py-8">Hospital Unit</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {duties
                  .filter(d => {
                    const dDate = new Date(d.date);
                    return dDate.getMonth() === currentMonth.getMonth() && dDate.getFullYear() === currentMonth.getFullYear();
                  })
                  .sort((a,b) => b.date.localeCompare(a.date))
                  .map(duty => (
                    <tr key={duty.id} className="hover:bg-indigo-50/30 transition-all group">
                      <td className="px-10 py-7 font-black text-slate-900">{new Date(duty.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                      <td className="px-10 py-7">
                        <span className={`px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border shadow-sm ${
                          duty.shift === ShiftType.MORNING ? 'bg-yellow-400 text-yellow-950 border-yellow-500' :
                          duty.shift === ShiftType.AFTERNOON ? 'bg-orange-500 text-white border-orange-600' : 
                          duty.shift === ShiftType.NIGHT ? 'bg-indigo-600 text-white border-indigo-700' :
                          duty.shift === ShiftType.STRAIGHT ? 'bg-emerald-600 text-white border-emerald-700' :
                          duty.shift === ShiftType.LEAVE ? 'bg-rose-500 text-white border-rose-600' : 'bg-slate-100 text-slate-400'
                        }`}>{duty.shift}</span>
                      </td>
                      <td className="px-10 py-7 font-bold text-slate-500 uppercase text-xs">{nurse.ward} Ward</td>
                    </tr>
                  ))}
                {duties.filter(d => {
                  const dDate = new Date(d.date);
                  return dDate.getMonth() === currentMonth.getMonth() && dDate.getFullYear() === currentMonth.getFullYear();
                }).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-10 py-20 text-center">
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">No duties scheduled for this month.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'security') {
    return (
      <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-500">
        <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5"><Lock size={120} className="text-indigo-900" /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-10">
              <div className="bg-indigo-100 p-4 rounded-3xl text-indigo-600 shadow-lg shadow-indigo-100/50"><ShieldAlert size={32} /></div>
              <div><h2 className="text-3xl font-black text-slate-900 tracking-tight">Security Center</h2><p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Manage hospital access credentials</p></div>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-8">
              {passwordError && <div className="bg-red-50 text-red-600 p-5 rounded-3xl text-xs font-black border border-red-100 uppercase tracking-widest animate-pulse">Error: {passwordError}</div>}
              {passwordSuccess && <div className="bg-emerald-50 text-emerald-600 p-5 rounded-3xl text-xs font-black border border-emerald-100 uppercase tracking-widest flex items-center gap-3"><CheckCircle size={18} /> Credentials updated successfully.</div>}
              <div className="space-y-3"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Current Password</label><div className="relative group"><Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="password" required value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-50 p-5 pl-14 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800" /></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">New Secure Key</label><input type="password" required value={passwordForm.new} onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-50 p-5 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800" /></div>
                <div className="space-y-3"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Repeat New Key</label><input type="password" required value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-50 p-5 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800" /></div>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 group"><Save size={20} className="group-hover:scale-110 transition-transform" /> Commit New Credentials</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default NurseDashboard;
