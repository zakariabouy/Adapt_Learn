# game_manager.gd — Autoload Singleton
# SETUP: Project → Project Settings → Autoload → Add this script as "GameManager"
extends Node

# ─── Signals ───
signal missions_updated
signal mission_interact(mission_data: Dictionary)
signal mission_completed(mission_id: String)
signal player_freeze(frozen: bool)

# ─── All therapy games (NO pills — pills are handled in the React dashboard) ───
var ALL_MISSIONS: Dictionary = {
	# ── Dyslexia Pack ──
	"g1": { "id": "g1", "name": "Letter Flip",      "cat": "dyslexia", "icon": "🔤", "desc": "Spot the correct letter among mirror images!", "color": Color(0.455, 0.725, 1.0) },
	"g2": { "id": "g2", "name": "Word Builder",     "cat": "dyslexia", "icon": "🧩", "desc": "Unscramble letters to build the right word!",  "color": Color(0.455, 0.725, 1.0) },
	"g3": { "id": "g3", "name": "Syllable Stomp",   "cat": "dyslexia", "icon": "👣", "desc": "Break words into syllable parts!",             "color": Color(0.455, 0.725, 1.0) },
	"g6": { "id": "g6", "name": "Mirror Letters",   "cat": "dyslexia", "icon": "🪞", "desc": "Spot the reversed letters!",                   "color": Color(0.455, 0.725, 1.0) },
	# ── ADHD Pack ──
	"a1": { "id": "a1", "name": "Focus Sprint",     "cat": "adhd",     "icon": "🎯", "desc": "Find the target shape before time runs out!",  "color": Color(1.0, 0.702, 0.278) },
	"a2": { "id": "a2", "name": "Impulse Pause",    "cat": "adhd",     "icon": "⏸️", "desc": "Wait for the right moment to act!",            "color": Color(1.0, 0.702, 0.278) },
	"a3": { "id": "a3", "name": "Memory Dash",      "cat": "adhd",     "icon": "🧠", "desc": "Repeat the pattern fast!",                     "color": Color(1.0, 0.702, 0.278) },
	"a4": { "id": "a4", "name": "Calm Countdown",   "cat": "adhd",     "icon": "🌬️", "desc": "Slow breathing challenge!",                   "color": Color(1.0, 0.702, 0.278) },
	# ── Autism Pack ──
	"u1": { "id": "u1", "name": "Routine Builder",  "cat": "autism",   "icon": "🗓️", "desc": "Put daily steps in the right order!",          "color": Color(0.635, 0.608, 0.996) },
	"u2": { "id": "u2", "name": "Emotion Match",    "cat": "autism",   "icon": "🙂", "desc": "Match faces to the feelings they show!",       "color": Color(0.635, 0.608, 0.996) },
	"u3": { "id": "u3", "name": "Calm Corner",      "cat": "autism",   "icon": "🫧", "desc": "Breathing and calming practice!",              "color": Color(0.635, 0.608, 0.996) },
	"u4": { "id": "u4", "name": "Social Sequence",  "cat": "autism",   "icon": "🗣️", "desc": "Choose the next social step!",                "color": Color(0.635, 0.608, 0.996) },
	# ── Anxiety Pack ──
	"fr1": { "id": "fr1", "name": "Frogger Cross", "cat": "anxiety", "icon": "🐸", "desc": "Cross the street carefully without getting hit!", "color": Color(0.2, 0.8, 0.2) },
	"mw1": { "id": "mw1", "name": "Vark test",    "cat": "anxiety",  "icon": "", "desc": "Discover your learning style and gain coins!", "color": Color(0.420, 0.796, 0.467) },
	"n1": { "id": "n1", "name": "Breath Bubble",    "cat": "anxiety",  "icon": "💨", "desc": "Breathe in and out with the bubble!",          "color": Color(0.420, 0.796, 0.467) },
	"n2": { "id": "n2", "name": "Worry Drop",       "cat": "anxiety",  "icon": "🍃", "desc": "Let worries float gently away!",               "color": Color(0.420, 0.796, 0.467) },
	"n3": { "id": "n3", "name": "Brave Steps",      "cat": "anxiety",  "icon": "👣", "desc": "Pick the calm next step!",                     "color": Color(0.420, 0.796, 0.467) },
	"n4": { "id": "n4", "name": "Safe Space",       "cat": "anxiety",  "icon": "🏡", "desc": "Build a comfort routine!",                     "color": Color(0.420, 0.796, 0.467) },
}

