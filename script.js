// ===== Battery Control System - Main JavaScript =====

// State Management
let drivers = [];
let timerIntervals = {};

// DOM Elements
const elements = {
    addDriverForm: document.getElementById('addDriverForm'),
    driverName: document.getElementById('driverName'),
    batteryCount: document.getElementById('batteryCount'),
    customHours: document.getElementById('customHours'),
    customMinutes: document.getElementById('customMinutes'),
    defaultHours: document.getElementById('defaultHours'),
    defaultMinutes: document.getElementById('defaultMinutes'),
    warningThreshold: document.getElementById('warningThreshold'),
    criticalThreshold: document.getElementById('criticalThreshold'),
    driversGrid: document.getElementById('driversGrid'),
    emptyState: document.getElementById('emptyState'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    activeDriversCount: document.getElementById('activeDriversCount'),
    totalBatteriesCount: document.getElementById('totalBatteriesCount'),
    alertSound: document.getElementById('alertSound'),
    settingsToggle: document.getElementById('settingsToggle'),
    settingsContent: document.getElementById('settingsContent'),
    settingsPanel: document.querySelector('.settings-panel'),
    collapseIcon: document.getElementById('collapseIcon'),
    confirmModal: document.getElementById('confirmModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalMessage: document.getElementById('modalMessage'),
    modalConfirm: document.getElementById('modalConfirm'),
    modalCancel: document.getElementById('modalCancel')
};

// Modal callback
let modalCallback = null;

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    loadSettingsState();
    setupEventListeners();
    updateStats();
    startAllTimers();
});

// ===== Event Listeners =====
function setupEventListeners() {
    elements.addDriverForm.addEventListener('submit', handleAddDriver);
    elements.clearAllBtn.addEventListener('click', handleClearAll);

    // Settings toggle
    elements.settingsToggle.addEventListener('click', toggleSettings);

    // Modal buttons
    elements.modalConfirm.addEventListener('click', handleModalConfirm);
    elements.modalCancel.addEventListener('click', hideModal);
    elements.confirmModal.addEventListener('click', (e) => {
        if (e.target === elements.confirmModal) hideModal();
    });

    // Save settings on change
    ['defaultHours', 'defaultMinutes', 'warningThreshold', 'criticalThreshold'].forEach(id => {
        document.getElementById(id).addEventListener('change', saveSettings);
    });
}

// ===== Settings Toggle =====
function toggleSettings() {
    const panel = elements.settingsPanel;
    panel.classList.toggle('collapsed');

    // Save collapsed state
    const isCollapsed = panel.classList.contains('collapsed');
    localStorage.setItem('batteryControl_settingsCollapsed', isCollapsed);
}

function loadSettingsState() {
    const isCollapsed = localStorage.getItem('batteryControl_settingsCollapsed') === 'true';
    if (isCollapsed) {
        elements.settingsPanel.classList.add('collapsed');
    }
}

// ===== Driver Management =====
function handleAddDriver(e) {
    e.preventDefault();

    const name = elements.driverName.value.trim();
    const batteries = parseInt(elements.batteryCount.value) || 1;

    // Get time (custom or default)
    let hours = parseInt(elements.customHours.value);
    let minutes = parseInt(elements.customMinutes.value);

    if (isNaN(hours) && isNaN(minutes)) {
        hours = parseInt(elements.defaultHours.value) || 5;
        minutes = parseInt(elements.defaultMinutes.value) || 0;
    } else {
        hours = isNaN(hours) ? 0 : hours;
        minutes = isNaN(minutes) ? 0 : minutes;
    }

    const totalSeconds = (hours * 3600) + (minutes * 60);

    if (totalSeconds === 0) {
        alert('Por favor, ingresa un tiempo válido');
        return;
    }

    const driver = {
        id: Date.now().toString(),
        name: name,
        batteries: batteries,
        totalSeconds: totalSeconds,
        remainingSeconds: totalSeconds,
        isPaused: false,
        createdAt: new Date().toISOString()
    };

    drivers.push(driver);
    saveToLocalStorage();
    renderDriver(driver);
    updateStats();
    startTimer(driver.id);

    // Reset form
    elements.addDriverForm.reset();
    elements.customHours.value = '';
    elements.customMinutes.value = '';
    elements.driverName.focus();
}

function removeDriver(id) {
    showModal(
        '¿Eliminar chofer?',
        'El temporizador y todos los datos de este chofer serán eliminados.',
        () => {
            clearInterval(timerIntervals[id]);
            delete timerIntervals[id];
            drivers = drivers.filter(d => d.id !== id);
            saveToLocalStorage();
            renderAllDrivers();
            updateStats();
        }
    );
}

