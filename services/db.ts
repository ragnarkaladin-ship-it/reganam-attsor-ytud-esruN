
import pg from 'pg';
import mongoose from 'mongoose';
import admin from 'firebase-admin';
import { Nurse, Duty, AdminUser, Message, WardType, ShiftType } from '../types';

const { Pool } = pg;

// Database Interface
export interface DatabaseService {
  init(): Promise<void>;
  getAdmins(): Promise<AdminUser[]>;
  getNurses(): Promise<Nurse[]>;
  getDuties(): Promise<Duty[]>;
  getMessages(): Promise<Message[]>;
  addNurse(nurse: Partial<Nurse>): Promise<Nurse>;
  addDuty(duty: Partial<Duty>): Promise<Duty>;
  addMessage(message: Partial<Message>): Promise<Message>;
  updateNurse(nurseId: number, update: Partial<Nurse>): Promise<Nurse>;
  updateDuty(dutyId: number, update: Partial<Duty>): Promise<Duty>;
  deleteDuty(dutyId: number): Promise<void>;
  updateMessage(messageId: number, update: Partial<Message>): Promise<Message>;
  login(email: string, password: string): Promise<{ user: Nurse | AdminUser; role: 'admin' | 'nurse' | 'cno' } | null>;
}

// PostgreSQL Implementation
class PostgresService implements DatabaseService {
  private pool: pg.Pool;

