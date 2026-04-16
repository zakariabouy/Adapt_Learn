# goblin_speech.gd — RPG-style speech bubble system for the goblin hero
# Creates a polished pixel-art speech bubble above the goblin with contextual dialogue.
extends Node2D

# ─── Dialogue Lines ───
var DIALOGUE: Dictionary = {
	"greeting": [
		"Hey champion! Ready to explore?",
		"Let's go on an adventure!",
		"I missed you! Let's do this!",
		"Welcome back, hero!",
	],
	"near_mission": [
		"Ooh! A mission! Press E!",
		"That carpet is glowing...",
		"A challenge awaits!",
		"My senses are tingling!",
	],
	"game_start": [
		"You've got this!",
		"Focus up, champion!",
		"Let's crush this!",
		"Time to prove ourselves!",
	],
	"game_won": [
		"INCREDIBLE! Amazing!",
		"WOW! Great team!",
		"That was EPIC!",
		"Champion status!",
		"We're unstoppable!",
	],
	"idle": [
		"*stretches* So cool!",
		"Let's find a mission!",
		"What's over there...?",
		"*yawns* Let's go!",
		"Carpets are waiting!",
	],
	"walking": [
		"Let's go!",
		"Adventure awaits!",
		"Love exploring!",
	],
	"all_done": [
		"ALL missions done! Legends!",
		"Every mission cleared!",
		"Champion level unlocked!",
	],
}

# ─── UI Nodes ───
var bubble_node: Node2D
var bg_polygon: Polygon2D
var outline_polygon: Polygon2D
var tail_polygon: Polygon2D
var tail_outline: Polygon2D
var inner_glow: Polygon2D
var text_label: Label
var name_label: Label

var bubble_visible: bool = false
var bubble_timer: float = 0.0
var bubble_duration: float = 3.0

# ─── Timing ───
var idle_timer: float = 0.0
var idle_threshold: float = 14.0
var walk_timer: float = 0.0
var walk_speak_interval: float = 28.0
var last_category: String = ""
var last_line_index: int = -1
var greeting_done: bool = false
var near_mission_cooldown: float = 0.0

# ─── Bubble dimensions ───
const BUBBLE_W: float = 140.0
const BUBBLE_H: float = 38.0
const CORNER_R: float = 6.0
const OUTLINE_W: float = 1.5

func _ready() -> void:
	# ── Container ──
	bubble_node = Node2D.new()
	bubble_node.position = Vector2(-BUBBLE_W * 0.5, -75)
	bubble_node.z_index = 100
	bubble_node.visible = false
	add_child(bubble_node)

	# ── Outline (dark border) ──
	outline_polygon = Polygon2D.new()
	outline_polygon.polygon = _make_rounded_rect(-OUTLINE_W, -OUTLINE_W, BUBBLE_W + OUTLINE_W * 2, BUBBLE_H + OUTLINE_W * 2, CORNER_R + 1)
	outline_polygon.color = Color(0.12, 0.08, 0.20, 0.95)
	bubble_node.add_child(outline_polygon)

	# ── Background ──
	bg_polygon = Polygon2D.new()
	bg_polygon.polygon = _make_rounded_rect(0, 0, BUBBLE_W, BUBBLE_H, CORNER_R)
	bg_polygon.color = Color(0.15, 0.12, 0.25, 0.92)
	bubble_node.add_child(bg_polygon)

	# ── Inner highlight (top edge glow) ──
	inner_glow = Polygon2D.new()
	inner_glow.polygon = _make_rounded_rect(2, 2, BUBBLE_W - 4, 8, 3)
	inner_glow.color = Color(0.35, 0.55, 0.85, 0.25)
	bubble_node.add_child(inner_glow)

	# ── Tail outline ──
	tail_outline = Polygon2D.new()
	tail_outline.polygon = PackedVector2Array([
		Vector2(BUBBLE_W * 0.42, BUBBLE_H - 1),
		Vector2(BUBBLE_W * 0.58, BUBBLE_H - 1),
		Vector2(BUBBLE_W * 0.50, BUBBLE_H + 10),
	])
	tail_outline.color = Color(0.12, 0.08, 0.20, 0.95)
	bubble_node.add_child(tail_outline)

	# ── Tail fill ──
	tail_polygon = Polygon2D.new()
	tail_polygon.polygon = PackedVector2Array([
		Vector2(BUBBLE_W * 0.44, BUBBLE_H - 1),
		Vector2(BUBBLE_W * 0.56, BUBBLE_H - 1),
		Vector2(BUBBLE_W * 0.50, BUBBLE_H + 7),
	])
	tail_polygon.color = Color(0.15, 0.12, 0.25, 0.92)
	bubble_node.add_child(tail_polygon)

	# ── Name tag ──
	name_label = Label.new()
	name_label.text = "Hero"
	name_label.position = Vector2(4, 1)
	name_label.size = Vector2(40, 12)
	name_label.add_theme_font_size_override("font_size", 7)
	name_label.add_theme_color_override("font_color", Color(0.45, 0.85, 0.95))
	name_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	name_label.add_theme_constant_override("shadow_offset_x", 1)
	name_label.add_theme_constant_override("shadow_offset_y", 1)
	bubble_node.add_child(name_label)

	# ── Text ──
	text_label = Label.new()
	text_label.position = Vector2(6, 12)
	text_label.size = Vector2(BUBBLE_W - 12, BUBBLE_H - 16)
	text_label.add_theme_font_size_override("font_size", 8)
	text_label.add_theme_color_override("font_color", Color(0.92, 0.92, 0.97))
	text_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	text_label.add_theme_constant_override("shadow_offset_x", 1)
	text_label.add_theme_constant_override("shadow_offset_y", 1)
	text_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	text_label.text = ""
	bubble_node.add_child(text_label)

	# ── Decorative dots (pixel-art feel) ──
	for i in range(3):
		var dot = Polygon2D.new()
		var dx = BUBBLE_W - 14 + i * 4.0
		dot.polygon = PackedVector2Array([
			Vector2(dx, 5), Vector2(dx + 2, 5), Vector2(dx + 2, 7), Vector2(dx, 7)
		])
		dot.color = Color(0.5, 0.75, 0.95, 0.4 - i * 0.1)
		bubble_node.add_child(dot)

	# ── Connect to game events ──
	if has_node("/root/GameManager"):
		GameManager.mission_interact.connect(_on_near_mission)
		GameManager.mission_completed.connect(_on_mission_done)

	call_deferred("_do_greeting")

