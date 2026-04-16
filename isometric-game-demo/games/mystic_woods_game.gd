# mystic_woods_game.gd — Stress-Adaptive Forest Adventure
#
# The player walks through a mystic forest, collects calm spirits, avoids slimes.
# EMG sensor drives difficulty: stressed → more slimes, faster movement.
# Breathing prompt appears when stress is too high → calming down = bonus points.
# 3 Hearts | 3 Levels | Real sprite animations | Stress-adaptive
extends CanvasLayer

signal game_finished(score: int)

# ─── PATHS ───
const PLAYER_PNG = "res://mystic_woods_assets/characters/player.png"
const SLIME_PNG  = "res://mystic_woods_assets/characters/slime.png"
const DUST_PNG   = "res://mystic_woods_assets/particles/dust_particles_01.png"
const GRASS_PNG  = "res://mystic_woods_assets/tilesets/grass.png"
const PLAINS_PNG = "res://mystic_woods_assets/tilesets/plains.png"
const OBJECTS_PNG = "res://mystic_woods_assets/objects/objects.png"

# ─── SPRITE SOURCE SIZES ───
const PLAYER_FRAME_W: int = 48
const PLAYER_FRAME_H: int = 48
const SLIME_FRAME_W: int = 32
const SLIME_FRAME_H: int = 32

# ─── DISPLAY SIZES (scaled up for visibility) ───
const PLAYER_SCALE: float = 3.0
const SLIME_SCALE: float = 2.5
const PLAYER_DISP_W: int = 144  # 48 * 3
const PLAYER_DISP_H: int = 144
const SLIME_DISP_W: int = 80   # 32 * 2.5
const SLIME_DISP_H: int = 80

const PLAYER_SPEED: float = 320.0

# Level configs
const LEVELS: Array = [
	{ "name": "Level 1 — Peaceful Path", "spirits": 5, "slimes": 2, "slime_speed": 55.0, "time": 40, "color": Color(0.3, 0.85, 0.5) },
	{ "name": "Level 2 — Deeper Woods",  "spirits": 7, "slimes": 4, "slime_speed": 80.0, "time": 45, "color": Color(0.9, 0.75, 0.2) },
	{ "name": "Level 3 — Dark Forest",    "spirits": 9, "slimes": 6, "slime_speed": 110.0, "time": 50, "color": Color(0.85, 0.3, 0.35) },
]

# ─── STATE ───
var hearts: int = 3
var score: int = 0
var current_level: int = 0
var collected: int = 0
var time_left: float = 40.0
var game_active: bool = false
var game_over: bool = false
var invincible_timer: float = 0.0

# Stress
var current_stress: float = 0.0
var stress_mult: float = 1.0
var breathing_active: bool = false

# Player
var player_pos: Vector2 = Vector2(400, 300)
var player_frame: int = 0
var player_anim_timer: float = 0.0
var player_facing_right: bool = true
var player_moving: bool = false

# Entities
var spirits: Array[Dictionary] = []
var slimes: Array[Dictionary] = []

# Viewport
var vp_size: Vector2 = Vector2(1152, 648)
var play_top: float = 120.0  # top of playable area (below HUD)

# ─── UI REFS ───
var game_layer: Control
var player_node: Control
var spirit_container: Control
var slime_container: Control
var hearts_label: Label
var score_label: Label
var timer_label: Label
var level_label: Label
var stress_bar_bg: ColorRect
var stress_bar_fill: ColorRect
var stress_label: Label
var message_label: Label
var breathing_panel: VBoxContainer
var breathing_text: Label
var game_over_panel: VBoxContainer
var stress_overlay: ColorRect

func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS
	vp_size = get_viewport().get_visible_rect().size
	if vp_size.x < 100:
		vp_size = Vector2(1152, 648)
	_build_ui()
	_connect_stress()
	_start_level()

