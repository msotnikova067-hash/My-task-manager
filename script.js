"use strict";

/**
 * Офлайн-планировщик.
 * Данные не отправляются в сеть: они сохраняются в localStorage браузера.
 */

const TASK_STORAGE_KEY = "task-manager-tasks-v3";
const LEGACY_TASK_STORAGE_KEYS = ["task-manager-tasks-v2", "task-manager-tasks-v1"];
const SCHEDULE_STORAGE_KEY = "task-manager-work-schedule-v1";
const CALENDAR_ENTRIES_STORAGE_KEY = "task-manager-calendar-entries-v2";
const LEGACY_CALENDAR_ENTRIES_STORAGE_KEY = "task-manager-calendar-entries-v1";
const APPEARANCE_STORAGE_KEY = "task-manager-appearance-v1";
const DEFAULT_ACCENT_COLOR = "#b52f42";
const MAX_BACKGROUND_DATA_URL_LENGTH = 2_400_000;

const CATEGORIES = {
  work: { label: "Работа", color: "#4896ff" },
  study: { label: "Учёба", color: "#a985ff" },
  personal: { label: "Личное", color: "#57ba69" },
  home: { label: "Дом", color: "#f4a048" },
  important: { label: "Важно", color: "#ef7096" },
  other: { label: "Другое", color: "#25bea7" }
};

const PRIORITIES = {
  low: { label: "Низкий", order: 1 },
  normal: { label: "Обычный", order: 2 },
  high: { label: "Высокий", order: 3 }
};

const RECURRENCES = {
  none: "Не повторяется",
  daily: "Каждый день",
  weekdays: "По будням",
  weekly: "Каждую неделю",
  monthly: "Каждый месяц"
};

const SCHEDULE_TYPES = {
  work: { label: "Рабочий день" },
  off: { label: "Выходной" },
  shift: { label: "Другая смена" }
};

const TIME_BLOCK_TYPES = {
  work: { label: "Работа" },
  study: { label: "Учёба" },
  personal: { label: "Личное" }
};

const LEGACY_COLOR_TO_CATEGORY = {
  violet: "study",
  blue: "work",
  teal: "other",
  green: "personal",
  orange: "home",
  pink: "important"
};

const elements = {
  taskForm: document.querySelector("#taskForm"),
  titleInput: document.querySelector("#taskTitle"),
  descriptionInput: document.querySelector("#taskDescription"),
  taskCategory: document.querySelector("#taskCategory"),
  taskPriority: document.querySelector("#taskPriority"),
  taskDueAt: document.querySelector("#taskDueAt"),
  taskRecurrence: document.querySelector("#taskRecurrence"),
  createError: document.querySelector("#createError"),
  taskList: document.querySelector("#taskList"),
  emptyState: document.querySelector("#emptyState"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyText: document.querySelector("#emptyText"),
  taskStats: document.querySelector("#taskStats"),
  filterButtons: document.querySelectorAll("[data-filter]"),

  editDialog: document.querySelector("#editDialog"),
  editForm: document.querySelector("#editTaskForm"),
  editTitle: document.querySelector("#editTitle"),
  editDescription: document.querySelector("#editDescription"),
  editCategory: document.querySelector("#editCategory"),
  editPriority: document.querySelector("#editPriority"),
  editDueAt: document.querySelector("#editDueAt"),
  editRecurrence: document.querySelector("#editRecurrence"),
  editError: document.querySelector("#editError"),
  deleteDialog: document.querySelector("#deleteDialog"),
  confirmDelete: document.querySelector("#confirmDelete"),

  todayDate: document.querySelector("#todayDate"),
  currentSchedule: document.querySelector("#currentSchedule"),
  currentScheduleDetail: document.querySelector("#currentScheduleDetail"),
  nextSchedule: document.querySelector("#nextSchedule"),
  nextScheduleDetail: document.querySelector("#nextScheduleDetail"),
  focusTask: document.querySelector("#focusTask"),
  focusTaskDetail: document.querySelector("#focusTaskDetail"),
  enableNotifications: document.querySelector("#enableNotifications"),
  notificationStatus: document.querySelector("#notificationStatus"),

  scheduleTypeButtons: document.querySelectorAll("[data-schedule-type]"),
  previousMonth: document.querySelector("#previousMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  calendarMonth: document.querySelector("#calendarMonth"),
  calendarGrid: document.querySelector("#calendarGrid"),
  scheduleStatus: document.querySelector("#scheduleStatus"),
  previousWeek: document.querySelector("#previousWeek"),
  nextWeek: document.querySelector("#nextWeek"),
  weekLabel: document.querySelector("#weekLabel"),
  weekTimeline: document.querySelector("#weekTimeline"),
  selectedScheduleDate: document.querySelector("#selectedScheduleDate"),
  timeBlockForm: document.querySelector("#timeBlockForm"),
  timeBlockType: document.querySelector("#timeBlockType"),
  timeBlockStart: document.querySelector("#timeBlockStart"),
  timeBlockEnd: document.querySelector("#timeBlockEnd"),
  timeBlockError: document.querySelector("#timeBlockError"),
  saveTimeBlock: document.querySelector("#saveTimeBlock"),
  cancelTimeEdit: document.querySelector("#cancelTimeEdit"),
  repeatScheduleForm: document.querySelector("#repeatScheduleForm"),
  repeatMode: document.querySelector("#repeatMode"),
  repeatCount: document.querySelector("#repeatCount"),
  repeatError: document.querySelector("#repeatError"),
  reminderForm: document.querySelector("#reminderForm"),
  reminderTitle: document.querySelector("#reminderTitle"),
  reminderTime: document.querySelector("#reminderTime"),
  reminderError: document.querySelector("#reminderError"),
  timeBlocksList: document.querySelector("#timeBlocksList"),
  remindersList: document.querySelector("#remindersList"),

  accentColor: document.querySelector("#accentColor"),
  accentColorValue: document.querySelector("#accentColorValue"),
  themeSwatches: document.querySelectorAll("[data-theme-color]"),
  backgroundUpload: document.querySelector("#backgroundUpload"),
  backgroundStatus: document.querySelector("#backgroundStatus"),
  clearBackground: document.querySelector("#clearBackground"),
  resetAppearance: document.querySelector("#resetAppearance"),

  exportBackup: document.querySelector("#exportBackup"),
  importBackup: document.querySelector("#importBackup"),
  backupStatus: document.querySelector("#backupStatus"),
  toast: document.querySelector("#toast")
};

let tasks = loadTasks();
let schedule = loadSchedule();
let calendarEntries = loadCalendarEntries();
let appearance = loadAppearance();
let activeFilter = "all";
let editingTaskId = null;
let deletingTaskId = null;
let editingTimeBlockId = null;
let activeScheduleType = "select";
let selectedScheduleDate = toDateKey(new Date());
let calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let weekStartDate = startOfWeek(new Date());
let toastTimer = null;
const notifiedReminderIds = new Set();

/** Инициализация интерфейса и всех обработчиков. */
function init() {
  elements.taskForm.addEventListener("submit", handleCreateTask);
  elements.titleInput.addEventListener("input", () => clearError(elements.createError, elements.titleInput));
  elements.taskRecurrence.addEventListener("change", () => clearError(elements.createError, elements.titleInput));
  elements.taskList.addEventListener("change", handleTaskToggle);
  elements.taskList.addEventListener("click", handleTaskAction);
  elements.filterButtons.forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.filter)));

  elements.editForm.addEventListener("submit", handleEditTask);
  elements.editTitle.addEventListener("input", () => clearError(elements.editError, elements.editTitle));
  document.querySelectorAll("[data-close-edit]").forEach((button) => button.addEventListener("click", () => elements.editDialog.close()));
  document.querySelectorAll("[data-close-delete]").forEach((button) => button.addEventListener("click", () => elements.deleteDialog.close()));
  elements.editDialog.addEventListener("close", resetEditDialog);
  elements.deleteDialog.addEventListener("close", () => { deletingTaskId = null; });
  elements.confirmDelete.addEventListener("click", deleteTask);

  elements.scheduleTypeButtons.forEach((button) => button.addEventListener("click", () => setScheduleType(button.dataset.scheduleType)));
  elements.previousMonth.addEventListener("click", () => changeCalendarMonth(-1));
  elements.nextMonth.addEventListener("click", () => changeCalendarMonth(1));
  elements.calendarGrid.addEventListener("click", handleCalendarDayClick);
  elements.previousWeek.addEventListener("click", () => changeWeek(-1));
  elements.nextWeek.addEventListener("click", () => changeWeek(1));
  elements.weekTimeline.addEventListener("click", handleWeekDayClick);
  elements.timeBlockForm.addEventListener("submit", handleTimeBlockSubmit);
  elements.cancelTimeEdit.addEventListener("click", resetTimeBlockForm);
  elements.timeBlocksList.addEventListener("click", handleTimeBlockListAction);
  elements.repeatScheduleForm.addEventListener("submit", handleRepeatSchedule);
  elements.reminderForm.addEventListener("submit", handleReminderSubmit);
  elements.reminderTitle.addEventListener("input", () => clearPlannerError(elements.reminderError));
  elements.remindersList.addEventListener("click", handleReminderListAction);

  elements.accentColor.addEventListener("input", () => setAccentColor(elements.accentColor.value));
  elements.themeSwatches.forEach((button) => button.addEventListener("click", () => setAccentColor(button.dataset.themeColor)));
  elements.backgroundUpload.addEventListener("change", handleBackgroundUpload);
  elements.clearBackground.addEventListener("click", clearBackground);
  elements.resetAppearance.addEventListener("click", resetAppearance);

  elements.exportBackup.addEventListener("click", exportBackup);
  elements.importBackup.addEventListener("change", importBackup);
  elements.enableNotifications.addEventListener("click", requestNotificationPermission);

  applyAppearance();
  renderAll();
  updateNotificationButton();
  checkDueReminders();
  window.setInterval(() => {
    renderDashboard();
    checkDueReminders();
  }, 30000);
  registerServiceWorker();
}

