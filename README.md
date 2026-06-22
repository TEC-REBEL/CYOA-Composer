<div align="center">

<img src="assets/banner.png" alt="CYOA Composer" width="100%" />

<br/>

### 🎭 Select multiple CYOA choices, add custom text, edit & reorder — then send it all as one combined message.

<br/>

[![SillyTavern](https://img.shields.io/badge/SillyTavern-Extension-8B5CF6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PHBhdGggZD0iTTEyIDJMMiAyMmgyMEwxMiAyeiIvPjwvc3ZnPg==&labelColor=1a1025)](https://github.com/SillyTavern/SillyTavern)
[![Version](https://img.shields.io/badge/version-1.2.0-6366F1?style=for-the-badge&labelColor=1a1025)](https://github.com/TEC-REBEL/cyoa-composer/releases)
[![License](https://img.shields.io/badge/license-MIT-34D399?style=for-the-badge&labelColor=1a1025)](LICENSE)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=for-the-badge&logo=javascript&labelColor=1a1025)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

</div>

---

## 🤔 The Problem

When the AI presents CYOA action choices — whether as clickable buttons or plain-text lists — there's no way to:

- Pick **multiple options** at once (*"I want to investigate AND draw my sword"*)
- **Add your own custom actions** alongside AI choices
- **Edit** a choice text before sending
- **Control the order** of your actions

## ✨ The Solution

This extension transforms choices into a **multi-select composition system** with a sleek floating panel.

---

## 🎯 Features

<table>
<tr>
<td width="50%">

### 🖱️ Multi-Select Choices
Click multiple AI-generated choice buttons or list items. Each gets highlighted and numbered in selection order.

### ✍️ Add Custom Text
Type your own actions, dialogue, or context between choices. Mix freely: *choice → custom text → choice*.

### ✏️ Expand & Edit
Click the ▼ chevron on any queued item to expand it — see the full text and edit inline with a textarea.

</td>
<td width="50%">

### 🔍 Flexible Detection
Detect choices from **buttons**, **numbered lists**, **bulleted lists**, or any **custom CSS selector** you define.

### 📐 Panel Positions
Choose where the composition panel appears:
- **Right Side** — floating panel, doesn't block the chat
- **Left Side** — floating panel on the left
- **Bottom** — classic full-width bottom bar

### 🎨 6 Color Themes
Pick from **Purple Haze**, **Cyber Cyan**, **Sakura Rose**, **Solar Amber**, **Emerald Night**, or **Ghost Minimal**.

</td>
</tr>
</table>

### Additional Features

- ↕️ **Reorder** — Move items up/down to build the exact sequence you want
- 🗑️ **Remove individual items** — Click ✕ to remove any item
- 📐 **Collapsible panel** — Minimize to just the header bar
- ⚡ **Zero config** — Works out of the box with sensible defaults
- 🔧 **Custom format template** — Control how the combined message is structured

---

## 📦 Installation

### Method 1: SillyTavern Extension Installer
1. Open SillyTavern → **Extensions** → **Install Extension**
2. Paste the URL:
   ```
   https://github.com/TEC-REBEL/cyoa-composer
   ```
3. Click **Install** and reload

### Method 2: Git Clone
```bash
cd SillyTavern/public/scripts/extensions/third-party/
git clone https://github.com/TEC-REBEL/cyoa-composer.git
```

### Method 3: Manual Download
1. Download as ZIP → extract to `.../third-party/cyoa-composer/`
2. Reload SillyTavern

---

## 🎮 Usage

<details>
<summary><strong>Click to see example flow</strong></summary>

<br/>

The AI presents these choices (as buttons or plain text):

> 1. 🗡️ *Invite her in warmly*
> 2. 🛡️ *Answer the door wearing only a towel*
> 3. 🏃 *Let her start cleaning*
> 4. 📱 *Check your phone for Devil Skills*

**With CYOA Composer:**

1. Click **choice 1** → glows, appears in the side panel
2. Type *"Whisper to Lilith to play along"* → click **+**
3. Click **choice 4** → added to panel
4. Click ▼ on any item to **expand & edit** the text
5. Use ↑↓ arrows to **reorder**
6. Click **Send Combined**

The LLM receives:
```
I choose:
1. Invite her in warmly
2. Whisper to Lilith to play along
3. Check your phone for Devil Skills
```

</details>

---

## ⚙️ Configuration

Open **Extensions** panel → **🎭 CYOA Composer**:

### Choice Detection

| Mode | Detects | When to Use |
|:-----|:--------|:------------|
| **Buttons** | `<button class="menu-msg-button">` | Standard CYOA button format |
| **Numbered Lists** | `<ol> > <li>` | AI outputs numbered choice lists |
| **Bulleted Lists** | `<ul> > <li>` | AI outputs bulleted choice lists |
| **All List Items** | Any `<li>` | Catches all list-based choices |
| **Custom** | Your CSS selector | For unique AI output formats |

> **Tip:** For the "Custom" mode, DOMPurify in SillyTavern prefixes all AI-generated classes with `custom-`. So if the AI outputs `class="my-choice"`, target it with `.custom-my-choice`.

### Panel Position

| Position | Description |
|:---------|:------------|
| **Right Side** *(default)* | Floating rounded panel on the right — doesn't cover the chat input |
| **Left Side** | Same but on the left |
| **Bottom** | Full-width bar at the bottom of the screen |

### Themes

| Theme | Colors |
|:------|:-------|
| 💜 **Purple Haze** | Purple / Indigo *(default)* |
| 🩵 **Cyber Cyan** | Teal / Cyan |
| 🩷 **Sakura Rose** | Pink / Rose |
| 🧡 **Solar Amber** | Orange / Amber |
| 💚 **Emerald Night** | Green / Emerald |
| 🩶 **Ghost** | Slate / Monochrome |

### Other Settings

| Setting | Description | Default |
|:--------|:------------|:--------|
| **Enable** | Master toggle | ✅ On |
| **Include numbering** | Adds `1.`, `2.` before choices | ✅ On |
| **Send Format** | Template using `{choices}` placeholder | `I choose:\n{choices}` |

---

## 🔧 Technical Details

<details>
<summary><strong>How it works under the hood</strong></summary>

<br/>

- **Capture-phase interception**: `addEventListener('click', handler, true)` intercepts before any other handler
- **DOMPurify aware**: Targets `custom-menu-msg-button` (DOMPurify prefixes classes with `custom-`)
- **Leaf-node filtering**: For list items, automatically skips `<li>` elements that contain nested sub-lists
- **HSL theme system**: All 6 themes use a single `--cyoa-h/s/l` triplet; every color derives from it
- **Queue-based state**: Ordered array of `{type, text, mesId, btnIndex}` items with unique IDs

</details>

---

## 🤝 Compatibility

- ✅ Button-based CYOA (`<button class="menu-msg-button">`)
- ✅ Plain-text numbered/bulleted choice lists
- ✅ Custom AI output formats via CSS selector
- ✅ All LLM backends (OpenAI, Claude, local models, etc.)
- ✅ SillyTavern swipes, branching, and bookmarks
- ✅ Auto-clears on chat switch, swipe, or new generation

---

## 📄 License

[MIT](LICENSE) — Use it, modify it, share it. Have fun! 🎉

---

<div align="center">

**Made with 💜 for the SillyTavern community**

</div>
