import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, now } from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
export const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(DATA_DIR, 'db.json');

function makeSeedData() {
  const createdAt = now();

  return {
    users: [
      {
        id: 'usr_admin',
        name: 'Facilities Admin',
        email: 'admin@campus.local',
        role: 'admin',
        department: 'Operations',
        passwordHash: hashPassword('admin123', 'seed-admin'),
        createdAt
      },
      {
        id: 'usr_network',
        name: 'Network Team Lead',
        email: 'network@campus.local',
        role: 'admin',
        department: 'IT Services',
        passwordHash: hashPassword('network123', 'seed-network'),
        createdAt
      },
      {
        id: 'usr_student',
        name: 'Asha Rao',
        email: 'asha@student.local',
        role: 'user',
        department: 'Computer Science',
        passwordHash: hashPassword('user123', 'seed-student'),
        createdAt
      }
    ],
    issues: [
      {
        id: 'iss_wifi_library',
        title: 'Library Wi-Fi drops every few minutes',
        category: 'Network',
        priority: 'High',
        status: 'In Progress',
        location: 'Central Library, Floor 2',
        description:
          'Students are losing access during online quizzes and research sessions. The problem is worst near the east reading zone.',
        reporterId: 'usr_student',
        assigneeId: 'usr_network',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
        resolution: '',
        createdAt,
        updatedAt: createdAt,
        closedAt: null,
        comments: [
          {
            id: 'com_seed_1',
            authorId: 'usr_network',
            authorName: 'Network Team Lead',
            message: 'Router logs show repeated channel congestion. Site survey is scheduled.',
            createdAt
          }
        ],
        history: [
          {
            id: 'hist_seed_1',
            actorId: 'usr_student',
            actorName: 'Asha Rao',
            action: 'Issue created',
            detail: 'Issue reported in Network category with High priority.',
            createdAt
          },
          {
            id: 'hist_seed_2',
            actorId: 'usr_admin',
            actorName: 'Facilities Admin',
            action: 'Assigned',
            detail: 'Assigned to Network Team Lead.',
            createdAt
          },
          {
            id: 'hist_seed_3',
            actorId: 'usr_network',
            actorName: 'Network Team Lead',
            action: 'Status changed',
            detail: 'Status changed from Assigned to In Progress.',
            createdAt
          }
        ]
      },
      {
        id: 'iss_projector_b203',
        title: 'Projector not powering on',
        category: 'Equipment',
        priority: 'Medium',
        status: 'Open',
        location: 'Academic Block B, Room 203',
        description:
          'The ceiling projector does not start even after using the wall switch and remote. Classes are being moved to another room.',
        reporterId: 'usr_student',
        assigneeId: null,
        dueDate: '',
        resolution: '',
        createdAt,
        updatedAt: createdAt,
        closedAt: null,
        comments: [],
        history: [
          {
            id: 'hist_seed_4',
            actorId: 'usr_student',
            actorName: 'Asha Rao',
            action: 'Issue created',
            detail: 'Issue reported in Equipment category with Medium priority.',
            createdAt
          }
        ]
      }
    ],
    sessions: []
  };
}

export async function ensureDb() {
  await mkdir(DATA_DIR, { recursive: true });

  if (!existsSync(DB_PATH)) {
    await writeFile(DB_PATH, `${JSON.stringify(makeSeedData(), null, 2)}\n`, 'utf8');
  }
}

export async function readDb() {
  await ensureDb();
  const raw = await readFile(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

export async function writeDb(db) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

export async function transact(mutator) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

export async function clearSessions() {
  const db = await readDb();
  db.sessions = [];
  await writeDb(db);
}
