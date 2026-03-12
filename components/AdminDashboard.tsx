
import React, { useState, useMemo, useRef } from 'react';
import { Nurse, Duty, Message, ShiftType, AdminUser, WardType } from '../types';
import { UserPlus, CalendarPlus, Calendar, Sparkles, MessageCircle, MoreVertical, Smartphone, Info, UserCircle, Briefcase, ChevronRight, Users, X, MapPin, ShieldAlert, Lock, Save, CheckCircle, FileText, Filter, LayoutGrid, PlaneTakeoff, Check, Ban, Search, Camera, Loader2, ChevronLeft, ChevronRight as ChevronRightIcon, Printer, Table } from 'lucide-react';
import { optimizeRoster, summarizeMessages, generateSmsNotification, predictStaffingNeeds } from '../services/geminiService';
import { GoogleGenAI } from "@google/genai";

interface AdminDashboardProps {
  activeTab: string;
  nurses: Nurse[];
  duties: Duty[];
  messages: Message[];
  onAddNurse: (nurse: Omit<Nurse, 'id'>) => void;
  onAssignDuty: (duty: Omit<Duty, 'id'>) => void;
  setDuties: React.Dispatch<React.SetStateAction<Duty[]>>;
  onSwitchTab: (tab: string) => void;
  currentUser: AdminUser & { password?: string };
  onUpdateAdmin: (updates: Partial<AdminUser> & { password?: string }) => void;
  onProcessLeave?: (messageId: number, status: 'approved' | 'rejected') => void;
}