func _build_ui() -> void:
	# ── Dark forest base ──
	var bg = ColorRect.new()
	bg.color = Color(0.04, 0.08, 0.04)
	bg.anchor_right = 1.0
	bg.anchor_bottom = 1.0
	add_child(bg)

	# ── Grass tileset as ground ──
	if ResourceLoader.exists(GRASS_PNG):
		var grass_tex = load(GRASS_PNG)
		var grass = TextureRect.new()
		grass.texture = grass_tex
		grass.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		grass.stretch_mode = TextureRect.STRETCH_TILE
		grass.anchor_right = 1.0
		grass.anchor_bottom = 1.0
		grass.offset_top = play_top - 20
		grass.modulate = Color(0.55, 0.75, 0.45, 0.35)
		add_child(grass)

	# ── Plains overlay for depth ──
	if ResourceLoader.exists(PLAINS_PNG):
		var plains_tex = load(PLAINS_PNG)
		var plains = TextureRect.new()
		plains.texture = plains_tex
		plains.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		plains.stretch_mode = TextureRect.STRETCH_TILE
		plains.anchor_right = 1.0
		plains.offset_top = play_top - 10
		plains.offset_bottom = vp_size.y * 0.35
		plains.modulate = Color(0.4, 0.6, 0.35, 0.2)
		add_child(plains)

	# ── Tree decorations using objects spritesheet ──
	if ResourceLoader.exists(OBJECTS_PNG):
		var obj_tex = load(OBJECTS_PNG)
		var tree_count = 6
		for i in range(tree_count):
			var tree_clip = Control.new()
			tree_clip.clip_contents = true
			tree_clip.size = Vector2(64, 80)
			tree_clip.position = Vector2(
				i * (vp_size.x / tree_count) + randf() * 60 - 30,
				play_top - 70 + randf() * 20
			)
			add_child(tree_clip)
			var tree_tex = TextureRect.new()
			tree_tex.texture = obj_tex
			tree_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			tree_tex.stretch_mode = TextureRect.STRETCH_SCALE
			tree_tex.size = Vector2(obj_tex.get_width() * 2.5, obj_tex.get_height() * 2.5)
			# Offset to show a tree section from the spritesheet
			tree_tex.position = Vector2(-randi() % 3 * 64, 0)
			tree_tex.modulate = Color(0.6, 0.85, 0.55, 0.7 + randf() * 0.3)
			tree_clip.add_child(tree_tex)
	else:
		# Fallback: code-drawn tree silhouettes
		for i in range(8):
			var tree = ColorRect.new()
			tree.color = Color(0.06, 0.16, 0.06, 0.8)
			tree.size = Vector2(30 + randi() % 40, 80 + randi() % 120)
			tree.position = Vector2(i * (vp_size.x / 8.0) + randi() % 50, play_top - tree.size.y + randi() % 20)
			add_child(tree)
			var top = ColorRect.new()
			top.color = Color(0.1, 0.25, 0.08, 0.9)
			top.size = Vector2(tree.size.x + 30, 40)
			top.position = Vector2(-15, -35)
			tree.add_child(top)

	# ── Extra grass tufts ──
	for i in range(20):
		var grass_tuft = ColorRect.new()
		grass_tuft.color = Color(0.18 + randf() * 0.1, 0.35 + randf() * 0.2, 0.12, 0.5)
		grass_tuft.size = Vector2(50 + randi() % 80, 8 + randi() % 10)
		grass_tuft.position = Vector2(randi() % int(vp_size.x), play_top + randi() % int(vp_size.y - play_top - 40))
		add_child(grass_tuft)

	# ── Stress red overlay ──
	stress_overlay = ColorRect.new()
	stress_overlay.color = Color(0.7, 0.1, 0.1, 0.0)
	stress_overlay.anchor_right = 1.0
	stress_overlay.anchor_bottom = 1.0
	stress_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(stress_overlay)

	# ── Game layer (for entities) ──
	game_layer = Control.new()
	game_layer.anchor_right = 1.0
	game_layer.anchor_bottom = 1.0
	add_child(game_layer)

	spirit_container = Control.new()
	game_layer.add_child(spirit_container)

	slime_container = Control.new()
	game_layer.add_child(slime_container)

	# ── Player ──
	player_node = Control.new()
	player_node.size = Vector2(PLAYER_DISP_W, PLAYER_DISP_H)
	game_layer.add_child(player_node)

	var player_clip = Control.new()
	player_clip.clip_contents = true
	player_clip.size = Vector2(PLAYER_DISP_W, PLAYER_DISP_H)
	player_clip.position = Vector2.ZERO
	player_node.add_child(player_clip)

	var player_tex = TextureRect.new()
	player_tex.name = "PlayerTex"
	player_tex.texture = load(PLAYER_PNG)
	player_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	player_tex.stretch_mode = TextureRect.STRETCH_SCALE
	# Scale the entire spritesheet: 6 cols × 10 rows at display size
	player_tex.size = Vector2(6 * PLAYER_DISP_W, 10 * PLAYER_DISP_H)
	player_tex.position = Vector2.ZERO
	player_clip.add_child(player_tex)

	# Player shadow
	var shadow = ColorRect.new()
	shadow.color = Color(0, 0, 0, 0.25)
	shadow.size = Vector2(PLAYER_DISP_W * 0.65, 12)
	shadow.position = Vector2(PLAYER_DISP_W * 0.17, PLAYER_DISP_H - 8)
	player_node.add_child(shadow)

	# ── HUD ──
	hearts_label = Label.new()
	hearts_label.position = Vector2(20, 12)
	hearts_label.add_theme_font_size_override("font_size", 32)
	hearts_label.add_theme_color_override("font_color", Color(1, 0.35, 0.35))
	add_child(hearts_label)

	score_label = Label.new()
	score_label.anchor_left = 1.0
	score_label.anchor_right = 1.0
	score_label.offset_left = -220
	score_label.offset_top = 12
	score_label.offset_right = -20
	score_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	score_label.add_theme_font_size_override("font_size", 26)
	score_label.add_theme_color_override("font_color", Color(1, 0.85, 0.24))
	add_child(score_label)

	timer_label = Label.new()
	timer_label.anchor_left = 1.0
	timer_label.anchor_right = 1.0
	timer_label.offset_left = -220
	timer_label.offset_top = 46
	timer_label.offset_right = -20
	timer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	timer_label.add_theme_font_size_override("font_size", 19)
	timer_label.add_theme_color_override("font_color", Color(0.7, 0.85, 0.95))
	add_child(timer_label)

	level_label = Label.new()
	level_label.anchor_left = 0.5
	level_label.anchor_right = 0.5
	level_label.offset_left = -200
	level_label.offset_top = 12
	level_label.offset_right = 200
	level_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	level_label.add_theme_font_size_override("font_size", 18)
	level_label.add_theme_color_override("font_color", Color(0.6, 0.8, 0.65))
	add_child(level_label)

	# Stress bar
	stress_bar_bg = ColorRect.new()
	stress_bar_bg.color = Color(0.15, 0.15, 0.18)
	stress_bar_bg.position = Vector2(20, 56)
	stress_bar_bg.size = Vector2(200, 16)
	add_child(stress_bar_bg)

	stress_bar_fill = ColorRect.new()
	stress_bar_fill.color = Color(0.3, 0.8, 0.4)
	stress_bar_fill.position = Vector2(20, 56)
	stress_bar_fill.size = Vector2(0, 16)
	add_child(stress_bar_fill)

	stress_label = Label.new()
	stress_label.text = "Calm"
	stress_label.position = Vector2(226, 54)
	stress_label.add_theme_font_size_override("font_size", 14)
	stress_label.add_theme_color_override("font_color", Color(0.5, 0.7, 0.55))
	add_child(stress_label)

	# ── Center message ──
	message_label = Label.new()
	message_label.visible = false
	message_label.anchor_left = 0.5
	message_label.anchor_top = 0.4
	message_label.anchor_right = 0.5
	message_label.offset_left = -300
	message_label.offset_right = 300
	message_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	message_label.add_theme_font_size_override("font_size", 40)
	message_label.add_theme_color_override("font_color", Color.WHITE)
	add_child(message_label)

	# ── Breathing panel ──
	breathing_panel = VBoxContainer.new()
	breathing_panel.visible = false
	breathing_panel.anchor_left = 0.5
	breathing_panel.anchor_top = 0.5
	breathing_panel.anchor_right = 0.5
	breathing_panel.anchor_bottom = 0.5
	breathing_panel.offset_left = -180
	breathing_panel.offset_top = -100
	breathing_panel.offset_right = 180
	breathing_panel.offset_bottom = 100
	breathing_panel.alignment = BoxContainer.ALIGNMENT_CENTER
	breathing_panel.add_theme_constant_override("separation", 14)
	add_child(breathing_panel)

	breathing_text = Label.new()
	breathing_text.text = "Breathe slowly..."
	breathing_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	breathing_text.add_theme_font_size_override("font_size", 32)
	breathing_text.add_theme_color_override("font_color", Color(0.5, 0.9, 0.7))
	breathing_panel.add_child(breathing_text)

	var breath_circle = ColorRect.new()
	breath_circle.color = Color(0.3, 0.8, 0.5, 0.3)
	breath_circle.custom_minimum_size = Vector2(90, 90)
	breathing_panel.add_child(breath_circle)

	var breath_hint = Label.new()
	breath_hint.text = "Relax your muscles..."
	breath_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	breath_hint.add_theme_font_size_override("font_size", 16)
	breath_hint.add_theme_color_override("font_color", Color(0.45, 0.65, 0.5))
	breathing_panel.add_child(breath_hint)

	# ── Game over panel ──
	game_over_panel = VBoxContainer.new()
	game_over_panel.visible = false
	game_over_panel.anchor_left = 0.5
	game_over_panel.anchor_top = 0.5
	game_over_panel.anchor_right = 0.5
	game_over_panel.anchor_bottom = 0.5
	game_over_panel.offset_left = -200
	game_over_panel.offset_top = -160
	game_over_panel.offset_right = 200
	game_over_panel.offset_bottom = 160
	game_over_panel.alignment = BoxContainer.ALIGNMENT_CENTER
	game_over_panel.add_theme_constant_override("separation", 14)
	add_child(game_over_panel)