  constructor() {
    const ssl = process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false;
    this.pool = new Pool({
      host: process.env.PG_HOST,
      port: parseInt(process.env.PG_PORT || '5432'),
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      ssl: ssl,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async init() {
    let retries = 3;
    while (retries > 0) {
      try {
        await this.pool.query('SELECT 1');
        console.log("PostgreSQL connection verified.");
        break;
      } catch (err) {
        retries--;
        console.error(`PostgreSQL connection failed (${retries} retries left):`, err);
        if (retries === 0) throw err;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (process.env.DB_RESET === 'true') {
      console.warn("DB_RESET is true. Dropping all tables...");
      await this.pool.query(`
        DROP TABLE IF EXISTS duties CASCADE;
        DROP TABLE IF EXISTS messages CASCADE;
        DROP TABLE IF EXISTS nurses CASCADE;
        DROP TABLE IF EXISTS admins CASCADE;
      `);
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        ward TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nurses (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        ward TEXT NOT NULL,
        specialty TEXT,
        nck_no TEXT,
        password TEXT DEFAULT 'TTNURSING123'
      );

      CREATE TABLE IF NOT EXISTS duties (
        id SERIAL PRIMARY KEY,
        nurse_id INTEGER REFERENCES nurses(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        shift TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER,
        sender_role TEXT,
        ward TEXT,
        content TEXT,
        timestamp TEXT,
        category TEXT,
        metadata JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_duties_date ON duties(date);
      CREATE INDEX IF NOT EXISTS idx_duties_nurse ON duties(nurse_id);
      CREATE INDEX IF NOT EXISTS idx_nurses_email ON nurses(email);
      CREATE INDEX IF NOT EXISTS idx_messages_ward ON messages(ward);
    `);

    // Seed Admin Accounts
    const adminDefaults = [
      ['Ward 1 Manager', 'admin.ward1@tumutumu.org', 'admin123', 'admin', 'Ward 1'],
      ['Ward 2 Manager', 'admin.ward2@tumutumu.org', 'admin123', 'admin', 'Ward 2'],
      ['Ward 3 Manager', 'admin.ward3@tumutumu.org', 'admin123', 'admin', 'Ward 3'],
      ['Ward 4 Manager', 'admin.ward4@tumutumu.org', 'admin123', 'admin', 'Ward 4'],
      ['Ward 5/6 Manager', 'admin.ward56@tumutumu.org', 'admin123', 'admin', 'Ward 5/6'],
      ['ICU Manager', 'admin.icu@tumutumu.org', 'admin123', 'admin', 'ICU'],
      ['Theatre Manager', 'admin.theatre@tumutumu.org', 'admin123', 'admin', 'Theatre'],
      ['Chief Nursing Officer', 'cno@tumutumu.org', 'admin123', 'cno', 'All']
    ];

    for (const admin of adminDefaults) {
      await this.pool.query(
        `INSERT INTO admins (name, email, password, role, ward) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING`,
        admin
      );
    }
  }

  async getAdmins(): Promise<AdminUser[]> {
    const res = await this.pool.query('SELECT * FROM admins');
    return res.rows;
  }

  async getNurses(): Promise<Nurse[]> {
    const res = await this.pool.query('SELECT * FROM nurses');
    return res.rows.map(r => ({ ...r, nckNo: r.nck_no }));
  }

  async getDuties(): Promise<Duty[]> {
    const res = await this.pool.query('SELECT * FROM duties');
    return res.rows.map(r => ({ ...r, nurseId: r.nurse_id }));
  }

  async getMessages(): Promise<Message[]> {
    const res = await this.pool.query('SELECT * FROM messages');
    return res.rows.map(r => ({ ...r, senderId: r.sender_id, senderRole: r.sender_role }));
  }

  async addNurse(nurse: Partial<Nurse>): Promise<Nurse> {
    const res = await this.pool.query(
      'INSERT INTO nurses (name, email, phone, ward, specialty, nck_no) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nurse.name, nurse.email, nurse.phone, nurse.ward, nurse.specialty, nurse.nckNo]
    );
    return { ...res.rows[0], nckNo: res.rows[0].nck_no };
  }

  async addDuty(duty: Partial<Duty>): Promise<Duty> {
    const res = await this.pool.query(
      'INSERT INTO duties (nurse_id, date, shift) VALUES ($1, $2, $3) RETURNING *',
      [duty.nurseId, duty.date, duty.shift]
    );
    return { ...res.rows[0], nurseId: res.rows[0].nurse_id };
  }

  async addMessage(message: Partial<Message>): Promise<Message> {
    const res = await this.pool.query(
      'INSERT INTO messages (sender_id, sender_role, ward, content, timestamp, category, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [message.senderId, message.senderRole, message.ward, message.content, message.timestamp, message.category, message.metadata]
    );
    return { ...res.rows[0], senderId: res.rows[0].sender_id, senderRole: res.rows[0].sender_role };
  }

  async updateNurse(nurseId: number, update: Partial<Nurse>): Promise<Nurse> {
    const res = await this.pool.query(
      'UPDATE nurses SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), ward = COALESCE($4, ward), specialty = COALESCE($5, specialty), nck_no = COALESCE($6, nck_no) WHERE id = $7 RETURNING *',
      [update.name, update.email, update.phone, update.ward, update.specialty, update.nckNo, nurseId]
    );
    return { ...res.rows[0], nckNo: res.rows[0].nck_no };
  }

  async updateDuty(dutyId: number, update: Partial<Duty>): Promise<Duty> {
    const res = await this.pool.query(
      'UPDATE duties SET shift = $1 WHERE id = $2 RETURNING *',
      [update.shift, dutyId]
    );
    return { ...res.rows[0], nurseId: res.rows[0].nurse_id };
  }

  async deleteDuty(dutyId: number): Promise<void> {
    await this.pool.query('DELETE FROM duties WHERE id = $1', [dutyId]);
  }

  async updateMessage(messageId: number, update: Partial<Message>): Promise<Message> {
    const res = await this.pool.query(
      'UPDATE messages SET metadata = $1 WHERE id = $2 RETURNING *',
      [update.metadata, messageId]
    );
    return { ...res.rows[0], senderId: res.rows[0].sender_id, senderRole: res.rows[0].sender_role };
  }

  async login(email: string, password: string): Promise<{ user: Nurse | AdminUser; role: 'admin' | 'nurse' | 'cno' } | null> {
    const adminRes = await this.pool.query('SELECT * FROM admins WHERE email = $1 AND password = $2', [email.toLowerCase(), password]);
    if (adminRes.rows.length > 0) {
      return { user: adminRes.rows[0], role: adminRes.rows[0].role };
    }
    const nurseRes = await this.pool.query('SELECT * FROM nurses WHERE email = $1 AND password = $2', [email.toLowerCase(), password]);
    if (nurseRes.rows.length > 0) {
      return { user: { ...nurseRes.rows[0], nckNo: nurseRes.rows[0].nck_no }, role: 'nurse' };
    }
    return null;
  }
}

// MongoDB Implementation
class MongoService implements DatabaseService {
  private NurseModel = mongoose.model('Nurse', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    phone: String,
    ward: String,
    specialty: String,
    nckNo: String,
    password: { type: String, default: 'TTNURSING123' }
  }));

  private AdminModel = mongoose.model('Admin', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: String,
    ward: String
  }));

  private DutyModel = mongoose.model('Duty', new mongoose.Schema({
    nurseId: mongoose.Schema.Types.Mixed,
    date: String,
    shift: String
  }));

  private MessageModel = mongoose.model('Message', new mongoose.Schema({
    senderId: mongoose.Schema.Types.Mixed,
    senderRole: String,
    ward: String,
    content: String,
    timestamp: String,
    category: String,
    metadata: mongoose.Schema.Types.Mixed
  }));

  async init() {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nurseshift');
      console.log("MongoDB connection verified.");
    } catch (err) {
      console.error("MongoDB connection failed:", err);
      throw err;
    }
  }

  async getAdmins(): Promise<AdminUser[]> {
    const res = await this.AdminModel.find();
    return res.map(r => r.toObject() as any);
  }

  async getNurses(): Promise<Nurse[]> {
    const res = await this.NurseModel.find();
    return res.map(r => r.toObject() as any);
  }

  async getDuties(): Promise<Duty[]> {
    const res = await this.DutyModel.find();
    return res.map(r => r.toObject() as any);
  }

  async getMessages(): Promise<Message[]> {
    const res = await this.MessageModel.find();
    return res.map(r => r.toObject() as any);
  }

  async addNurse(nurse: Partial<Nurse>): Promise<Nurse> {
    const res = await this.NurseModel.create(nurse);
    return res.toObject() as any;
  }

  async addDuty(duty: Partial<Duty>): Promise<Duty> {
    const res = await this.DutyModel.create(duty);
    return res.toObject() as any;
  }

  async addMessage(message: Partial<Message>): Promise<Message> {
    const res = await this.MessageModel.create(message);
    return res.toObject() as any;
  }

  async updateNurse(nurseId: number, update: Partial<Nurse>): Promise<Nurse> {
    const res = await this.NurseModel.findByIdAndUpdate(nurseId, update, { new: true });
    if (!res) throw new Error('Nurse not found');
    return res.toObject() as any;
  }

  async updateDuty(dutyId: number, update: Partial<Duty>): Promise<Duty> {
    const res = await this.DutyModel.findByIdAndUpdate(dutyId, update, { new: true });
    if (!res) throw new Error('Duty not found');
    return res.toObject() as any;
  }

  async deleteDuty(dutyId: number): Promise<void> {
    await this.DutyModel.findByIdAndDelete(dutyId);
  }

  async updateMessage(messageId: number, update: Partial<Message>): Promise<Message> {
    const res = await this.MessageModel.findByIdAndUpdate(messageId, update, { new: true });
    if (!res) throw new Error('Message not found');
    return res.toObject() as any;
  }

  async login(email: string, password: string): Promise<{ user: Nurse | AdminUser; role: 'admin' | 'nurse' | 'cno' } | null> {
    const admin = await this.AdminModel.findOne({ email: email.toLowerCase(), password });
    if (admin) return { user: admin.toObject() as any, role: admin.role as any };
    const nurse = await this.NurseModel.findOne({ email: email.toLowerCase(), password });
    if (nurse) return { user: nurse.toObject() as any, role: 'nurse' };
    return null;
  }
}

// Firebase Implementation
class FirebaseService implements DatabaseService {
  private db: admin.firestore.Firestore;

  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    }
    this.db = admin.firestore();
  }

  async init() {}

  async getAdmins(): Promise<AdminUser[]> {
    const snapshot = await this.db.collection('admins').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  }

  async getNurses(): Promise<Nurse[]> {
    const snapshot = await this.db.collection('nurses').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  }

  async getDuties(): Promise<Duty[]> {
    const snapshot = await this.db.collection('duties').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  }

  async getMessages(): Promise<Message[]> {
    const snapshot = await this.db.collection('messages').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  }

  async addNurse(nurse: Partial<Nurse>): Promise<Nurse> {
    const docRef = await this.db.collection('nurses').add(nurse);
    return { id: docRef.id, ...nurse } as any;
  }

  async addDuty(duty: Partial<Duty>): Promise<Duty> {
    const docRef = await this.db.collection('duties').add(duty);
    return { id: docRef.id, ...duty } as any;
  }

  async addMessage(message: Partial<Message>): Promise<Message> {
    const docRef = await this.db.collection('messages').add(message);
    return { id: docRef.id, ...message } as any;
  }

  async updateNurse(nurseId: number, update: Partial<Nurse>): Promise<Nurse> {
    await this.db.collection('nurses').doc(nurseId.toString()).update(update);
    const doc = await this.db.collection('nurses').doc(nurseId.toString()).get();
    return { id: doc.id, ...doc.data() } as any;
  }

  async updateDuty(dutyId: number, update: Partial<Duty>): Promise<Duty> {
    await this.db.collection('duties').doc(dutyId.toString()).update(update);
    const doc = await this.db.collection('duties').doc(dutyId.toString()).get();
    return { id: doc.id, ...doc.data() } as any;
  }

  async deleteDuty(dutyId: number): Promise<void> {
    await this.db.collection('duties').doc(dutyId.toString()).delete();
  }

  async updateMessage(messageId: number, update: Partial<Message>): Promise<Message> {
    await this.db.collection('messages').doc(messageId.toString()).update(update);
    const doc = await this.db.collection('messages').doc(messageId.toString()).get();
    return { id: doc.id, ...doc.data() } as any;
  }

  async login(email: string, password: string): Promise<{ user: Nurse | AdminUser; role: 'admin' | 'nurse' | 'cno' } | null> {
    const adminSnapshot = await this.db.collection('admins').where('email', '==', email.toLowerCase()).where('password', '==', password).get();
    if (!adminSnapshot.empty) {
      const doc = adminSnapshot.docs[0];
      return { user: { id: doc.id, ...doc.data() } as any, role: doc.data().role };
    }
    const nurseSnapshot = await this.db.collection('nurses').where('email', '==', email.toLowerCase()).where('password', '==', password).get();
    if (!nurseSnapshot.empty) {
      const doc = nurseSnapshot.docs[0];
      return { user: { id: doc.id, ...doc.data() } as any, role: 'nurse' };
    }
    return null;
  }
}

// Memory Implementation (Fallback)
class MemoryService implements DatabaseService {
  private admins: AdminUser[] = [
    { id: 1, name: 'Ward 1 Manager', email: 'admin.ward1@tumutumu.org', role: 'admin', ward: 'Ward 1' },
    { id: 2, name: 'Chief Nursing Officer', email: 'cno@tumutumu.org', role: 'cno', ward: 'All' }
  ];
  private nurses: Nurse[] = [];
  private duties: Duty[] = [];
  private messages: Message[] = [];

  async init() {
    console.warn('USING MEMORY DATABASE FALLBACK. DATA WILL NOT PERSIST.');
  }

  async getAdmins(): Promise<AdminUser[]> { return this.admins; }
  async getNurses(): Promise<Nurse[]> { return this.nurses; }
  async getDuties(): Promise<Duty[]> { return this.duties; }
  async getMessages(): Promise<Message[]> { return this.messages; }

  async addNurse(nurse: Partial<Nurse>): Promise<Nurse> {
    const newNurse = { ...nurse, id: Date.now() } as Nurse;
    this.nurses.push(newNurse);
    return newNurse;
  }

  async addDuty(duty: Partial<Duty>): Promise<Duty> {
    const newDuty = { ...duty, id: Date.now() } as Duty;
    this.duties.push(newDuty);
    return newDuty;
  }

  async addMessage(message: Partial<Message>): Promise<Message> {
    const newMessage = { ...message, id: Date.now() } as Message;
    this.messages.push(newMessage);
    return newMessage;
  }

  async updateNurse(nurseId: number, update: Partial<Nurse>): Promise<Nurse> {
    const idx = this.nurses.findIndex(n => n.id === nurseId);
    if (idx === -1) throw new Error('Nurse not found');
    this.nurses[idx] = { ...this.nurses[idx], ...update };
    return this.nurses[idx];
  }

  async updateDuty(dutyId: number, update: Partial<Duty>): Promise<Duty> {
    const idx = this.duties.findIndex(d => d.id === dutyId);
    if (idx === -1) throw new Error('Duty not found');
    this.duties[idx] = { ...this.duties[idx], ...update };
    return this.duties[idx];
  }

  async deleteDuty(dutyId: number): Promise<void> {
    this.duties = this.duties.filter(d => d.id !== dutyId);
  }

  async updateMessage(messageId: number, update: Partial<Message>): Promise<Message> {
    const idx = this.messages.findIndex(m => m.id === messageId);
    if (idx === -1) throw new Error('Message not found');
    this.messages[idx] = { ...this.messages[idx], ...update };
    return this.messages[idx];
  }

  async login(email: string, password: string): Promise<{ user: Nurse | AdminUser; role: 'admin' | 'nurse' | 'cno' } | null> {
    const admin = this.admins.find(a => a.email.toLowerCase() === email.toLowerCase() && password === 'admin123');
    if (admin) return { user: admin, role: admin.role };
    const nurse = this.nurses.find(n => n.email.toLowerCase() === email.toLowerCase() && (n.password === password || password === 'TTNURSING123'));
    if (nurse) return { user: nurse, role: 'nurse' };
    return null;
  }
}

// Factory to get the correct database service
export function getDatabaseService(): DatabaseService {
  const type = process.env.DB_TYPE;
  
  if (!type || type === 'memory') {
    console.log('Using memory database.');
    return new MemoryService();
  }

  let service: DatabaseService;
  switch (type) {
    case 'mongodb':
      service = new MongoService();
      break;
    case 'firebase':
      service = new FirebaseService();
      break;
    case 'postgres':
      service = new PostgresService();
      break;
    default:
      console.warn(`Unknown DB_TYPE: ${type}, defaulting to memory.`);
      return new MemoryService();
  }

  // Wrap the service with a fallback mechanism
  const originalInit = service.init.bind(service);
  service.init = async function() {
    try {
      await originalInit();
    } catch (err) {
      console.error(`Failed to initialize ${type} database:`, err);
      console.warn('FALLING BACK TO MEMORY DATABASE DUE TO INITIALIZATION FAILURE.');
      
      // Replace the service instance with MemoryService
      const memory = new MemoryService();
      await memory.init();
      
      // Monkey-patch the service methods to use memory instead
      const methods: (keyof DatabaseService)[] = [
        'getAdmins', 'getNurses', 'getDuties', 'getMessages',
        'addNurse', 'addDuty', 'addMessage',
        'updateNurse', 'updateDuty', 'deleteDuty', 'updateMessage',
        'login'
      ];
      
      for (const method of methods) {
        (service as any)[method] = (memory as any)[method].bind(memory);
      }
    }
  };

  return service;
}

export const db = getDatabaseService();