const StaffCard: React.FC<{ nurse: Nurse }> = ({ nurse }) => (
  <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col items-center text-center group hover:border-indigo-400 hover:shadow-2xl hover:scale-[1.03] transition-all duration-500">
    <div className="w-24 h-24 rounded-[2rem] bg-indigo-50 flex items-center justify-center font-black text-3xl text-indigo-400 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg">{nurse.name.split(' ').map(n => n[0]).join('')}</div>
    <h4 className="font-black text-xl text-slate-900 mb-1">{nurse.name}</h4>
    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{nurse.specialty}</p>
    <div className="w-full space-y-2 mb-6">
      <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-500 uppercase"><Smartphone size={12} className="text-indigo-400" /> {nurse.phone}</div>
      <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-500 uppercase"><FileText size={12} className="text-indigo-400" /> {nurse.nckNo}</div>
      <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-500 uppercase"><MapPin size={12} className="text-indigo-400" /> {nurse.ward}</div>
    </div>
    <div className="flex gap-3 w-full">
      <button className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all">Profile</button>
      <button className="p-3 bg-slate-50 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-2xl transition-all"><MoreVertical size={18} /></button>
    </div>
  </div>
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  activeTab, nurses, duties, messages, onAddNurse, onAssignDuty, setDuties, onSwitchTab, currentUser, onUpdateAdmin, onProcessLeave
}) => {
  const [showAddNurse, setShowAddNurse] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGeneratingMonth, setIsGeneratingMonth] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [staffingPrediction, setStaffingPrediction] = useState<string | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  
  const [selectedWardFilter, setSelectedWardFilter] = useState<WardType | 'All'>('All');
  const [rosterViewMode, setRosterViewMode] = useState<'list' | 'matrix' | 'calendar'>('calendar');
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [scanFormDefaults, setScanFormDefaults] = useState({ name: '', nckNo: '', specialty: '' });
  const [dashboardSelectedNurseId, setDashboardSelectedNurseId] = useState<number | null>(null);
  const [rosterSelectedNurseId, setRosterSelectedNurseId] = useState<number | null>(null);

  // Initialize selected nurse IDs when nurses are loaded
  React.useEffect(() => {
    if (nurses.length > 0) {
      if (dashboardSelectedNurseId === null) setDashboardSelectedNurseId(nurses[0].id);
      if (rosterSelectedNurseId === null) setRosterSelectedNurseId(nurses[0].id);
    }
  }, [nurses]);

  const getShiftsForNurse = (nurseId: number | null) => {
    const nurse = nurses.find(n => n.id === nurseId);
    if (!nurse) return Object.values(ShiftType);
    
    if (nurse.ward === 'Theatre') {
      return Object.values(ShiftType);
    } else {
      // Only Straight, Night, Leave (Off), and Off
      return [ShiftType.STRAIGHT, ShiftType.NIGHT, ShiftType.LEAVE, ShiftType.OFF];
    }
  };
  const [currentRosterMonth, setCurrentRosterMonth] = useState(new Date());
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isDefaultPassword = currentUser.password === 'admin123' || !currentUser.password;
  const wards: WardType[] = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5/6', 'ICU', 'Theatre'];

  const handleAiOptimize = async () => {
    setIsOptimizing(true);
    const today = new Date();
    const next7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    const result = await optimizeRoster(nurses, next7Days);
    if (result && Array.isArray(result)) {
      try {
        const response = await fetch('/api/duties/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        });
        const savedDuties = await response.json();
        setDuties(prev => [...prev, ...savedDuties]);
      } catch (err) {
        console.error('Failed to save optimized duties:', err);
      }
    }
    setIsOptimizing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleMonthlyGenerate = async () => {
    setIsGeneratingMonth(true);
    const year = currentRosterMonth.getFullYear();
    const month = currentRosterMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    });

    const result = await optimizeRoster(nurses, monthDays);
    if (result && Array.isArray(result)) {
      try {
        // Clear existing duties for this month
        await fetch(`/api/duties/month/${year}/${month}`, { method: 'DELETE' });
        
        const response = await fetch('/api/duties/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        });
        const savedDuties = await response.json();
        
        setDuties(prev => {
          const otherMonths = prev.filter(d => {
            const dDate = new Date(d.date);
            return dDate.getMonth() !== month || dDate.getFullYear() !== year;
          });
          return [...otherMonths, ...savedDuties];
        });
      } catch (err) {
        console.error('Failed to save monthly duties:', err);
      }
    }
    setIsGeneratingMonth(false);
  };

  const handleGetAiSummary = async () => {
    const msgContents = messages.map(m => `[${m.senderRole}] ${m.content}`);
    const summary = await summarizeMessages(msgContents);
    setAiSummary(summary);
  };

  const handlePredictStaffing = async () => {
    setIsPredicting(true);
    const prediction = await predictStaffingNeeds(nurses, duties, currentUser.role === 'cno' ? 'All' : currentUser.ward);
    setStaffingPrediction(prediction);
    setIsPredicting(false);
  };

  React.useEffect(() => {
    handlePredictStaffing();
  }, [duties.length]);

  const handleDocumentScan = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      // Delay to allow camera to focus
      await new Promise(r => setTimeout(r, 2000));
      
      if (canvasRef.current && videoRef.current) {
        const context = canvasRef.current.getContext('2d');
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context?.drawImage(videoRef.current, 0, 0);
        
        const base64Image = canvasRef.current.toDataURL('image/jpeg').split(',')[1];
        
        // Stop camera
        stream.getTracks().forEach(track => track.stop());

        // Call Gemini for OCR extraction
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
              { text: 'Extract the Full Name, NCK Registration Number, and Specialty from this medical practitioner certificate. Return ONLY a JSON object with keys: name, nckNo, specialty. If something is missing, use an empty string.' }
            ]
          },
          config: { responseMimeType: 'application/json' }
        });

        const data = JSON.parse(result.text);
        setScanFormDefaults({
          name: data.name || '',
          nckNo: data.nckNo || '',
          specialty: data.specialty || ''
        });
      }
    } catch (err) {
      console.error('Scan failed', err);
    } finally {
      setIsScanning(false);
    }
  };

  const nursesGroupedByWard = useMemo(() => {
    const groups: Record<string, Nurse[]> = {};
    const filteredBySearch = nurses.filter(n => 
      n.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) || 
      n.nckNo.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      n.specialty.toLowerCase().includes(staffSearchQuery.toLowerCase())
    );

    const relevantNurses = selectedWardFilter === 'All' 
      ? filteredBySearch 
      : filteredBySearch.filter(n => n.ward === selectedWardFilter);

    relevantNurses.forEach(nurse => {
      if (!groups[nurse.ward]) groups[nurse.ward] = [];
      groups[nurse.ward].push(nurse);
    });
    return groups;
  }, [nurses, selectedWardFilter, staffSearchQuery]);

  const staffOnLeave = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return duties
      .filter(d => d.date === today && d.shift === ShiftType.LEAVE)
      .map(d => nurses.find(n => n.id === d.nurseId))
      .filter(n => !!n) as Nurse[];
  }, [duties, nurses]);

  // Fix: Added handleManualAssign to process manual duty deployments
  const handleManualAssign = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nurseId = parseInt(formData.get('nurseId') as string);
    const date = formData.get('date') as string;
    const shift = formData.get('shift') as ShiftType;

    onAssignDuty({ nurseId, date, shift });
    e.currentTarget.reset();
  };

  // Fix: Added handlePasswordChange to handle administrative access key updates
  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (passwordForm.current !== currentUser.password && !(currentUser.password === undefined && passwordForm.current === 'admin123')) {
      setPasswordError('Current management key verification failed.');
      return;
    }
    if (passwordForm.new.length < 6) {
      setPasswordError('New key must be at least 6 characters.');
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('Key confirmation does not match.');
      return;
    }

    onUpdateAdmin({ password: passwordForm.new });
    setPasswordSuccess(true);
    setPasswordForm({ current: '', new: '', confirm: '' });
  };

  const renderOnboardingModal = () => {
    if (!showAddNurse) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-6 overflow-y-auto">
        <div className="bg-white p-10 lg:p-14 rounded-[4rem] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-500 my-8">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Practitioner Onboarding</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Official Unit Registration</p>
            </div>
            <button onClick={() => setShowAddNurse(false)} className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400"><X size={28} /></button>
          </div>

          <div className="mb-8 p-6 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-[2.5rem] flex flex-col items-center gap-4 text-center">
             <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg text-indigo-600">
               {isScanning ? <Loader2 size={32} className="animate-spin" /> : <Camera size={32} />}
             </div>
             <div>
               <p className="font-black text-slate-900 uppercase text-xs">AI Smart Scan</p>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 italic">Scan NCK certificate to auto-populate form</p>
             </div>
             <button onClick={handleDocumentScan} disabled={isScanning} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
               {isScanning ? 'Processing Document...' : 'Start Camera Scan'}
             </button>
             <video ref={videoRef} className="hidden" />
             <canvas ref={canvasRef} className="hidden" />
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const wardValue = (formData.get('ward') as WardType) || currentUser.ward;
            onAddNurse({
              name: formData.get('name') as string,
              email: formData.get('email') as string,
              phone: formData.get('phone') as string,
              nckNo: formData.get('nckNo') as string,
              ward: wardValue,
              specialty: formData.get('specialty') as string,
              password: 'TTNURSING123'
            });
            setShowAddNurse(false);
          }} className="space-y-6">
            <div className="space-y-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Full Name</label><input name="name" required defaultValue={scanFormDefaults.name} className="w-full bg-slate-50 border-2 border-slate-50 p-5 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800" placeholder="e.g. Mary Wambui" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Work Email</label><input name="email" type="email" required className="w-full bg-slate-50 border-2 border-slate-50 p-5 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800" placeholder="name@tumutumu.org" /></div>
              <div className="space-y-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Contact</label><input name="phone" type="tel" required className="w-full bg-slate-50 border-2 border-slate-50 p-5 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800" placeholder="+254..." /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><label className="block text-[10px) font-black text-slate-400 uppercase tracking-widest px-2">NCK Reg. Number</label><input name="nckNo" required defaultValue={scanFormDefaults.nckNo} className="w-full bg-slate-50 border-2 border-slate-50 p-5 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800" placeholder="NCK-XXXXX" /></div>
              <div className="space-y-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Specialty</label><input name="specialty" defaultValue={scanFormDefaults.specialty || "General Nursing"} className="w-full bg-slate-50 border-2 border-slate-50 p-5 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800" /></div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Unit Assignment</label>
              <select name="ward" defaultValue={currentUser.role === 'admin' ? currentUser.ward : 'Ward 1'} disabled={currentUser.role === 'admin'} className="w-full bg-slate-50 border-2 border-slate-50 p-5 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800 disabled:opacity-50 appearance-none">
                {wards.map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div className="flex gap-4 pt-4">
              <button type="submit" className="flex-1 bg-indigo-600 text-white py-5 rounded-[2rem] font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 uppercase tracking-widest text-[11px]">Finalize Registration</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {isDefaultPassword && (
              <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2.5rem] flex items-center justify-between gap-6 shadow-lg shadow-amber-100 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="bg-amber-100 p-3 rounded-2xl text-amber-600"><ShieldAlert size={28} /></div>
                  <div>
                    <p className="font-black text-amber-900 uppercase tracking-tight">Management Security Alert: Default Credentials</p>
                    <p className="text-xs text-amber-700 font-bold opacity-80 uppercase tracking-widest mt-1">Please update your HOD access key in the security tab immediately.</p>
                  </div>
                </div>
                <button onClick={() => onSwitchTab('security')} className="bg-amber-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all">Resolve Now</button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Ward Staff', val: nurses.length },
                { label: 'On Leave Today', val: staffOnLeave.length },
                { label: 'Active Today', val: duties.filter(d => d.date === new Date().toISOString().split('T')[0] && d.shift !== ShiftType.LEAVE).length },
                { label: 'Ward Comms', val: messages.length },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-default group">
                  <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 group-hover:text-indigo-400 transition-colors">{stat.label}</h3>
                  <p className="text-4xl font-black text-slate-900">{stat.val}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
                <h3 className="font-black text-slate-900 flex items-center gap-3 text-lg uppercase tracking-tight">
                  <LayoutGrid size={22} className="text-indigo-600" />
                  Live Roster Tracking - {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Live Updates Active</span>
                </div>
              </div>
              <div className="p-8 overflow-x-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Object.values(ShiftType).filter(s => s !== ShiftType.OFF && s !== ShiftType.LEAVE).map(shift => {
                    const activeNurses = duties
                      .filter(d => d.date === new Date().toISOString().split('T')[0] && d.shift === shift)
                      .map(d => nurses.find(n => n.id === d.nurseId))
                      .filter(n => !!n) as Nurse[];
                    
                    if (activeNurses.length === 0 && currentUser.role !== 'cno') return null;

                    return (
                      <div key={shift} className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{shift} Shift</h4>
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-black">{activeNurses.length}</span>
                        </div>
                        <div className="space-y-3">
                          {activeNurses.map(n => (
                            <div key={n.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all">
                              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs">{n.name[0]}</div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-800 truncate">{n.name}</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{n.ward}</p>
                              </div>
                            </div>
                          ))}
                          {activeNurses.length === 0 && (
                            <div className="p-4 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                              <p className="text-[9px] text-slate-300 font-bold uppercase">No deployment</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex items-center justify-between gap-6 group hover:border-indigo-400 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        {isPredicting ? <Loader2 size={32} className="animate-spin" /> : <Sparkles size={32} />}
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Staffing Insight</h4>
                        <p className="text-sm font-black text-slate-800 leading-tight">
                          {isPredicting ? 'Analyzing ward dynamics...' : (staffingPrediction || 'Stable staffing levels detected.')}
                        </p>
                      </div>
                    </div>
                    <button onClick={handlePredictStaffing} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-all"><Filter size={20} /></button>
                  </div>

                  <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-red-50/30">
                      <h3 className="font-black text-slate-900 flex items-center gap-3 text-lg uppercase tracking-tight">
                        <PlaneTakeoff size={22} className="text-red-600" />
                        Staff Currently on Leave
                      </h3>
                      <div className="bg-red-100 px-4 py-2 rounded-2xl border border-red-200 text-[10px] font-black text-red-600 uppercase tracking-widest">Absence Control</div>
                    </div>
                    <div className="p-8">
                      {staffOnLeave.length === 0 ? (
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest text-center py-6 italic">Full capacity - No staff on leave today.</p>
                      ) : (
                        <div className="space-y-8">
                          {currentUser.role === 'cno' ? (
                            Object.entries(
                              staffOnLeave.reduce((acc, n) => {
                                if (!acc[n.ward]) acc[n.ward] = [];
                                acc[n.ward].push(n);
                                return acc;
                              }, {} as Record<string, Nurse[]>)
                            ).map(([ward, wardStaff]) => (
                              <div key={ward} className="space-y-4">
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-2 border-l-2 border-indigo-600">{ward}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {(wardStaff as Nurse[]).map(n => (
                                    <div key={n.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                      <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-black">{n.name[0]}</div>
                                      <div>
                                        <p className="text-sm font-black text-slate-800">{n.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">{n.specialty}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {staffOnLeave.map(n => (
                                <div key={n.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-black">{n.name[0]}</div>
                                  <div>
                                    <p className="text-sm font-black text-slate-800">{n.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{n.ward} • {n.specialty}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <button onClick={handleAiOptimize} disabled={isOptimizing} className="flex-1 bg-indigo-600 text-white px-8 py-5 rounded-[2rem] flex items-center justify-center gap-3 font-black hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 disabled:opacity-50 group uppercase text-xs tracking-widest">
                      <Sparkles size={20} className="group-hover:animate-pulse" />
                      {isOptimizing ? 'AI Running Optimization...' : 'Run Smart Ward Optimizer'}
                    </button>
                    <button onClick={handleGetAiSummary} className="flex-1 bg-white border-2 border-slate-100 text-slate-700 px-8 py-5 rounded-[2rem] flex items-center justify-center gap-3 font-black hover:bg-slate-50 transition-all shadow-sm uppercase text-xs tracking-widest">
                      <MessageCircle size={20} />
                      AI Communication Summary
                    </button>
                  </div>

                  {aiSummary && (
                    <div className="bg-white border-2 border-indigo-100 p-8 rounded-[3rem] shadow-2xl shadow-indigo-50 relative overflow-hidden animate-in zoom-in-95 duration-500">
                      <div className="absolute top-0 right-0 p-3 bg-indigo-500 text-white text-[9px] font-black uppercase tracking-tighter">AI Analysis</div>
                      <h4 className="text-indigo-900 font-black mb-4 flex items-center gap-2 text-lg"><Sparkles size={22} /> Administrative Summary</h4>
                      <div className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed font-medium italic">{aiSummary}</div>
                      <button onClick={() => setAiSummary(null)} className="mt-6 text-xs text-indigo-600 font-black hover:underline uppercase tracking-widest">Dismiss</button>
                    </div>
                  )}

                  <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-black text-slate-900 flex items-center gap-3 text-lg uppercase tracking-tight">
                        <CalendarPlus size={22} className="text-indigo-600" />
                        Today's Roster Status
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-50/30 border-b border-slate-100">
                            <th className="px-10 py-5">Practitioner</th>
                            <th className="px-10 py-5">Unit</th>
                            <th className="px-10 py-5">Shift Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentUser.role === 'cno' ? (
                            Object.entries(nursesGroupedByWard).map(([ward, wardNurses]) => (
                              <React.Fragment key={ward}>
                                <tr className="bg-slate-50/50">
                                  <td colSpan={3} className="px-10 py-3 font-black text-[9px] uppercase tracking-widest text-indigo-600 border-y border-slate-100">{ward}</td>
                                </tr>
                                {(wardNurses as Nurse[]).map(nurse => {
                                  const duty = duties.find(d => d.nurseId === nurse.id && d.date === new Date().toISOString().split('T')[0]);
                                  return (
                                    <tr key={nurse.id} className="hover:bg-slate-50/50 transition-all group">
                                      <td className="px-10 py-6">
                                        <div className="flex items-center gap-4">
                                          <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600 text-sm border border-indigo-100 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">{nurse.name[0]}</div>
                                          <div><p className="font-black text-slate-800">{nurse.name}</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{nurse.specialty} • {nurse.nckNo}</p></div>
                                        </div>
                                      </td>
                                      <td className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase">{nurse.ward}</td>
                                      <td className="px-10 py-6">
                                        {duty ? (
                                          <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                                            duty.shift === ShiftType.MORNING ? 'bg-yellow-400 text-yellow-950 border-yellow-500' :
                                            duty.shift === ShiftType.AFTERNOON ? 'bg-orange-500 text-white border-orange-600' : 
                                            duty.shift === ShiftType.NIGHT ? 'bg-indigo-600 text-white border-indigo-700' :
                                            duty.shift === ShiftType.STRAIGHT ? 'bg-emerald-600 text-white border-emerald-700' :
                                            duty.shift === ShiftType.LEAVE ? 'bg-rose-500 text-white border-rose-600' : 'bg-slate-100 text-slate-400'
                                          }`}>
                                            {duty.shift}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300 italic text-[10px] font-black uppercase tracking-widest">Off Duty</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            ))
                          ) : (
                            nurses.map(nurse => {
                              const duty = duties.find(d => d.nurseId === nurse.id && d.date === new Date().toISOString().split('T')[0]);
                              return (
                                <tr key={nurse.id} className="hover:bg-slate-50/50 transition-all group">
                                  <td className="px-10 py-6">
                                    <div className="flex items-center gap-4">
                                      <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600 text-sm border border-indigo-100 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">{nurse.name[0]}</div>
                                      <div><p className="font-black text-slate-800">{nurse.name}</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{nurse.specialty} • {nurse.nckNo}</p></div>
                                    </div>
                                  </td>
                                  <td className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase">{nurse.ward}</td>
                                  <td className="px-10 py-6">
                                    {duty ? (
                                      <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                                        duty.shift === ShiftType.MORNING ? 'bg-yellow-400 text-yellow-950 border-yellow-500' :
                                        duty.shift === ShiftType.AFTERNOON ? 'bg-orange-500 text-white border-orange-600' : 
                                        duty.shift === ShiftType.NIGHT ? 'bg-indigo-600 text-white border-indigo-700' :
                                        duty.shift === ShiftType.STRAIGHT ? 'bg-emerald-600 text-white border-emerald-700' :
                                        duty.shift === ShiftType.LEAVE ? 'bg-rose-500 text-white border-rose-600' : 'bg-slate-100 text-slate-400'
                                      }`}>
                                        {duty.shift}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 italic text-[10px] font-black uppercase tracking-widest">Off Duty</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
               </div>

               <div className="space-y-8">
                  <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
                    <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tight"><UserPlus size={20} className="text-indigo-600" /> Quick Onboard</h3>
                    <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">Instantly add a new practitioner to {currentUser.role === 'cno' ? 'any unit' : 'your ward'}.</p>
                    <button onClick={() => setShowAddNurse(true)} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl">Activate Form <ChevronRight size={14} /></button>
                  </div>

                  <div className="bg-indigo-900 p-8 rounded-[3rem] text-white shadow-2xl shadow-indigo-200">
                    <h3 className="font-black mb-6 flex items-center gap-2 uppercase tracking-tight"><CalendarPlus size={20} className="text-indigo-400" /> Direct Assignment</h3>
                    <form onSubmit={handleManualAssign} className="space-y-5">
                       <div>
                          <label className="block text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-2 px-1">Staff Member</label>
                          <select name="nurseId" value={dashboardSelectedNurseId || ''} onChange={(e) => setDashboardSelectedNurseId(parseInt(e.target.value))} className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-2xl text-sm font-bold outline-none text-white appearance-none">
                            {nurses.map(n => <option key={n.id} value={n.id} className="text-slate-900">{n.name}</option>)}
                          </select>
                       </div>
                       <div>
                          <label className="block text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-2 px-1">Date</label>
                          <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-2xl text-sm font-bold outline-none text-white" />
                       </div>
                       <div>
                          <label className="block text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-2 px-1">Shift Type</label>
                          <select name="shift" className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-2xl text-sm font-bold outline-none text-white appearance-none">
                            {getShiftsForNurse(dashboardSelectedNurseId).map(s => <option key={s} value={s} className="text-slate-900">{s}</option>)}
                          </select>
                       </div>
                       <button type="submit" className="w-full bg-white text-indigo-900 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-50 transition-all shadow-lg mt-2">Deploy Duty</button>
                    </form>
                  </div>
               </div>
            </div>
          </div>
        );
      case 'staff':
        return (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4"><Users className="text-indigo-600" size={32} /> Hospital Staff Registry</h2>
                <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest">
                  {currentUser.role === 'cno' 
                    ? `Hospital Command • ${selectedWardFilter === 'All' ? 'Full Roster' : `${selectedWardFilter} Unit`}` 
                    : `Ward: ${currentUser.ward} Personnel`}
                </p>
              </div>
              <button onClick={() => setShowAddNurse(true)} className="bg-indigo-600 text-white px-8 py-4 rounded-[2rem] flex items-center gap-3 font-black hover:bg-indigo-700 shadow-2xl shadow-indigo-100 transition-all uppercase text-[10px] tracking-widest">
                <UserPlus size={20} /> Register Personnel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <div className="md:col-span-1 lg:col-span-3 relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search practitioners by name, NCK number or specialty..."
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-5 pl-16 rounded-[2rem] outline-none focus:border-indigo-600 shadow-sm font-bold text-slate-800"
                  />
               </div>
               {currentUser.role === 'cno' && (
                 <select 
                   value={selectedWardFilter} 
                   onChange={(e) => setSelectedWardFilter(e.target.value as WardType | 'All')}
                   className="w-full bg-white border border-slate-200 p-5 rounded-[2rem] outline-none focus:border-indigo-600 shadow-sm font-black uppercase text-[10px] tracking-widest text-slate-500 appearance-none text-center"
                 >
                   <option value="All">All Hospital Units</option>
                   {wards.map(w => <option key={w} value={w}>{w}</option>)}
                 </select>
               )}
            </div>

            <div className="space-y-16">
              {Object.keys(nursesGroupedByWard).length === 0 ? (
                <div className="text-center py-24 bg-white rounded-[4rem] border border-slate-200">
                   <Users size={64} className="mx-auto text-slate-200 mb-6" />
                   <p className="font-black text-slate-400 uppercase tracking-widest text-xs">No personnel onboarded in this selection.</p>
                </div>
              ) : (
                Object.entries(nursesGroupedByWard).sort(([a], [b]) => a.localeCompare(b)).map(([wardName, wardNurses]) => (
                  <div key={wardName} className="space-y-8 animate-in fade-in duration-500">
                    <div className="flex items-center gap-4 px-2">
                       <div className="h-px flex-1 bg-slate-200"></div>
                       <div className="flex items-center gap-3 bg-white px-6 py-2 rounded-2xl border border-slate-100 shadow-sm">
                          <MapPin size={16} className="text-indigo-600" />
                          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{wardName}</h3>
                          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg">
                            {(wardNurses as Nurse[]).length} Staff
                          </span>
                       </div>
                       <div className="h-px flex-1 bg-slate-200"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {(wardNurses as Nurse[]).map(nurse => <StaffCard key={nurse.id} nurse={nurse} />)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'messages':
        return (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Personnel Comms & Requests</h2>
              <button 
                onClick={handleGetAiSummary}
                className="bg-white border-2 border-indigo-100 text-indigo-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-50 transition-all shadow-sm"
              >
                <Sparkles size={18} /> Generate AI Summary
              </button>
            </div>

            {aiSummary && (
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700"><Sparkles size={120} /></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md"><Info size={20} /></div>
                    <h3 className="font-black uppercase tracking-widest text-xs text-indigo-200">AI Intelligence Summary</h3>
                  </div>
                  <div className="prose prose-invert max-w-none">
                    <p className="text-lg font-medium leading-relaxed text-indigo-50">{aiSummary}</p>
                  </div>
                  <button onClick={() => setAiSummary(null)} className="mt-8 text-[10px] font-black uppercase tracking-widest text-indigo-300 hover:text-white transition-colors">Dismiss Summary</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-10 space-y-8">
                {messages.length === 0 ? (
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-center py-12 italic">No incoming communications.</p>
                ) : (
                  currentUser.role === 'cno' ? (
                    Object.entries(
                      messages.reduce((acc, msg) => {
                        if (!acc[msg.ward]) acc[msg.ward] = [];
                        acc[msg.ward].push(msg);
                        return acc;
                      }, {} as Record<string, Message[]>)
                    ).map(([ward, wardMessages]) => (
                      <div key={ward} className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="h-px flex-1 bg-slate-100"></div>
                          <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] bg-white px-4">{ward} Unit Comms</h3>
                          <div className="h-px flex-1 bg-slate-100"></div>
                        </div>
                        {(wardMessages as Message[]).map((msg: Message) => {
                          const sender = nurses.find(n => n.id === msg.senderId);
                          const isLeaveRequest = msg.category === 'leave_request';
                          const isSwapRequest = msg.category === 'shift_swap';
                          const status = msg.metadata?.status || 'pending';

                          return (
                            <div key={msg.id} className={`p-8 rounded-[3rem] border transition-all ${ (isLeaveRequest || isSwapRequest) ? (status === 'approved' ? 'bg-emerald-50 border-emerald-100' : status === 'rejected' ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100 shadow-lg shadow-indigo-100/50') : 'bg-slate-50 border-slate-100'}`}>
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${ (isLeaveRequest || isSwapRequest) ? 'bg-white text-indigo-600 shadow-sm' : 'bg-indigo-900 text-white'}`}>{sender?.name[0] || 'A'}</div>
                                   <div>
                                      <p className="font-black text-slate-900">{sender?.name || 'Administrative Account'}</p>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{msg.timestamp} • {msg.ward}</p>
                                   </div>
                                </div>
                                {(isLeaveRequest || isSwapRequest) && (
                                  <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-indigo-600 border-indigo-200'}`}>
                                    {status} {isLeaveRequest ? 'Leave' : 'Swap'}
                                  </div>
                                )}
                              </div>
                              <p className="text-slate-700 font-medium leading-relaxed mb-6">{msg.content}</p>
                              {(isLeaveRequest || isSwapRequest) && status === 'pending' && onProcessLeave && (
                                <div className="flex gap-4">
                                  <button onClick={() => onProcessLeave(msg.id, 'approved')} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"><Check size={16} /> Approve {isLeaveRequest ? 'Leave' : 'Swap'}</button>
                                  <button onClick={() => onProcessLeave(msg.id, 'rejected')} className="bg-white text-red-600 border-2 border-red-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-50 transition-all"><Ban size={16} /> Reject</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    messages.map(msg => {
                      const sender = nurses.find(n => n.id === msg.senderId);
                      const isLeaveRequest = msg.category === 'leave_request';
                      const isSwapRequest = msg.category === 'shift_swap';
                      const status = msg.metadata?.status || 'pending';

                      return (
                        <div key={msg.id} className={`p-8 rounded-[3rem] border transition-all ${ (isLeaveRequest || isSwapRequest) ? (status === 'approved' ? 'bg-emerald-50 border-emerald-100' : status === 'rejected' ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100 shadow-lg shadow-indigo-100/50') : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-4">
                               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${ (isLeaveRequest || isSwapRequest) ? 'bg-white text-indigo-600 shadow-sm' : 'bg-indigo-900 text-white'}`}>{sender?.name[0] || 'A'}</div>
                               <div>
                                  <p className="font-black text-slate-900">{sender?.name || 'Administrative Account'}</p>
                                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{msg.timestamp} • {msg.ward}</p>
                               </div>
                            </div>
                            {(isLeaveRequest || isSwapRequest) && (
                              <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-indigo-600 border-indigo-200'}`}>
                                {status} {isLeaveRequest ? 'Leave' : 'Swap'}
                              </div>
                            )}
                          </div>
                          <p className="text-slate-700 font-medium leading-relaxed mb-6">{msg.content}</p>
                          {(isLeaveRequest || isSwapRequest) && status === 'pending' && onProcessLeave && (
                            <div className="flex gap-4">
                              <button onClick={() => onProcessLeave(msg.id, 'approved')} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"><Check size={16} /> Approve {isLeaveRequest ? 'Leave' : 'Swap'}</button>
                              <button onClick={() => onProcessLeave(msg.id, 'rejected')} className="bg-white text-red-600 border-2 border-red-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-50 transition-all"><Ban size={16} /> Reject</button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          </div>
        );
      case 'roster':
        const filteredDuties = duties.filter(d => {
          const dDate = new Date(d.date);
          return dDate.getMonth() === currentRosterMonth.getMonth() && dDate.getFullYear() === currentRosterMonth.getFullYear();
        });

        const daysInMonth = new Date(currentRosterMonth.getFullYear(), currentRosterMonth.getMonth() + 1, 0).getDate();
        const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        return (
          <div className="space-y-10 animate-in fade-in duration-500 print:m-0 print:p-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 print:hidden">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Deployment History</h2>
              <div className="flex flex-wrap items-center gap-4">
                <button 
                  onClick={handleMonthlyGenerate} 
                  disabled={isGeneratingMonth}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {isGeneratingMonth ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Generate {currentRosterMonth.toLocaleDateString(undefined, { month: 'short' })} Roster
                </button>
                <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                  <button 
                    onClick={() => setRosterViewMode('calendar')} 
                    className={`p-2 rounded-xl transition-all ${rosterViewMode === 'calendar' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                    title="Calendar View"
                  >
                    <Calendar size={20} />
                  </button>
                  <button 
                    onClick={() => setRosterViewMode('list')} 
                    className={`p-2 rounded-xl transition-all ${rosterViewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                    title="List View"
                  >
                    <LayoutGrid size={20} />
                  </button>
                  <button 
                    onClick={() => setRosterViewMode('matrix')} 
                    className={`p-2 rounded-xl transition-all ${rosterViewMode === 'matrix' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                    title="Matrix View"
                  >
                    <Table size={20} />
                  </button>
                </div>
                <button 
                  onClick={handlePrint}
                  className="bg-white border-2 border-slate-100 text-slate-700 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <Printer size={16} />
                  Print
                </button>
                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                  <button onClick={() => setCurrentRosterMonth(new Date())} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all font-black text-[9px] uppercase tracking-widest">Today</button>
                  <button onClick={() => {
                    const d = new Date(currentRosterMonth);
                    d.setMonth(d.getMonth() - 1);
                    setCurrentRosterMonth(d);
                  }} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"><ChevronLeft size={20} /></button>
                  <span className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-900">
                    {currentRosterMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => {
                    const d = new Date(currentRosterMonth);
                    d.setMonth(d.getMonth() + 1);
                    setCurrentRosterMonth(d);
                  }} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"><ChevronRightIcon size={20} /></button>
                </div>
              </div>
            </div>

            <div className="hidden print:block mb-10 text-center">
              <h1 className="text-2xl font-black uppercase tracking-widest text-indigo-900">PCEA Tumutumu Hospital</h1>
              <h2 className="text-xl font-bold text-slate-600 mt-2">Monthly Duty Roster - {currentRosterMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
            </div>

            {rosterViewMode === 'calendar' ? (
              <div className="bg-white rounded-[4rem] border border-slate-200 shadow-xl overflow-hidden print:border-none print:shadow-none">
                <div className="px-10 py-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center print:hidden">
                  <h3 className="font-black text-slate-900 uppercase text-lg">Monthly Roster Calendar</h3>
                  <div className="flex gap-4">
                    {Object.values(ShiftType).filter(s => s !== ShiftType.OFF).map(s => (
                      <div key={s} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          s === ShiftType.MORNING ? 'bg-yellow-400' :
                          s === ShiftType.AFTERNOON ? 'bg-orange-500' :
                          s === ShiftType.NIGHT ? 'bg-indigo-600' :
                          s === ShiftType.STRAIGHT ? 'bg-emerald-600' : 'bg-rose-500'
                        }`} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                          {s === ShiftType.MORNING || s === ShiftType.AFTERNOON ? `${s} (Theatre)` : s}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-3xl overflow-hidden">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="bg-slate-50 p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">{d}</div>
                      ))}
                      {(() => {
                        const firstDayOfMonth = new Date(currentRosterMonth.getFullYear(), currentRosterMonth.getMonth(), 1).getDay();
                        const daysInMonth = new Date(currentRosterMonth.getFullYear(), currentRosterMonth.getMonth() + 1, 0).getDate();
                        const cells = [];
                        
                        // Empty cells for previous month
                        for (let i = 0; i < firstDayOfMonth; i++) {
                          cells.push(<div key={`empty-${i}`} className="bg-slate-50/50 min-h-[150px]" />);
                        }
                        
                        // Days of the month
                        for (let day = 1; day <= daysInMonth; day++) {
                          const dateStr = `${currentRosterMonth.getFullYear()}-${String(currentRosterMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const dayDuties = duties.filter(d => d.date === dateStr);
                          const isToday = new Date().toISOString().split('T')[0] === dateStr;
                          
                          cells.push(
                            <div key={day} className={`bg-white min-h-[150px] p-4 border-slate-100 hover:bg-slate-50/50 transition-all ${isToday ? 'ring-2 ring-inset ring-indigo-500 z-10' : ''}`}>
                              <div className="flex justify-between items-start mb-3">
                                <span className={`text-sm font-black ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{day}</span>
                                {isToday && <span className="text-[8px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Today</span>}
                              </div>
                              <div className="space-y-1.5">
                                {dayDuties.map(duty => {
                                  const nurse = nurses.find(n => n.id === duty.nurseId);
                                  if (!nurse) return null;
                                  return (
                                    <div key={duty.id} className={`px-2 py-1 rounded-lg text-[9px] font-bold truncate flex items-center gap-1.5 border shadow-sm ${
                                      duty.shift === ShiftType.MORNING ? 'bg-yellow-50 border-yellow-100 text-yellow-900' :
                                      duty.shift === ShiftType.AFTERNOON ? 'bg-orange-50 border-orange-100 text-orange-900' :
                                      duty.shift === ShiftType.NIGHT ? 'bg-indigo-50 border-indigo-100 text-indigo-900' :
                                      duty.shift === ShiftType.STRAIGHT ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
                                      'bg-rose-50 border-rose-100 text-rose-900'
                                    }`}>
                                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        duty.shift === ShiftType.MORNING ? 'bg-yellow-400' :
                                        duty.shift === ShiftType.AFTERNOON ? 'bg-orange-500' :
                                        duty.shift === ShiftType.NIGHT ? 'bg-indigo-600' :
                                        duty.shift === ShiftType.STRAIGHT ? 'bg-emerald-600' : 'bg-rose-500'
                                      }`} />
                                      <span className="truncate flex-1">
                                        {currentUser.role === 'cno' && <span className="text-[7px] font-black text-indigo-400 mr-1">[{nurse.ward}]</span>}
                                        {nurse.name}
                                      </span>
                                      <span className="opacity-50 text-[7px] uppercase tracking-tighter shrink-0">{duty.shift[0]}</span>
                                    </div>
                                  );
                                })}
                                {dayDuties.length === 0 && (
                                  <div className="text-[8px] text-slate-300 italic font-medium">No duties</div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        
                        return cells;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ) : rosterViewMode === 'list' ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 print:block">
                <div className="lg:col-span-1 bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl shadow-slate-100 h-fit sticky top-36 print:hidden">
                  <h3 className="font-black mb-8 flex items-center gap-3 text-indigo-600 uppercase tracking-widest text-sm"><CalendarPlus size={24} /> New Post</h3>
                  <form onSubmit={handleManualAssign} className="space-y-8">
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Practitioner</label><select name="nurseId" value={rosterSelectedNurseId || ''} onChange={(e) => setRosterSelectedNurseId(parseInt(e.target.value))} className="w-full border-2 border-slate-50 bg-slate-50 p-5 rounded-[1.5rem] text-sm font-black outline-none focus:bg-white focus:border-indigo-600 shadow-sm appearance-none">{nurses.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Duty Date</label><input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full border-2 border-slate-50 bg-slate-50 p-5 rounded-[1.5rem] text-sm font-black outline-none focus:bg-white focus:border-indigo-600 shadow-sm" /></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Shift</label><select name="shift" className="w-full border-2 border-slate-50 bg-slate-50 p-5 rounded-[1.5rem] text-sm font-black outline-none focus:bg-white focus:border-indigo-600 shadow-sm appearance-none">{getShiftsForNurse(rosterSelectedNurseId).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 shadow-2xl mt-4 transition-all">Commit Duty</button>
                  </form>
                </div>
                <div className="lg:col-span-3 bg-white rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
                  <div className="px-10 py-8 bg-slate-50/50 border-b border-slate-100 font-black text-slate-900 uppercase text-lg print:hidden">Hospital Roster History</div>
                  <div className="max-h-[800px] overflow-y-auto custom-scrollbar print:max-h-none">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 sticky top-0 z-20 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                          <tr><th className="px-10 py-6">Date</th><th className="px-10 py-6">Personnel</th><th className="px-10 py-6">Shift</th><th className="px-10 py-6 print:hidden">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm font-bold">
                          {currentUser.role === 'cno' ? (
                            Object.entries(nursesGroupedByWard).map(([ward, wardNurses]) => {
                              const wardDuties = filteredDuties.filter(d => (wardNurses as Nurse[]).some(n => n.id === d.nurseId));
                              if (wardDuties.length === 0) return null;
                              return (
                                <React.Fragment key={ward}>
                                  <tr className="bg-slate-50/50">
                                    <td colSpan={4} className="px-10 py-4 font-black text-[10px] uppercase tracking-widest text-indigo-600 border-y border-slate-100">{ward}</td>
                                  </tr>
                                  {wardDuties.sort((a,b) => b.date.localeCompare(a.date)).map(duty => {
                                    const nurse = nurses.find(n => n.id === duty.nurseId);
                                    return (
                                      <tr key={duty.id} className="hover:bg-slate-50/80 transition-all">
                                        <td className="px-10 py-7 font-mono text-slate-400 text-xs tracking-widest">{duty.date}</td>
                                        <td className="px-10 py-7 font-black text-slate-800"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] text-indigo-400 print:hidden">{nurse?.name[0]}</div>{nurse?.name}</div></td>
                                        <td className="px-10 py-7">
                                          <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                                            duty.shift === ShiftType.MORNING ? 'bg-yellow-400 text-yellow-950 border-yellow-500' :
                                            duty.shift === ShiftType.AFTERNOON ? 'bg-orange-500 text-white border-orange-600' : 
                                            duty.shift === ShiftType.NIGHT ? 'bg-indigo-600 text-white border-indigo-700' :
                                            duty.shift === ShiftType.STRAIGHT ? 'bg-emerald-600 text-white border-emerald-700' :
                                            duty.shift === ShiftType.LEAVE ? 'bg-rose-500 text-white border-rose-600' : 'bg-slate-100 text-slate-400'
                                          }`}>
                                            {duty.shift}
                                          </span>
                                        </td>
                                        <td className="px-10 py-7 print:hidden"><button onClick={() => setDuties(prev => prev.filter(d => d.id !== duty.id))} className="text-red-400 hover:text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 px-3 py-1.5 rounded-xl transition-all">Revoke</button></td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })
                          ) : (
                            filteredDuties.sort((a,b) => b.date.localeCompare(a.date)).map(duty => {
                              const nurse = nurses.find(n => n.id === duty.nurseId);
                              return (
                                <tr key={duty.id} className="hover:bg-slate-50/80 transition-all">
                                  <td className="px-10 py-7 font-mono text-slate-400 text-xs tracking-widest">{duty.date}</td>
                                  <td className="px-10 py-7 font-black text-slate-800"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] text-indigo-400 print:hidden">{nurse?.name[0]}</div>{nurse?.name}</div></td>
                                  <td className="px-10 py-7">
                                    <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                                      duty.shift === ShiftType.MORNING ? 'bg-yellow-400 text-yellow-950 border-yellow-500' :
                                      duty.shift === ShiftType.AFTERNOON ? 'bg-orange-500 text-white border-orange-600' : 
                                      duty.shift === ShiftType.NIGHT ? 'bg-indigo-600 text-white border-indigo-700' :
                                      duty.shift === ShiftType.STRAIGHT ? 'bg-emerald-600 text-white border-emerald-700' :
                                      duty.shift === ShiftType.LEAVE ? 'bg-rose-500 text-white border-rose-600' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                      {duty.shift}
                                    </span>
                                  </td>
                                  <td className="px-10 py-7 print:hidden"><button onClick={() => setDuties(prev => prev.filter(d => d.id !== duty.id))} className="text-red-400 hover:text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 px-3 py-1.5 rounded-xl transition-all">Revoke</button></td>
                                </tr>
                              );
                            })
                          )}
                          {filteredDuties.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-10 py-20 text-center">
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">No deployment records for this period.</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[4rem] border border-slate-200 shadow-xl overflow-hidden print:border-none print:shadow-none">
                <div className="px-10 py-8 bg-slate-50/50 border-b border-slate-100 font-black text-slate-900 uppercase text-lg print:hidden">Monthly Duty Allocation Matrix</div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-[9px] text-slate-400 font-black uppercase tracking-tighter border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 sticky left-0 bg-slate-50 z-30 min-w-[150px]">Nurse Name</th>
                        {monthDays.map(day => {
                          const date = new Date(currentRosterMonth.getFullYear(), currentRosterMonth.getMonth(), day);
                          const dayName = date.toLocaleDateString(undefined, { weekday: 'narrow' });
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                          return (
                            <th key={day} className={`px-2 py-4 text-center min-w-[30px] ${isWeekend ? 'bg-slate-100/50' : ''}`}>
                              <div>{dayName}</div>
                              <div className="text-[11px] text-slate-900 mt-1">{day}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentUser.role === 'cno' ? (
                        Object.entries(nursesGroupedByWard).map(([ward, wardNurses]) => (
                          <React.Fragment key={ward}>
                            <tr className="bg-slate-100/50">
                              <td colSpan={monthDays.length + 1} className="px-6 py-3 font-black text-[10px] uppercase tracking-widest text-indigo-600 border-y border-slate-200 sticky left-0 z-20 bg-slate-50/80 backdrop-blur-sm">{ward}</td>
                            </tr>
                            {(wardNurses as Nurse[]).map(nurse => (
                              <tr key={nurse.id} className="hover:bg-slate-50/50 transition-all">
                                <td className="px-6 py-4 sticky left-0 bg-white z-20 font-black text-slate-800 text-xs border-r border-slate-100">{nurse.name}</td>
                                {monthDays.map(day => {
                                  const dateStr = `${currentRosterMonth.getFullYear()}-${String(currentRosterMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                  const duty = duties.find(d => d.nurseId === nurse.id && d.date === dateStr);
                                  const date = new Date(currentRosterMonth.getFullYear(), currentRosterMonth.getMonth(), day);
                                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                  
                                  return (
                                    <td key={day} className={`px-2 py-4 text-center ${isWeekend ? 'bg-slate-50/30' : ''}`}>
                                      {duty && duty.shift !== ShiftType.LEAVE ? (
                                        <div className="flex justify-center">
                                          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-100 animate-pulse" title={duty.shift} />
                                        </div>
                                      ) : duty && duty.shift === ShiftType.LEAVE ? (
                                        <div className="flex justify-center">
                                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200" title="Off Duty" />
                                        </div>
                                      ) : null}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </React.Fragment>
                        ))
                      ) : (
                        nurses
                          .filter(n => n.ward === currentUser.ward)
                          .map(nurse => (
                          <tr key={nurse.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-6 py-4 sticky left-0 bg-white z-20 font-black text-slate-800 text-xs border-r border-slate-100">{nurse.name}</td>
                            {monthDays.map(day => {
                              const dateStr = `${currentRosterMonth.getFullYear()}-${String(currentRosterMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const duty = duties.find(d => d.nurseId === nurse.id && d.date === dateStr);
                              const date = new Date(currentRosterMonth.getFullYear(), currentRosterMonth.getMonth(), day);
                              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                              
                              return (
                                <td key={day} className={`px-2 py-4 text-center ${isWeekend ? 'bg-slate-50/30' : ''}`}>
                                  {duty && duty.shift !== ShiftType.LEAVE ? (
                                    <div className="flex justify-center">
                                      <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-100 animate-pulse" title={duty.shift} />
                                    </div>
                                  ) : duty && duty.shift === ShiftType.LEAVE ? (
                                    <div className="flex justify-center">
                                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200" title="Off Duty" />
                                    </div>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-wrap gap-6 justify-center">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400" /> <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Morning (Theatre)</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500" /> <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Afternoon (Theatre)</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-600" /> <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Night</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-600" /> <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Straight</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /> <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">On Duty</span></div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-200" /> <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Off Duty / Leave</span></div>
                </div>
              </div>
            )}
          </div>
        );
      case 'security':
        return (
          <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-500">
            <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5"><Lock size={120} className="text-indigo-900" /></div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-10">
                  <div className="bg-indigo-100 p-4 rounded-3xl text-indigo-600 shadow-lg shadow-indigo-100/50"><ShieldAlert size={32} /></div>
                  <div><h2 className="text-3xl font-black text-slate-900 tracking-tight">Management Security</h2><p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Administrator Access Control</p></div>
                </div>
                <form onSubmit={handlePasswordChange} className="space-y-8">
                  {passwordError && <div className="bg-red-50 text-red-600 p-5 rounded-3xl text-xs font-black border border-red-100 uppercase tracking-widest animate-pulse">Error: {passwordError}</div>}
                  {passwordSuccess && <div className="bg-emerald-50 text-emerald-600 p-5 rounded-3xl text-xs font-black border border-emerald-100 uppercase tracking-widest flex items-center gap-3"><CheckCircle size={18} /> Admin Access Key Updated.</div>}
                  <div className="space-y-3"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Current Management Key</label><div className="relative"><Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="password" required value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-50 p-5 pl-14 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800" /></div></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">New Secure Key</label><input type="password" required value={passwordForm.new} onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-50 p-5 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800" /></div>
                    <div className="space-y-3"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Repeat New Key</label><input type="password" required value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-50 p-5 rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-800" /></div>
                  </div>
                  <button type="submit" className="w-full bg-indigo-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-black transition-all flex items-center justify-center gap-3 group"><Save size={20} className="group-hover:scale-110 transition-transform" /> Finalize Key Update</button>
                </form>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {renderContent()}
      {renderOnboardingModal()}
    </>
  );
};

export default AdminDashboard;