# ─── STRESS CONNECTION ───
func _connect_stress() -> void:
	if has_node("/root/StressMonitor"):
		var monitor = get_node("/root/StressMonitor")
		monitor.stress_updated.connect(func(s): current_stress = s)
		monitor.stress_alert.connect(_on_stress_alert)

func _on_stress_alert(is_stressed: bool) -> void:
	if is_stressed and not breathing_active and game_active:
		_start_breathing()
	elif not is_stressed and breathing_active:
		_end_breathing()

# ─── LEVEL MANAGEMENT ───
func _start_level() -> void:
	game_active = false
	collected = 0

	# Clear old entities
	for s in spirits:
		if is_instance_valid(s["node"]): s["node"].queue_free()
	for s in slimes:
		if is_instance_valid(s["node"]): s["node"].queue_free()
	spirits.clear()
	slimes.clear()

	var lvl = LEVELS[current_level]
	time_left = lvl["time"]

	# Show level name
	message_label.text = lvl["name"]
	message_label.add_theme_color_override("font_color", lvl["color"])
	message_label.visible = true

	await get_tree().create_timer(1.8).timeout
	message_label.text = "GO!"
	await get_tree().create_timer(0.6).timeout
	message_label.visible = false

	_spawn_spirits(lvl["spirits"])
	_spawn_slimes(lvl["slimes"])

	# Reset player position
	player_pos = Vector2(vp_size.x * 0.08, vp_size.y * 0.45)
	game_active = true

