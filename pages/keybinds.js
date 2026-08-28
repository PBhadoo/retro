/* Keyboard control binding for the EmulatorJS-powered game players.
 * EmulatorJS matches keydown/keyup events by e.keyCode against a fixed
 * keyCode->name table, and resolves EJS_defaultControls "value" strings
 * against that same table (case-insensitive). KEY_CODE_MAP below is a
 * copy of that table so our remap UI stores/display names EmulatorJS
 * will actually recognize.
 */
(function (global) {
  var KEY_CODE_MAP = {
    8: "backspace", 9: "tab", 13: "enter", 16: "shift", 17: "ctrl", 18: "alt",
    19: "pause/break", 20: "caps lock", 27: "escape", 32: "space",
    33: "page up", 34: "page down", 35: "end", 36: "home",
    37: "left arrow", 38: "up arrow", 39: "right arrow", 40: "down arrow",
    45: "insert", 46: "delete",
    48: "0", 49: "1", 50: "2", 51: "3", 52: "4", 53: "5", 54: "6", 55: "7", 56: "8", 57: "9",
    65: "a", 66: "b", 67: "c", 68: "d", 69: "e", 70: "f", 71: "g", 72: "h", 73: "i", 74: "j",
    75: "k", 76: "l", 77: "m", 78: "n", 79: "o", 80: "p", 81: "q", 82: "r", 83: "s", 84: "t",
    85: "u", 86: "v", 87: "w", 88: "x", 89: "y", 90: "z",
    96: "numpad 0", 97: "numpad 1", 98: "numpad 2", 99: "numpad 3", 100: "numpad 4",
    101: "numpad 5", 102: "numpad 6", 103: "numpad 7", 104: "numpad 8", 105: "numpad 9",
    106: "multiply", 107: "add", 109: "subtract", 110: "decimal point", 111: "divide",
    112: "f1", 113: "f2", 114: "f3", 115: "f4", 116: "f5", 117: "f6",
    118: "f7", 119: "f8", 120: "f9", 121: "f10", 122: "f11", 123: "f12",
    144: "num lock", 145: "scroll lock",
    186: "semi-colon", 187: "equal sign", 188: "comma", 189: "dash", 190: "period",
    191: "forward slash", 192: "grave accent", 219: "open bracket", 220: "back slash",
    221: "close braket", 222: "single quote"
  };

  var DISPLAY_OVERRIDES = {
    "up arrow": "↑ Up", "down arrow": "↓ Down",
    "left arrow": "← Left", "right arrow": "→ Right",
    "enter": "↵ Enter", "shift": "⇧ Shift", "space": "Space",
    "escape": "Esc", "backspace": "⌫ Backspace", "tab": "⇥ Tab", "ctrl": "Ctrl"
  };

  // EmulatorJS button indices (standard across cores; unused buttons are
  // simply never overridden and keep EmulatorJS's own defaults/gamepad map).
  var BUTTONS = [
    { id: "up", index: 4, label: "D-Pad Up", consoles: ["nes", "snes"], defaultKey: "up arrow" },
    { id: "down", index: 5, label: "D-Pad Down", consoles: ["nes", "snes"], defaultKey: "down arrow" },
    { id: "left", index: 6, label: "D-Pad Left", consoles: ["nes", "snes"], defaultKey: "left arrow" },
    { id: "right", index: 7, label: "D-Pad Right", consoles: ["nes", "snes"], defaultKey: "right arrow" },
    { id: "a", index: 8, label: "A Button", consoles: ["nes", "snes"], defaultKey: "z" },
    { id: "b", index: 0, label: "B Button", consoles: ["nes", "snes"], defaultKey: "x" },
    { id: "x", index: 9, label: "X Button", consoles: ["snes"], defaultKey: "a" },
    { id: "y", index: 1, label: "Y Button", consoles: ["snes"], defaultKey: "s" },
    { id: "l", index: 10, label: "L Shoulder", consoles: ["snes"], defaultKey: "q" },
    { id: "r", index: 11, label: "R Shoulder", consoles: ["snes"], defaultKey: "e" },
    { id: "start", index: 3, label: "Start", consoles: ["nes", "snes"], defaultKey: "enter" },
    { id: "select", index: 2, label: "Select", consoles: ["nes", "snes"], defaultKey: "v" }
  ];

  function storageKey(consoleType) { return "retroKeyBinds_" + consoleType; }

  function buttonsFor(consoleType) {
    return BUTTONS.filter(function (b) { return b.consoles.indexOf(consoleType) !== -1; });
  }

  function loadKeyBinds(consoleType) {
    var defaults = {};
    buttonsFor(consoleType).forEach(function (b) { defaults[b.id] = b.defaultKey; });
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey(consoleType)));
      return Object.assign({}, defaults, saved || {});
    } catch (e) {
      return defaults;
    }
  }

  function saveKeyBind(consoleType, id, keyName) {
    var binds = loadKeyBinds(consoleType);
    binds[id] = keyName;
    localStorage.setItem(storageKey(consoleType), JSON.stringify(binds));
  }

  function resetKeyBinds(consoleType) {
    localStorage.removeItem(storageKey(consoleType));
  }

  function keyNameFromEvent(e) {
    return KEY_CODE_MAP[e.keyCode] || null;
  }

  function displayName(keyName) {
    if (!keyName) return "—";
    return DISPLAY_OVERRIDES[keyName] || keyName.toUpperCase();
  }

  // Builds the object to assign to window.EJS_defaultControls before
  // launching a game. Only sets the keyboard "value" for each button we
  // manage; EmulatorJS keeps its own gamepad ("value2") defaults since we
  // never touch that key.
  function buildDefaultControls(consoleType) {
    var binds = loadKeyBinds(consoleType);
    var player0 = {};
    buttonsFor(consoleType).forEach(function (b) {
      if (binds[b.id]) player0[b.index] = { value: binds[b.id] };
    });
    return { 0: player0 };
  }

  // Renders remap rows into `container` (a DOM element) for the given
  // console type. Clicking a row's button starts listening for the next
  // keypress and saves it. Returns a cleanup function to stop listening
  // (call when the settings panel closes).
  function renderKeyBindUI(container, consoleType) {
    container.innerHTML = "";
    var listeningBtn = null, listeningId = null;

    function refreshLabel(btn, id) {
      btn.textContent = displayName(loadKeyBinds(consoleType)[id]);
    }

    function stopListening() {
      if (listeningBtn) {
        listeningBtn.classList.remove("listening");
        refreshLabel(listeningBtn, listeningId);
      }
      listeningBtn = null;
      listeningId = null;
    }

    buttonsFor(consoleType).forEach(function (b) {
      var row = document.createElement("div");
      row.className = "setting-row";
      var label = document.createElement("label");
      label.textContent = b.label;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key-bind-btn";
      btn.textContent = displayName(loadKeyBinds(consoleType)[b.id]);
      btn.addEventListener("click", function () {
        stopListening();
        listeningBtn = btn;
        listeningId = b.id;
        btn.classList.add("listening");
        btn.textContent = "Press a key...";
      });
      row.appendChild(label);
      row.appendChild(btn);
      container.appendChild(row);
    });

    function onKeyDown(e) {
      if (!listeningBtn) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { stopListening(); return; }
      var name = keyNameFromEvent(e);
      if (!name) return;
      saveKeyBind(consoleType, listeningId, name);
      var btn = listeningBtn, id = listeningId;
      listeningBtn = null;
      listeningId = null;
      btn.classList.remove("listening");
      refreshLabel(btn, id);
    }
    document.addEventListener("keydown", onKeyDown, true);

    return function cleanup() {
      stopListening();
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }

  global.RetroKeybinds = {
    buttonsFor: buttonsFor,
    loadKeyBinds: loadKeyBinds,
    saveKeyBind: saveKeyBind,
    resetKeyBinds: resetKeyBinds,
    buildDefaultControls: buildDefaultControls,
    renderKeyBindUI: renderKeyBindUI,
    displayName: displayName
  };
})(window);