func _make_rounded_rect(x: float, y: float, w: float, h: float, r: float) -> PackedVector2Array:
	var pts: PackedVector2Array = PackedVector2Array()
	var segments: int = 4
	# Top-left corner
	for i in range(segments + 1):
		var angle = PI + (PI / 2.0) * (float(i) / segments)
		pts.append(Vector2(x + r + cos(angle) * r, y + r + sin(angle) * r))
	# Top-right corner
	for i in range(segments + 1):
		var angle = -PI / 2.0 + (PI / 2.0) * (float(i) / segments)
		pts.append(Vector2(x + w - r + cos(angle) * r, y + r + sin(angle) * r))
	# Bottom-right corner
	for i in range(segments + 1):
		var angle = 0.0 + (PI / 2.0) * (float(i) / segments)
		pts.append(Vector2(x + w - r + cos(angle) * r, y + h - r + sin(angle) * r))
	# Bottom-left corner
	for i in range(segments + 1):
		var angle = PI / 2.0 + (PI / 2.0) * (float(i) / segments)
		pts.append(Vector2(x + r + cos(angle) * r, y + h - r + sin(angle) * r))
	return pts

func _do_greeting() -> void:
	await get_tree().create_timer(2.0).timeout
	if not greeting_done:
		greeting_done = true
		say("greeting")

func _process(delta: float) -> void:
	if bubble_visible:
		bubble_timer -= delta
		if bubble_timer <= 0:
			_hide_bubble()

	if near_mission_cooldown > 0:
		near_mission_cooldown -= delta

	var parent = get_parent()
	if parent and parent is CharacterBody2D:
		var vel = parent.velocity if "velocity" in parent else Vector2.ZERO
		if vel.length() < 5.0:
			idle_timer += delta
			walk_timer = 0.0
			if idle_timer >= idle_threshold and not bubble_visible:
				idle_timer = 0.0
				idle_threshold = randf_range(12.0, 22.0)
				say("idle")
		else:
			idle_timer = 0.0
			walk_timer += delta
			if walk_timer >= walk_speak_interval and not bubble_visible:
				walk_timer = 0.0
				walk_speak_interval = randf_range(22.0, 38.0)
				say("walking")

func say(category: String, custom_line: String = "") -> void:
	var line: String
	if custom_line != "":
		line = custom_line
	else:
		line = _pick_random(category)
	if line == "":
		return

	text_label.text = line
	bubble_timer = bubble_duration
	bubble_node.visible = true
	bubble_visible = true

	# Pop-in animation
	bubble_node.scale = Vector2(0.2, 0.2)
	bubble_node.modulate.a = 0.0
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(bubble_node, "scale", Vector2(1.0, 1.0), 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(bubble_node, "modulate:a", 1.0, 0.15)

func _hide_bubble() -> void:
	bubble_visible = false
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(bubble_node, "scale", Vector2(0.8, 0.8), 0.2)
	tween.tween_property(bubble_node, "modulate:a", 0.0, 0.2)
	tween.chain().tween_callback(func(): bubble_node.visible = false)

func _pick_random(category: String) -> String:
	var lines = DIALOGUE.get(category, [])
	if lines.is_empty():
		return ""
	var idx = randi() % lines.size()
	if category == last_category and idx == last_line_index and lines.size() > 1:
		idx = (idx + 1) % lines.size()
	last_category = category
	last_line_index = idx
	return lines[idx]

func _on_near_mission(_data: Dictionary) -> void:
	if near_mission_cooldown <= 0:
		say("game_start")
		near_mission_cooldown = 15.0

func _on_mission_done(_mission_id: String) -> void:
	say("game_won")
	if GameManager.active_missions.is_empty():
		await get_tree().create_timer(3.0).timeout
		say("all_done")