func _spawn_spirits(count: int) -> void:
	var dust_tex = load(DUST_PNG)
	var margin_x = vp_size.x * 0.12
	var margin_top = play_top + 40
	var margin_bottom = vp_size.y - 80
	for i in range(count):
		var spirit_ctrl = Control.new()
		var spirit_size = 48.0
		spirit_ctrl.size = Vector2(spirit_size, spirit_size)
		var x = margin_x + randi() % int(vp_size.x - margin_x * 2)
		var y = margin_top + randi() % int(margin_bottom - margin_top)
		spirit_ctrl.position = Vector2(x, y)
		spirit_container.add_child(spirit_ctrl)

		# Glow circle behind
		var glow = ColorRect.new()
		glow.color = Color(0.4, 0.9, 0.6, 0.25)
		glow.size = Vector2(spirit_size + 16, spirit_size + 16)
		glow.position = Vector2(-8, -8)
		spirit_ctrl.add_child(glow)

		# Particle texture
		var tex = TextureRect.new()
		tex.texture = dust_tex
		tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tex.custom_minimum_size = Vector2(spirit_size, spirit_size)
		tex.modulate = Color(0.5, 1.0, 0.7, 0.9)
		spirit_ctrl.add_child(tex)

		spirits.append({"node": spirit_ctrl, "collected": false, "base_y": float(y), "phase": randf() * TAU})

