# stress_runner_game.gd — Stress Management Runner Game
#
# The hero runs automatically. Kid taps SPACE/UP to jump over obstacles.
# EMG sensor measures stress. When stress is too high:
#   → Screen tints red, hero slows down, breathing prompt appears
#   → If kid calms down (stress drops), difficulty eases and hero speeds back up
#   → This teaches self-regulation through positive reinforcement
#
# 3 Hearts | 3 Levels | Increasing difficulty | Stress-adaptive
extends CanvasLayer

signal game_finished(score: int)

# ─── GAME CONFIG ───
const GROUND_Y: float = 420.0
const GRAVITY: float = 1400.0
const JUMP_FORCE: float = -520.0
const BASE_SPEED: float = 200.0

# Level configs: [obstacle_interval, speed_multiplier, obstacles_to_clear]
const LEVELS: Array = [
	{ "name": "Level 1 — Easy", "interval": 1.8, "speed_mult": 1.0, "goal": 8,  "color": Color(0.18, 0.75, 0.55) },
	{ "name": "Level 2 — Medium", "interval": 1.4, "speed_mult": 1.3, "goal": 12, "color": Color(0.95, 0.75, 0.2) },
	{ "name": "Level 3 — Hard", "interval": 1.0, "speed_mult": 1.6, "goal": 15, "color": Color(0.85, 0.3, 0.3) },
]

# ─── STATE ───
var hearts: int = 3
var max_hearts: int = 3
var current_level: int = 0
var score: int = 0
var obstacles_cleared: int = 0
var game_over: bool = false
var game_paused: bool = false   # true during breathing prompt
var level_transitioning: bool = false

# Hero state
var hero_y: float = GROUND_Y
var hero_vy: float = 0.0
var hero_on_ground: bool = true

# Stress-adaptive difficulty
var stress_difficulty_mult: float = 1.0  # 0.5 (calming) to 1.5 (stressed)
var current_stress: float = 0.0
var breathing_active: bool = false
var breath_timer: float = 0.0

# Obstacles
var obstacles: Array = []
var spawn_timer: float = 0.0
var invincible_timer: float = 0.0  # brief invincibility after hit

# ─── UI NODES ───
var bg: ColorRect
var ground_line: ColorRect
var stress_overlay: ColorRect
var hero_sprite: ColorRect
var hero_eye_l: ColorRect
var hero_eye_r: ColorRect
var hero_mouth: ColorRect
var hearts_label: Label
var score_label: Label
var level_label: Label
var stress_bar_bg: ColorRect
var stress_bar_fill: ColorRect
var stress_bar_label: Label
var breathing_panel: VBoxContainer
var breathing_circle: ColorRect
var breathing_text: Label
var message_label: Label
var game_over_panel: VBoxContainer

func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS

	_build_ui()
	_connect_stress()
	_show_level_intro()