/* ---------- Хранилище и нормализация данных ---------- */

function loadTasks() {
  try {
    const raw = localStorage.getItem(TASK_STORAGE_KEY) || LEGACY_TASK_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    const parsed = JSON.parse(raw);
    return normalizeTasks(parsed);
  } catch (error) {
    console.warn("Не удалось прочитать задачи:", error);
    return [];
  }
}

function normalizeTasks(source) {
  if (!Array.isArray(source)) return [];
  return source.map(normalizeTask).filter(Boolean);
}

function normalizeTask(task) {
  if (!task || typeof task.title !== "string" || !task.title.trim()) return null;
  const legacyCategory = LEGACY_COLOR_TO_CATEGORY[task.color];
  const category = hasOwn(CATEGORIES, task.category) ? task.category : (legacyCategory || "other");
  return {
    id: typeof task.id === "string" && task.id ? task.id : createId("task"),
    title: task.title.trim(),
    description: typeof task.description === "string" ? task.description.trim() : "",
    category,
    priority: hasOwn(PRIORITIES, task.priority) ? task.priority : "normal",
    due_at: isValidDateTime(task.due_at) ? task.due_at : "",
    recurrence: hasOwn(RECURRENCES, task.recurrence) ? task.recurrence : "none",
    repeat_created: task.repeat_created === true,
    is_completed: task.is_completed === true,
    created_at: isValidDate(task.created_at) ? task.created_at : new Date().toISOString()
  };
}

function loadSchedule() {
  try {
    return normalizeSchedule(JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY)));
  } catch (error) {
    console.warn("Не удалось прочитать цветовые отметки графика:", error);
    return {};
  }
}

function normalizeSchedule(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source).filter(([key, value]) => isDateKey(key) && hasOwn(SCHEDULE_TYPES, value)));
}

function loadCalendarEntries() {
  try {
    const raw = localStorage.getItem(CALENDAR_ENTRIES_STORAGE_KEY) || localStorage.getItem(LEGACY_CALENDAR_ENTRIES_STORAGE_KEY);
    return normalizeCalendarEntries(JSON.parse(raw));
  } catch (error) {
    console.warn("Не удалось прочитать почасовой график:", error);
    return {};
  }
}