function handleClearAll() {
    if (drivers.length === 0) return;

    showModal(
        '¿Eliminar todos los choferes?',
        'Todos los temporizadores y datos serán eliminados permanentemente.',
        () => {
            Object.keys(timerIntervals).forEach(id => clearInterval(timerIntervals[id]));
            timerIntervals = {};
            drivers = [];
            saveToLocalStorage();
            renderAllDrivers();
            updateStats();
        }
    );
}

// ===== Modal Functions =====
function showModal(title, message, callback) {
    elements.modalTitle.textContent = title;
    elements.modalMessage.textContent = message;
    modalCallback = callback;
    elements.confirmModal.classList.add('active');
}

function hideModal() {
    elements.confirmModal.classList.remove('active');
    modalCallback = null;
}

function handleModalConfirm() {
    if (modalCallback) {
        modalCallback();
    }
    hideModal();
}

// ===== Timer Functions =====
function startTimer(id) {
    const driver = drivers.find(d => d.id === id);
    if (!driver) return;

    clearInterval(timerIntervals[id]);

    timerIntervals[id] = setInterval(() => {
        const driverIndex = drivers.findIndex(d => d.id === id);
        if (driverIndex === -1) {
            clearInterval(timerIntervals[id]);
            return;
        }

        const driver = drivers[driverIndex];

        if (!driver.isPaused && driver.remainingSeconds > 0) {
            driver.remainingSeconds--;
            updateTimerDisplay(id);
            saveToLocalStorage();

            // Check for critical threshold and play sound
            const criticalThreshold = parseInt(elements.criticalThreshold.value) * 60;
            if (driver.remainingSeconds === criticalThreshold) {
                playAlertSound();
            }
        }

        if (driver.remainingSeconds <= 0) {
            clearInterval(timerIntervals[id]);
            updateTimerDisplay(id);
            playAlertSound();
        }
    }, 1000);
}

function startAllTimers() {
    drivers.forEach(driver => {
        if (driver.remainingSeconds > 0) {
            startTimer(driver.id);
        }
    });
}

function togglePause(id) {
    const driver = drivers.find(d => d.id === id);
    if (!driver) return;

    driver.isPaused = !driver.isPaused;
    saveToLocalStorage();
    updateTimerDisplay(id);

    const pauseBtn = document.querySelector(`[data-driver-id="${id}"] .btn-pause`);
    if (pauseBtn) {
        pauseBtn.textContent = driver.isPaused ? '▶️' : '⏸️';
    }
}

function resetTimer(id) {
    const driver = drivers.find(d => d.id === id);
    if (!driver) return;

    driver.remainingSeconds = driver.totalSeconds;
    driver.isPaused = false;
    saveToLocalStorage();
    updateTimerDisplay(id);
    startTimer(id);

    const pauseBtn = document.querySelector(`[data-driver-id="${id}"] .btn-pause`);
    if (pauseBtn) {
        pauseBtn.textContent = '⏸️';
    }
}

function addTime(id, minutes) {
    const driver = drivers.find(d => d.id === id);
    if (!driver) return;

    driver.remainingSeconds += minutes * 60;
    driver.totalSeconds += minutes * 60;
    saveToLocalStorage();
    updateTimerDisplay(id);
}

// ===== Display Functions =====
function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getTimerStatus(remainingSeconds) {
    const warningThreshold = parseInt(elements.warningThreshold.value) * 60;
    const criticalThreshold = parseInt(elements.criticalThreshold.value) * 60;

    if (remainingSeconds <= 0) {
        return { class: 'critical', text: '⚠️ TIEMPO AGOTADO', statusClass: 'critical' };
    } else if (remainingSeconds <= criticalThreshold) {
        return { class: 'critical', text: '🔴 ¡Tiempo crítico!', statusClass: 'critical' };
    } else if (remainingSeconds <= warningThreshold) {
        return { class: 'warning', text: '🟠 Tiempo limitado', statusClass: 'warning' };
    } else {
        return { class: '', text: '🟢 En tiempo', statusClass: 'ok' };
    }
}