func _build_ui() -> void:
	# ── Sky background ──
	bg = ColorRect.new()
	bg.color = Color(0.08, 0.1, 0.18)
	bg.anchor_right = 1.0
	bg.anchor_bottom = 1.0
	add_child(bg)

	# ── Ground ──
	ground_line = ColorRect.new()
	ground_line.color = Color(0.15, 0.4, 0.25)
	ground_line.anchor_left = 0.0
	ground_line.anchor_right = 1.0
	ground_line.offset_top = GROUND_Y + 30
	ground_line.offset_bottom = GROUND_Y + 200
	add_child(ground_line)

	# ── Grass line ──
	var grass = ColorRect.new()
	grass.color = Color(0.2, 0.55, 0.3)
	grass.anchor_left = 0.0
	grass.anchor_right = 1.0
	grass.offset_top = GROUND_Y + 25
	grass.offset_bottom = GROUND_Y + 35
	add_child(grass)

	# ── Stress red overlay (fades in when stressed) ──
	stress_overlay = ColorRect.new()
	stress_overlay.color = Color(0.8, 0.1, 0.1, 0.0)
	stress_overlay.anchor_right = 1.0
	stress_overlay.anchor_bottom = 1.0
	stress_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(stress_overlay)

	# ── Hero (pixel-art style character built from rects) ──
	var hero_container = Control.new()
	hero_container.position = Vector2(120, GROUND_Y)
	hero_container.name = "HeroContainer"
	add_child(hero_container)

	# Body
	hero_sprite = ColorRect.new()
	hero_sprite.color = Color(0.3, 0.75, 0.95)
	hero_sprite.position = Vector2(-15, -40)
	hero_sprite.size = Vector2(30, 40)
	hero_container.add_child(hero_sprite)

	# Head
	var head = ColorRect.new()
	head.color = Color(0.95, 0.82, 0.65)
	head.position = Vector2(-12, -58)
	head.size = Vector2(24, 22)
	hero_container.add_child(head)

	# Eyes
	hero_eye_l = ColorRect.new()
	hero_eye_l.color = Color(0.1, 0.1, 0.1)
	hero_eye_l.position = Vector2(-6, -52)
	hero_eye_l.size = Vector2(5, 5)
	hero_container.add_child(hero_eye_l)

	hero_eye_r = ColorRect.new()
	hero_eye_r.color = Color(0.1, 0.1, 0.1)
	hero_eye_r.position = Vector2(3, -52)
	hero_eye_r.size = Vector2(5, 5)
	hero_container.add_child(hero_eye_r)

	# Mouth (changes with stress)
	hero_mouth = ColorRect.new()
	hero_mouth.color = Color(0.85, 0.35, 0.3)
	hero_mouth.position = Vector2(-4, -43)
	hero_mouth.size = Vector2(8, 3)
	hero_container.add_child(hero_mouth)

	# Feet
	var foot_l = ColorRect.new()
	foot_l.color = Color(0.2, 0.2, 0.2)
	foot_l.position = Vector2(-12, 0)
	foot_l.size = Vector2(10, 6)
	hero_container.add_child(foot_l)

	var foot_r = ColorRect.new()
	foot_r.color = Color(0.2, 0.2, 0.2)
	foot_r.position = Vector2(4, 0)
	foot_r.size = Vector2(10, 6)
	hero_container.add_child(foot_r)

	# ── HUD ──
	# Hearts
	hearts_label = Label.new()
	hearts_label.position = Vector2(20, 15)
	hearts_label.add_theme_font_size_override("font_size", 28)
	hearts_label.add_theme_color_override("font_color", Color(1, 0.3, 0.3))
	add_child(hearts_label)

	# Score
	score_label = Label.new()
	score_label.anchor_left = 1.0
	score_label.anchor_right = 1.0
	score_label.offset_left = -160
	score_label.offset_top = 15
	score_label.offset_right = -20
	score_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	score_label.add_theme_font_size_override("font_size", 22)
	score_label.add_theme_color_override("font_color", Color(1, 0.85, 0.24))
	add_child(score_label)

	# Level
	level_label = Label.new()
	level_label.anchor_left = 0.5
	level_label.anchor_right = 0.5
	level_label.offset_left = -100
	level_label.offset_top = 15
	level_label.offset_right = 100
	level_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	level_label.add_theme_font_size_override("font_size", 16)
	level_label.add_theme_color_override("font_color", Color(0.7, 0.8, 0.9))
	add_child(level_label)

	# ── Stress bar ──
	stress_bar_bg = ColorRect.new()
	stress_bar_bg.color = Color(0.2, 0.2, 0.25)
	stress_bar_bg.position = Vector2(20, 55)
	stress_bar_bg.size = Vector2(200, 16)
	add_child(stress_bar_bg)

	stress_bar_fill = ColorRect.new()
	stress_bar_fill.color = Color(0.3, 0.8, 0.4)
	stress_bar_fill.position = Vector2(20, 55)
	stress_bar_fill.size = Vector2(0, 16)
	add_child(stress_bar_fill)

	stress_bar_label = Label.new()
	stress_bar_label.text = "Calm"
	stress_bar_label.position = Vector2(225, 53)
	stress_bar_label.add_theme_font_size_override("font_size", 13)
	stress_bar_label.add_theme_color_override("font_color", Color(0.6, 0.7, 0.8))
	add_child(stress_bar_label)

	# ── Breathing prompt (hidden) ──
	breathing_panel = VBoxContainer.new()
	breathing_panel.visible = false
	breathing_panel.anchor_left = 0.5
	breathing_panel.anchor_top = 0.5
	breathing_panel.anchor_right = 0.5
	breathing_panel.anchor_bottom = 0.5
	breathing_panel.offset_left = -150
	breathing_panel.offset_top = -100
	breathing_panel.offset_right = 150
	breathing_panel.offset_bottom = 100
	breathing_panel.alignment = BoxContainer.ALIGNMENT_CENTER
	breathing_panel.add_theme_constant_override("separation", 12)
	add_child(breathing_panel)

	breathing_text = Label.new()
	breathing_text.text = "Breathe slowly..."
	breathing_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	breathing_text.add_theme_font_size_override("font_size", 28)
	breathing_text.add_theme_color_override("font_color", Color(0.6, 0.9, 1.0))
	breathing_panel.add_child(breathing_text)

	breathing_circle = ColorRect.new()
	breathing_circle.color = Color(0.3, 0.7, 0.9, 0.4)
	breathing_circle.custom_minimum_size = Vector2(80, 80)
	breathing_circle.size = Vector2(80, 80)
	breathing_panel.add_child(breathing_circle)

	var breath_hint = Label.new()
	breath_hint.text = "Relax your arm muscles..."
	breath_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	breath_hint.add_theme_font_size_override("font_size", 14)
	breath_hint.add_theme_color_override("font_color", Color(0.5, 0.65, 0.75))
	breathing_panel.add_child(breath_hint)

	# ── Center message (level intros, etc) ──
	message_label = Label.new()
	message_label.visible = false
	message_label.anchor_left = 0.5
	message_label.anchor_top = 0.5
	message_label.anchor_right = 0.5
	message_label.anchor_bottom = 0.5
	message_label.offset_left = -200
	message_label.offset_top = -40
	message_label.offset_right = 200
	message_label.offset_bottom = 40
	message_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	message_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	message_label.add_theme_font_size_override("font_size", 32)
	message_label.add_theme_color_override("font_color", Color.WHITE)
	add_child(message_label)

	# ── Game over panel (hidden) ──
	game_over_panel = VBoxContainer.new()
	game_over_panel.visible = false
	game_over_panel.anchor_left = 0.5
	game_over_panel.anchor_top = 0.5
	game_over_panel.anchor_right = 0.5
	game_over_panel.anchor_bottom = 0.5
	game_over_panel.offset_left = -160
	game_over_panel.offset_top = -120
	game_over_panel.offset_right = 160
	game_over_panel.offset_bottom = 120
	game_over_panel.alignment = BoxContainer.ALIGNMENT_CENTER
	game_over_panel.add_theme_constant_override("separation", 14)
	add_child(game_over_panel)

	_update_hud()