function normalizeCalendarEntries(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const normalized = {};

  Object.entries(source).forEach(([dateKey, entry]) => {
    if (!isDateKey(dateKey) || !entry || typeof entry !== "object") return;
    const blocks = Array.isArray(entry.blocks)
      ? entry.blocks
        .filter((block) => block && hasOwn(TIME_BLOCK_TYPES, block.type) && isValidTime(block.start) && isValidTime(block.end) && block.start < block.end)
        .map((block) => ({ id: typeof block.id === "string" && block.id ? block.id : createId("block"), type: block.type, start: block.start, end: block.end }))
      : [];
    const reminders = Array.isArray(entry.reminders)
      ? entry.reminders
        .filter((reminder) => reminder && typeof reminder.title === "string" && reminder.title.trim() && (!reminder.time || isValidTime(reminder.time)))
        .map((reminder) => ({ id: typeof reminder.id === "string" && reminder.id ? reminder.id : createId("reminder"), title: reminder.title.trim(), time: reminder.time || "" }))
      : [];
    if (blocks.length || reminders.length) normalized[dateKey] = { blocks, reminders };
  });
  return normalized;
}

function loadAppearance() {
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)));
  } catch (error) {
    console.warn("Не удалось прочитать настройки оформления:", error);
    return normalizeAppearance(null);
  }
}

function normalizeAppearance(source) {
  return {
    accent: isValidHexColor(source?.accent) ? source.accent.toLowerCase() : DEFAULT_ACCENT_COLOR,
    background: isValidBackgroundDataUrl(source?.background) ? source.background : null
  };
}

function saveTasks() { return saveToStorage(TASK_STORAGE_KEY, tasks, "Не удалось сохранить задачи."); }
function saveSchedule() { return saveToStorage(SCHEDULE_STORAGE_KEY, schedule, "Не удалось сохранить график."); }
function saveCalendarEntries() { return saveToStorage(CALENDAR_ENTRIES_STORAGE_KEY, calendarEntries, "Не удалось сохранить записи календаря."); }
function saveAppearance() { return saveToStorage(APPEARANCE_STORAGE_KEY, appearance, "Не удалось сохранить оформление."); }

function saveToStorage(key, value, message) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(message, error);
    showToast(`${message} Возможно, в браузере закончилось место.`);
    return false;
  }
}

/* ---------- Задачи ---------- */

function handleCreateTask(event) {
  event.preventDefault();
  const data = getTaskFormData("create");
  if (!validateTaskData(data, elements.createError, elements.titleInput)) return;

  tasks.push({ id: createId("task"), ...data, repeat_created: false, is_completed: false, created_at: new Date().toISOString() });
  saveTasks();
  elements.taskForm.reset();
  elements.taskCategory.value = "work";
  elements.taskPriority.value = "normal";
  elements.taskRecurrence.value = "none";
  clearError(elements.createError, elements.titleInput);
  renderTasksAndDashboard();
  showToast("Задача добавлена.");
  elements.titleInput.focus();
}

function getTaskFormData(mode) {
  const isEdit = mode === "edit";
  const title = (isEdit ? elements.editTitle : elements.titleInput).value.trim();
  const description = (isEdit ? elements.editDescription : elements.descriptionInput).value.trim();
  const category = (isEdit ? elements.editCategory : elements.taskCategory).value;
  const priority = (isEdit ? elements.editPriority : elements.taskPriority).value;
  const dueAt = (isEdit ? elements.editDueAt : elements.taskDueAt).value;
  const recurrence = (isEdit ? elements.editRecurrence : elements.taskRecurrence).value;
  return { title, description, category, priority, due_at: dueAt, recurrence };
}

function validateTaskData(data, errorElement, titleElement) {
  if (!data.title) {
    setError(errorElement, titleElement, "Введите название задачи — оно не может быть пустым.");
    return false;
  }
  if (!hasOwn(CATEGORIES, data.category) || !hasOwn(PRIORITIES, data.priority) || !hasOwn(RECURRENCES, data.recurrence)) {
    setError(errorElement, titleElement, "Проверьте параметры задачи.");
    return false;
  }
  if (data.due_at && !isValidDateTime(data.due_at)) {
    setError(errorElement, titleElement, "Укажите корректные дату и время.");
    return false;
  }
  if (data.recurrence !== "none" && !data.due_at) {
    setError(errorElement, titleElement, "Для повторяющейся задачи укажите срок выполнения.");
    return false;
  }
  clearError(errorElement, titleElement);
  return true;
}

function handleTaskToggle(event) {
  if (!event.target.matches('[data-action="toggle"]')) return;
  const task = tasks.find((item) => item.id === event.target.dataset.id);
  if (!task) return;

  task.is_completed = event.target.checked;
  let message = task.is_completed ? "Задача отмечена выполненной." : "Задача возвращена в активные.";

  // Повторяющаяся задача после выполнения создаёт следующую запись только один раз.
  if (task.is_completed && task.recurrence !== "none" && !task.repeat_created) {
    const nextDue = getNextDueDate(task.due_at, task.recurrence);
    if (nextDue) {
      tasks.push({
        id: createId("task"),
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        due_at: nextDue,
        recurrence: task.recurrence,
        repeat_created: false,
        is_completed: false,
        created_at: new Date().toISOString()
      });
      task.repeat_created = true;
      message = "Задача выполнена. Следующее повторение добавлено.";
    }
  }

  saveTasks();
  renderTasksAndDashboard();
  showToast(message);
}

function handleTaskAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button || button.dataset.action === "toggle") return;
  if (button.dataset.action === "edit") openEditDialog(button.dataset.id);
  if (button.dataset.action === "delete") openDeleteDialog(button.dataset.id);
}

function openEditDialog(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  editingTaskId = task.id;
  elements.editTitle.value = task.title;
  elements.editDescription.value = task.description;
  elements.editCategory.value = task.category;
  elements.editPriority.value = task.priority;
  elements.editDueAt.value = task.due_at;
  elements.editRecurrence.value = task.recurrence;
  clearError(elements.editError, elements.editTitle);
  elements.editDialog.showModal();
  elements.editTitle.focus();
  elements.editTitle.select();
}

function handleEditTask(event) {
  event.preventDefault();
  const data = getTaskFormData("edit");
  if (!validateTaskData(data, elements.editError, elements.editTitle)) return;
  const task = tasks.find((item) => item.id === editingTaskId);
  if (!task) {
    elements.editDialog.close();
    return;
  }
  Object.assign(task, data);
  task.repeat_created = false;
  saveTasks();
  renderTasksAndDashboard();
  elements.editDialog.close();
  showToast("Изменения сохранены.");
}

function resetEditDialog() {
  editingTaskId = null;
  elements.editForm.reset();
  clearError(elements.editError, elements.editTitle);
}

