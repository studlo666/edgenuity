/**
 * EdgeSchool Pro - Automation Suite & Floating Controller
 * Hosted version for GitHub CDN / Raw loaders
 */
(function () {
  'use strict';

  // Toggle or Cleanup if already running
  if (window.__edg_master_loaded) {
    var existingFrame = document.getElementById('edg-pixel-ui-frame');
    if (existingFrame) existingFrame.remove();
    var existingDock = document.getElementById('edg-pixel-dock');
    if (existingDock) existingDock.remove();
    if (window.__edg_master_cleanup) window.__edg_master_cleanup();
    window.__edg_master_loaded = false;
    return;
  }

  window.__edg_master_loaded = true;

  // Global State & Stats
  window.__edg_state = {
    autoClick: true,
    skipIntros: true,
    autoDefi: true,
    antiAfk: true
  };

  window.__edg_stats = {
    startTime: Date.now(),
    slidesAdvanced: 0,
    vocabCompleted: 0,
    afkPings: 0
  };

  window.__edg_logs = [];

  window.__edg_log = function (msg, type) {
    type = type || 'info';
    var d = new Date();
    var time = [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(function (n) { return n < 10 ? '0' + n : n; })
      .join(':');
    window.__edg_logs.unshift({ time: time, msg: msg, type: type });
    if (window.__edg_logs.length > 100) window.__edg_logs.pop();
    if (window.__edg_on_log) window.__edg_on_log();
  };

  // Timer Management
  var activeTimers = [];
  function addTimer(fn, interval) {
    var id = setInterval(fn, interval);
    activeTimers.push(id);
    return id;
  }

  window.__edg_master_cleanup = function () {
    activeTimers.forEach(clearInterval);
    activeTimers = [];
  };

  // 1. Create Dock Button
  var dock = document.getElementById('edg-pixel-dock');
  if (dock) dock.remove();
  dock = document.createElement('div');
  dock.id = 'edg-pixel-dock';
  Object.assign(dock.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: '2147483647',
    display: 'none'
  });
  dock.innerHTML = `
    <button id="edg-dock-btn" title="Restore EdgeSchool" style="width:48px;height:48px;border-radius:14px;background:#174ea6;color:#fff;border:0;box-shadow:0 4px 12px rgba(0,0,0,0.25);cursor:pointer;display:grid;place-items:center;transition:transform 0.2s cubic-bezier(0.16,1,0.3,1)">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
      </svg>
    </button>`;
  document.documentElement.appendChild(dock);

  // 2. Create Floating UI Frame
  var frame = document.getElementById('edg-pixel-ui-frame');
  if (frame) frame.remove();
  frame = document.createElement('iframe');
  frame.id = 'edg-pixel-ui-frame';
  Object.assign(frame.style, {
    position: 'fixed',
    left: '50%',
    top: '45%',
    transform: 'translate(-50%, -50%) scale(0.9)',
    width: 'min(640px, calc(100vw - 28px))',
    height: 'min(480px, calc(100vh - 40px))',
    minWidth: '320px',
    minHeight: '260px',
    border: '1px solid #c5ccda',
    borderRadius: '18px',
    zIndex: '2147483647',
    boxShadow: '0 18px 48px rgba(34,51,74,0.25)',
    background: '#fff',
    opacity: '0',
    transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease',
    pointerEvents: 'none'
  });
  document.documentElement.appendChild(frame);

  // 3. Inject UI Content
  var doc = frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { box-sizing: border-box; margin:0; padding:0; font-family: system-ui, -apple-system, sans-serif; -webkit-user-select: none; user-select: none; }
    body { height: 100vh; display: flex; flex-direction: column; background: #f8f9ff; color: #202124; overflow: hidden; }
    .window { display: flex; flex-direction: column; height: 100vh; }
    .titlebar { height: 46px; flex: none; display: flex; align-items: center; padding: 0 10px 0 14px; gap: 10px; background: #f8f9ff; border-bottom: 1px solid #e1e5ed; cursor: grab; }
    .titlebar:active { cursor: grabbing; }
    .appicon { width: 28px; height: 28px; border-radius: 8px; background: #d3e3fd; color: #174ea6; display: grid; place-items: center; font-size: 16px; }
    .title { font-size: 13.5px; font-weight: 600; flex: 1; }
    .controls { display: flex; gap: 3px; }
    .control { border: 0; background: transparent; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: #4b5260; cursor: pointer; transition: background .15s; font-size: 15px; }
    .control:hover { background: #e8edf6; }
    .control.close:hover { background: #fce8e6; color: #b3261e; }
    .body { padding: 18px; flex: 1; overflow-y: auto; font-size: 13px; }
    .eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .06em; color: #687080; text-transform: uppercase; margin-bottom: 2px; }
    h1 { font-size: 20px; margin-bottom: 6px; font-weight: 600; }
    .sub { font-size: 12.5px; color: #626a78; margin-bottom: 12px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; background: #e6f4ea; color: #137333; font-size: 11.5px; font-weight: 600; border-radius: 12px; margin-bottom: 12px; }
    .badge.off { background: #fce8e6; color: #c5221f; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #1e8e3e; }
    .badge.off .dot { background: #d93025; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
    .stat-card { background: #fff; border: 1px solid #e1e5ed; border-radius: 10px; padding: 10px; text-align: center; }
    .stat-card .val { font-size: 18px; font-weight: 700; color: #174ea6; }
    .stat-card .lbl { font-size: 11px; color: #626a78; margin-top: 2px; }
    .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .card { border-radius: 12px; background: #edf2fa; padding: 12px; border: 1px solid #e0e6ef; }
    .card h3 { font-size: 13px; color: #174ea6; margin-bottom: 4px; }
    .card p { font-size: 11.5px; color: #626a78; line-height: 1.35; }
    .item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #fff; border-radius: 10px; border: 1px solid #e0e6ef; margin-bottom: 8px; }
    .item label { font-size: 13px; font-weight: 500; cursor: pointer; }
    .toggle { position: relative; display: inline-block; width: 36px; height: 20px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; inset: 0; background: #ccc; border-radius: 20px; transition: .2s; }
    .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .2s; }
    input:checked + .slider { background: #174ea6; }
    input:checked + .slider:before { transform: translateX(16px); }
    .logs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .btn-clear { border: 1px solid #d2d8e4; background: #fff; border-radius: 6px; padding: 3px 8px; font-size: 11.5px; cursor: pointer; color: #525967; }
    .log-list { background: #1e222b; color: #e1e5ed; border-radius: 10px; padding: 10px; font-family: monospace; font-size: 11px; height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
    .log-row { display: flex; gap: 6px; }
    .log-time { color: #8894a7; }
    .log-type-success { color: #81c995; }
    .log-type-info { color: #8ab4f8; }
    .log-type-warn { color: #fdd663; }
    .bottom { flex: none; background: #eef1f7; border-top: 1px solid #e1e5ed; }
    .navbar { height: 46px; display: flex; align-items: center; justify-content: space-around; padding: 0 12px; }
    .navitem { border: 0; background: transparent; height: 32px; display: flex; align-items: center; gap: 6px; color: #525967; font-size: 12.5px; font-weight: 500; cursor: pointer; padding: 0 12px; border-radius: 6px; }
    .navitem.active { color: #174ea6; background: #dfe8f5; font-weight: 600; }
  </style>
</head>
<body>
  <main class="window" id="win">
    <header class="titlebar" id="drag">
      <div class="appicon">&#127891;</div>
      <div class="title">EdgeSchool Pro</div>
      <div class="controls">
        <button class="control" id="min" title="Minimize">&minus;</button>
        <button class="control" id="max" title="Maximize">&#9633;</button>
        <button class="control close" id="close" title="Close">&times;</button>
      </div>
    </header>
    <section class="body" id="body"></section>
    <footer class="bottom">
      <div class="navbar">
        <button class="navitem active" data-page="home">Home</button>
        <button class="navitem" data-page="settings">Settings</button>
        <button class="navitem" data-page="logs">Logs</button>
      </div>
    </footer>
  </main>
</body>
</html>`);
  doc.close();

  // 4. UI View Logic & Events
  var win = frame.contentWindow;
  var bdoc = frame.contentDocument;
  var body = bdoc.getElementById('body');
  var drag = bdoc.getElementById('drag');
  var dockBtn = document.getElementById('edg-dock-btn');
  var maxed = false, restore = {}, currentPage = 'home';

  setTimeout(function () {
    frame.style.opacity = '1';
    frame.style.transform = 'translate(-50%, -50%) scale(1)';
    frame.style.pointerEvents = 'auto';
  }, 10);

  function minimizeWindow() {
    frame.style.transform = 'translate(calc(50vw - 40px), calc(50vh - 40px)) scale(0.1)';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    setTimeout(function () {
      frame.style.display = 'none';
      dock.style.display = 'block';
    }, 250);
  }

  function restoreWindow() {
    dock.style.display = 'none';
    frame.style.display = 'block';
    setTimeout(function () {
      frame.style.transform = 'translate(-50%, -50%) scale(1)';
      frame.style.opacity = '1';
      frame.style.pointerEvents = 'auto';
    }, 10);
  }

  bdoc.getElementById('min').onclick = minimizeWindow;
  dockBtn.onclick = restoreWindow;

  bdoc.getElementById('close').onclick = function () {
    frame.style.opacity = '0';
    frame.style.transform = 'translate(-50%, -50%) scale(0.9)';
    setTimeout(function () {
      frame.remove();
      dock.remove();
      if (window.__edg_master_cleanup) window.__edg_master_cleanup();
      window.__edg_master_loaded = false;
    }, 250);
  };

  bdoc.getElementById('max').onclick = function () {
    if (!maxed) {
      restore = {
        left: frame.style.left,
        top: frame.style.top,
        width: frame.style.width,
        height: frame.style.height,
        transform: frame.style.transform
      };
      Object.assign(frame.style, {
        left: '8px',
        top: '8px',
        transform: 'none',
        width: 'calc(100vw - 16px)',
        height: 'calc(100vh - 16px)'
      });
      maxed = true;
    } else {
      Object.assign(frame.style, restore);
      maxed = false;
    }
  };

  // Draggable Handler
  var dragging = false, sx = 0, sy = 0, rect = null;
  drag.onmousedown = function (e) {
    if (e.target.closest('button') || maxed) return;
    dragging = true;
    rect = frame.getBoundingClientRect();
    frame.style.transition = 'none';
    frame.style.transform = 'none';
    frame.style.left = rect.left + 'px';
    frame.style.top = rect.top + 'px';
    sx = e.clientX;
    sy = e.clientY;
  };

  function onDragMove(e) {
    if (!dragging) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    frame.style.left = (rect.left + dx) + 'px';
    frame.style.top = (rect.top + dy) + 'px';
  }

  function onDragEnd() {
    dragging = false;
    frame.style.transition = 'transform 0.25s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease';
  }

  window.addEventListener('mousemove', onDragMove);
  win.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
  win.addEventListener('mouseup', onDragEnd);

  // Formatting & Rendering
  function formatUptime() {
    var sec = Math.floor((Date.now() - window.__edg_stats.startTime) / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + 'm ' + s + 's';
  }

  function renderHome() {
    var stats = window.__edg_stats;
    var state = window.__edg_state;
    var isAnyActive = state.autoClick || state.autoDefi || state.skipIntros || state.antiAfk;
    body.innerHTML = `
      <div class="eyebrow">Controller Dashboard</div>
      <h1>System Overview</h1>
      <div class="badge ${isAnyActive ? '' : 'off'}">
        <span class="dot"></span>${isAnyActive ? 'Automation Active' : 'Paused'}
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="val" id="val-uptime">${formatUptime()}</div><div class="lbl">Uptime</div></div>
        <div class="stat-card"><div class="val">${stats.slidesAdvanced}</div><div class="lbl">Slides Advanced</div></div>
        <div class="stat-card"><div class="val">${stats.vocabCompleted}</div><div class="lbl">Vocab Solved</div></div>
      </div>
      <div class="cards">
        <article class="card"><h3>Auto Next</h3><p>Automatically progresses forward as soon as slides finish.</p></article>
        <article class="card"><h3>Auto Vocab</h3><p>Detects matching terms, types answers, and submits questions.</p></article>
        <article class="card"><h3>Skip Intros</h3><p>Bypasses blocking audio dialogs and overlay barriers.</p></article>
        <article class="card"><h3>Anti-AFK</h3><p>Emits background heartbeats to prevent idle timeouts.</p></article>
      </div>`;
  }

  function renderSettings() {
    var s = window.__edg_state;
    body.innerHTML = `
      <div class="eyebrow">Configuration</div>
      <h1>Preferences</h1>
      <p class="sub">Enable or disable automation modules in real time.</p>
      <div class="item">
        <label for="set-click">Auto-Advance Completed Slides</label>
        <label class="toggle"><input type="checkbox" id="set-click" ${s.autoClick ? 'checked' : ''}><span class="slider"></span></label>
      </div>
      <div class="item">
        <label for="set-skip">Skip Dialog & Intro Overlays</label>
        <label class="toggle"><input type="checkbox" id="set-skip" ${s.skipIntros ? 'checked' : ''}><span class="slider"></span></label>
      </div>
      <div class="item">
        <label for="set-defi">Auto Vocabulary / Defi Solver</label>
        <label class="toggle"><input type="checkbox" id="set-defi" ${s.autoDefi ? 'checked' : ''}><span class="slider"></span></label>
      </div>
      <div class="item">
        <label for="set-afk">Anti-Inactivity Heartbeat (Keep-Alive)</label>
        <label class="toggle"><input type="checkbox" id="set-afk" ${s.antiAfk ? 'checked' : ''}><span class="slider"></span></label>
      </div>`;

    bdoc.getElementById('set-click').onchange = function (e) {
      s.autoClick = e.target.checked;
      window.__edg_log('Auto-Advance ' + (s.autoClick ? 'enabled' : 'disabled'));
    };
    bdoc.getElementById('set-skip').onchange = function (e) {
      s.skipIntros = e.target.checked;
      window.__edg_log('Skip Intros ' + (s.skipIntros ? 'enabled' : 'disabled'));
    };
    bdoc.getElementById('set-defi').onchange = function (e) {
      s.autoDefi = e.target.checked;
      window.__edg_log('Auto Vocab ' + (s.autoDefi ? 'enabled' : 'disabled'));
    };
    bdoc.getElementById('set-afk').onchange = function (e) {
      s.antiAfk = e.target.checked;
      window.__edg_log('Anti-AFK ' + (s.antiAfk ? 'enabled' : 'disabled'));
    };
  }

  function renderLogs() {
    var logs = window.__edg_logs;
    body.innerHTML = `
      <div class="logs-header">
        <div><div class="eyebrow">Console</div><h1>Event Stream</h1></div>
        <button class="btn-clear" id="btn-clear-logs">Clear</button>
      </div>
      <div class="log-list" id="log-list">
        ${logs.length
          ? logs.map(function (l) {
              return `<div class="log-row"><span class="log-time">[${l.time}]</span><span class="log-type-${l.type}">${l.msg}</span></div>`;
            }).join('')
          : '<div style="color:#687080;padding:12px;text-align:center">No events captured yet.</div>'
        }
      </div>`;

    bdoc.getElementById('btn-clear-logs').onclick = function () {
      window.__edg_logs.length = 0;
      renderLogs();
    };
  }

  window.__edg_on_log = function () {
    if (currentPage === 'logs') renderLogs();
    if (currentPage === 'home') {
      var el = bdoc.getElementById('val-uptime');
      if (el) el.innerText = formatUptime();
    }
  };

  renderHome();

  setInterval(function () {
    if (currentPage === 'home') {
      var el = bdoc.getElementById('val-uptime');
      if (el) el.innerText = formatUptime();
    }
  }, 1000);

  bdoc.querySelectorAll('.navitem').forEach(function (btn) {
    btn.onclick = function () {
      bdoc.querySelectorAll('.navitem').forEach(function (b) { b.classList.toggle('active', b === btn); });
      currentPage = btn.getAttribute('data-page');
      if (currentPage === 'home') renderHome();
      else if (currentPage === 'settings') renderSettings();
      else if (currentPage === 'logs') renderLogs();
    };
  });

  function triggerEvent(el, type) {
    var ev = new Event(type, { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
  }

  window.__edg_log('EdgeSchool active & running', 'success');

  // 5. Automation Background Loops
  var isClickingSlide = false;
  addTimer(function () {
    if (!window.__edg_state.autoClick) return;

    var nextNav = document.querySelector('.footnav.goRight:not(.disabled)');
    if (nextNav) {
      nextNav.click();
      window.__edg_stats.slidesAdvanced++;
      window.__edg_log('Next activity clicked', 'success');
      return;
    }

    try {
      var innerIframe = document.querySelector('iframe:not(#edg-pixel-ui-frame)');
      if (innerIframe && innerIframe.contentWindow && innerIframe.contentWindow.API && innerIframe.contentWindow.API.E2020) {
        if (!innerIframe.contentWindow.API.E2020.freeMovement) {
          innerIframe.contentWindow.API.E2020.freeMovement = true;
          window.__edg_log('Unlocked freeMovement on activity', 'info');
        }
      }
    } catch (e) {}

    var curFrame = document.querySelector('.FrameCurrent.FrameComplete');
    var nextSlide = document.querySelector('.FrameRight');
    if (curFrame && nextSlide && !isClickingSlide) {
      isClickingSlide = true;
      nextSlide.click();
      window.__edg_stats.slidesAdvanced++;
      window.__edg_log('Advanced completed slide', 'success');
      setTimeout(function () {
        isClickingSlide = false;
      }, 600);
    }
  }, 1000);

  addTimer(function () {
    if (!window.__edg_state.skipIntros) return;
    var invis = document.getElementById('invis-o-div');
    if (invis) {
      invis.remove();
      window.__edg_log('Removed invis-o-div overlay', 'info');
    }
    var err = document.getElementById('uid1_errorMessage');
    if (err) {
      err.remove();
      window.__edg_log('Cleared audio error dialog', 'info');
    }
  }, 1500);

  var alreadyPlayedCheck = false;
  addTimer(function () {
    if (!window.__edg_state.autoDefi) return;
    var normalTextBox = document.querySelector('.word-textbox.word-normal');
    var correctTextBox = document.querySelector('.word-textbox.word-correct');
    var normalTextBtn = document.querySelector('.plainbtn.alt.blue.selected');
    var firstDefBtn = document.querySelector('.playbutton.vocab-play');
    var nextBtn = document.querySelector('.uibtn.uibtn-blue.uibtn-arrow-next');

    if (normalTextBox && !correctTextBox && normalTextBtn) {
      normalTextBox.value = normalTextBtn.textContent || normalTextBtn.innerText;
      alreadyPlayedCheck = false;
      triggerEvent(normalTextBox, 'keyup');
      window.__edg_log('Entered vocab definition', 'info');
    }
    if (correctTextBox && !alreadyPlayedCheck && firstDefBtn) {
      firstDefBtn.click();
      alreadyPlayedCheck = true;
    }
    if (nextBtn && correctTextBox) {
      nextBtn.click();
      window.__edg_stats.vocabCompleted++;
      window.__edg_log('Vocab question completed', 'success');
    }
  }, 2000);

  addTimer(function () {
    if (!window.__edg_state.antiAfk) return;
    triggerEvent(document.body, 'click');
    window.__edg_stats.afkPings++;
  }, 15000);

  // Shortcut key: Ctrl + Shift + \
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === '\\') {
      var f = document.getElementById('edg-pixel-ui-frame');
      var d = document.getElementById('edg-pixel-dock');
      if (!f || !d) return;
      if (f.style.display === 'none' || f.style.opacity === '0') {
        restoreWindow();
      } else {
        minimizeWindow();
      }
    }
  });
})();
