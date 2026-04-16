# Adventure World — Godot Web Build

This folder hosts the exported HTML5 build of the `isometric-game-demo` Godot project. The Next.js page at `/student/adventure` loads `index.html` from here in an iframe.

## How to export from Godot 4

1. Open `isometric-game-demo/project.godot` in Godot 4.x.
2. Install the **Web Export Templates** if prompted (Editor → Manage Export Templates).
3. Go to **Project → Export…**
4. Click **Add…** and choose the **Web** preset.
5. In the Export settings:
   - **Export Path:** `../frontend/public/adventure/index.html` (adjust to the absolute path of this folder).
   - **Head Include** (optional): add Cross-Origin isolation headers if SharedArrayBuffer is required. For our simple demo, defaults are fine.
   - Leave `Export With Debug` unchecked for the final build.
6. Click **Export Project** (not "Export PCK/Zip").
7. Confirm the following files land in this folder:
   - `index.html`
   - `index.js`
   - `index.wasm`
   - `index.pck`
   - `index.audio.worklet.js`
   - `index.icon.png` / `index.apple-touch-icon.png`

Reload `/student/adventure` in the browser — the loading spinner clears when the engine boots.

## Bridge contract

The Next.js host listens for `window.postMessage` events with these shapes:

```js
// Lifecycle
window.parent.postMessage({ type: 'game_loaded' }, '*');   // clears the loading spinner

// Navigation
window.parent.postMessage({ type: 'open_vark' }, '*');     // → /student/vark
window.parent.postMessage({ type: 'open_workspace' }, '*');// → /student/workspace
window.parent.postMessage({ type: 'open_games' }, '*');    // → /student/games

// Gamification — host POSTs /gamification/add-xp with the student's JWT,
// updates the live HUD, and shows a toast.
window.parent.postMessage(
  { type: 'mission_complete', mission_id: 'g1', score: 120 },
  '*'
);
```

From GDScript in a web export, use the `GameManager._post_to_host()` helper:

```gdscript
GameManager._post_to_host({
    "type": "mission_complete",
    "mission_id": mission_id,
    "score": total_score,
})
```

**Wiring already in place:**
- `game_manager.gd::_ready()` → emits `game_loaded`
- `game_manager.gd::complete()` → emits `mission_complete` (first-time only, no double XP)
- `mission_ui.gd` → `mw1` arrow emits `open_vark` instead of launching an in-engine mini-game

## Server-authoritative state (Phase 3)

The Next.js host fetches `GET /adventure/config` on mount and embeds the
result in the iframe URL as query params:

```
/adventure/index.html?pack=anxiety&completed=mw1,g1
```

`game_manager.gd::_ready()` must read these on boot so the arrows the student
already cleared don't respawn. Add this to `_ready()` **before** the
`assign_pack(...)` call:

```gdscript
var pack_from_url := ""
var completed_from_url: Array[String] = []
if OS.has_feature("web") and Engine.has_singleton("JavaScriptBridge"):
    var qs: String = JavaScriptBridge.eval("window.location.search || ''", true)
    var parsed := _parse_query_string(qs)
    pack_from_url = parsed.get("pack", "")
    var raw_completed: String = parsed.get("completed", "")
    if raw_completed != "":
        for id in raw_completed.split(","):
            var trimmed := id.strip_edges()
            if trimmed != "":
                completed_from_url.append(trimmed)

# Seed the in-engine completed list BEFORE picking the pack so arrows
# the student already cleared don't spawn again.
for id in completed_from_url:
    if id not in completed_ids:
        completed_ids.append(id)

var pack_to_use := pack_from_url if pack_from_url in PACKS else "anxiety"
assign_pack(pack_to_use)

# Emit the ready ping as before.
_post_to_host({ "type": "game_loaded" })
```

And the tiny query-string helper:

```gdscript
func _parse_query_string(qs: String) -> Dictionary:
    var out: Dictionary = {}
    if qs.is_empty():
        return out
    if qs.begins_with("?"):
        qs = qs.substr(1)
    for pair in qs.split("&"):
        if pair.is_empty():
            continue
        var eq := pair.find("=")
        if eq == -1:
            out[pair.uri_decode()] = ""
        else:
            var k := pair.substr(0, eq).uri_decode()
            var v := pair.substr(eq + 1).uri_decode()
            out[k] = v
    return out
```

XP awards now go through `POST /adventure/complete` (server-authoritative,
idempotent per mission — replays can't double-award XP). The client-side
`MISSION_XP` map in `adventure/page.tsx` is gone; the backend router owns it.

## Cross-origin note

If the Godot build complains about `SharedArrayBuffer` in the browser console, Next.js needs to serve COOP/COEP headers. Add this to `next.config.mjs`:

```js
async headers() {
  return [{
    source: '/adventure/:path*',
    headers: [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
    ],
  }];
},
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Adventure build not found" card | `index.html` isn't present — re-export from Godot. |
| Spinner never clears | Check browser console; likely missing `.wasm` or wrong MIME type. |
| Arrow spot does nothing | Confirm the Web export ran AFTER the `mission_ui.gd` change; rebuild. |