function openDeleteDialog(taskId) {
  if (!tasks.some((task) => task.id === taskId)) return;
  deletingTaskId = taskId;
  elements.deleteDialog.showModal();
  elements.confirmDelete.focus();
}

function deleteTask() {
  if (!deletingTaskId) return;
  tasks = tasks.filter((task) => task.id !== deletingTaskId);
  saveTasks();
  renderTasksAndDashboard();
  elements.deleteDialog.close();
  showToast("Задача удалена.");
}

function setFilter(filter) {
  activeFilter = filter;
  elements.filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  renderTaskList();
}

function renderTasksAndDashboard() {
  renderTaskList();
  renderDashboard();
}

function getVisibleTasks() {
  const visible = tasks.filter((task) => activeFilter === "all" || (activeFilter === "active" ? !task.is_completed : task.is_completed));
  return visible.sort(compareTasks);
}

function compareTasks(first, second) {
  if (first.is_completed !== second.is_completed) return Number(first.is_completed) - Number(second.is_completed);
  const firstDue = first.due_at ? new Date(first.due_at).getTime() : Number.POSITIVE_INFINITY;
  const secondDue = second.due_at ? new Date(second.due_at).getTime() : Number.POSITIVE_INFINITY;
  if (firstDue !== secondDue) return firstDue - secondDue;
  if (PRIORITIES[first.priority].order !== PRIORITIES[second.priority].order) return PRIORITIES[second.priority].order - PRIORITIES[first.priority].order;
  return new Date(second.created_at) - new Date(first.created_at);
}

function renderTaskList() {
  const completed = tasks.filter((task) => task.is_completed).length;
  const visibleTasks = getVisibleTasks();
  elements.taskStats.textContent = `Всего: ${tasks.length} · Выполнено: ${completed}`;
  elements.taskList.replaceChildren();
  if (!visibleTasks.length) {
    setEmptyStateText();
    elements.emptyState.hidden = false;
    return;
  }
  elements.emptyState.hidden = true;
  visibleTasks.forEach((task) => elements.taskList.append(createTaskCard(task)));
}

function setEmptyStateText() {
  if (!tasks.length) {
    elements.emptyTitle.textContent = "У вас пока нет задач";
    elements.emptyText.textContent = "Добавьте первую — и начните двигаться к цели.";
  } else if (activeFilter === "active") {
    elements.emptyTitle.textContent = "Активных задач нет";
    elements.emptyText.textContent = "Все задачи выполнены — отличный результат!";
  } else {
    elements.emptyTitle.textContent = "Выполненных задач пока нет";
    elements.emptyText.textContent = "Завершённые задачи появятся здесь.";
  }
}

function createTaskCard(task) {
  const category = CATEGORIES[task.category];
  const card = document.createElement("article");
  card.className = `task-card${task.is_completed ? " is-completed" : ""}${isTaskOverdue(task) ? " is-overdue" : ""}`;
  card.style.setProperty("--task-accent", category.color);

  const checkboxLabel = document.createElement("label");
  checkboxLabel.className = "task-checkbox";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.is_completed;
  checkbox.dataset.action = "toggle";
  checkbox.dataset.id = task.id;
  checkbox.setAttribute("aria-label", task.is_completed ? `Отменить выполнение задачи «${task.title}»` : `Отметить задачу «${task.title}» как выполненную`);
  checkboxLabel.append(checkbox);

  const content = document.createElement("div");
  content.className = "task-content";
  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;
  content.append(title);

  if (task.description) {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    content.append(description);
  }

  const footer = document.createElement("div");
  footer.className = "task-footer";
  footer.append(createTaskMeta("task-category", category.label));
  footer.append(createTaskMeta(`priority-${task.priority}`, `Приоритет: ${PRIORITIES[task.priority].label}`));
  if (task.due_at) {
    const due = createTaskMeta(isTaskOverdue(task) ? "task-due is-overdue" : "task-due", `${isTaskOverdue(task) ? "Просрочено: " : "Срок: "}${formatDueDate(task.due_at)}`);
    footer.append(due);
  }
  if (task.recurrence !== "none") footer.append(createTaskMeta("task-recurrence", RECURRENCES[task.recurrence]));
  content.append(footer);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(createActionButton("edit", task.id, "Редактировать задачу", editIcon()), createActionButton("delete", task.id, "Удалить задачу", deleteIcon()));
  card.append(checkboxLabel, content, actions);
  return card;
}

function createTaskMeta(className, text) {
  const meta = document.createElement("span");
  meta.className = `task-meta ${className}`;
  meta.textContent = text;
  return meta;
}

function createActionButton(action, id, label, iconMarkup) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-button";
  button.dataset.action = action;
  button.dataset.id = id;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = iconMarkup;
  return button;
}

/* ---------- Сводка «Сегодня» ---------- */

function renderDashboard() {
  const now = new Date();
  const todayKey = toDateKey(now);
  elements.todayDate.textContent = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(now);

  const todayBlocks = getSortedBlocks(todayKey);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const current = todayBlocks.find((block) => timeToMinutes(block.start) <= currentMinutes && timeToMinutes(block.end) > currentMinutes);
  const next = findNextBlock(now);

  if (current) {
    elements.currentSchedule.textContent = TIME_BLOCK_TYPES[current.type].label;
    elements.currentScheduleDetail.textContent = `${current.start}–${current.end} · ${Math.max(0, timeToMinutes(current.end) - currentMinutes)} мин. осталось`;
  } else {
    elements.currentSchedule.textContent = "Нет активного занятия";
    elements.currentScheduleDetail.textContent = "Свободное время или добавьте блок в график.";
  }

  if (next) {
    elements.nextSchedule.textContent = TIME_BLOCK_TYPES[next.block.type].label;
    elements.nextScheduleDetail.textContent = `${formatShortDate(next.dateKey)} · ${next.block.start}–${next.block.end}`;
  } else {
    elements.nextSchedule.textContent = "План свободен";
    elements.nextScheduleDetail.textContent = "В ближайшие 14 дней занятий нет.";
  }

  const nextTask = tasks.filter((task) => !task.is_completed && task.due_at).sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0];
  if (nextTask) {
    elements.focusTask.textContent = nextTask.title;
    elements.focusTaskDetail.textContent = `${CATEGORIES[nextTask.category].label} · ${isTaskOverdue(nextTask) ? "просрочено" : formatDueDate(nextTask.due_at)}`;
  } else {
    elements.focusTask.textContent = "Нет задач со сроком";
    elements.focusTaskDetail.textContent = "Добавьте срок, чтобы видеть ближайшую задачу.";
  }
}

