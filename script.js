document.addEventListener("DOMContentLoaded", function () {
    const STORAGE_KEY = "todo-tasks";

    const form = document.getElementById("task-form");
    const taskInput = document.getElementById("task-input");
    const deadlineInput = document.getElementById("deadline-input");
    const taskList = document.getElementById("task-list");
    const sortButton = document.getElementById("sort-deadline");
    const filterButtons = document.querySelectorAll(".btn-filter");

    let tasks = [];
    let currentFilter = "all"; // all | active | completed

    // ---- Работа с localStorage ----

    function loadTasks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                tasks = [];
                return;
            }

            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                tasks = parsed;
            } else {
                tasks = [];
            }
        } catch (e) {
            console.error("Ошибка чтения localStorage:", e);
            tasks = [];
        }
    }

    function saveTasks() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        } catch (e) {
            console.error("Ошибка записи localStorage:", e);
        }
    }

    // ---- Фильтрация задач ----

    function filterTasksForRender() {
        return tasks.filter(function (task) {
            if (currentFilter === "active") {
                return !task.completed;
            }
            if (currentFilter === "completed") {
                return task.completed;
            }
            return true; // all
        });
    }

    // ---- Рендер задач ----

    function renderTasks() {
        taskList.innerHTML = "";

        const tasksToShow = filterTasksForRender();

        tasksToShow.forEach(function (task) {
            const li = createTaskElement(task);
            taskList.appendChild(li);
        });
    }

    function createTaskElement(task) {
        const li = document.createElement("li");
        li.className = "task-item";

        const checkboxWrapper = document.createElement("div");
        checkboxWrapper.className = "task-checkbox";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-done";
        checkbox.checked = !!task.completed;

        checkboxWrapper.appendChild(checkbox);

        const content = document.createElement("div");
        content.className = "task-content";

        const textSpan = document.createElement("span");
        textSpan.className = "task-text";
        textSpan.textContent = task.text;

        const meta = document.createElement("div");
        meta.className = "task-meta";

        const deadlineLabel = document.createElement("span");
        deadlineLabel.className = "task-deadline-label";
        deadlineLabel.textContent = "Дедлайн:";

        const deadlineSpan = document.createElement("span");
        deadlineSpan.className = "task-deadline";

        if (task.deadline) {
            deadlineSpan.textContent = formatDate(task.deadline);
            deadlineSpan.dataset.deadline = task.deadline;
        } else {
            deadlineSpan.textContent = "Без дедлайна";
            deadlineSpan.classList.add("no-deadline");
            deadlineSpan.dataset.deadline = "";
        }

        meta.appendChild(deadlineLabel);
        meta.appendChild(deadlineSpan);

        content.appendChild(textSpan);
        content.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn btn-delete";
        deleteBtn.textContent = "Удалить";

        actions.appendChild(deleteBtn);

        li.appendChild(checkboxWrapper);
        li.appendChild(content);
        li.appendChild(actions);

        // классы completed / overdue
        if (task.completed) {
            li.classList.add("task-completed");
        }
        updateTaskOverdueState(li);

        // ---- Обработчики ----

        checkbox.addEventListener("change", function () {
            task.completed = checkbox.checked;
            li.classList.toggle("task-completed", task.completed);
            saveTasks();
            updateTaskOverdueState(li);
            // после смены статуса перерисуем (чтобы фильтры сразу срабатывали)
            renderTasks();
        });

        deleteBtn.addEventListener("click", function () {
            tasks = tasks.filter(function (t) {
                return t.id !== task.id;
            });
            saveTasks();
            renderTasks();
        });

        return li;
    }

    // ---- Добавление задачи ----

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const text = taskInput.value.trim();
        const deadlineValue = deadlineInput.value; // YYYY-MM-DD

        if (!text) {
            taskInput.focus();
            return;
        }

        const newTask = {
            id: Date.now(),
            text: text,
            deadline: deadlineValue || "",
            completed: false
        };

        tasks.push(newTask);
        saveTasks();
        renderTasks();

        taskInput.value = "";
        deadlineInput.value = "";
        taskInput.focus();
    });

    // ---- Сортировка по дедлайнам ----

    function sortTasksByDeadline() {
        tasks.sort(function (a, b) {
            const da = a.deadline;
            const db = b.deadline;

            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;

            if (da < db) return -1;
            if (da > db) return 1;
            return 0;
        });

        saveTasks();
        renderTasks();
    }

    sortButton.addEventListener("click", function () {
        sortTasksByDeadline();
    });

    // ---- Работа фильтров ----

    function setFilter(filterName) {
        currentFilter = filterName;

        filterButtons.forEach(function (btn) {
            const btnFilter = btn.getAttribute("data-filter");
            if (btnFilter === filterName) {
                btn.classList.add("filter-active");
            } else {
                btn.classList.remove("filter-active");
            }
        });

        renderTasks();
    }

    filterButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            const filterName = btn.getAttribute("data-filter");
            setFilter(filterName);
        });
    });

    // ---- Подсветка просроченных задач ----

    // Форматируем дату YYYY-MM-DD → DD.MM.YYYY
    function formatDate(isoDateString) {
        const parts = isoDateString.split("-");
        if (parts.length !== 3) return isoDateString;
        const [year, month, day] = parts;
        return `${day}.${month}.${year}`;
    }

    function updateTaskOverdueState(taskItem) {
        const deadlineSpan = taskItem.querySelector(".task-deadline");
        const checkbox = taskItem.querySelector(".task-done");

        if (!deadlineSpan) return;

        const deadlineIso = deadlineSpan.dataset.deadline;
        taskItem.classList.remove("task-overdue");

        if (!deadlineIso || (checkbox && checkbox.checked)) {
            return;
        }

        const deadlineParts = deadlineIso.split("-");
        if (deadlineParts.length !== 3) return;

        const [yearStr, monthStr, dayStr] = deadlineParts;
        const year = Number(yearStr);
        const month = Number(monthStr);
        const day = Number(dayStr);

        if (!year || !month || !day) return;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const deadlineDate = new Date(year, month - 1, day);

        if (deadlineDate < today) {
            taskItem.classList.add("task-overdue");
        }
    }

    // Периодически пересчитываем просрочку
    setInterval(function () {
        const items = document.querySelectorAll(".task-item");
        items.forEach(updateTaskOverdueState);
    }, 60 * 1000);

    // ---- Старт ----
    loadTasks();
    renderTasks();
});