# ─── Packs: parent picks one of these from the React dashboard ───
var PACKS: Dictionary = {
	"dyslexia": ["g1", "g2", "g3", "g6"],
	"adhd":     ["a1", "a2", "a3", "a4"],
	"autism":   ["u1", "u2", "u3", "u4"],
	"anxiety":  ["fr1", "mw1", "n1", "n2", "n3", "n4"],
}

# ─── State ───
var active_missions: Array[Dictionary] = []
var completed_ids: Array[String] = []
var total_score: int = 0

# ─── Spawn points for arrows (2 slots — on the carpets) ───
var spawn_slots: Array[Vector2] = [
	Vector2(392, 717),   # Carpet 1
	Vector2(54, 112),    # Carpet 2
]

func _ready() -> void:
	# ── Web bridge: read persisted state from the iframe URL ──
	# The Next.js host fetches /adventure/config and embeds the result as query
	# params (?pack=anxiety&completed=mw1,g1) when mounting the iframe. This
	# keeps progress across reloads without Godot itself hitting the API.
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

	# Seed completed list BEFORE picking the pack so arrows already cleared
	# don't respawn after a page reload.
	for id in completed_from_url:
		if id not in completed_ids:
			completed_ids.append(id)

	var pack_to_use := pack_from_url if pack_from_url in PACKS else "anxiety"
	assign_pack(pack_to_use)

	# ── Web bridge: tell the Next.js host the Godot engine is ready ──
	_post_to_host({ "type": "game_loaded" })

# ── Tiny URL query-string parser: "?a=1&b=c%2Cd" → { "a":"1", "b":"c,d" } ──
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

# ── postMessage bridge helper — no-op outside web builds ──
func _post_to_host(payload: Dictionary) -> void:
	if not OS.has_feature("web"):
		return
	if not Engine.has_singleton("JavaScriptBridge"):
		return
	var json_payload = JSON.stringify(payload)
	# JSON.stringify always produces JS-safe output, so we can drop it straight in.
	JavaScriptBridge.eval("window.parent.postMessage(%s, '*');" % json_payload)

# ─── Called when parent picks a pack ───
func assign_pack(pack_id: String) -> void:
	var ids = PACKS.get(pack_id, [])
	# Only first 2 games — matching our 2 carpet slots
	set_active_missions(ids.slice(0, 2))

# ─── Set which game IDs are active (up to number of spawn slots) ───
func set_active_missions(ids: Array) -> void:
	active_missions.clear()
	for id in ids:
		if id in ALL_MISSIONS and id not in completed_ids:
			active_missions.append(ALL_MISSIONS[id])
	missions_updated.emit()

# ─── Player walks up and presses E ───
func request_interact(mission_data: Dictionary) -> void:
	player_freeze.emit(true)
	mission_interact.emit(mission_data)

# ─── Kid finishes a game → remove only that one arrow ───
func complete(mission_id: String) -> void:
	var first_time = mission_id not in completed_ids
	if first_time:
		completed_ids.append(mission_id)
		total_score += 10
	active_missions = active_missions.filter(func(m): return m["id"] != mission_id)
	mission_completed.emit(mission_id)
	player_freeze.emit(false)

	# ── Web bridge: notify the Next.js host so it can award XP via /gamification/add-xp ──
	# Only the first completion posts — repeat plays don't double-award XP.
	if first_time:
		_post_to_host({
			"type": "mission_complete",
			"mission_id": mission_id,
			"score": total_score,
		})

func cancel_interact() -> void:
	player_freeze.emit(false)

func is_done(mission_id: String) -> bool:
	return mission_id in completed_ids