func _spawn_slimes(count: int) -> void:
	var margin_x = vp_size.x * 0.15
	var margin_top = play_top + 60
	var margin_bottom = vp_size.y - 100
	for i in range(count):
		var slime_ctrl = Control.new()
		slime_ctrl.size = Vector2(SLIME_DISP_W, SLIME_DISP_H)
		var x = margin_x + randi() % int(vp_size.x - margin_x * 2)
		var y = margin_top + randi() % int(margin_bottom - margin_top)
		slime_ctrl.position = Vector2(x, y)
		slime_container.add_child(slime_ctrl)

		# Slime sprite (clip to one frame, scaled up)
		var clip = Control.new()
		clip.clip_contents = true
		clip.size = Vector2(SLIME_DISP_W, SLIME_DISP_H)
		slime_ctrl.add_child(clip)

		var tex = TextureRect.new()
		tex.name = "SlimeTex"
		tex.texture = load(SLIME_PNG)
		tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tex.stretch_mode = TextureRect.STRETCH_SCALE
		# Scale the full sheet: 6 cols × 13 rows at display size
		tex.size = Vector2(6 * SLIME_DISP_W, 13 * SLIME_DISP_H)
		tex.position = Vector2.ZERO
		clip.add_child(tex)

		# Shadow
		var shadow = ColorRect.new()
		shadow.color = Color(0, 0, 0, 0.2)
		shadow.size = Vector2(SLIME_DISP_W * 0.7, 10)
		shadow.position = Vector2(SLIME_DISP_W * 0.15, SLIME_DISP_H - 6)
		slime_ctrl.add_child(shadow)

		var angle = randf() * TAU
		slimes.append({
			"node": slime_ctrl,
			"base": Vector2(x, y),
			"angle": angle,
			"speed": LEVELS[current_level]["slime_speed"],
			"frame": 0,
			"anim_timer": 0.0,
		})

# ─── MAIN LOOP ───
func _process(delta: float) -> void:
	if game_over:
		return

	_update_stress_visuals(delta)

	if breathing_active:
		_process_breathing(delta)
		return

	if not game_active:
		return

	# Timer
	time_left -= delta
	if time_left <= 0:
		time_left = 0
		_lose_heart()
		if hearts > 0:
			_start_level()
		return

	_move_player(delta)
	_animate_player(delta)
	_update_spirits(delta)
	_move_slimes(delta)
	_animate_slimes(delta)
	_check_collisions()
	_update_hud()

	# Check level complete
	if collected >= LEVELS[current_level]["spirits"]:
		game_active = false
		score += 20
		if current_level + 1 >= LEVELS.size():
			_end_game(true)
		else:
			current_level += 1
			_start_level()

# ─── PLAYER ───
func _move_player(delta: float) -> void:
	var input = Vector2.ZERO
	input.x = Input.get_action_strength("move_right") - Input.get_action_strength("move_left")
	input.y = Input.get_action_strength("move_down") - Input.get_action_strength("move_up")
	if input.length() > 1.0:
		input = input.normalized()

	player_moving = input.length() > 0.1
	if input.x > 0.1: player_facing_right = true
	elif input.x < -0.1: player_facing_right = false

	player_pos += input * PLAYER_SPEED * delta
	player_pos.x = clamp(player_pos.x, 20, vp_size.x - PLAYER_DISP_W - 20)
	player_pos.y = clamp(player_pos.y, play_top, vp_size.y - PLAYER_DISP_H - 10)
	player_node.position = player_pos

	# Invincibility
	if invincible_timer > 0:
		invincible_timer -= delta
		player_node.modulate.a = 0.4 if fmod(invincible_timer, 0.2) < 0.1 else 1.0
	else:
		player_node.modulate.a = 1.0

func _animate_player(delta: float) -> void:
	player_anim_timer += delta
	if player_anim_timer >= 0.15:
		player_anim_timer = 0.0
		player_frame = (player_frame + 1) % 6

	var row = 3 if player_moving else 0
	var col = player_frame

	var tex_node: Node = null
	var clip = player_node.get_child(0)
	if clip and clip.get_child_count() > 0:
		tex_node = clip.get_child(0)

	if tex_node:
		tex_node.position = Vector2(-col * PLAYER_DISP_W, -row * PLAYER_DISP_H)
		# Flip horizontally
		if clip:
			clip.scale.x = -1.0 if not player_facing_right else 1.0
			clip.position.x = PLAYER_DISP_W if not player_facing_right else 0