function findNextBlock(now) {
  const currentKey = toDateKey(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  for (let offset = 0; offset <= 14; offset += 1) {
    const date = addDays(makeDateFromKey(currentKey), offset);
    const dateKey = toDateKey(date);
    const candidate = getSortedBlocks(dateKey).find((block) => offset > 0 || timeToMinutes(block.start) > currentMinutes);
    if (candidate) return { dateKey, block: candidate };
  }
  return null;
}

/* ---------- Календарь, график и напоминания ---------- */

function setScheduleType(type) {
  activeScheduleType = type;
  elements.scheduleTypeButtons.forEach((button) => {
    const isSelected = button.dataset.scheduleType === type;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  if (type === "select") elements.scheduleStatus.textContent = "Режим выбора: нажмите на дату, чтобы заполнить её план.";
  else if (type === "clear") elements.scheduleStatus.textContent = "Режим стирания: нажмите на день, чтобы снять цветовую отметку.";
  else elements.scheduleStatus.textContent = `Выбран тип: «${SCHEDULE_TYPES[type].label}». Нажмите на нужный день.`;
}

function changeCalendarMonth(direction) {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + direction, 1);
  renderCalendar();
}

function selectPlannerDate(dateKey, moveCalendar = false) {
  selectedScheduleDate = dateKey;
  weekStartDate = startOfWeek(makeDateFromKey(dateKey));
  if (moveCalendar) {
    const date = makeDateFromKey(dateKey);
    calendarDate = new Date(date.getFullYear(), date.getMonth(), 1);
  }
  resetTimeBlockForm();
  renderCalendar();
  renderWeekTimeline();
  renderDayPlanner();
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toDateKey(new Date());
  elements.calendarMonth.textContent = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(calendarDate);
  elements.calendarGrid.replaceChildren();

  for (let index = 0; index < firstDayIndex; index += 1) {
    const placeholder = document.createElement("span");
    placeholder.className = "calendar-day-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    elements.calendarGrid.append(placeholder);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = toDateKey(new Date(year, month, day));
    const scheduleType = schedule[dateKey];
    const entry = getCalendarEntry(dateKey);
    const entriesCount = (entry?.blocks.length || 0) + (entry?.reminders.length || 0);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.dataset.date = dateKey;
    button.textContent = String(day);
    if (dateKey === todayKey) button.classList.add("is-today");
    if (dateKey === selectedScheduleDate) button.classList.add("is-selected-date");
    if (scheduleType) {
      button.classList.add(`has-${scheduleType}`);
      const marker = document.createElement("span");
      marker.className = "day-marker";
      marker.setAttribute("aria-hidden", "true");
      button.append(marker);
    }
    if (entriesCount) {
      const badge = document.createElement("span");
      badge.className = "calendar-entry-badge";
      badge.textContent = String(Math.min(entriesCount, 9));
      badge.setAttribute("aria-hidden", "true");
      button.append(badge);
    }
    button.setAttribute("aria-label", buildCalendarAriaLabel(dateKey, scheduleType, entry));
    elements.calendarGrid.append(button);
  }
}

function buildCalendarAriaLabel(dateKey, scheduleType, entry) {
  const details = [];
  if (scheduleType) details.push(SCHEDULE_TYPES[scheduleType].label);
  if (entry?.blocks.length) details.push(`занятий: ${entry.blocks.length}`);
  if (entry?.reminders.length) details.push(`напоминаний: ${entry.reminders.length}`);
  return details.length ? `${formatLongDate(dateKey)}, ${details.join(", ")}` : formatLongDate(dateKey);
}

function handleCalendarDayClick(event) {
  const button = event.target.closest(".calendar-day[data-date]");
  if (!button) return;
  const dateKey = button.dataset.date;
  const previousType = schedule[dateKey];

  if (activeScheduleType === "select") {
    elements.scheduleStatus.textContent = `Выбрана дата: ${formatLongDate(dateKey)}.`;
  } else if (activeScheduleType === "clear" || previousType === activeScheduleType) {
    if (previousType) {
      delete schedule[dateKey];
      saveSchedule();
      elements.scheduleStatus.textContent = `Цветовая отметка за ${formatShortDate(dateKey)} удалена.`;
    }
  } else {
    schedule[dateKey] = activeScheduleType;
    saveSchedule();
    elements.scheduleStatus.textContent = `${formatShortDate(dateKey)}: «${SCHEDULE_TYPES[activeScheduleType].label}».`;
  }
  selectPlannerDate(dateKey);
}

function changeWeek(direction) {
  weekStartDate = addDays(weekStartDate, direction * 7);
  renderWeekTimeline();
}

function renderWeekTimeline() {
  const lastDay = addDays(weekStartDate, 6);
  elements.weekLabel.textContent = `${formatShortDate(toDateKey(weekStartDate))} — ${formatShortDate(toDateKey(lastDay))}`;
  elements.weekTimeline.replaceChildren();

  for (let index = 0; index < 7; index += 1) {
    const date = addDays(weekStartDate, index);
    const dateKey = toDateKey(date);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "week-day-card";
    card.dataset.weekDate = dateKey;
    if (dateKey === selectedScheduleDate) card.classList.add("is-selected");
    if (dateKey === toDateKey(new Date())) card.classList.add("is-today");

    const heading = document.createElement("span");
    heading.className = "week-day-heading";
    heading.textContent = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric" }).format(date);
    card.append(heading);

    const blocks = getSortedBlocks(dateKey);
    if (!blocks.length) {
      const empty = document.createElement("span");
      empty.className = "week-day-empty";
      empty.textContent = "Свободно";
      card.append(empty);
    } else {
      blocks.forEach((block) => {
        const pill = document.createElement("span");
        pill.className = `week-block week-block-${block.type}`;
        pill.textContent = `${block.start} ${TIME_BLOCK_TYPES[block.type].label}`;
        card.append(pill);
      });
    }
    elements.weekTimeline.append(card);
  }
}

function handleWeekDayClick(event) {
  const card = event.target.closest("[data-week-date]");
  if (!card) return;
  selectPlannerDate(card.dataset.weekDate, true);
  elements.scheduleStatus.textContent = `Выбрана дата: ${formatLongDate(card.dataset.weekDate)}.`;
}

function getCalendarEntry(dateKey, createIfMissing = false) {
  if (!calendarEntries[dateKey] && createIfMissing) calendarEntries[dateKey] = { blocks: [], reminders: [] };
  return calendarEntries[dateKey] || null;
}

function getSortedBlocks(dateKey) {
  return [...(getCalendarEntry(dateKey)?.blocks || [])].sort((a, b) => a.start.localeCompare(b.start));
}

function renderDayPlanner() {
  elements.selectedScheduleDate.textContent = formatLongDate(selectedScheduleDate);
  const entry = getCalendarEntry(selectedScheduleDate);
  const blocks = getSortedBlocks(selectedScheduleDate);
  const reminders = [...(entry?.reminders || [])].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  elements.timeBlocksList.replaceChildren();
  elements.remindersList.replaceChildren();
  if (blocks.length) blocks.forEach((block) => elements.timeBlocksList.append(createTimeBlockItem(block)));
  else elements.timeBlocksList.append(createPlannerEmptyMessage("На этот день занятий пока нет."));
  if (reminders.length) reminders.forEach((reminder) => elements.remindersList.append(createReminderItem(reminder)));
  else elements.remindersList.append(createPlannerEmptyMessage("Напоминаний на этот день нет."));
}

function createPlannerEmptyMessage(text) {
  const message = document.createElement("p");
  message.className = "planner-empty";
  message.textContent = text;
  return message;
}

function createTimeBlockItem(block) {
  const item = document.createElement("div");
  item.className = `planner-item time-block-item time-block-${block.type}`;
  const main = document.createElement("div");
  main.className = "planner-item-main";
  const type = document.createElement("span");
  type.className = "planner-item-type";
  type.textContent = TIME_BLOCK_TYPES[block.type].label;
  const time = document.createElement("strong");
  time.textContent = `${block.start} – ${block.end}`;
  main.append(type, time);
  const actions = document.createElement("div");
  actions.className = "planner-item-actions";
  actions.append(createPlannerActionButton("edit-time", block.id, "Изменить занятие", "✎"), createPlannerActionButton("delete-time", block.id, "Удалить занятие", "×"));
  item.append(main, actions);
  return item;
}

function createReminderItem(reminder) {
  const item = document.createElement("div");
  item.className = "planner-item reminder-item";
  const main = document.createElement("div");
  main.className = "planner-item-main";
  const time = document.createElement("span");
  time.className = "reminder-time";
  time.textContent = reminder.time || "Без времени";
  const title = document.createElement("strong");
  title.textContent = reminder.title;
  main.append(time, title);
  const actions = document.createElement("div");
  actions.className = "planner-item-actions";
  actions.append(createPlannerActionButton("delete-reminder", reminder.id, "Удалить напоминание", "×"));
  item.append(main, actions);
  return item;
}

function createPlannerActionButton(action, id, label, symbol) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "planner-action-button";
  button.dataset.dayAction = action;
  button.dataset.id = id;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = symbol;
  return button;
}

function handleTimeBlockSubmit(event) {
  event.preventDefault();
  const type = elements.timeBlockType.value;
  const start = elements.timeBlockStart.value;
  const end = elements.timeBlockEnd.value;
  if (!hasOwn(TIME_BLOCK_TYPES, type) || !isValidTime(start) || !isValidTime(end) || start >= end) {
    setPlannerError(elements.timeBlockError, "Укажите корректное время: начало должно быть раньше конца.");
    return;
  }
  const entry = getCalendarEntry(selectedScheduleDate, true);
  const overlaps = entry.blocks.some((block) => block.id !== editingTimeBlockId && start < block.end && end > block.start);
  if (overlaps) {
    setPlannerError(elements.timeBlockError, "Этот интервал пересекается с уже добавленным занятием.");
    return;
  }

  if (editingTimeBlockId) {
    const block = entry.blocks.find((item) => item.id === editingTimeBlockId);
    if (!block) return resetTimeBlockForm();
    Object.assign(block, { type, start, end });
    elements.scheduleStatus.textContent = "Почасовой блок изменён.";
  } else {
    entry.blocks.push({ id: createId("block"), type, start, end });
    elements.scheduleStatus.textContent = `${TIME_BLOCK_TYPES[type].label}: ${start}–${end} добавлено.`;
  }
  saveCalendarEntries();
  resetTimeBlockForm();
  renderPlannerViews();
}

function handleTimeBlockListAction(event) {
  const button = event.target.closest("[data-day-action]");
  if (!button) return;
  const entry = getCalendarEntry(selectedScheduleDate);
  if (!entry) return;
  const blockId = button.dataset.id;

  if (button.dataset.dayAction === "edit-time") {
    const block = entry.blocks.find((item) => item.id === blockId);
    if (!block) return;
    editingTimeBlockId = block.id;
    elements.timeBlockType.value = block.type;
    elements.timeBlockStart.value = block.start;
    elements.timeBlockEnd.value = block.end;
    clearPlannerError(elements.timeBlockError);
    elements.saveTimeBlock.textContent = "Сохранить блок";
    elements.cancelTimeEdit.hidden = false;
    elements.timeBlockStart.focus();
  }

  if (button.dataset.dayAction === "delete-time") {
    entry.blocks = entry.blocks.filter((block) => block.id !== blockId);
    removeCalendarEntryIfEmpty(selectedScheduleDate);
    saveCalendarEntries();
    resetTimeBlockForm();
    elements.scheduleStatus.textContent = "Почасовой блок удалён.";
    renderPlannerViews();
  }
}

/** Копирует график выбранного дня на следующие дни, будни или недели. */
function handleRepeatSchedule(event) {
  event.preventDefault();
  const mode = elements.repeatMode.value;
  const count = Number(elements.repeatCount.value);
  const source = getCalendarEntry(selectedScheduleDate);
  if (!source?.blocks.length) {
    setPlannerError(elements.repeatError, "Сначала добавьте хотя бы один почасовой блок на выбранный день.");
    return;
  }
  if (!["daily", "weekdays", "weekly"].includes(mode) || !Number.isInteger(count) || count < 1 || count > 60) {
    setPlannerError(elements.repeatError, "Укажите от 1 до 60 повторений.");
    return;
  }

  let cursor = makeDateFromKey(selectedScheduleDate);
  let copiedDays = 0;
  let copiedBlocks = 0;
  while (copiedDays < count) {
    cursor = getNextScheduleDate(cursor, mode);
    const targetKey = toDateKey(cursor);
    const target = getCalendarEntry(targetKey, true);
    let copiedToThisDay = 0;
    source.blocks.forEach((block) => {
      const overlaps = target.blocks.some((item) => block.start < item.end && block.end > item.start);
      if (!overlaps) {
        target.blocks.push({ id: createId("block"), type: block.type, start: block.start, end: block.end });
        copiedToThisDay += 1;
      }
    });
    if (schedule[selectedScheduleDate] && !schedule[targetKey]) schedule[targetKey] = schedule[selectedScheduleDate];
    if (copiedToThisDay) {
      copiedDays += 1;
      copiedBlocks += copiedToThisDay;
    } else {
      // Дата уже заполнена: считаем её обработанной, чтобы цикл гарантированно завершился.
      copiedDays += 1;
    }
  }

  saveCalendarEntries();
  saveSchedule();
  clearPlannerError(elements.repeatError);
  elements.scheduleStatus.textContent = `Создано повторений: ${count}; добавлено блоков: ${copiedBlocks}.`;
  renderPlannerViews();
}

function getNextScheduleDate(date, mode) {
  let next = addDays(date, mode === "weekly" ? 7 : 1);
  if (mode === "weekdays") {
    while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1);
  }
  return next;
}