func _connect_stress() -> void:
	# Connect to StressMonitor autoload if available
	if has_node("/root/StressMonitor"):
		var monitor = get_node("/root/StressMonitor")
		monitor.stress_updated.connect(_on_stress_updated)
		monitor.stress_alert.connect(_on_stress_alert)
		print("StressRunner: Connected to StressMonitor")
	else:
		print("StressRunner: No StressMonitor found — stress features disabled")

func _on_stress_updated(level: float) -> void:
	current_stress = level

func _on_stress_alert(is_stressed: bool) -> void:
	if is_stressed and not breathing_active and not game_over and not level_transitioning:
		_start_breathing_prompt()
	elif not is_stressed and breathing_active:
		_end_breathing_prompt()

func _show_level_intro() -> void:
	level_transitioning = true
	var lvl = LEVELS[current_level]
	message_label.text = lvl["name"]
	message_label.add_theme_color_override("font_color", lvl["color"])
	message_label.visible = true

	await get_tree().create_timer(2.0).timeout
	message_label.text = "GO!"
	await get_tree().create_timer(0.8).timeout
	message_label.visible = false
	level_transitioning = false

func _process(delta: float) -> void:
	if game_over or level_transitioning:
		return

	_update_stress_visuals(delta)

	if breathing_active:
		_process_breathing(delta)
		return

	_process_hero(delta)
	_process_obstacles(delta)
	_process_spawning(delta)
	_update_hud()

