document.addEventListener("DOMContentLoaded", function () {
    var STORAGE_KEY = "todo-tasks";

    var form = document.getElementById("task-form");
    var taskInput = document.getElementById("task-input");
    var deadlineInput = document.getElementById("deadline-input");
    var taskList = document.getElementById("task-list");

    var filterButtons = document.querySelectorAll(".btn-filter");

    var sortDeadlineBtn = document.getElementById("sort-deadline");
    var deadlinePeriodBtn = document.getElementById("deadline-period-btn");
    var deadlinePeriodPanel = document.getElementById("deadline-period-panel");
    var deadlineFromInput = document.getElementById("deadline-from");
    var deadlineToInput = document.getElementById("deadline-to");
    var deadlineApplyBtn = document.getElementById("deadline-apply");
    var deadlineResetBtn = document.getElementById("deadline-reset");

    var tasks = [];
    var currentFilter = "all";   // all | active | completed

    // период по дедлайну (для сортировки/фильтра по периоду)
    var deadlineFrom = "";       // YYYY-MM-DD или ""
    var deadlineTo = "";         // YYYY-MM-DD или ""

    // ---- localStorage ----

    function loadTasks() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                tasks = [];
                return;
            }

            var parsed = JSON.parse(raw);
            if (Object.prototype.toString.call(parsed) === "[object Array]") {
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
        var parts = iso.split("-");
        if (parts.length !== 3) return null;
        var y = Number(parts[0]);
        var m = Number(parts[1]);
        var d = Number(parts[2]);
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

        var deadlineDate = parseDateOnly(task.deadline);
        if (!deadlineDate) return false;

        var fromDate = parseDateOnly(deadlineFrom);
        var toDate = parseDateOnly(deadlineTo);

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

        var tasksToShow = filterTasksForRender();

        tasksToShow.forEach(function (task) {
            var li = createTaskElement(task);
            taskList.appendChild(li);
        });
    }

    function createTaskElement(task) {
        var li = document.createElement("li");
        li.className = "task-item";

        var checkboxWrapper = document.createElement("div");
        checkboxWrapper.className = "task-checkbox";

        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-done";
        checkbox.checked = !!task.completed;

        checkboxWrapper.appendChild(checkbox);

        var content = document.createElement("div");
        content.className = "task-content";

        var textSpan = document.createElement("span");
        textSpan.className = "task-text";
        textSpan.textContent = task.text;

        var meta = document.createElement("div");
        meta.className = "task-meta";

        var deadlineLabel = document.createElement("span");
        deadlineLabel.className = "task-deadline-label";
        deadlineLabel.textContent = "Дедлайн:";

        var deadlineSpan = document.createElement("span");
        deadlineSpan.className = "task-deadline";

        if (task.deadline) {
            deadlineSpan.textContent = formatDate(task.deadline);
            deadlineSpan.setAttribute("data-deadline", task.deadline);
        } else {
            deadlineSpan.textContent = "Без дедлайна";
            deadlineSpan.classList.add("no-deadline");
            deadlineSpan.setAttribute("data-deadline", "");
        }

        meta.appendChild(deadlineLabel);
        meta.appendChild(deadlineSpan);

        content.appendChild(textSpan);
        content.appendChild(meta);

        var actions = document.createElement("div");
        actions.className = "task-actions";

        var deleteBtn = document.createElement("button");
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
        var input = document.createElement("input");
        input.type = "text";
        input.className = "task-edit-input";
        input.value = task.text;

        textSpan.replaceWith(input);
        input.focus();
        input.select();

        function finish(save) {
            var newText = task.text;
            if (save) {
                var trimmed = input.value.replace(/^\s+|\s+$/g, "");
                if (trimmed) {
                    newText = trimmed;
                    task.text = newText;
                }
            }

            var newSpan = document.createElement("span");
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
        var input = document.createElement("input");
        input.type = "date";
        input.className = "task-edit-date";
        input.value = task.deadline || "";

        deadlineSpan.replaceWith(input);
        input.focus();

        function finish(save) {
            var newDeadline = task.deadline || "";
            if (save) {
                newDeadline = input.value || "";
                task.deadline = newDeadline;
            }

            var newSpan = document.createElement("span");
            newSpan.className = "task-deadline";

            if (newDeadline) {
                newSpan.textContent = formatDate(newDeadline);
                newSpan.setAttribute("data-deadline", newDeadline);
            } else {
                newSpan.textContent = "Без дедлайна";
                newSpan.classList.add("no-deadline");
                newSpan.setAttribute("data-deadline", "");
            }

            newSpan.addEventListener("click", function () {
                startEditDeadline(task, newSpan);
            });

            input.replaceWith(newSpan);
            saveTasks();
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

        var text = taskInput.value.replace(/^\s+|\s+$/g, "");
        var deadlineValue = deadlineInput.value; // YYYY-MM-DD

        if (!text) {
            taskInput.focus();
            return;
        }

        var newTask = {
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

    // ---- 1. Сортировка по дедлайну (ОТ МЕНЬШЕГО К БОЛЬШЕМУ) ----

    function sortTasksByDeadlineAsc() {
        tasks.sort(function (a, b) {
            var da = a.deadline;
            var db = b.deadline;

            // без дедлайна — в конец
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;

            var dA = parseDateOnly(da);
            var dB = parseDateOnly(db);

            if (!dA && !dB) return 0;
            if (!dA) return 1;
            if (!dB) return -1;

            var tA = dA.getTime();
            var tB = dB.getTime();

            if (tA < tB) return -1; // ранняя дата выше
            if (tA > tB) return 1;  // поздняя ниже
            return 0;
        });
    }

    sortDeadlineBtn.addEventListener("click", function () {
        sortTasksByDeadlineAsc();
        saveTasks();
        renderTasks();
    });

    // ---- 2. Сортировка по периоду (фильтрация по дедлайну) ----

    // открыть/закрыть панель выбора периода
    deadlinePeriodBtn.addEventListener("click", function () {
        if (deadlinePeriodPanel.classList.contains("is-open")) {
            deadlinePeriodPanel.classList.remove("is-open");
        } else {
            deadlinePeriodPanel.classList.add("is-open");
        }
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
            var btnFilter = btn.getAttribute("data-filter");
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
            var filterName = btn.getAttribute("data-filter");
            setFilter(filterName);
        });
    });

    // ---- Подсветка просроченных задач ----

    // Форматируем дату YYYY-MM-DD → DD.MM.YYYY
    function formatDate(isoDateString) {
        var parts = isoDateString.split("-");
        if (parts.length !== 3) return isoDateString;
        var year = parts[0];
        var month = parts[1];
        var day = parts[2];
        return day + "." + month + "." + year;
    }

    function updateTaskOverdueState(taskItem) {
        var deadlineSpan = taskItem.querySelector(".task-deadline");
        var checkbox = taskItem.querySelector(".task-done");

        if (!deadlineSpan) return;

        var deadlineIso = deadlineSpan.getAttribute("data-deadline");
        taskItem.classList.remove("task-overdue");

        if (!deadlineIso || (checkbox && checkbox.checked)) {
            return;
        }

        var deadlineParts = deadlineIso.split("-");
        if (deadlineParts.length !== 3) return;

        var year = Number(deadlineParts[0]);
        var month = Number(deadlineParts[1]);
        var day = Number(deadlineParts[2]);

        if (!year || !month || !day) return;

        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var deadlineDate = new Date(year, month - 1, day);

        if (deadlineDate < today) {
            taskItem.classList.add("task-overdue");
        }
    }

    // Периодически пересчитываем просрочку
    setInterval(function () {
        var items = document.querySelectorAll(".task-item");
        items.forEach(function (item) {
            updateTaskOverdueState(item);
        });
    }, 60 * 1000);

    // ---- Старт ----
    loadTasks();
    renderTasks();
});