function handleReminderSubmit(event) {
  event.preventDefault();
  const title = elements.reminderTitle.value.trim();
  const time = elements.reminderTime.value;
  if (!title) {
    setPlannerError(elements.reminderError, "Введите текст напоминания.");
    elements.reminderTitle.focus();
    return;
  }
  if (time && !isValidTime(time)) {
    setPlannerError(elements.reminderError, "Укажите корректное время напоминания.");
    return;
  }
  const entry = getCalendarEntry(selectedScheduleDate, true);
  entry.reminders.push({ id: createId("reminder"), title, time });
  saveCalendarEntries();
  elements.reminderForm.reset();
  elements.reminderTime.value = "09:00";
  clearPlannerError(elements.reminderError);
  elements.scheduleStatus.textContent = `Напоминание на ${formatShortDate(selectedScheduleDate)} добавлено.`;
  renderPlannerViews();
}

function handleReminderListAction(event) {
  const button = event.target.closest('[data-day-action="delete-reminder"]');
  if (!button) return;
  const entry = getCalendarEntry(selectedScheduleDate);
  if (!entry) return;
  entry.reminders = entry.reminders.filter((reminder) => reminder.id !== button.dataset.id);
  removeCalendarEntryIfEmpty(selectedScheduleDate);
  saveCalendarEntries();
  elements.scheduleStatus.textContent = "Напоминание удалено.";
  renderPlannerViews();
}