func _update_stress_visuals(delta: float) -> void:
	# Red overlay intensity based on stress
	var target_alpha = current_stress * 0.35
	stress_overlay.color.a = lerp(stress_overlay.color.a, target_alpha, delta * 3.0)

	# Stress bar
	stress_bar_fill.size.x = current_stress * 200.0
	if current_stress < 0.35:
		stress_bar_fill.color = Color(0.3, 0.8, 0.4)
		stress_bar_label.text = "Calm"
		stress_bar_label.add_theme_color_override("font_color", Color(0.4, 0.85, 0.5))
	elif current_stress < 0.65:
		stress_bar_fill.color = Color(0.95, 0.75, 0.2)
		stress_bar_label.text = "Alert"
		stress_bar_label.add_theme_color_override("font_color", Color(0.95, 0.75, 0.2))
	else:
		stress_bar_fill.color = Color(0.85, 0.25, 0.25)
		stress_bar_label.text = "Stressed!"
		stress_bar_label.add_theme_color_override("font_color", Color(0.9, 0.3, 0.3))

	# Hero face changes with stress
	if current_stress > 0.6:
		hero_mouth.size = Vector2(10, 2)  # worried flat line
		hero_mouth.position.x = -5
		hero_sprite.color = Color(0.85, 0.4, 0.4)  # reddish
	elif current_stress > 0.35:
		hero_mouth.size = Vector2(8, 3)
		hero_mouth.position.x = -4
		hero_sprite.color = Color(0.7, 0.7, 0.4)  # yellowish
	else:
		hero_mouth.size = Vector2(6, 4)  # smile
		hero_mouth.position.x = -3
		hero_sprite.color = Color(0.3, 0.75, 0.95)  # happy blue

	# Stress affects difficulty multiplier (smooth transition)
	var target_mult = 1.0 + (current_stress - 0.3) * 0.8  # 0.76 at calm, 1.56 at max stress
	stress_difficulty_mult = lerp(stress_difficulty_mult, clamp(target_mult, 0.6, 1.6), delta * 2.0)

func _process_hero(delta: float) -> void:
	var container = get_node("HeroContainer")

	# Gravity
	if not hero_on_ground:
		hero_vy += GRAVITY * delta
		hero_y += hero_vy * delta
		if hero_y >= GROUND_Y:
			hero_y = GROUND_Y
			hero_vy = 0
			hero_on_ground = true

	container.position.y = hero_y

	# Invincibility flash
	if invincible_timer > 0:
		invincible_timer -= delta
		container.modulate.a = 0.5 if fmod(invincible_timer, 0.2) < 0.1 else 1.0
	else:
		container.modulate.a = 1.0

func _process_obstacles(delta: float) -> void:
	var lvl = LEVELS[current_level]
	var speed = BASE_SPEED * lvl["speed_mult"] * stress_difficulty_mult

	var to_remove: Array = []
	for obs in obstacles:
		var node: ColorRect = obs["node"]
		node.position.x -= speed * delta

		# Check collision with hero
		if invincible_timer <= 0 and not obs["scored"]:
			var hero_rect = Rect2(Vector2(105, hero_y - 40), Vector2(30, 40))
			var obs_rect = Rect2(node.position, node.size)
			if hero_rect.intersects(obs_rect):
				_take_hit()
				obs["scored"] = true
				continue

		# Passed hero = score
		if not obs["scored"] and node.position.x + node.size.x < 100:
			obs["scored"] = true
			score += 10
			obstacles_cleared += 1
			_check_level_complete()

		# Off screen = remove
		if node.position.x < -80:
			to_remove.append(obs)

	for obs in to_remove:
		obs["node"].queue_free()
		obstacles.erase(obs)

func _process_spawning(delta: float) -> void:
	spawn_timer -= delta
	if spawn_timer <= 0:
		_spawn_obstacle()
		var lvl = LEVELS[current_level]
		spawn_timer = lvl["interval"] / stress_difficulty_mult
		spawn_timer = max(spawn_timer, 0.5)  # minimum gap

func _spawn_obstacle() -> void:
	var obs = ColorRect.new()
	# Vary obstacle types
	var height = 25 + randi() % 25
	var width = 20 + randi() % 15
	obs.size = Vector2(width, height)
	obs.position = Vector2(1200, GROUND_Y + 30 - height)

	# Color based on level
	var colors = [Color(0.6, 0.3, 0.2), Color(0.5, 0.25, 0.5), Color(0.7, 0.2, 0.2)]
	obs.color = colors[current_level % colors.size()]

	# Add spiky top
	var spike = ColorRect.new()
	spike.color = obs.color.lightened(0.2)
	spike.size = Vector2(width * 0.6, 8)
	spike.position = Vector2(width * 0.2, -6)
	obs.add_child(spike)

	add_child(obs)
	obstacles.append({ "node": obs, "scored": false })

func _take_hit() -> void:
	hearts -= 1
	invincible_timer = 1.5
	_update_hud()

	# Screen shake effect
	var orig_pos = bg.position
	var shake_tween = create_tween()
	shake_tween.tween_property(bg, "position", Vector2(8, 0), 0.05)
	shake_tween.tween_property(bg, "position", Vector2(-8, 0), 0.05)
	shake_tween.tween_property(bg, "position", Vector2(4, 0), 0.05)
	shake_tween.tween_property(bg, "position", orig_pos, 0.05)

	if hearts <= 0:
		_game_over(false)

