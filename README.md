# CYOA Multi-Choice Combiner

A SillyTavern extension that lets you **select multiple CYOA choices** and send them together as a single combined message to the LLM.

## The Problem

When the AI presents action choices (using `<button class="menu-msg-button">` elements), clicking one immediately sends it to the LLM. There's no way to pick multiple options at once — like choosing to both "investigate the noise" AND "draw your sword."

## The Solution

This extension intercepts choice button clicks and converts them into a multi-select interface:

1. **Click** a choice button → it gets **selected** (highlighted in purple) instead of sent
2. **Click more** choices to add them to your selection
3. A floating **action bar** appears at the bottom showing your selections
4. Click **"Send Combined"** to send all chosen options as one message
5. The LLM receives them together and responds to all your choices at once

## Installation

### Method 1: Git Clone (Recommended)
```bash
cd SillyTavern/public/scripts/extensions/third-party/
git clone https://github.com/TEC-REBEL/cyoa-combiner.git
```

### Method 2: Manual
1. Download this repository as a ZIP
2. Extract to `SillyTavern/public/scripts/extensions/third-party/cyoa-combiner/`
3. Restart SillyTavern

## Configuration

Open **Extensions** panel → **CYOA Multi-Choice Combiner**:

| Setting | Description | Default |
|---------|-------------|---------|
| Enable multi-choice | Master toggle for the extension | ✅ On |
| Include numbering | Adds "1.", "2." before choices in sent message | ✅ On |
| Send Format | Template for the combined message. `{choices}` is replaced with selected choices | `I choose:\n{choices}` |

## How It Works

- Uses a **capture-phase** click listener to intercept `.menu-msg-button` clicks before the default send behavior
- Selections are tracked per-message with visual feedback (purple glow + numbered badges)
- The floating action bar shows a real-time preview of your selections
- Combined choices are sent through SillyTavern's normal message pipeline

## Compatibility

- Works with any character card / prompt that outputs `<button class="menu-msg-button">` elements
- Compatible with SillyTavern's built-in features (swipes, branching, etc.)
- Selections auto-clear on chat switch, swipe, or new generation

## License

MIT
