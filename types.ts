
export enum ShiftType {
  MORNING = 'Morning',
  AFTERNOON = 'Afternoon',
  NIGHT = 'Night',
  STRAIGHT = 'Straight',
  OFF = 'Off',
  LEAVE = 'Leave'
}

export type WardType = 'Ward 1' | 'Ward 2' | 'Ward 3' | 'Ward 4' | 'Ward 5/6' | 'ICU' | 'Theatre' | 'All';

export interface Nurse {
  id: number;
  name: string;
  email: string;
  phone: string;
  ward: WardType;
  specialty: string;
  nckNo: string;
  password?: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'cno';
  ward: WardType;
}

export interface Duty {
  id: number;
  nurseId: number;
  date: string;
  shift: ShiftType;
}

export interface Message {
  id: number;
  senderId: number;
  senderRole: 'admin' | 'nurse' | 'system';
  ward: WardType;
  content: string;
  timestamp: string;
  category?: 'general' | 'leave_request' | 'shift_swap';
  metadata?: {
    startDate?: string;
    endDate?: string;
    myDate?: string;
    targetDate?: string;
    targetNurse?: string;
    isProcessed?: boolean;
    status?: 'approved' | 'rejected' | 'pending';
  };
}

export type UserRole = 'admin' | 'nurse' | 'cno';

export interface AppState {
  currentUser: Nurse | AdminUser | null;
  role: UserRole;
  nurses: Nurse[];
  duties: Duty[];
  messages: Message[];
}
