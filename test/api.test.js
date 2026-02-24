const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createServer, DATA_FILE } = require('../server');

let server;
let baseUrl;

test.before(async () => {
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(DATA_FILE, '[]');

  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('can create and list tasks', async () => {
  const createRes = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Dokumentation schreiben',
      details: 'Die neue API dokumentieren',
      dueDate: '2026-03-01',
      assignee: 'Anna'
    })
  });

  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.title, 'Dokumentation schreiben');

  const listRes = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(listRes.status, 200);
  const tasks = await listRes.json();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].assignee, 'Anna');
});

test('can toggle completion', async () => {
  const listRes = await fetch(`${baseUrl}/api/tasks`);
  const [task] = await listRes.json();

  const patchRes = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...task, completed: true })
  });

  assert.equal(patchRes.status, 200);
  const updated = await patchRes.json();
  assert.equal(updated.completed, true);
  assert.ok(updated.completedAt);
});
