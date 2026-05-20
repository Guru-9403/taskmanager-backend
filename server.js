const express    = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CONFIG — loaded from environment variables ───────────
require('dotenv').config();
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME     = process.env.DB_NAME     || 'dailytask';
const JWT_SECRET  = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASS  = process.env.ADMIN_PASS;

if (!MONGODB_URI || !JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASS) {
  console.error("❌ ERROR: Missing required environment variables. Please check your .env file.");
  process.exit(1);
}

// ── MIDDLEWARE ───────────────────────────────────────────

app.use(cors());

app.use(cors({
  origin: '*'
}));

app.use(express.json());
app.use(express.static('public')); // serve HTML file

// ── MONGODB CONNECTION ───────────────────────────────────
let db;
const client = new MongoClient(MONGODB_URI);

async function connectDB() {
  try {
    await client.connect();
    db = client.db(DB_NAME);
    console.log('✅ Connected to MongoDB Atlas!');

    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('tasks').createIndex({ createdAt: 1 });
    console.log('✅ Indexes created!');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

// ── AUTH MIDDLEWARE ──────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ══════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════

// ── REGISTER ─────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashedPass = await bcrypt.hash(password, 10);
    const user = {
      name,
      email: email.toLowerCase(),
      password: hashedPass,
      visits: 0,
      joined: new Date().toLocaleDateString('en-IN'),
      createdAt: new Date()
    };

    const result = await db.collection('users').insertOne(user);

    // Add login log
    await addLog(name, email.toLowerCase(), 'login', db);

    // Update visits
    await db.collection('users').updateOne({ _id: result.insertedId }, { $inc: { visits: 1 } });

    const token = jwt.sign(
      { id: result.insertedId, name, email: email.toLowerCase(), role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, name, email: email.toLowerCase() });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── LOGIN ─────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Incorrect email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect email or password' });

    // Update visits & log
    await db.collection('users').updateOne({ _id: user._id }, { $inc: { visits: 1 } });
    await addLog(user.name, email.toLowerCase(), 'login', db);

    const token = jwt.sign(
      { id: user._id, name: user.name, email: email.toLowerCase(), role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, name: user.name, email: email.toLowerCase() });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── ADMIN LOGIN ───────────────────────────────────────────
app.post('/api/auth/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
<<<<<<< HEAD
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase())
      return res.status(401).json({ error: 'Incorrect admin email' });

    // Compare against bcrypt hash stored in ADMIN_PASS env var
    const match = await bcrypt.compare(password, ADMIN_PASS);
    if (!match)
      return res.status(401).json({ error: 'Incorrect admin password' });
=======
    if (password !== ADMIN_PASS)
      return res.status(401).json({ error: 'Incorrect admin password' });
    if (email.toLowerCase() !== ADMIN_EMAIL)
      return res.status(401).json({ error: 'Incorrect admin email' });
>>>>>>> 392a0984d023ad7a8bd213b0dff1a794e7990233

    await addLog('Admin', email.toLowerCase(), 'admin', db);

    const token = jwt.sign(
      { role: 'admin', email: email.toLowerCase() },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

<<<<<<< HEAD
// ── VERIFY ADMIN EMAIL (Step 1) ───────────────────────────
app.post('/api/auth/admin-check-email', (req, res) => {
  const { email } = req.body;
  if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase())
    return res.status(401).json({ error: 'Not a registered admin email' });
=======
// ── VERIFY ADMIN PASSWORD (Step 1) ───────────────────────
app.post('/api/auth/admin-check-pwd', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASS)
    return res.status(401).json({ error: 'Incorrect password' });
>>>>>>> 392a0984d023ad7a8bd213b0dff1a794e7990233
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════
//  TASK ROUTES
// ══════════════════════════════════════════════════════════

// ── GET ALL TASKS ─────────────────────────────────────────
app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const tasks = await db.collection('tasks').find({}).sort({ createdAt: 1 }).toArray();
    res.json(tasks.map(t => ({ ...t, id: t._id.toString() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD TASK ──────────────────────────────────────────────
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { task, asgn, stat, start, end } = req.body;
    if (!task || !asgn || !stat || !start || !end)
      return res.status(400).json({ error: 'All fields are required' });

    const newTask = { task, asgn, stat, start, end, createdAt: new Date() };
    const result  = await db.collection('tasks').insertOne(newTask);
    res.json({ ...newTask, id: result.insertedId.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE TASK ───────────────────────────────────────────
app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { task, asgn, stat, start, end } = req.body;
    await db.collection('tasks').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { task, asgn, stat, start, end } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE TASK ───────────────────────────────────────────
app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    await db.collection('tasks').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── BULK DELETE TASKS ─────────────────────────────────────
app.post('/api/tasks/bulk-delete', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;
    await db.collection('tasks').deleteMany({ _id: { $in: ids.map(id => new ObjectId(id)) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ══════════════════════════════════════════════════════════

// ── GET ALL USERS ─────────────────────────────────────────
app.get('/api/admin/users', adminMiddleware, async (req, res) => {
  try {
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET LOG ───────────────────────────────────────────────
app.get('/api/admin/log', adminMiddleware, async (req, res) => {
  try {
    const log = await db.collection('log').find({}).sort({ sno: 1 }).toArray();
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET ALL TASKS (ADMIN) ─────────────────────────────────
app.get('/api/admin/tasks', adminMiddleware, async (req, res) => {
  try {
    const tasks = await db.collection('tasks').find({}).sort({ createdAt: 1 }).toArray();
    res.json(tasks.map(t => ({ ...t, id: t._id.toString() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE TASK (ADMIN) ───────────────────────────────────
app.put('/api/admin/tasks/:id', adminMiddleware, async (req, res) => {
  try {
    const { task, asgn, stat, start, end } = req.body;
    await db.collection('tasks').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { task, asgn, stat, start, end } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OVERVIEW STATS ────────────────────────────────────────
app.get('/api/admin/overview', adminMiddleware, async (req, res) => {
  try {
    const [users, log, tasks] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('log').find({}).toArray(),
      db.collection('tasks').countDocuments()
    ]);
    res.json({
      totalUsers:  users,
      totalTasks:  tasks,
      totalLogins: log.filter(l => l.type === 'login').length,
      totalTrials: log.filter(l => l.type === 'trial').length,
      recentLog:   [...log].reverse().slice(0, 8)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ══════════════════════════════════════════════════════════
//  MEMBERS ROUTES
// ══════════════════════════════════════════════════════════

// ── GET ALL MEMBERS ───────────────────────────────────────
app.get('/api/members', async (req, res) => {
  try {
    let members = await db.collection('members').find({}).sort({ createdAt: 1 }).toArray();
    if (!members.length) {
      // Seed default members if none exist
      const defaults = ['guru','hema','dharani','jeeva'];
      await db.collection('members').insertMany(defaults.map(name => ({ name, createdAt: new Date() })));
      members = await db.collection('members').find({}).sort({ createdAt: 1 }).toArray();
    }
    res.json(members);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADD MEMBER ────────────────────────────────────────────
app.post('/api/members', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const existing = await db.collection('members').findOne({ name: name.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Member already exists' });
    const result = await db.collection('members').insertOne({ name: name.toLowerCase(), createdAt: new Date() });
    res.json({ id: result.insertedId, name: name.toLowerCase() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE MEMBER ─────────────────────────────────────────
app.delete('/api/members/:name', async (req, res) => {
  try {
    await db.collection('members').deleteOne({ name: req.params.name });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TRIAL LOG ─────────────────────────────────────────────
app.post('/api/trial-log', async (req, res) => {
  try {
    await addLog('Guest', 'guest@trial', 'trial', db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  HELPER
// ══════════════════════════════════════════════════════════
async function addLog(name, email, type, database) {
  const count = await database.collection('log').countDocuments();
  await database.collection('log').insertOne({
    sno: count + 1,
    name,
    email,
    type,
    time: new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  });
}

// ── START SERVER ──────────────────────────────────────────
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  Port ${PORT} is busy! Run this command first:`);
      console.log(`    netstat -ano | findstr :${PORT}`);
      console.log(`    Then: taskkill /PID <number> /F`);
      console.log(`    Then: npm start`);
      process.exit(1);
    }
  });
});