function renderPlannerViews() {
  renderCalendar();
  renderWeekTimeline();
  renderDayPlanner();
  renderDashboard();
}

function resetTimeBlockForm() {
  editingTimeBlockId = null;
  elements.timeBlockForm.reset();
  elements.timeBlockType.value = "work";
  elements.timeBlockStart.value = "08:00";
  elements.timeBlockEnd.value = "14:00";
  elements.saveTimeBlock.textContent = "Добавить блок";
  elements.cancelTimeEdit.hidden = true;
  clearPlannerError(elements.timeBlockError);
}

function setPlannerError(element, text) { element.textContent = text; }
function clearPlannerError(element) { element.textContent = ""; }
function removeCalendarEntryIfEmpty(dateKey) {
  const entry = calendarEntries[dateKey];
  if (entry && !entry.blocks.length && !entry.reminders.length) delete calendarEntries[dateKey];
}

/* ---------- Напоминания в открытом приложении ---------- */

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    elements.notificationStatus.textContent = "Этот браузер не поддерживает системные уведомления.";
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    updateNotificationButton();
    elements.notificationStatus.textContent = permission === "granted" ? "Уведомления включены для напоминаний при открытом приложении." : "Разрешение на уведомления не получено.";
  } catch (error) {
    elements.notificationStatus.textContent = "Не удалось запросить разрешение на уведомления.";
  }
}

function updateNotificationButton() {
  if (!("Notification" in window)) {
    elements.enableNotifications.hidden = true;
    return;
  }
  const granted = Notification.permission === "granted";
  elements.enableNotifications.textContent = granted ? "Уведомления включены" : "Включить уведомления";
  elements.enableNotifications.disabled = granted;
}

function checkDueReminders() {
  const now = new Date();
  const todayKey = toDateKey(now);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const reminders = getCalendarEntry(todayKey)?.reminders || [];
  reminders.filter((reminder) => reminder.time === currentTime).forEach((reminder) => {
    const notificationKey = `${todayKey}-${reminder.id}-${currentTime}`;
    if (notifiedReminderIds.has(notificationKey)) return;
    notifiedReminderIds.add(notificationKey);
    showToast(`Напоминание: ${reminder.title}`);
    showBrowserNotification("Менеджер задач", reminder.title);
  });
}

async function showBrowserNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) await registration.showNotification(title, { body, icon: "icons/icon.svg", badge: "icons/icon.svg" });
    else new Notification(title, { body });
  } catch (error) {
    // В локальном HTML Service Worker недоступен; уведомление не должно ломать интерфейс.
    console.warn("Не удалось показать системное уведомление:", error);
  }
}

/* ---------- Резервное копирование ---------- */

