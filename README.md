# StudySync Assist

A Tampermonkey userscript built to streamline navigation, automate form filling and quiz solving via Gemini AI Vision, and customize dashboard metrics on Edgenuity.

## Features

- **Material You Controller:** A draggable shadow DOM UI featuring an overview dashboard, configuration settings, and a live activity log.
- **Gemini AI Form & Quiz Solver:** Inspects questions, multiple-choice items, math formulas, and diagrams using Gemini 2.5 Flash, automatically populating answers and submitting.
- **Multi-Key Quota Rotation:** Supports comma-separated API keys to automatically bypass rate limits (`15 RPM`) by rotating slots.
- **Dashboard Customization & Spoofer:** Overwrites course progress and grades (Ahead or On Target statuses) and hides overdue alert banners.
- **Smart Progression & Automation:** Auto-advances completed slides, handles vocabulary matching tasks, clears intro overlays, and maintains a connection keep-alive heartbeat.
- **Global Panic Switch:** Instantly self-destructs and restores the native environment across all parent and child frames.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Shift + /` | Toggle UI container visibility. |
| `Shift + \` | Panic kill script instantly across all frames. |

---

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser (Chrome, Firefox, Edge, Safari).
2. Create a new userscript in Tampermonkey.
3. Paste the contents of `StudySync.js` into the script editor and save.
4. Navigate to your Edgenuity course portal (`*.core.learn.edgenuity.com` or `student.edgenuity.com`).
5. Press `Shift + /` to open the configuration panel and input your Gemini API key(s).

---

## Repository
Source code and updates are hosted on GitHub: [studlo666/edgenuity](https://github.com/studlo666/edgenuity).