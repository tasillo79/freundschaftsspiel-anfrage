const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number(process.env.PORT ?? 3000);
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readTasks() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeTasks(tasks) {
  await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload zu groß.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Ungültiges JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function validateTaskInput(input) {
  if (!input.title || String(input.title).trim().length < 3) {
    return 'Titel muss mindestens 3 Zeichen haben.';
  }
  if (!input.details || String(input.details).trim().length < 5) {
    return 'Details müssen mindestens 5 Zeichen haben.';
  }
  if (!input.dueDate || Number.isNaN(new Date(input.dueDate).getTime())) {
    return 'Bitte ein gültiges Frist-Datum angeben.';
  }
  return null;
}

function mapTaskInput(input, existingTask = null) {
  return {
    id: existingTask?.id ?? randomUUID(),
    title: String(input.title).trim(),
    details: String(input.details).trim(),
    assignee: String(input.assignee ?? '').trim(),
    dueDate: new Date(input.dueDate).toISOString(),
    completed: Boolean(input.completed),
    createdAt: existingTask?.createdAt ?? new Date().toISOString(),
    completedAt: input.completed ? new Date().toISOString() : null
  };
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/tasks') {
    const tasks = await readTasks();
    return sendJson(res, 200, tasks);
  }

  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    const body = await parseBody(req);
    const error = validateTaskInput(body);
    if (error) return sendJson(res, 400, { error });

    const tasks = await readTasks();
    const task = mapTaskInput(body);
    tasks.push(task);
    await writeTasks(tasks);
    return sendJson(res, 201, task);
  }

  if (req.method === 'PATCH' && url.pathname.startsWith('/api/tasks/')) {
    const id = url.pathname.split('/').pop();
    const body = await parseBody(req);
    const tasks = await readTasks();
    const idx = tasks.findIndex((task) => task.id === id);

    if (idx < 0) return sendJson(res, 404, { error: 'Aufgabe nicht gefunden.' });

    const merged = { ...tasks[idx], ...body };
    const error = validateTaskInput(merged);
    if (error) return sendJson(res, 400, { error });

    tasks[idx] = mapTaskInput(merged, tasks[idx]);
    if (!body.completed && tasks[idx].completedAt) {
      tasks[idx].completedAt = null;
    }

    await writeTasks(tasks);
    return sendJson(res, 200, tasks[idx]);
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/tasks/')) {
    const id = url.pathname.split('/').pop();
    const tasks = await readTasks();
    const next = tasks.filter((task) => task.id !== id);
    if (next.length === tasks.length) {
      return sendJson(res, 404, { error: 'Aufgabe nicht gefunden.' });
    }
    await writeTasks(next);
    res.writeHead(204);
    return res.end();
  }

  return false;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (pathname === '/') pathname = '/index.html';
  const requestedPath = path.join(PUBLIC_DIR, pathname);

  if (!requestedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  try {
    const data = await fs.readFile(requestedPath);
    const ext = path.extname(requestedPath);
    const mime = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8'
    }[ext] ?? 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

async function requestListener(req, res) {
  try {
    const apiHandled = await handleApi(req, res);
    if (apiHandled !== false) return;
    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Interner Serverfehler.' });
  }
}

function createServer() {
  return http.createServer(requestListener);
}

if (require.main === module) {
  createServer().listen(PORT, HOST, () => {
    console.log(`Server läuft auf http://${HOST}:${PORT}`);
  });
}

module.exports = { createServer, readTasks, writeTasks, DATA_FILE };
