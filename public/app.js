const taskList = document.querySelector('#task-list');
const form = document.querySelector('#task-form');
const messageEl = document.querySelector('#form-message');

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (response.status === 204) return null;

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Unbekannter Fehler');
  }
  return data;
}

function formatDate(dateIso) {
  return new Date(dateIso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function renderTasks(tasks) {
  if (!tasks.length) {
    taskList.innerHTML = '<li>Keine Aufgaben vorhanden.</li>';
    return;
  }

  taskList.innerHTML = tasks
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .map(
      (task) => `
      <li class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <header>
          <strong>${task.title}</strong>
          <span class="badge ${task.completed ? 'done' : ''}">${task.completed ? 'Erledigt' : 'Offen'}</span>
        </header>
        <p>${task.details}</p>
        <small>Frist: ${formatDate(task.dueDate)} ${task.assignee ? `| Zuständig: ${task.assignee}` : ''}</small>
        <div class="actions">
          <button class="secondary" data-action="toggle">${task.completed ? 'Als offen markieren' : 'Als erledigt markieren'}</button>
          <button class="danger" data-action="delete">Löschen</button>
        </div>
      </li>
    `
    )
    .join('');
}

async function loadTasks() {
  const tasks = await api('/api/tasks');
  renderTasks(tasks);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  messageEl.textContent = '';
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    form.reset();
    messageEl.textContent = 'Aufgabe gespeichert.';
    await loadTasks();
  } catch (error) {
    messageEl.textContent = error.message;
  }
});

taskList.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const taskItem = event.target.closest('.task-item');
  if (!taskItem) return;
  const id = taskItem.dataset.id;

  try {
    if (button.dataset.action === 'delete') {
      await api(`/api/tasks/${id}`, { method: 'DELETE' });
    }

    if (button.dataset.action === 'toggle') {
      const all = await api('/api/tasks');
      const current = all.find((task) => task.id === id);
      if (!current) return;
      await api(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...current, completed: !current.completed })
      });
    }
    await loadTasks();
  } catch (error) {
    alert(error.message);
  }
});

loadTasks();