# ─── SPIRITS ───
func _update_spirits(delta: float) -> void:
	for s in spirits:
		if s["collected"]:
			continue
		var node: Control = s["node"]
		node.position.y = s["base_y"] + sin(Time.get_ticks_msec() / 500.0 + s["phase"]) * 8.0
		node.modulate.a = 0.7 + sin(Time.get_ticks_msec() / 400.0 + s["phase"]) * 0.3

# ─── SLIMES ───
func _move_slimes(delta: float) -> void:
	var speed_mult = stress_mult
	for s in slimes:
		var base: Vector2 = s["base"]
		s["angle"] += delta * 1.2 * speed_mult
		var radius = 80.0 + sin(s["angle"] * 0.5) * 35.0
		s["node"].position = Vector2(
			base.x + cos(s["angle"]) * radius,
			base.y + sin(s["angle"]) * radius * 0.5
		)
		s["node"].position.x = clamp(s["node"].position.x, 20, vp_size.x - SLIME_DISP_W - 20)
		s["node"].position.y = clamp(s["node"].position.y, play_top, vp_size.y - SLIME_DISP_H - 10)

func _animate_slimes(delta: float) -> void:
	for s in slimes:
		s["anim_timer"] += delta
		if s["anim_timer"] >= 0.18:
			s["anim_timer"] = 0.0
			s["frame"] = (s["frame"] + 1) % 6

		var row = 3  # move animation row
		var col = s["frame"]
		var clip = s["node"].get_child(0)
		if clip and clip.get_child_count() > 0:
			var tex = clip.get_child(0)
			tex.position = Vector2(-col * SLIME_DISP_W, -row * SLIME_DISP_H)

# ─── COLLISIONS ───
func _check_collisions() -> void:
	var player_center = player_pos + Vector2(PLAYER_DISP_W * 0.5, PLAYER_DISP_H * 0.5)

	# Collect spirits
	for s in spirits:
		if s["collected"]:
			continue
		var spirit_center = s["node"].position + Vector2(24, 24)
		if player_center.distance_to(spirit_center) < 55.0:
			s["collected"] = true
			s["node"].visible = false
			collected += 1
			score += 15

	# Hit slimes
	if invincible_timer > 0:
		return
	for s in slimes:
		var slime_center = s["node"].position + Vector2(SLIME_DISP_W * 0.5, SLIME_DISP_H * 0.5)
		if player_center.distance_to(slime_center) < 50.0:
			_lose_heart()
			break

func _lose_heart() -> void:
	hearts -= 1
	invincible_timer = 1.5
	if hearts <= 0:
		_end_game(false)

# ─── STRESS VISUALS ───
func _update_stress_visuals(delta: float) -> void:
	stress_overlay.color.a = lerp(stress_overlay.color.a, current_stress * 0.3, delta * 3.0)

	stress_bar_fill.size.x = current_stress * 200.0
	if current_stress < 0.35:
		stress_bar_fill.color = Color(0.3, 0.8, 0.4)
		stress_label.text = "Calm"
	elif current_stress < 0.65:
		stress_bar_fill.color = Color(0.9, 0.75, 0.2)
		stress_label.text = "Alert"
	else:
		stress_bar_fill.color = Color(0.85, 0.25, 0.25)
		stress_label.text = "Stressed!"

	stress_mult = 1.0 + (current_stress - 0.3) * 1.2
	stress_mult = clamp(stress_mult, 0.5, 2.0)

# ─── BREATHING ───
func _start_breathing() -> void:
	breathing_active = true
	breathing_panel.visible = true
	var tween = create_tween().set_loops()
	var circle = breathing_panel.get_child(1)
	tween.tween_property(circle, "custom_minimum_size", Vector2(110, 110), 2.0).set_trans(Tween.TRANS_SINE)
	tween.tween_property(circle, "custom_minimum_size", Vector2(50, 50), 2.0).set_trans(Tween.TRANS_SINE)

func _end_breathing() -> void:
	breathing_active = false
	breathing_panel.visible = false
	score += 15
	stress_mult = max(0.5, stress_mult - 0.4)
	message_label.text = "Great! Calm restored +15"
	message_label.add_theme_color_override("font_color", Color(0.4, 0.95, 0.6))
	message_label.visible = true
	await get_tree().create_timer(1.2).timeout
	if not game_over:
		message_label.visible = false

func _process_breathing(_delta: float) -> void:
	var phase = sin(Time.get_ticks_msec() / 1500.0)
	breathing_text.text = "Breathe in..." if phase > 0 else "Breathe out..."