function exportBackup() {
  const backup = {
    app: "offline-task-manager",
    version: 4,
    exported_at: new Date().toISOString(),
    tasks,
    schedule,
    calendar_entries: calendarEntries,
    appearance
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `planner-backup-${toDateKey(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  elements.backupStatus.textContent = "Резервная копия сохранена в загрузках.";
}

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const backup = JSON.parse(reader.result);
      if (!backup || typeof backup !== "object" || !Array.isArray(backup.tasks)) throw new Error("Неверный формат");
      if (!window.confirm("Импорт заменит текущие задачи, график, напоминания и оформление. Продолжить?")) return;

      tasks = normalizeTasks(backup.tasks);
      schedule = normalizeSchedule(backup.schedule);
      calendarEntries = normalizeCalendarEntries(backup.calendar_entries);
      appearance = normalizeAppearance(backup.appearance);
      saveTasks();
      saveSchedule();
      saveCalendarEntries();
      saveAppearance();
      applyAppearance();
      renderAll();
      elements.backupStatus.textContent = "Резервная копия успешно импортирована.";
      showToast("Данные восстановлены.");
    } catch (error) {
      elements.backupStatus.textContent = "Не удалось импортировать файл: это не резервная копия планировщика.";
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

/* ---------- Оформление ---------- */

function setAccentColor(color) {
  if (!isValidHexColor(color)) return;
  appearance.accent = color.toLowerCase();
  saveAppearance();
  applyAppearance();
}

function applyAppearance() {
  const accent = appearance.accent;
  const root = document.documentElement;
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--primary-dark", darkenHexColor(accent, 0.18));
  root.style.setProperty("--primary-soft", hexToRgba(accent, 0.20));
  root.style.setProperty("--primary-ring", hexToRgba(accent, 0.52));
  root.style.setProperty("--primary-border", hexToRgba(accent, 0.52));
  root.style.setProperty("--primary-shadow", hexToRgba(accent, 0.35));
  root.style.setProperty("--accent-tint", hexToRgba(accent, 0.24));
  if (appearance.background) {
    root.style.setProperty("--custom-background-image", `url(${appearance.background})`);
    document.body.classList.add("has-custom-background");
  } else {
    root.style.removeProperty("--custom-background-image");
    document.body.classList.remove("has-custom-background");
  }
  elements.accentColor.value = accent;
  elements.accentColorValue.textContent = accent.toUpperCase();
  elements.clearBackground.disabled = !appearance.background;
  elements.backgroundStatus.textContent = appearance.background ? "Фоновое изображение установлено и сохранено на устройстве." : "Фон не выбран.";
  elements.themeSwatches.forEach((button) => {
    const isActive = button.dataset.themeColor.toLowerCase() === accent;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

async function handleBackgroundUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    elements.backgroundStatus.textContent = "Выберите изображение в формате JPG, PNG или WebP.";
    event.target.value = "";
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    elements.backgroundStatus.textContent = "Файл слишком большой. Выберите изображение до 10 МБ.";
    event.target.value = "";
    return;
  }
  elements.backgroundStatus.textContent = "Подготавливаем изображение…";
  try {
    const background = await compressBackgroundImage(file);
    const previousBackground = appearance.background;
    appearance.background = background;
    if (!saveAppearance()) {
      appearance.background = previousBackground;
      applyAppearance();
      return;
    }
    applyAppearance();
    showToast("Оформление обновлено.");
  } catch (error) {
    elements.backgroundStatus.textContent = error.message || "Не удалось обработать изображение.";
  } finally {
    event.target.value = "";
  }
}

function clearBackground() {
  appearance.background = null;
  saveAppearance();
  elements.backgroundUpload.value = "";
  applyAppearance();
  showToast("Фоновое изображение удалено.");
}

function resetAppearance() {
  appearance = { accent: DEFAULT_ACCENT_COLOR, background: null };
  saveAppearance();
  elements.backgroundUpload.value = "";
  applyAppearance();
  showToast("Стандартное оформление восстановлено.");
}

async function compressBackgroundImage(file) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const maxDimension = 1280;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#24060a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let result = canvas.toDataURL("image/jpeg", 0.78);
  if (result.length > MAX_BACKGROUND_DATA_URL_LENGTH) result = canvas.toDataURL("image/jpeg", 0.58);
  if (result.length > MAX_BACKGROUND_DATA_URL_LENGTH) throw new Error("Изображение слишком детализированное. Выберите фото меньшего размера.");
  return result;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Не удалось прочитать файл.")));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Не удалось открыть изображение.")));
    image.src = source;
  });
}

/* ---------- PWA ---------- */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !(location.protocol === "https:" || location.hostname === "localhost")) return;
  navigator.serviceWorker.register("service-worker.js").catch((error) => console.warn("Service Worker не зарегистрирован:", error));
}

/* ---------- Вспомогательные функции ---------- */

function renderAll() {
  renderTaskList();
  renderCalendar();
  renderWeekTimeline();
  renderDayPlanner();
  renderDashboard();
}

function setError(errorElement, inputElement, message) {
  errorElement.textContent = message;
  inputElement.classList.add("input-invalid");
  inputElement.setAttribute("aria-invalid", "true");
  inputElement.focus();
}

function clearError(errorElement, inputElement) {
  errorElement.textContent = "";
  inputElement.classList.remove("input-invalid");
  inputElement.removeAttribute("aria-invalid");
}

function createId(prefix = "item") {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }
function isValidDate(value) { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
function isValidDateTime(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime()); }
function isDateKey(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValidDate(`${value}T12:00:00`); }
function isValidTime(value) { return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function isValidHexColor(value) { return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value); }
function isValidBackgroundDataUrl(value) { return typeof value === "string" && /^data:image\/(jpeg|png|webp);base64,/i.test(value) && value.length <= MAX_BACKGROUND_DATA_URL_LENGTH; }

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function makeDateFromKey(key) { return new Date(`${key}T12:00:00`); }
function addDays(date, count) { const copy = new Date(date); copy.setDate(copy.getDate() + count); return copy; }
function startOfWeek(date) { const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate()); const index = (copy.getDay() + 6) % 7; return addDays(copy, -index); }
function timeToMinutes(time) { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; }

function getNextDueDate(value, recurrence) {
  if (!isValidDateTime(value)) return "";
  const next = new Date(value);
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  if (recurrence === "weekdays") {
    do { next.setDate(next.getDate() + 1); } while (next.getDay() === 0 || next.getDay() === 6);
  }
  if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  return toDateTimeLocalValue(next);
}

function toDateTimeLocalValue(date) {
  return `${toDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isTaskOverdue(task) { return !task.is_completed && task.due_at && new Date(task.due_at).getTime() < Date.now(); }
function formatDueDate(value) { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatShortDate(key) { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(makeDateFromKey(key)); }
function formatLongDate(key) { return new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(makeDateFromKey(key)); }

function hexToRgba(hex, alpha) {
  return `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha})`;
}
function darkenHexColor(hex, amount) {
  const values = [1, 3, 5].map((start) => Math.max(0, Math.round(parseInt(hex.slice(start, start + 2), 16) * (1 - amount))).toString(16).padStart(2, "0"));
  return `#${values.join("")}`;
}

function editIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h8"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>'; }
function deleteIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>'; }

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3000);
}

init();