function updateTimerDisplay(id) {
    const driver = drivers.find(d => d.id === id);
    if (!driver) return;

    const card = document.querySelector(`[data-driver-id="${id}"]`);
    if (!card) return;

    const timerDisplay = card.querySelector('.timer-display');
    const timerValue = card.querySelector('.timer-value');
    const timerStatus = card.querySelector('.timer-status');

    const status = getTimerStatus(driver.remainingSeconds);

    // Update card class
    card.classList.remove('warning', 'critical');
    if (status.class) {
        card.classList.add(status.class);
    }

    // Update timer display class
    timerDisplay.classList.remove('warning', 'critical');
    if (status.class) {
        timerDisplay.classList.add(status.class);
    }

    // Update timer value
    timerValue.textContent = formatTime(driver.remainingSeconds);

    // Update status text
    timerStatus.className = `timer-status ${status.statusClass}`;
    timerStatus.textContent = driver.isPaused ? '⏸️ Pausado' : status.text;
}

function renderDriver(driver) {
    elements.emptyState.style.display = 'none';

    const status = getTimerStatus(driver.remainingSeconds);

    const card = document.createElement('div');
    card.className = `driver-card ${status.class}`;
    card.setAttribute('data-driver-id', driver.id);

    card.innerHTML = `
        <div class="driver-header">
            <div class="driver-info">
                <h3>${escapeHtml(driver.name)}</h3>
                <div class="battery-count">
                    🔋 Baterías: <span>${driver.batteries}</span>
                </div>
            </div>
            <div class="driver-actions">
                <button class="btn-icon-only danger" onclick="removeDriver('${driver.id}')" title="Eliminar">
                    ✕
                </button>
            </div>
        </div>
        <div class="timer-display ${status.class}">
            <div class="timer-label">Tiempo Restante</div>
            <div class="timer-value">${formatTime(driver.remainingSeconds)}</div>
            <div class="timer-status ${status.statusClass}">${driver.isPaused ? '⏸️ Pausado' : status.text}</div>
        </div>
        <div class="timer-controls">
            <button class="btn-icon-only btn-pause" onclick="togglePause('${driver.id}')">
                ${driver.isPaused ? '▶️' : '⏸️'}
            </button>
            <button class="btn-icon-only btn-reset" onclick="resetTimer('${driver.id}')" title="Reiniciar">
                🔄
            </button>
            <button class="btn-icon-only btn-add-time" onclick="addTime('${driver.id}', 30)" title="+30 min">
                +30
            </button>
            <button class="btn-icon-only btn-add-time" onclick="addTime('${driver.id}', 60)" title="+1 hora">
                +60
            </button>
        </div>
    `;

    // Insert before empty state
    elements.driversGrid.insertBefore(card, elements.emptyState);
}

function renderAllDrivers() {
    // Clear existing cards
    const cards = elements.driversGrid.querySelectorAll('.driver-card');
    cards.forEach(card => card.remove());

    // Show/hide empty state
    elements.emptyState.style.display = drivers.length === 0 ? 'block' : 'none';

    // Render all drivers
    drivers.forEach(driver => renderDriver(driver));
}

function updateStats() {
    elements.activeDriversCount.textContent = drivers.length;
    elements.totalBatteriesCount.textContent = drivers.reduce((sum, d) => sum + d.batteries, 0);
}

// ===== Audio =====
function playAlertSound() {
    try {
        // Create a simple beep using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.log('Audio not supported');
    }
}

// ===== Local Storage =====
function saveToLocalStorage() {
    localStorage.setItem('batteryControl_drivers', JSON.stringify(drivers));
    saveSettings();
}

function loadFromLocalStorage() {
    const savedDrivers = localStorage.getItem('batteryControl_drivers');
    if (savedDrivers) {
        drivers = JSON.parse(savedDrivers);
        renderAllDrivers();
    }

    // Load settings
    const settings = localStorage.getItem('batteryControl_settings');
    if (settings) {
        const parsed = JSON.parse(settings);
        elements.defaultHours.value = parsed.defaultHours ?? 5;
        elements.defaultMinutes.value = parsed.defaultMinutes ?? 0;
        elements.warningThreshold.value = parsed.warningThreshold ?? 60;
        elements.criticalThreshold.value = parsed.criticalThreshold ?? 30;
    }
}

function saveSettings() {
    const settings = {
        defaultHours: parseInt(elements.defaultHours.value) || 5,
        defaultMinutes: parseInt(elements.defaultMinutes.value) || 0,
        warningThreshold: parseInt(elements.warningThreshold.value) || 60,
        criticalThreshold: parseInt(elements.criticalThreshold.value) || 30
    };
    localStorage.setItem('batteryControl_settings', JSON.stringify(settings));
}

// ===== Utility Functions =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally accessible
window.removeDriver = removeDriver;
window.togglePause = togglePause;
window.resetTimer = resetTimer;
window.addTime = addTime;