# ─── HUD ───
func _update_hud() -> void:
	var heart_str = ""
	for i in range(3):
		heart_str += "❤️" if i < hearts else "🖤"
	hearts_label.text = heart_str
	score_label.text = "Score: %d" % score
	timer_label.text = "Time: %ds" % int(ceil(time_left))
	var lvl = LEVELS[current_level]
	level_label.text = "%s  [%d/%d spirits]" % [lvl["name"], collected, lvl["spirits"]]

# ─── GAME OVER ───
func _end_game(won: bool) -> void:
	game_over = true
	game_active = false

	var star_tex = load("res://decorations/star.png") if ResourceLoader.exists("res://decorations/star.png") else null

	if star_tex:
		var star = TextureRect.new()
		star.texture = star_tex
		star.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		star.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		star.custom_minimum_size = Vector2(120, 66)
		star.pivot_offset = Vector2(60, 33)
		game_over_panel.add_child(star)
		var spin = create_tween()
		spin.tween_property(star, "rotation", TAU, 0.8).set_ease(Tween.EASE_OUT)

	var title = Label.new()
	title.text = "Forest Saved!" if won else "Try Again!"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 34)
	title.add_theme_color_override("font_color", Color.WHITE)
	game_over_panel.add_child(title)

	var score_lbl = Label.new()
	score_lbl.text = "%d points" % score
	score_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	score_lbl.add_theme_font_size_override("font_size", 26)
	score_lbl.add_theme_color_override("font_color", Color(1, 0.85, 0.24))
	game_over_panel.add_child(score_lbl)

	var msg = Label.new()
	msg.text = "Staying calm helped you through the dark forest!" if won else "Remember: breathe when things feel scary."
	msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	msg.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	msg.add_theme_font_size_override("font_size", 16)
	msg.add_theme_color_override("font_color", Color(0.6, 0.8, 0.65))
	game_over_panel.add_child(msg)

	# Health bar based on score
	var bar_path: String
	var pct: float = clamp(float(score) / 150.0, 0.0, 1.0)
	if pct >= 0.9: bar_path = "res://decorations/fullhealth.png"
	elif pct >= 0.65: bar_path = "res://decorations/70full.png"
	elif pct >= 0.4: bar_path = "res://decorations/50full.png"
	elif pct >= 0.15: bar_path = "res://decorations/20full.png"
	else: bar_path = "res://decorations/emptybar.png"
	if ResourceLoader.exists(bar_path):
		var bar = TextureRect.new()
		bar.texture = load(bar_path)
		bar.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		bar.custom_minimum_size = Vector2(240, 70)
		game_over_panel.add_child(bar)

	var done_btn = Button.new()
	done_btn.text = "Back to Map"
	done_btn.custom_minimum_size = Vector2(200, 54)
	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.18, 0.75, 0.5)
	style.corner_radius_top_left = 14
	style.corner_radius_top_right = 14
	style.corner_radius_bottom_left = 14
	style.corner_radius_bottom_right = 14
	done_btn.add_theme_stylebox_override("normal", style)
	done_btn.add_theme_color_override("font_color", Color.WHITE)
	done_btn.add_theme_font_size_override("font_size", 18)
	done_btn.pressed.connect(func(): game_finished.emit(score))
	game_over_panel.add_child(done_btn)

	game_over_panel.scale = Vector2(0.1, 0.1)
	game_over_panel.pivot_offset = Vector2(200, 160)
	var pop = create_tween()
	pop.tween_property(game_over_panel, "scale", Vector2(1.0, 1.0), 0.5).set_trans(Tween.TRANS_SPRING).set_ease(Tween.EASE_OUT)
	game_over_panel.visible = true

func _unhandled_input(event: InputEvent) -> void:
	# Shift+Up/Down for stress demo
	if event is InputEventKey and event.pressed and event.shift_pressed:
		if event.keycode == KEY_UP:
			current_stress = clamp(current_stress + 0.2, 0.0, 1.0)
			if current_stress >= 0.65 and not breathing_active and game_active:
				_start_breathing()
		elif event.keycode == KEY_DOWN:
			current_stress = clamp(current_stress - 0.2, 0.0, 1.0)
			if current_stress <= 0.35 and breathing_active:
				_end_breathing()
