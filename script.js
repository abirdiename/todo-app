document.addEventListener("DOMContentLoaded", function () {
    const STORAGE_KEY = "todo-tasks";

    const form = document.getElementById("task-form");
    const taskInput = document.getElementById("task-input");
    const deadlineInput = document.getElementById("deadline-input");
    const taskList = document.getElementById("task-list");

    const filterButtons = document.querySelectorAll(".btn-filter");

    const sortDeadlineBtn = document.getElementById("sort-deadline");
    const deadlinePeriodBtn = document.getElementById("deadline-period-btn");
    const deadlinePeriodPanel = document.getElementById("deadline-period-panel");
    const deadlineFromInput = document.getElementById("deadline-from");
    const deadlineToInput = document.getElementById("deadline-to");
    const deadlineApplyBtn = document.getElementById("deadline-apply");
    const deadlineResetBtn = document.getElementById("deadline-reset");

    let tasks = [];
    let currentFilter = "all";   // all | active | completed

    // период по дедлайну (для кнопки "Сортировка по периоду")
    let deadlineFrom = "";       // YYYY-MM-DD или ""
    let deadlineTo = "";         // YYYY-MM-DD или ""

    // ---- localStorage ----

    function loadTasks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                tasks = [];
                return;
            }

            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                tasks = parsed.map(function (t) {
                    return {
                        id: t.id || Date.now(),
                        text: t.text || "",
                        deadline: t.deadline || "",
                        completed: !!t.completed,
                        completedAt: t.completedAt || ""
                    };
                });
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

    // ---- Утилита: парсим YYYY-MM-DD в Date (без времени) ----

    function parseDateOnly(iso) {
        if (!iso) return null;
        const parts = iso.split("-");
        if (parts.length !== 3) return null;
        const [yStr, mStr, dStr] = parts;
        const y = Number(yStr);
        const m = Number(mStr);
        const d = Number(dStr);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d);
    }

    // ---- Фильтрация по статусу и периоду дедлайна ----

    function isDeadlineInPeriod(task) {
        if (!deadlineFrom && !deadlineTo) {
            return true; // период не задан — не фильтруем
        }

        if (!task.deadline) {
            return false; // без дедлайна — вне периода
        }

        const deadlineDate = parseDateOnly(task.deadline);
        if (!deadlineDate) return false;

        const fromDate = parseDateOnly(deadlineFrom);
        const toDate = parseDateOnly(deadlineTo);

        if (fromDate && deadlineDate < fromDate) return false;
        if (toDate && deadlineDate > toDate) return false;

        return true;
    }

    function filterTasksForRender() {
        return tasks.filter(function (task) {
            if (currentFilter === "active" && task.completed) {
                return false;
            }
            if (currentFilter === "completed" && !task.completed) {
                return false;
            }

            if (!isDeadlineInPeriod(task)) {
                return false;
            }

            return true;
        });
    }

    // ---- Рендер ----

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

        if (task.completed) {
            li.classList.add("task-completed");
        }
        updateTaskOverdueState(li);

        // чекбокс
        checkbox.addEventListener("change", function () {
            task.completed = checkbox.checked;
            if (task.completed) {
                task.completedAt = new Date().toISOString();
            } else {
                task.completedAt = "";
            }

            li.classList.toggle("task-completed", task.completed);
            saveTasks();
            updateTaskOverdueState(li);
            // список НЕ пересортировываем автоматически – сортировка только по кнопке
            renderTasks();
        });

        // удаление
        deleteBtn.addEventListener("click", function () {
            tasks = tasks.filter(function (t) {
                return t.id !== task.id;
            });
            saveTasks();
            renderTasks();
        });

        // редактирование текста
        textSpan.addEventListener("click", function () {
            startEditText(task, textSpan);
        });

        // редактирование дедлайна
        deadlineSpan.addEventListener("click", function () {
            startEditDeadline(task, deadlineSpan);
        });

        return li;
    }

    // ---- Редактирование текста ----

    function startEditText(task, textSpan) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "task-edit-input";
        input.value = task.text;

        textSpan.replaceWith(input);
        input.focus();
        input.select();

        function finish(save) {
            let newText = task.text;
            if (save) {
                const trimmed = input.value.trim();
                if (trimmed) {
                    newText = trimmed;
                    task.text = newText;
                }
            }

            const newSpan = document.createElement("span");
            newSpan.className = "task-text";
            newSpan.textContent = newText;

            newSpan.addEventListener("click", function () {
                startEditText(task, newSpan);
            });

            input.replaceWith(newSpan);
            saveTasks();
        }

        input.addEventListener("blur", function () {
            finish(true);
        });

        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                finish(true);
            } else if (e.key === "Escape") {
                finish(false);
            }
        });
    }

    // ---- Редактирование дедлайна ----

    function startEditDeadline(task, deadlineSpan) {
        const input = document.createElement("input");
        input.type = "date";
        input.className = "task-edit-date";
        input.value = task.deadline || "";

        deadlineSpan.replaceWith(input);
        input.focus();

        function finish(save) {
            let newDeadline = task.deadline || "";
            if (save) {
                newDeadline = input.value || "";
                task.deadline = newDeadline;
            }

            const newSpan = document.createElement("span");
            newSpan.className = "task-deadline";

            if (newDeadline) {
                newSpan.textContent = formatDate(newDeadline);
                newSpan.dataset.deadline = newDeadline;
            } else {
                newSpan.textContent = "Без дедлайна";
                newSpan.classList.add("no-deadline");
                newSpan.dataset.deadline = "";
            }

            newSpan.addEventListener("click", function () {
                startEditDeadline(task, newSpan);
            });

            input.replaceWith(newSpan);
            saveTasks();
            // автоматической сортировки нет, только по кнопке
            renderTasks();
        }

        input.addEventListener("blur", function () {
            finish(true);
        });

        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                finish(true);
            } else if (e.key === "Escape") {
                finish(false);
            }
        });
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
            completed: false,
            completedAt: ""
        };

        tasks.push(newTask);
        saveTasks();
        renderTasks();

        taskInput.value = "";
        deadlineInput.value = "";
        taskInput.focus();
    });

    // ---- 1. Сортировка по дедлайну (от большего к меньшему) ----

    function sortTasksByDeadlineDesc() {
        tasks.sort(function (a, b) {
            const da = a.deadline;
            const db = b.deadline;

            // без дедлайна — в конец
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;

            // строки в формате YYYY-MM-DD сравниваются корректно
            if (da < db) return 1;   // хотим БОЛЬШИЕ (поздние даты) ВВЕРХУ
            if (da > db) return -1;
            return 0;
        });
    }

    sortDeadlineBtn.addEventListener("click", function () {
        sortTasksByDeadlineDesc();
        saveTasks();
        renderTasks();
    });

    // ---- 2. Сортировка по периоду (фильтрация по дедлайну) ----

    // открыть/закрыть панель выбора периода
    deadlinePeriodBtn.addEventListener("click", function () {
        deadlinePeriodPanel.classList.toggle("is-open");
    });

    // применить период
    deadlineApplyBtn.addEventListener("click", function () {
        deadlineFrom = deadlineFromInput.value;
        deadlineTo = deadlineToInput.value;
        renderTasks();
    });

    // сбросить период
    deadlineResetBtn.addEventListener("click", function () {
        deadlineFrom = "";
        deadlineTo = "";
        deadlineFromInput.value = "";
        deadlineToInput.value = "";
        renderTasks();
    });

    // ---- Фильтры статуса ----

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
    // При старте НЕ сортируем — sorting только по кнопке
    saveTasks(); // на случай миграции старых данных
    renderTasks();
});