func _check_level_complete() -> void:
	var lvl = LEVELS[current_level]
	if obstacles_cleared >= lvl["goal"]:
		if current_level + 1 >= LEVELS.size():
			_game_over(true)  # Won all levels!
		else:
			_next_level()

func _next_level() -> void:
	current_level += 1
	obstacles_cleared = 0

	# Clear remaining obstacles
	for obs in obstacles:
		obs["node"].queue_free()
	obstacles.clear()

	_show_level_intro()

func _start_breathing_prompt() -> void:
	breathing_active = true
	game_paused = true
	breath_timer = 0
	breathing_panel.visible = true

	# Animate the breathing circle
	var breath_tween = create_tween().set_loops()
	breath_tween.set_meta("breathing", true)
	breath_tween.tween_property(breathing_circle, "custom_minimum_size", Vector2(100, 100), 2.0).set_trans(Tween.TRANS_SINE)
	breath_tween.tween_property(breathing_circle, "custom_minimum_size", Vector2(50, 50), 2.0).set_trans(Tween.TRANS_SINE)

func _end_breathing_prompt() -> void:
	breathing_active = false
	game_paused = false
	breathing_panel.visible = false

	# Reward for calming down
	score += 15
	stress_difficulty_mult = max(0.6, stress_difficulty_mult - 0.3)

	# Show positive feedback
	message_label.text = "Great job calming down! +15"
	message_label.add_theme_color_override("font_color", Color(0.4, 0.9, 0.6))
	message_label.visible = true
	await get_tree().create_timer(1.5).timeout
	message_label.visible = false

func _process_breathing(delta: float) -> void:
	breath_timer += delta
	# Animate breathing text
	var phase = sin(breath_timer * 1.5)
	if phase > 0:
		breathing_text.text = "Breathe in..."
	else:
		breathing_text.text = "Breathe out..."

func _unhandled_input(event: InputEvent) -> void:
	if game_over or game_paused or level_transitioning:
		return
	if event.is_action_pressed("move_up") or event.is_action_pressed("ui_accept"):
		if hero_on_ground:
			hero_vy = JUMP_FORCE
			hero_on_ground = false

func _update_hud() -> void:
	# Hearts
	var heart_str = ""
	for i in range(max_hearts):
		heart_str += "❤️" if i < hearts else "🖤"
	hearts_label.text = heart_str

	score_label.text = "Score: %d" % score

	var lvl = LEVELS[current_level]
	level_label.text = "%s  [%d/%d]" % [lvl["name"], obstacles_cleared, lvl["goal"]]

func _game_over(won: bool) -> void:
	game_over = true

	# Clear obstacles
	for obs in obstacles:
		obs["node"].queue_free()
	obstacles.clear()

	# Build game over UI
	var emoji = Label.new()
	emoji.text = "🏆" if won else "💪"
	emoji.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	emoji.add_theme_font_size_override("font_size", 56)
	game_over_panel.add_child(emoji)

	var title = Label.new()
	title.text = "You Won!" if won else "Game Over"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", Color.WHITE)
	game_over_panel.add_child(title)

	var score_lbl = Label.new()
	score_lbl.text = "Score: %d" % score
	score_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	score_lbl.add_theme_font_size_override("font_size", 24)
	score_lbl.add_theme_color_override("font_color", Color(1, 0.85, 0.24))
	game_over_panel.add_child(score_lbl)

	var calm_msg = Label.new()
	if won:
		calm_msg.text = "You stayed calm and beat all 3 levels!"
	else:
		calm_msg.text = "Remember: breathe slowly when things get tough!"
	calm_msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	calm_msg.add_theme_font_size_override("font_size", 14)
	calm_msg.add_theme_color_override("font_color", Color(0.6, 0.75, 0.85))
	calm_msg.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	game_over_panel.add_child(calm_msg)

	var done_btn = Button.new()
	done_btn.text = "Back to Map"
	done_btn.custom_minimum_size = Vector2(180, 48)
	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.18, 0.77, 0.71)
	style.corner_radius_top_left = 14
	style.corner_radius_top_right = 14
	style.corner_radius_bottom_left = 14
	style.corner_radius_bottom_right = 14
	done_btn.add_theme_stylebox_override("normal", style)
	done_btn.add_theme_color_override("font_color", Color.WHITE)
	done_btn.add_theme_font_size_override("font_size", 16)
	done_btn.pressed.connect(func(): game_finished.emit(score))
	game_over_panel.add_child(done_btn)

	game_over_panel.visible = true
