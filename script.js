// ==UserScript==
// @name         StudySync Assist - Course Navigation & Form Helper
// @namespace    https://github.com/studysync
// @version      4.8
// @description  Streamlined academic utility interface for automated navigation, quiz solving, math matching, and dashboard customization.
// @author       StudySync Systems
// @match        *://*.core.learn.edgenuity.com/*
// @match        *://student.edgenuity.com/*
// @match        *://*.student.edgenuity.com/*
// @match        *://media.edgenuity.com/contentengine/frames/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      generativelanguage.googleapis.com
// @connect      media.edgenuity.com
// @connect      core.learn.edgenuity.com
// @connect      student.edgenuity.com
// ==/UserScript==

(function () {
  'use strict';

  function getStoredKeys() {
    var raw = GM_getValue('PROVIDER_KEY', '') || GM_getValue('GEMINI_API_KEY', '');
    return raw.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
  }

  var currentKeyIndex = 0;
  function getActiveKey() {
    var keys = getStoredKeys();
    if (!keys.length) return '';
    return keys[currentKeyIndex % keys.length];
  }

  function rotateKey() {
    var keys = getStoredKeys();
    if (keys.length > 1) {
      currentKeyIndex = (currentKeyIndex + 1) % keys.length;
      if (window.__ss_log) window.__ss_log('Switched to secondary API key slot ' + (currentKeyIndex + 1), 'info');
    }
  }

  function setStoredKeys(keyString) {
    GM_setValue('PROVIDER_KEY', keyString.trim());
    GM_setValue('GEMINI_API_KEY', keyString.trim());
  }

  // Cross-frame messaging
  window.addEventListener('message', function (e) {
    if (e.data === 'SS_PANIC_DESTROY') {
      executeSelfDestruct();
    }
    if (e.data === 'SS_SHOW_UI' && window === window.top) {
      toggleInterface();
    }
  });

  // Debounced Key Listeners (350ms cooldown)
  var lastToggleTime = 0;
  window.addEventListener('keydown', function (e) {
    var now = Date.now();

    // 1. Shift + / -> Show / Toggle Interface
    if (e.shiftKey && (e.key === '?' || e.key === '/' || e.code === 'Slash')) {
      e.preventDefault();
      if (now - lastToggleTime < 350) return;
      lastToggleTime = now;

      if (window === window.top) {
        toggleInterface();
      } else {
        window.top.postMessage('SS_SHOW_UI', '*');
      }
    }

    // 2. Shift + \ -> Panic Kill Script Everywhere Instantly
    if (e.shiftKey && (e.key === '|' || e.key === '\\' || e.code === 'Backslash')) {
      e.preventDefault();
      window.top.postMessage('SS_PANIC_DESTROY', '*');
      for (var i = 0; i < window.frames.length; i++) {
        try { window.frames[i].postMessage('SS_PANIC_DESTROY', '*'); } catch (_) {}
      }
      executeSelfDestruct();
    }
  });

  function toggleInterface() {
    if (window !== window.top) return;
    var host = document.getElementById('studysync-container');
    var dock = document.getElementById('studysync-dock');
    if (!host) return;

    if (host.style.display === 'none') {
      if (dock) dock.style.display = 'none';
      host.style.display = 'block';
    } else {
      host.style.display = 'none';
    }
  }

  function executeSelfDestruct() {
    window.__ss_dead = true;

    var host = document.getElementById('studysync-container');
    if (host) host.remove();
    var dock = document.getElementById('studysync-dock');
    if (dock) dock.remove();

    document.querySelectorAll('#ss-fill-btn').forEach(function(b) { b.remove(); });

    if (window.__ss_mount_timer) {
      clearInterval(window.__ss_mount_timer);
      window.__ss_mount_timer = null;
    }

    if (window.__ss_timers && Array.isArray(window.__ss_timers)) {
      window.__ss_timers.forEach(clearInterval);
      window.__ss_timers = [];
    }

    if (window.__ss_spoof_timer) {
      clearInterval(window.__ss_spoof_timer);
      window.__ss_spoof_timer = null;
    }

    revertDashboardSpoof();

    if (window.__ss_state) {
      window.__ss_state.assistAutoFill = false;
      window.__ss_state.navAdvance = false;
      window.__ss_state.vocabHelper = false;
      window.__ss_state.keepAlive = false;
      window.__ss_state.enableSpoof = false;
    }

    for (var i = 0; i < window.frames.length; i++) {
      try { window.frames[i].postMessage('SS_PANIC_DESTROY', '*'); } catch (_) {}
    }

    console.log('[StudySync] Terminated. Stock Edgenuity restored.');
  }

  // =========================================================================
  // SECTION 1: MATERIAL YOU CONTROLLER (Top-Level Window Only)
  // =========================================================================
  var isTopWindow = (window === window.top);
  var isEdgenuityHost = window.location.hostname.includes('edgenuity.com');

  if (isEdgenuityHost && isTopWindow) {
    if (!window.__ss_loaded) {
      window.__ss_loaded = true;

      window.__ss_state = {
        assistAutoFill: GM_getValue('assistAutoFill', true),
        autoCommit: GM_getValue('autoCommit', true),
        navAdvance: GM_getValue('navAdvance', true),
        clearOverlays: GM_getValue('clearOverlays', true),
        vocabHelper: GM_getValue('vocabHelper', true),
        keepAlive: GM_getValue('keepAlive', true),
        delayProcessing: GM_getValue('delayProcessing', 2),
        delayTransition: GM_getValue('delayTransition', 2),
        enableSpoof: GM_getValue('enableSpoof', false),
        spoofMode: GM_getValue('spoofMode', 'ahead'),
        spoofType: GM_getValue('spoofType', 'random'),
        spoofGrade: GM_getValue('spoofGrade', '97.5%'),
        spoofMin: GM_getValue('spoofMin', 84),
        spoofMax: GM_getValue('spoofMax', 98),
        hideOverdue: GM_getValue('hideOverdue', true)
      };

      window.__ss_stats = {
        startTime: Date.now(),
        slidesNavigated: 0,
        vocabSolved: 0,
        inputsHandled: 0,
        keepAlivePings: 0
      };

      window.__ss_logs = [];
      window.__ss_timers = [];

      window.__ss_log = function (msg, type) {
        if (window.__ss_dead) return;
        type = type || 'info';
        var d = new Date();
        var time = [d.getHours(), d.getMinutes(), d.getSeconds()]
          .map(function (n) { return n < 10 ? '0' + n : n; })
          .join(':');
        window.__ss_logs.unshift({ time: time, msg: msg, type: type });
        if (window.__ss_logs.length > 75) window.__ss_logs.pop();
        if (window.__ss_on_log) window.__ss_on_log();
      };

      function addLoop(fn, interval) {
        var id = setInterval(function () {
          if (!window.__ss_dead) fn();
        }, interval);
        window.__ss_timers.push(id);
        return id;
      }

      // Dock Pill
      var dock = document.createElement('div');
      dock.id = 'studysync-dock';
      Object.assign(dock.style, {
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: '2147483647',
        display: 'none'
      });
      dock.innerHTML = `
        <button id="ss-dock-btn" title="Open StudySync (Shift+/)" style="
          width: 46px;
          height: 46px;
          border-radius: 16px;
          background: #0b57d0;
          color: #ffffff;
          border: 2px solid rgba(255,255,255,0.7);
          box-shadow: 0 4px 14px rgba(11,87,208,0.3);
          cursor: pointer;
          display: grid;
          place-items: center;
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z"/>
          </svg>
        </button>`;
      document.body.appendChild(dock);

      // Main Window
      var host = document.createElement('div');
      host.id = 'studysync-container';
      var savedPos = GM_getValue('ss_window_pos', null);
      var defLeft = Math.max(10, window.innerWidth - 530);
      var defTop = 20;

      var curLeft = savedPos ? savedPos.left : defLeft;
      var curTop = savedPos ? savedPos.top : defTop;

      Object.assign(host.style, {
        position: 'fixed',
        left: curLeft + 'px',
        top: curTop + 'px',
        width: '500px',
        height: '520px',
        zIndex: '2147483646',
        display: 'block'
      });
      document.body.appendChild(host);

      var shadow = host.attachShadow({ mode: 'open' });

      var template = `
        <style>
          :host {
            --md-sys-color-primary: #0b57d0;
            --md-sys-color-on-primary: #ffffff;
            --md-sys-color-surface: #f8fafd;
            --md-sys-color-surface-container: #ffffff;
            --md-sys-color-surface-container-high: #e9eef6;
            --md-sys-color-outline: #c4c7c5;
            --md-sys-color-outline-variant: #e1e3e1;
            --md-sys-color-on-surface: #1f1f1f;
            --md-sys-color-on-surface-variant: #444746;
            --md-sys-color-error: #ba1a1a;
          }
          * { box-sizing: border-box; margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, "Google Sans", "Segoe UI", Roboto, sans-serif; user-select: none; }
          .window {
            display: flex; flex-direction: column; height: 100%; width: 100%;
            background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface);
            border-radius: 24px; border: 1px solid var(--md-sys-color-outline-variant);
            box-shadow: 0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06);
            overflow: hidden;
          }
          .header {
            height: 48px; flex: none; display: flex; align-items: center;
            padding: 0 16px; background: var(--md-sys-color-surface); border-bottom: 1px solid var(--md-sys-color-outline-variant);
            cursor: grab; touch-action: none;
          }
          .header:active { cursor: grabbing; }
          .brand { display: flex; align-items: center; gap: 10px; flex: 1; }
          .brand-icon {
            width: 28px; height: 28px; border-radius: 10px;
            background: #d3e3fd; color: #041e49; display: grid; place-items: center;
          }
          .brand-title { font-size: 13.5px; font-weight: 600; color: #041e49; letter-spacing: -0.2px; }
          .controls { display: flex; gap: 4px; }
          .ctrl-btn {
            border: 0; background: transparent; width: 30px; height: 30px; border-radius: 50%;
            display: grid; place-items: center; color: var(--md-sys-color-on-surface-variant);
            cursor: pointer; transition: background 0.15s ease;
          }
          .ctrl-btn:hover { background: var(--md-sys-color-surface-container-high); }
          .ctrl-btn.close:hover { background: #ffdad6; color: var(--md-sys-color-error); }

          .nav-tabs {
            display: flex; gap: 6px; padding: 10px 16px 8px; background: var(--md-sys-color-surface);
          }
          .nav-pill {
            border: 0; background: transparent; height: 32px; padding: 0 14px;
            border-radius: 16px; font-size: 12px; font-weight: 500; color: var(--md-sys-color-on-surface-variant);
            cursor: pointer; transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
          }
          .nav-pill.active {
            background: #d3e3fd; color: #041e49; font-weight: 600;
          }

          .content { padding: 12px 16px; flex: 1; overflow-y: auto; font-size: 13px; }

          .pill-status {
            display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
            border-radius: 8px; font-size: 11.5px; font-weight: 600; margin-bottom: 12px;
            background: #c4eed0; color: #072711;
          }
          .pill-status.paused { background: #ffdad6; color: #410002; }
          .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #146c2e; }
          .pill-status.paused .status-dot { background: #ba1a1a; }

          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
          .stat-card {
            background: var(--md-sys-color-surface-container); border-radius: 16px;
            padding: 10px 6px; text-align: center; border: 1px solid var(--md-sys-color-outline-variant);
          }
          .stat-val { font-size: 16px; font-weight: 700; color: var(--md-sys-color-primary); }
          .stat-lbl { font-size: 10px; color: var(--md-sys-color-on-surface-variant); margin-top: 2px; }

          .banner-shortcut {
            background: #e8f0fe; color: #174ea6; padding: 8px 12px; border-radius: 12px;
            font-size: 11.5px; margin-bottom: 12px; display: flex; justify-content: space-between;
          }
          .banner-shortcut kbd {
            background: #ffffff; padding: 2px 6px; border-radius: 6px;
            border: 1px solid #d2e3fc; font-weight: 600; font-family: inherit; font-size: 11px;
          }

          .section-label { font-size: 11px; font-weight: 700; color: var(--md-sys-color-primary); margin: 12px 0 6px 4px; text-transform: uppercase; letter-spacing: 0.5px; }
          .setting-row {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 14px; background: var(--md-sys-color-surface-container);
            border-radius: 14px; border: 1px solid var(--md-sys-color-outline-variant); margin-bottom: 6px;
          }
          .setting-row label { font-size: 12.5px; font-weight: 500; cursor: pointer; flex: 1; }

          .m3-switch { position: relative; width: 38px; height: 22px; flex: none; }
          .m3-switch input { opacity: 0; width: 0; height: 0; }
          .m3-slider {
            position: absolute; cursor: pointer; inset: 0;
            background: #e1e3e1; border-radius: 16px; border: 1px solid #747775; transition: 0.2s cubic-bezier(0.2, 0, 0, 1);
          }
          .m3-slider:before {
            position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px;
            background: #747775; border-radius: 50%; transition: 0.2s cubic-bezier(0.2, 0, 0, 1);
          }
          input:checked + .m3-slider { background: #0b57d0; border-color: #0b57d0; }
          input:checked + .m3-slider:before { background: #ffffff; transform: translateX(16px); }

          .num-input, .select-input {
            padding: 4px 8px; border: 1px solid var(--md-sys-color-outline);
            border-radius: 8px; font-size: 12px; background: #ffffff; outline: none;
          }
          .num-input { width: 60px; text-align: center; }

          .key-container {
            background: var(--md-sys-color-surface-container); padding: 10px 12px;
            border-radius: 14px; border: 1px solid var(--md-sys-color-outline-variant); margin-bottom: 8px;
          }
          .key-row { display: flex; gap: 8px; margin-top: 6px; }
          .text-input {
            flex: 1; border: 1px solid var(--md-sys-color-outline); border-radius: 8px;
            padding: 6px 10px; font-size: 12px; outline: none; background: #ffffff;
          }
          .btn-m3 {
            background: var(--md-sys-color-primary); color: #ffffff; border: 0;
            border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
          }
          .btn-m3.secondary { background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface); }
          .btn-m3.danger { background: #ba1a1a; }

          .log-box {
            background: #1f1f1f; color: #f2f2f2; border-radius: 14px;
            padding: 10px; font-family: ui-monospace, Menlo, Consolas, monospace;
            font-size: 11px; height: 310px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px;
          }
          .log-item { display: flex; gap: 6px; }
          .log-t { color: #8e918f; }
          .log-c-success { color: #6dd58c; }
          .log-c-info { color: #a8c7fa; }
          .log-c-warn { color: #f2b8b5; }
        </style>
        <div class="window">
          <header class="header" id="drag-handle">
            <div class="brand">
              <div class="brand-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z"/>
                </svg>
              </div>
              <div class="brand-title">StudySync Assist</div>
            </div>
            <div class="controls">
              <button class="ctrl-btn" id="ctrl-min" title="Minimize to Dock">&minus;</button>
              <button class="ctrl-btn close" id="ctrl-close" title="Hide UI (Shift+/ to restore)">&times;</button>
            </div>
          </header>

          <nav class="nav-tabs">
            <button class="nav-pill active" data-tab="overview">Overview</button>
            <button class="nav-pill" data-tab="config">Configuration</button>
            <button class="nav-pill" data-tab="activity">Activity Log</button>
          </nav>

          <section class="content" id="panel-content"></section>
        </div>
      `;
      shadow.innerHTML = template;

      var dragHandle = shadow.getElementById('drag-handle');
      var panelContent = shadow.getElementById('panel-content');
      var ctrlMin = shadow.getElementById('ctrl-min');
      var ctrlClose = shadow.getElementById('ctrl-close');
      var activeTab = 'overview';

      var isDragging = false, sX = 0, sY = 0, initL = 0, initT = 0;

      dragHandle.addEventListener('pointerdown', function (e) {
        if (e.target.closest('button')) return;
        isDragging = true;
        dragHandle.setPointerCapture(e.pointerId);
        sX = e.clientX;
        sY = e.clientY;
        initL = host.offsetLeft;
        initT = host.offsetTop;
      });

      dragHandle.addEventListener('pointermove', function (e) {
        if (!isDragging) return;
        var nL = initL + (e.clientX - sX);
        var nT = initT + (e.clientY - sY);

        nL = Math.max(5, Math.min(window.innerWidth - host.offsetWidth - 5, nL));
        nT = Math.max(5, Math.min(window.innerHeight - host.offsetHeight - 5, nT));

        host.style.left = nL + 'px';
        host.style.top = nT + 'px';
      });

      dragHandle.addEventListener('pointerup', function (e) {
        if (isDragging) {
          isDragging = false;
          try { dragHandle.releasePointerCapture(e.pointerId); } catch (_) {}
          GM_setValue('ss_window_pos', { left: host.offsetLeft, top: host.offsetTop });
        }
      });

      ctrlMin.onclick = function () {
        host.style.display = 'none';
        dock.style.display = 'block';
      };
      dock.onclick = function () {
        dock.style.display = 'none';
        host.style.display = 'block';
      };
      ctrlClose.onclick = function () {
        host.style.display = 'none';
      };

      function getUptime() {
        var s = Math.floor((Date.now() - window.__ss_stats.startTime) / 1000);
        return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
      }

      function renderOverview() {
        var stats = window.__ss_stats;
        var state = window.__ss_state;
        var isHalted = !!window.__ss_dead;
        var isActive = !isHalted && (state.assistAutoFill || state.navAdvance || state.vocabHelper || state.keepAlive);

        panelContent.innerHTML = `
          <div id="status-pill" class="pill-status ${isActive ? '' : 'paused'}">
            <span class="status-dot"></span>${isHalted ? 'Terminated' : (isActive ? 'System Running' : 'Idle')}
          </div>

          <div class="stats-grid">
            <div class="stat-card"><div class="stat-val" id="disp-uptime">${getUptime()}</div><div class="stat-lbl">Uptime</div></div>
            <div class="stat-card"><div class="stat-val">${stats.slidesNavigated}</div><div class="stat-lbl">Slides</div></div>
            <div class="stat-card"><div class="stat-val">${stats.vocabSolved}</div><div class="stat-lbl">Vocab</div></div>
            <div class="stat-card"><div class="stat-val">${stats.inputsHandled}</div><div class="stat-lbl">Inputs Filled</div></div>
          </div>

          <div class="banner-shortcut">
            <span>Toggle UI: <kbd>Shift + /</kbd></span>
            <span>Kill Script: <kbd>Shift + \\</kbd></span>
          </div>

          <div style="background:var(--md-sys-color-surface-container);padding:12px;border-radius:14px;border:1px solid var(--md-sys-color-outline-variant);">
            <div style="font-size:12px;font-weight:600;margin-bottom:4px;">Dashboard Customizer Active</div>
            <div style="font-size:11.5px;color:var(--md-sys-color-on-surface-variant);line-height:1.4;">
              Status: ${state.enableSpoof ? (state.spoofMode === 'ahead' ? 'Ahead (#4caf50)' : 'On Target (#007bff)') : 'Disabled'}<br>
              Grade Scoring: ${state.spoofType === 'random' ? ('Random range (' + state.spoofMin + '% - ' + state.spoofMax + '%)') : ('Fixed (' + state.spoofGrade + ')')}<br>
              Overdue Alerts Hidden: ${state.hideOverdue ? 'Yes' : 'No'}
            </div>
          </div>`;
      }

      function renderConfig() {
        var s = window.__ss_state;
        var savedKey = (GM_getValue('PROVIDER_KEY', '') || GM_getValue('GEMINI_API_KEY', ''));

        panelContent.innerHTML = `
          <div class="section-label">Safety & Termination</div>
          <div style="margin-bottom:8px;">
            <button id="btn-panic" class="btn-m3 danger" style="width:100%;padding:9px;font-weight:600;">
              Destroy Script & Restore Normal Edgenuity (Shift + \\)
            </button>
          </div>

          <div class="section-label">Dashboard Visual Customizer</div>
          <div class="setting-row">
            <label for="cfg-spoof">Spoof Dashboard Grade & Progress</label>
            <label class="m3-switch"><input type="checkbox" id="cfg-spoof" ${s.enableSpoof ? 'checked' : ''}><span class="m3-slider"></span></label>
          </div>
          <div class="setting-row">
            <label for="cfg-spoof-mode">Target Visual Status</label>
            <select id="cfg-spoof-mode" class="select-input">
              <option value="ahead" ${s.spoofMode === 'ahead' ? 'selected' : ''}>Ahead (#4caf50 Green)</option>
              <option value="ontarget" ${s.spoofMode === 'ontarget' ? 'selected' : ''}>On Target (#007bff Blue)</option>
            </select>
          </div>
          <div class="setting-row">
            <label for="cfg-spoof-type">Grade Scoring Mode</label>
            <select id="cfg-spoof-type" class="select-input">
              <option value="random" ${s.spoofType === 'random' ? 'selected' : ''}>Random Range (e.g. 80-100%)</option>
              <option value="fixed" ${s.spoofType === 'fixed' ? 'selected' : ''}>Fixed Exact Grade</option>
            </select>
          </div>
          <div class="setting-row" id="row-rand-grades" style="display:${s.spoofType === 'random' ? 'flex' : 'none'};">
            <label>Random Range (Min - Max %)</label>
            <div style="display:flex;gap:4px;align-items:center;">
              <input type="number" id="cfg-spoof-min" class="num-input" min="50" max="99" value="${s.spoofMin}">
              <span>-</span>
              <input type="number" id="cfg-spoof-max" class="num-input" min="51" max="100" value="${s.spoofMax}">
            </div>
          </div>
          <div class="setting-row" id="row-fixed-grade" style="display:${s.spoofType === 'fixed' ? 'flex' : 'none'};">
            <label for="cfg-spoof-grade">Exact Fixed Grade</label>
            <input type="text" id="cfg-spoof-grade" class="select-input" style="width:80px;text-align:center;" value="${s.spoofGrade}">
          </div>
          <div class="setting-row">
            <label for="cfg-hide-overdue">Hide Overdue Alerts & Banners</label>
            <label class="m3-switch"><input type="checkbox" id="cfg-hide-overdue" ${s.hideOverdue ? 'checked' : ''}><span class="m3-slider"></span></label>
          </div>

          <div class="section-label">Automated Input Processing</div>
          <div class="setting-row">
            <label for="cfg-fill">Automated Form Filling</label>
            <label class="m3-switch"><input type="checkbox" id="cfg-fill" ${s.assistAutoFill ? 'checked' : ''}><span class="m3-slider"></span></label>
          </div>
          <div class="setting-row">
            <label for="cfg-commit">Auto-Submit / Check Answers</label>
            <label class="m3-switch"><input type="checkbox" id="cfg-commit" ${s.autoCommit ? 'checked' : ''}><span class="m3-slider"></span></label>
          </div>
          <div class="setting-row">
            <label for="cfg-delay">Inspection Delay (seconds)</label>
            <input type="number" id="cfg-delay" class="num-input" min="1" max="15" value="${s.delayProcessing}">
          </div>

          <div class="section-label">Navigation & Progression</div>
          <div class="setting-row">
            <label for="cfg-advance">Auto-Advance Completed Slides</label>
            <label class="m3-switch"><input type="checkbox" id="cfg-advance" ${s.navAdvance ? 'checked' : ''}><span class="m3-slider"></span></label>
          </div>
          <div class="setting-row">
            <label for="cfg-trans-delay">Slide Transition Delay (seconds)</label>
            <input type="number" id="cfg-trans-delay" class="num-input" min="1" max="20" value="${s.delayTransition}">
          </div>
          <div class="setting-row">
            <label for="cfg-overlays">Dismiss Intro Dialogs</label>
            <label class="m3-switch"><input type="checkbox" id="cfg-overlays" ${s.clearOverlays ? 'checked' : ''}><span class="m3-slider"></span></label>
          </div>
          <div class="setting-row">
            <label for="cfg-vocab">Automated Vocabulary Solver</label>
            <label class="m3-switch"><input type="checkbox" id="cfg-vocab" ${s.vocabHelper ? 'checked' : ''}><span class="m3-slider"></span></label>
          </div>
          <div class="setting-row">
            <label for="cfg-keepalive">Connection Keep-Alive</label>
            <label class="m3-switch"><input type="checkbox" id="cfg-keepalive" ${s.keepAlive ? 'checked' : ''}><span class="m3-slider"></span></label>
          </div>

          <div class="section-label">API Quota & Multi-Key Setup</div>
          <div class="key-container">
            <label style="font-weight:600;font-size:11.5px;color:var(--md-sys-color-on-surface);">API Keys (comma-separated for auto-rotation)</label>
            <div class="key-row">
              <input type="password" id="key-input" class="text-input" placeholder="key1, key2, key3..." value="${savedKey}">
              <button id="btn-save-key" class="btn-m3">Save</button>
            </div>
            <div style="font-size:10px;color:var(--md-sys-color-on-surface-variant);margin-top:4px;">
              Paste 2-3 free keys separated by commas to bypass 15 RPM limits automatically.
            </div>
          </div>`;

        shadow.getElementById('btn-panic').onclick = executeSelfDestruct;

        shadow.getElementById('cfg-spoof').onchange = function (e) {
          s.enableSpoof = e.target.checked;
          GM_setValue('enableSpoof', s.enableSpoof);
          if (s.enableSpoof) applyDashboardSpoof();
          else revertDashboardSpoof();
        };

        shadow.getElementById('cfg-spoof-mode').onchange = function (e) {
          s.spoofMode = e.target.value;
          GM_setValue('spoofMode', s.spoofMode);
          if (s.enableSpoof) applyDashboardSpoof();
        };

        shadow.getElementById('cfg-spoof-type').onchange = function (e) {
          s.spoofType = e.target.value;
          GM_setValue('spoofType', s.spoofType);
          shadow.getElementById('row-rand-grades').style.display = (s.spoofType === 'random') ? 'flex' : 'none';
          shadow.getElementById('row-fixed-grade').style.display = (s.spoofType === 'fixed') ? 'flex' : 'none';
          if (s.enableSpoof) applyDashboardSpoof();
        };

        shadow.getElementById('cfg-spoof-min').onchange = function (e) {
          s.spoofMin = parseInt(e.target.value) || 80;
          GM_setValue('spoofMin', s.spoofMin);
          if (s.enableSpoof) applyDashboardSpoof();
        };

        shadow.getElementById('cfg-spoof-max').onchange = function (e) {
          s.spoofMax = parseInt(e.target.value) || 100;
          GM_setValue('spoofMax', s.spoofMax);
          if (s.enableSpoof) applyDashboardSpoof();
        };

        shadow.getElementById('cfg-spoof-grade').onchange = function (e) {
          s.spoofGrade = e.target.value.trim();
          GM_setValue('spoofGrade', s.spoofGrade);
          if (s.enableSpoof) applyDashboardSpoof();
        };

        shadow.getElementById('cfg-hide-overdue').onchange = function (e) {
          s.hideOverdue = e.target.checked;
          GM_setValue('hideOverdue', s.hideOverdue);
          if (s.enableSpoof) applyDashboardSpoof();
          else revertDashboardSpoof();
        };

        shadow.getElementById('cfg-fill').onchange = function (e) { s.assistAutoFill = e.target.checked; GM_setValue('assistAutoFill', s.assistAutoFill); };
        shadow.getElementById('cfg-commit').onchange = function (e) { s.autoCommit = e.target.checked; GM_setValue('autoCommit', s.autoCommit); };
        shadow.getElementById('cfg-delay').onchange = function (e) { s.delayProcessing = Math.max(1, parseInt(e.target.value) || 2); GM_setValue('delayProcessing', s.delayProcessing); };
        shadow.getElementById('cfg-advance').onchange = function (e) { s.navAdvance = e.target.checked; GM_setValue('navAdvance', s.navAdvance); };
        shadow.getElementById('cfg-trans-delay').onchange = function (e) { s.delayTransition = Math.max(1, parseInt(e.target.value) || 2); GM_setValue('delayTransition', s.delayTransition); };
        shadow.getElementById('cfg-overlays').onchange = function (e) { s.clearOverlays = e.target.checked; GM_setValue('clearOverlays', s.clearOverlays); };
        shadow.getElementById('cfg-vocab').onchange = function (e) { s.vocabHelper = e.target.checked; GM_setValue('vocabHelper', s.vocabHelper); };
        shadow.getElementById('cfg-keepalive').onchange = function (e) { s.keepAlive = e.target.checked; GM_setValue('keepAlive', s.keepAlive); };

        shadow.getElementById('btn-save-key').onclick = function () {
          var token = shadow.getElementById('key-input').value.trim();
          setStoredKeys(token);
          alert('API credentials updated (' + getStoredKeys().length + ' active key slots)!');
          window.__ss_log('Saved API credentials', 'success');
        };
      }

      function renderActivity() {
        var logs = window.__ss_logs;
        panelContent.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-size:12px;font-weight:600;color:var(--md-sys-color-on-surface);">Recorded Actions</div>
            <button id="btn-purge-logs" style="border:1px solid var(--md-sys-color-outline-variant);background:#fff;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;">Clear</button>
          </div>
          <div class="log-box">
            ${logs.length
              ? logs.map(function (l) {
                  return `<div class="log-item"><span class="log-t">[${l.time}]</span><span class="log-c-${l.type}">${l.msg}</span></div>`;
                }).join('')
              : '<div style="color:#8e918f;padding:12px;text-align:center">No recorded activity yet.</div>'
            }
          </div>`;

        shadow.getElementById('btn-purge-logs').onclick = function () {
          window.__ss_logs.length = 0;
          renderActivity();
        };
      }

      window.__ss_on_log = function () {
        if (activeTab === 'activity') renderActivity();
        if (activeTab === 'overview') {
          var el = shadow.getElementById('disp-uptime');
          if (el) el.innerText = getUptime();
        }
      };

      renderOverview();

      setInterval(function () {
        if (activeTab === 'overview') {
          var el = shadow.getElementById('disp-uptime');
          if (el) el.innerText = getUptime();
        }
      }, 1000);

      shadow.querySelectorAll('.nav-pill').forEach(function (btn) {
        btn.onclick = function () {
          shadow.querySelectorAll('.nav-pill').forEach(function (b) { b.classList.toggle('active', b === btn); });
          activeTab = btn.getAttribute('data-tab');
          if (activeTab === 'overview') renderOverview();
          else if (activeTab === 'config') renderConfig();
          else if (activeTab === 'activity') renderActivity();
        };
      });

      // Progression Loop
      var isStepping = false;
      addLoop(function () {
        if (window.__ss_dead || !window.__ss_state.navAdvance) return;

        var activityNav = document.querySelector('.footnav.goRight:not(.disabled)');
        if (activityNav) {
          activityNav.click();
          window.__ss_stats.slidesNavigated++;
          window.__ss_log('Progressed forward to next lesson module', 'success');
          return;
        }

        try {
          var innerIframe = document.querySelector('iframe:not(#studysync-container iframe)');
          if (innerIframe && innerIframe.contentWindow && innerIframe.contentWindow.API && innerIframe.contentWindow.API.E2020) {
            if (!innerIframe.contentWindow.API.E2020.freeMovement) {
              innerIframe.contentWindow.API.E2020.freeMovement = true;
            }
          }
        } catch (_) {}

        var currentSlide = document.querySelector('.FrameCurrent.FrameComplete');
        var slideArrow = document.querySelector('.FrameRight');
        if (currentSlide && slideArrow && !isStepping) {
          isStepping = true;
          slideArrow.click();
          window.__ss_stats.slidesNavigated++;
          window.__ss_log('Navigated forward to completed slide', 'success');
          setTimeout(function () { isStepping = false; }, 1000);
        }
      }, 1000);

      // Overlays Cleanup
      addLoop(function () {
        if (window.__ss_dead || !window.__ss_state.clearOverlays) return;
        var invis = document.getElementById('invis-o-div');
        if (invis) invis.remove();
        var err = document.getElementById('uid1_errorMessage');
        if (err) err.remove();
      }, 1500);

      // Vocabulary Helper
      var vocabPlayed = false;
      addLoop(function () {
        if (window.__ss_dead || !window.__ss_state.vocabHelper) return;
        var normalBox = document.querySelector('.word-textbox.word-normal');
        var correctBox = document.querySelector('.word-textbox.word-correct');
        var textBtn = document.querySelector('.plainbtn.alt.blue.selected');
        var playDefBtn = document.querySelector('.playbutton.vocab-play');
        var nextBtn = document.querySelector('.uibtn.uibtn-blue.uibtn-arrow-next');

        if (normalBox && !correctBox && textBtn) {
          normalBox.value = textBtn.textContent || textBtn.innerText;
          vocabPlayed = false;
          normalBox.dispatchEvent(new Event('keyup', { bubbles: true }));
        }
        if (correctBox && !vocabPlayed && playDefBtn) {
          playDefBtn.click();
          vocabPlayed = true;
        }
        if (nextBtn && correctBox) {
          nextBtn.click();
          window.__ss_stats.vocabSolved++;
          window.__ss_log('Completed vocabulary term match', 'success');
        }
      }, 2000);

      // Connection Heartbeat
      addLoop(function () {
        if (window.__ss_dead || !window.__ss_state.keepAlive) return;
        document.body.dispatchEvent(new Event('click', { bubbles: true }));
        window.__ss_stats.keepAlivePings++;
      }, 15000);

      // Cross-frame events
      window.addEventListener('message', function (e) {
        if (window.__ss_dead) return;
        if (e.data && e.data.type === 'SS_LOG') {
          window.__ss_log(e.data.msg, e.data.logType || 'info');
        }
        if (e.data && e.data.type === 'SS_FILLED') {
          window.__ss_stats.inputsHandled++;
          window.__ss_log('Answered question: ' + (e.data.title || 'Question Item'), 'success');
        }
        if (e.data === 'SS_ADVANCE_REQUEST') {
          var waitMs = (window.__ss_state.delayTransition || 2) * 1000;
          setTimeout(function() {
            if (!window.__ss_dead) {
              var qNext = document.querySelector('input[value*="Next"], button.next, .btn-next, .uibtn-arrow-next');
              if (qNext) {
                qNext.click();
                return;
              }
              var next = document.querySelector('.FrameRight') || document.querySelector('.footnav.goRight:not(.disabled)');
              if (next) next.click();
            }
          }, waitMs);
        }
      });
    }
  }

  // =========================================================================
  // SECTION 2: STUDENT DASHBOARD SPOOFER & OVERDUE CLEANUP
  // =========================================================================
  function getCourseStableGrade(courseName, min, max) {
    var hash = 0;
    for (var i = 0; i < courseName.length; i++) {
      hash = (hash << 5) - hash + courseName.charCodeAt(i);
      hash |= 0;
    }
    var normalized = Math.abs(hash % 1000) / 1000;
    var val = min + normalized * (max - min);
    return val.toFixed(1) + '%';
  }

  function getCourseStableLead(courseName) {
    var hash = 0;
    for (var i = 0; i < courseName.length; i++) {
      hash = (hash << 3) - hash + courseName.charCodeAt(i);
      hash |= 0;
    }
    return 2.0 + (Math.abs(hash % 70) / 10);
  }

  function applyDashboardSpoof() {
    if (window.__ss_dead) return;
    var state = window.__ss_state || {
      enableSpoof: GM_getValue('enableSpoof', false),
      spoofMode: GM_getValue('spoofMode', 'ahead'),
      spoofType: GM_getValue('spoofType', 'random'),
      spoofGrade: GM_getValue('spoofGrade', '97.5%'),
      spoofMin: GM_getValue('spoofMin', 84),
      spoofMax: GM_getValue('spoofMax', 98),
      hideOverdue: GM_getValue('hideOverdue', true)
    };

    if (!state.enableSpoof) return;

    var isAhead = (state.spoofMode === 'ahead');
    var barColor = isAhead ? '#4caf50' : '#007bff';
    var statusPhrase = isAhead ? 'ahead' : 'on target';

    var cards = document.querySelectorAll('.course-cards .card, .sle-card');
    cards.forEach(function (card) {
      var courseNameEl = card.querySelector('.course-name, .card-title');
      var courseName = courseNameEl ? courseNameEl.textContent.trim() : 'Course';

      var curProgress = card.querySelector('.student-progress.current-progress');
      var targetProgress = card.querySelector('.student-progress.target-progress');
      var scoreEl = card.querySelector('.progress-label .score');
      var phraseEl = card.querySelector('.progress-label .phrase');
      var gradeEl = card.querySelector('.course-grade-text');
      var warningsEl = card.querySelector('.course-warnings');

      if (curProgress && !card.dataset.origClass) {
        card.dataset.origClass = curProgress.className;
        card.dataset.origProgressWidth = curProgress.style.width || '';
        card.dataset.origProgressBg = curProgress.style.backgroundColor || '';
      }
      if (scoreEl && !card.dataset.origScore) card.dataset.origScore = scoreEl.textContent;
      if (phraseEl && !card.dataset.origPhrase) card.dataset.origPhrase = phraseEl.textContent;
      if (gradeEl && !card.dataset.origGrade) card.dataset.origGrade = gradeEl.textContent;

      var targetPct = 54.55;
      if (targetProgress && targetProgress.style.width) {
        targetPct = parseFloat(targetProgress.style.width) || 54.55;
      }

      var distinctLead = getCourseStableLead(courseName);
      var spoofedPct = isAhead ? Math.min(99.5, targetPct + distinctLead) : targetPct;
      var pctString = spoofedPct.toFixed(2) + '%';

      if (curProgress) {
        curProgress.classList.remove('behind', 'ontarget', 'ahead');
        curProgress.classList.add(isAhead ? 'ahead' : 'ontarget');
        curProgress.style.setProperty('background-color', barColor, 'important');
        curProgress.style.setProperty('width', pctString, 'important');
      }

      if (scoreEl) {
        scoreEl.textContent = pctString;
      }

      if (phraseEl) {
        phraseEl.textContent = statusPhrase;
        phraseEl.removeAttribute('style');
      }

      if (gradeEl) {
        if (state.spoofType === 'random') {
          gradeEl.textContent = getCourseStableGrade(courseName, state.spoofMin || 80, state.spoofMax || 100);
        } else {
          gradeEl.textContent = state.spoofGrade;
        }
      }

      if (warningsEl && state.hideOverdue) {
        warningsEl.style.setProperty('display', 'none', 'important');
      }
    });

    if (state.hideOverdue) {
      document.querySelectorAll('.alert-panel, .alert-container, .alert-progress, .course-warnings').forEach(function(el) {
        el.style.setProperty('display', 'none', 'important');
      });

      document.querySelectorAll('.ActivityTile-late, .ActivityTile-late-icon, .fa-exclamation-triangle').forEach(function(el) {
        el.classList.remove('ActivityTile-late');
        if (el.style) el.style.setProperty('display', 'none', 'important');
      });
    }

    document.querySelectorAll('.edge-bar-color').forEach(function(bar) {
      bar.classList.remove('behind');
      bar.style.setProperty('background-color', barColor, 'important');
      bar.style.setProperty('border-bottom-color', barColor, 'important');
    });
  }

  function revertDashboardSpoof() {
    var cards = document.querySelectorAll('.course-cards .card, .sle-card');
    cards.forEach(function (card) {
      var curProgress = card.querySelector('.student-progress.current-progress');
      var scoreEl = card.querySelector('.progress-label .score');
      var phraseEl = card.querySelector('.progress-label .phrase');
      var gradeEl = card.querySelector('.course-grade-text');
      var warningsEl = card.querySelector('.course-warnings');

      if (curProgress && card.dataset.origClass) {
        curProgress.className = card.dataset.origClass;
        curProgress.style.backgroundColor = card.dataset.origProgressBg || '';
        curProgress.style.width = card.dataset.origProgressWidth || '';
      }
      if (scoreEl && card.dataset.origScore) scoreEl.textContent = card.dataset.origScore;
      if (phraseEl && card.dataset.origPhrase) {
        phraseEl.textContent = card.dataset.origPhrase;
        phraseEl.removeAttribute('style');
      }
      if (gradeEl && card.dataset.origGrade) gradeEl.textContent = card.dataset.origGrade;
      if (warningsEl) warningsEl.style.display = '';

      delete card.dataset.origClass;
      delete card.dataset.origProgressWidth;
      delete card.dataset.origProgressBg;
      delete card.dataset.origScore;
      delete card.dataset.origPhrase;
      delete card.dataset.origGrade;
    });

    document.querySelectorAll('.alert-panel, .alert-container, .alert-progress, .course-warnings').forEach(function(el) {
      el.style.display = '';
    });
  }

  if (window.location.hostname.includes('student.edgenuity.com') || window.location.hostname.includes('core.learn.edgenuity.com')) {
    applyDashboardSpoof();
    window.__ss_spoof_timer = setInterval(applyDashboardSpoof, 800);
  }


  // =========================================================================
  // SECTION 3: FORM FILLER & CONNECTOR / MATCHING SOLVER
  // =========================================================================
  var isBusy = false;

  function logToParent(msg, logType) {
    if (window === window.top) {
      if (window.__ss_log) window.__ss_log(msg, logType || 'info');
    } else {
      window.top.postMessage({ type: 'SS_LOG', msg: msg, logType: logType || 'info' }, '*');
    }
  }

  function hasActiveQuestions() {
    // 1. Standard forms
    var formInputs = document.querySelectorAll('select, .ui-selectmenu, input[type="radio"], input[type="checkbox"], input[type="text"]').length > 0;
    if (formInputs) return true;

    // 2. Matching / Line Connection Activity (arrows and drop-boxes)
    var matchingElements = document.querySelectorAll('button[class*="arrow"], .arrow, .drop-box, [class*="connect"], [class*="match"], div[fdone], .done').length > 0;
    if (matchingElements) return true;

    return false;
  }

  function mountAlignedButton() {
    if (window.__ss_dead) return;

    var existingBtns = document.querySelectorAll('#ss-fill-btn');
    if (existingBtns.length > 1) {
      for (var i = 1; i < existingBtns.length; i++) existingBtns[i].remove();
    }

    if (!hasActiveQuestions()) {
      if (existingBtns[0]) existingBtns[0].remove();
      return;
    }

    var fillButton = document.getElementById('ss-fill-btn');
    if (!fillButton) {
      fillButton = document.createElement('button');
      fillButton.id = 'ss-fill-btn';
      fillButton.type = 'button';
      fillButton.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:5px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.2px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="color:#ffffff;">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
          <span id="ss-fill-btn-text">Auto Fill</span>
        </span>
      `;

      Object.assign(fillButton.style, {
        height: '30px',
        padding: '0 12px',
        borderRadius: '3px',
        background: 'linear-gradient(to bottom, #c5221f 0%, #a51d24 100%)',
        color: '#ffffff',
        border: '1px solid #7c141a',
        borderBottomColor: '#530c10',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.25)',
        textShadow: '0 -1px 0 rgba(0,0,0,0.3)',
        cursor: 'pointer',
        outline: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        boxSizing: 'border-box',
        marginRight: '8px',
        marginLeft: '4px'
      });

      fillButton.onmouseenter = function() { this.style.background = 'linear-gradient(to bottom, #d93025 0%, #b31412 100%)'; };
      fillButton.onmouseleave = function() { this.style.background = 'linear-gradient(to bottom, #c5221f 0%, #a51d24 100%)'; };
      fillButton.onmousedown = function() { this.style.transform = 'translateY(1px)'; };
      fillButton.onmouseup = function() { this.style.transform = 'none'; };

      fillButton.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        executeFill();
      };
    }

    var nextBtn = document.querySelector('input[value*="Next"], button.next, .btn-next, .FrameRight, .footnav.goRight, .uibtn-arrow-next, [title*="Next"]')
               || Array.from(document.querySelectorAll('input, button, a')).find(function (el) {
                    var val = (el.value || el.textContent || '').trim().toLowerCase();
                    return val === 'next' || val.startsWith('next ');
                  });

    var doneTarget = document.querySelector('div[fdone], .done, [title="done"], input[value="Check"]');
    var saveExitBtn = document.querySelector('input[value*="Save and Exit"], .btn-save-exit');

    if (nextBtn && nextBtn.parentElement) {
      if (fillButton.parentElement !== nextBtn.parentElement || fillButton.nextElementSibling !== nextBtn) {
        nextBtn.parentElement.insertBefore(fillButton, nextBtn);
      }
      fillButton.style.position = 'relative';
      fillButton.style.top = 'auto';
      fillButton.style.bottom = 'auto';
      fillButton.style.left = 'auto';
      fillButton.style.right = 'auto';
    } else if (doneTarget && doneTarget.parentElement) {
      if (fillButton.parentElement !== doneTarget.parentElement) {
        doneTarget.parentElement.insertBefore(fillButton, doneTarget);
      }
      fillButton.style.position = 'relative';
      fillButton.style.top = 'auto';
      fillButton.style.bottom = 'auto';
      fillButton.style.left = 'auto';
      fillButton.style.right = 'auto';
    } else if (saveExitBtn && saveExitBtn.parentElement) {
      if (fillButton.parentElement !== saveExitBtn.parentElement) {
        saveExitBtn.parentElement.insertBefore(fillButton, saveExitBtn);
      }
      fillButton.style.position = 'relative';
      fillButton.style.top = 'auto';
      fillButton.style.bottom = 'auto';
      fillButton.style.left = 'auto';
      fillButton.style.right = 'auto';
    } else {
      if (!fillButton.parentElement) document.body.appendChild(fillButton);
      Object.assign(fillButton.style, {
        position: 'fixed',
        bottom: '12px',
        right: '120px',
        zIndex: '2147483647'
      });
    }
  }

  // Mount on load
  window.addEventListener('load', function () {
    setTimeout(mountAlignedButton, 300);
    window.__ss_mount_timer = setInterval(mountAlignedButton, 1200);

    if (window.__ss_dead) return;
    var isAuto = GM_getValue('assistAutoFill', true);
    if (isAuto) {
      var pauseSec = (GM_getValue('delayProcessing', 2) || 2) * 1000;
      setTimeout(function () {
        if (!window.__ss_dead) executeFill();
      }, pauseSec);
    }
  });

  // Base64 helper for Gemini Vision
  function fetchImageBase64(imgUrl) {
    return new Promise(function(resolve) {
      if (!imgUrl || imgUrl.startsWith('data:')) {
        return resolve(imgUrl ? imgUrl.split(',')[1] : null);
      }
      if (imgUrl.startsWith('//')) imgUrl = window.location.protocol + imgUrl;

      GM_xmlhttpRequest({
        method: 'GET',
        url: imgUrl,
        responseType: 'blob',
        onload: function(res) {
          if (res.status === 200 && res.response) {
            var reader = new FileReader();
            reader.onloadend = function() {
              var b64 = reader.result ? reader.result.split(',')[1] : null;
              resolve(b64);
            };
            reader.readAsDataURL(res.response);
          } else {
            resolve(null);
          }
        },
        onerror: function() { resolve(null); }
      });
    });
  }

  async function executeFill() {
    if (isBusy || window.__ss_dead) return;
    var token = getActiveKey();
    if (!token) {
      token = prompt('Please paste your Gemini API Key(s) separated by commas:');
      if (token) {
        setStoredKeys(token);
      } else {
        logToParent('Auto Fill cancelled: No API key provided.', 'warn');
        return;
      }
    }

    if (!hasActiveQuestions()) {
      logToParent('No interactive questions found on current slide.', 'info');
      if (!window.__ss_dead) proceedWhenAudioFinished();
      return;
    }

    isBusy = true;
    var btnText = document.getElementById('ss-fill-btn-text');
    if (btnText) btnText.textContent = 'Resolving...';
    var fillBtn = document.getElementById('ss-fill-btn');
    if (fillBtn) fillBtn.style.filter = 'brightness(0.85)';
    logToParent('Analyzing question & formulas...', 'info');

    try {
      var context = extractContext();

      // Check for diagram or math formula image
      var imageB64 = null;
      var diagramImg = document.querySelector('img[src*="contentengine"], img[src*="Assessment"], .content img, #main img, table img, .question img');
      if (diagramImg && diagramImg.src && !diagramImg.src.includes('button') && !diagramImg.src.includes('icon')) {
        logToParent('Scanning formulas with Vision...', 'info');
        imageB64 = await fetchImageBase64(diagramImg.src);
      }

      var result = await requestAnswers(context, imageB64);
      if (window.__ss_dead) return;

      populateAnswers(result.answers);
      if (window === window.top) {
        if (window.__ss_stats) window.__ss_stats.inputsHandled++;
        if (window.__ss_log) window.__ss_log('Answered question: ' + document.title, 'success');
      } else {
        window.top.postMessage({ type: 'SS_FILLED', title: document.title }, '*');
      }
      if (btnText) btnText.textContent = 'Done!';

      var commit = GM_getValue('autoCommit', true);
      if (commit && !window.__ss_dead) {
        setTimeout(function () {
          if (window.__ss_dead) return;
          var doneBtn = document.querySelector('div[fdone], .done, input[value="Check"], button.check-answer, [title="done"]');
          if (doneBtn) doneBtn.click();
          else if (window.API && window.API.Question && typeof window.API.Question.attempt === 'function') {
            try { window.API.Question.attempt(doneBtn); } catch (_) {}
          }

          var qNext = document.querySelector('input[value*="Next"], button.next, .btn-next');
          if (qNext) {
            setTimeout(function() {
              if (!window.__ss_dead) qNext.click();
            }, 1200);
          } else if (!window.__ss_dead) {
            setTimeout(proceedWhenAudioFinished, 1500);
          }
        }, 1000);
      }

    } catch (err) {
      logToParent('API Error: ' + err.message, 'warn');
      if (btnText) btnText.textContent = 'Error';
      console.error('[StudySync] Resolution error:', err);
    } finally {
      if (fillBtn) fillBtn.style.filter = 'none';
      setTimeout(function () {
        if (btnText) btnText.textContent = 'Auto Fill';
        isBusy = false;
      }, 2500);
    }
  }

  function extractContext() {
    var container = document.querySelector('#main, form, .content, #assessment-container, body') || document.body;
    var text = (container.innerText || container.textContent).trim();
    var options = [];

    // 1. Selects & Dropdowns
    document.querySelectorAll('select').forEach(function (sel, i) {
      var opts = Array.from(sel.options).map(function (o) { return o.text.trim(); }).filter(Boolean);
      if (opts.length) options.push('Dropdown #' + (i + 1) + ': [' + opts.join(', ') + ']');
    });

    // 2. Multiple Choice Radio & Checkbox Items
    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(function (inp, i) {
      var label = inp.closest('label')
               || (inp.id ? document.querySelector('label[for="' + inp.id + '"]') : null)
               || inp.parentElement;
      var choiceText = label ? label.innerText.trim() : inp.value;
      if (choiceText) options.push('Choice #' + (i + 1) + ': ' + choiceText);
    });

    // 3. Matching Activity Extraction (Left expressions & Right expressions)
    var matchSources = Array.from(document.querySelectorAll('.source, .left-col div, tr td:first-child'));
    var matchTargets = Array.from(document.querySelectorAll('.target, .right-col div, tr td:last-child'));
    if (matchSources.length && matchTargets.length) {
      options.push('Matching Left Items: ' + matchSources.map(function(s, idx){ return '[' + (idx+1) + '] ' + s.textContent.trim(); }).join('; '));
      options.push('Matching Right Items: ' + matchTargets.map(function(t, idx){ return '[' + (idx+1) + '] ' + t.textContent.trim(); }).join('; '));
    }

    return { text: text, options: options.join('\n'), html: container.innerHTML.substring(0, 4500) };
  }

  function requestAnswers(ctx, imageB64, retryCount) {
    retryCount = retryCount || 0;
    var apiKey = getActiveKey();

    return new Promise(function (resolve, reject) {
      var promptText = "Read the question, choices, math formulas, and any diagram/image provided.\n" +
                       "Determine the exact correct answer for every question element.\n" +
                       "If this is a matching problem, match each item 1..N on the left to its corresponding 1..N slot on the right.\n\n" +
                       "Question Text:\n" + ctx.text + "\n\n" +
                       "Available Choices:\n" + ctx.options + "\n\n" +
                       "Return a JSON object conforming strictly to this format:\n" +
                       "{\"answers\": [{\"index\": 1, \"answer\": \"exact choice text\", \"matchTarget\": 4}]}";

      var parts = [{ text: promptText }];
      if (imageB64) {
        parts.push({
          inline_data: {
            mime_type: "image/png",
            data: imageB64
          }
        });
      }

      var model = (retryCount > 0) ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash';

      GM_xmlhttpRequest({
        method: 'POST',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: {
            response_mime_type: "application/json"
          }
        }),
        onload: function (res) {
          if (res.status === 429) {
            rotateKey();
            if (retryCount < 3) {
              logToParent('Quota hit, rotating key slot and retrying in 2s...', 'warn');
              return setTimeout(function() {
                resolve(requestAnswers(ctx, imageB64, retryCount + 1));
              }, 2000);
            }
          }

          if (res.status !== 200) {
            return reject(new Error('HTTP ' + res.status + ' (' + res.responseText.substring(0, 80) + ')'));
          }
          try {
            var raw = JSON.parse(res.responseText);
            if (raw.error) return reject(new Error(raw.error.message || 'API Error'));
            var cand = raw.candidates && raw.candidates[0];
            if (!cand || !cand.content || !cand.content.parts || !cand.content.parts[0]) {
              return reject(new Error('Empty answer from model'));
            }
            var text = cand.content.parts[0].text.trim();
            var jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              return reject(new Error('Invalid format: ' + text.substring(0, 40)));
            }
            resolve(JSON.parse(jsonMatch[0]));
          } catch (e) {
            reject(new Error(e.message));
          }
        },
        onerror: function () {
          rotateKey();
          reject(new Error('Network fault contacting Google API'));
        }
      });
    });
  }

  // Connector Helper for Matching Lines / Drag & Drop
  function simulateConnection(sourceEl, targetEl) {
    if (!sourceEl || !targetEl) return;

    // 1. Click source handle
    sourceEl.scrollIntoView({ block: 'nearest' });
    sourceEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    sourceEl.click();

    // 2. Click destination target box
    setTimeout(function () {
      targetEl.scrollIntoView({ block: 'nearest' });
      targetEl.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      targetEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      targetEl.click();

      // If jQuery UI droppable exists
      if (window.jQuery && window.jQuery(targetEl).data('droppable')) {
        try {
          window.jQuery(targetEl).trigger('drop', [ { draggable: window.jQuery(sourceEl) } ]);
        } catch (_) {}
      }
    }, 150);
  }

  function populateAnswers(answers) {
    if (!answers || !answers.length || window.__ss_dead) return;

    // 1. Check for Matching / Line Connector Activity (like dividing fractions)
    var arrowButtons = Array.from(document.querySelectorAll('button img[src*="arrow"], button:has(svg), .arrow, button.btn-arrow, a.arrow, [class*="arrow"]'))
      .filter(function(el) { return el.id !== 'ss-dock-btn' && !el.closest('#studysync-container'); });

    var dropBoxes = Array.from(document.querySelectorAll('.target, .drop-box, [class*="drop"], div[class*="square"], div[class*="box"]:empty, .ui-droppable'))
      .filter(function(el) { return !el.closest('#studysync-container'); });

    if (arrowButtons.length >= 2 && dropBoxes.length >= 2) {
      logToParent('Connecting matching pairs...', 'info');
      answers.forEach(function (item, idx) {
        var srcBtn = arrowButtons[idx];
        var targetIndex = (typeof item.matchTarget === 'number') ? (item.matchTarget - 1) : idx;
        var destBox = dropBoxes[targetIndex] || dropBoxes[idx];
        if (srcBtn && destBox) {
          setTimeout(function() {
            simulateConnection(srcBtn, destBox);
          }, idx * 400);
        }
      });
      return;
    }

    // 2. Standard Forms & Radios
    answers.forEach(function (item, idx) {
      var rawTarget = (item.answer || '').trim();
      var target = rawTarget.toLowerCase();

      // Radios & Checkboxes
      var radios = Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
      var matchedRadio = false;

      for (let box of radios) {
        var label = box.closest('label')
                 || (box.id ? document.querySelector('label[for="' + box.id + '"]') : null)
                 || box.parentElement;
        var container = box.closest('.answer-choice, .choice, li, tr, div') || box.parentElement;
        var labelText = (container ? container.innerText : (label ? label.innerText : box.value)).trim().toLowerCase();

        if (labelText === target || labelText.includes(target) || target.includes(labelText)) {
          box.checked = true;
          box.click();
          box.dispatchEvent(new Event('change', { bubbles: true }));
          box.dispatchEvent(new Event('click', { bubbles: true }));
          if (label) label.click();
          if (container && container !== label && container !== box) container.click();
          matchedRadio = true;
          break;
        }
      }

      if (!matchedRadio) {
        document.querySelectorAll('.answer-choice, .choice-row, .mc-option, li.choice').forEach(function(el) {
          var elText = el.innerText.trim().toLowerCase();
          if (elText === target || elText.includes(target) || target.includes(elText)) {
            el.click();
          }
        });
      }

      // Dropdowns
      var selects = Array.from(document.querySelectorAll('select'));
      if (selects[idx]) {
        var sel = selects[idx];
        for (let opt of sel.options) {
          var optText = opt.text.trim().toLowerCase();
          var optVal = opt.value.trim().toLowerCase();
          if (optText === target || optVal === target || optText.includes(target) || target.includes(optText)) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            if (window.jQuery && window.jQuery(sel).data('selectmenu')) {
              try {
                window.jQuery(sel).selectmenu('value', opt.value);
                window.jQuery(sel).selectmenu('refresh', true);
              } catch (_) {}
            }
            break;
          }
        }
      }

      // Free-Form Text Fields
      var inputs = document.querySelectorAll('input[type="text"]:not([readonly]), textarea');
      if (inputs[idx]) {
        inputs[idx].value = item.answer;
        inputs[idx].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[idx].dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function proceedWhenAudioFinished() {
    if (window.__ss_dead) return;
    var audio = document.querySelector('audio');
    if (audio && !audio.paused && !audio.ended) {
      audio.onended = function () { if (!window.__ss_dead) window.top.postMessage('SS_ADVANCE_REQUEST', '*'); };
      setTimeout(function () { if (!window.__ss_dead) window.top.postMessage('SS_ADVANCE_REQUEST', '*'); }, 12000);
    } else {
      window.top.postMessage('SS_ADVANCE_REQUEST', '*');
    }
  }
})();
