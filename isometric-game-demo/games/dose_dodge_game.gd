# dose_dodge_game.gd — Playable Dose Dodge mini-game (Medication)
# Match the right pill to the right time. Built entirely in code.
extends CanvasLayer

signal game_finished(score: int)

var challenges: Array[Dictionary] = [
	{ "prompt": "It's 8:00 AM — time for...", "options": ["☀️ Vitamin D", "🌙 Melatonin", "🐟 Omega-3"], "answer": 0 },
	{ "prompt": "It's 12:00 PM — lunch pill is...", "options": ["💪 Iron", "🐟 Omega-3", "☀️ Vitamin D"], "answer": 1 },
	{ "prompt": "It's 9:00 PM — bedtime pill is...", "options": ["🐟 Omega-3", "☀️ Vitamin D", "🌙 Melatonin"], "answer": 2 },
	{ "prompt": "Which pill helps your bones?", "options": ["🌙 Melatonin", "☀️ Vitamin D", "🦠 Probiotic"], "answer": 1 },
	{ "prompt": "Which pill helps you sleep?", "options": ["🌙 Melatonin", "💪 Iron", "🐟 Omega-3"], "answer": 0 },
	{ "prompt": "Which pill helps your tummy?", "options": ["💪 Iron", "☀️ Vitamin D", "🦠 Probiotic"], "answer": 2 },
]

var current_round: int = 0
var score: int = 0
var waiting: bool = false

var bg: ColorRect
var prompt_label: Label
var score_label: Label
var progress_bar: ProgressBar
var btn_container: VBoxContainer
var feedback_label: Label
var buttons: Array[Button] = []
var done_panel: VBoxContainer

func _ready() -> void:
	layer = 20

	bg = ColorRect.new()
	bg.color = Color(0.08, 0.06, 0.14, 1.0)
	bg.anchor_right = 1.0
	bg.anchor_bottom = 1.0
	add_child(bg)

	var center = VBoxContainer.new()
	center.anchor_left = 0.5
	center.anchor_top = 0.5
	center.anchor_right = 0.5
	center.anchor_bottom = 0.5
	center.offset_left = -200
	center.offset_top = -200
	center.offset_right = 200
	center.offset_bottom = 200
	center.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_theme_constant_override("separation", 12)
	add_child(center)

	# Header
	score_label = Label.new()
	score_label.text = "Score: 0"
	score_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	score_label.add_theme_font_size_override("font_size", 22)
	score_label.add_theme_color_override("font_color", Color(1, 0.85, 0.24))
	center.add_child(score_label)

	# Progress
	progress_bar = ProgressBar.new()
	progress_bar.max_value = challenges.size()
	progress_bar.value = 0
	progress_bar.custom_minimum_size = Vector2(320, 12)
	progress_bar.show_percentage = false
	center.add_child(progress_bar)

	# Pill emoji
	var pill_icon = Label.new()
	pill_icon.text = "💊"
	pill_icon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pill_icon.add_theme_font_size_override("font_size", 48)
	center.add_child(pill_icon)

	# Prompt
	prompt_label = Label.new()
	prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	prompt_label.add_theme_font_size_override("font_size", 22)
	prompt_label.add_theme_color_override("font_color", Color.WHITE)
	prompt_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	center.add_child(prompt_label)

	var spacer = Control.new()
	spacer.custom_minimum_size = Vector2(0, 6)
	center.add_child(spacer)

	# Buttons
	btn_container = VBoxContainer.new()
	btn_container.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_container.add_theme_constant_override("separation", 10)
	center.add_child(btn_container)

	for i in range(3):
		var btn = Button.new()
		btn.custom_minimum_size = Vector2(300, 50)
		var style = StyleBoxFlat.new()
		style.bg_color = Color(0.15, 0.17, 0.22)
		style.corner_radius_top_left = 14
		style.corner_radius_top_right = 14
		style.corner_radius_bottom_left = 14
		style.corner_radius_bottom_right = 14
		style.border_width_left = 2
		style.border_width_right = 2
		style.border_width_top = 2
		style.border_width_bottom = 2
		style.border_color = Color(0.3, 0.35, 0.4)
		btn.add_theme_stylebox_override("normal", style)
		var hover = style.duplicate()
		hover.border_color = Color(1, 0.85, 0.24)
		btn.add_theme_stylebox_override("hover", hover)
		btn.add_theme_font_size_override("font_size", 18)
		btn.add_theme_color_override("font_color", Color.WHITE)
		var idx = i
		btn.pressed.connect(func(): _pick(idx))
		btn_container.add_child(btn)
		buttons.append(btn)

	# Feedback
	feedback_label = Label.new()
	feedback_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	feedback_label.add_theme_font_size_override("font_size", 20)
	center.add_child(feedback_label)

	# Done panel
	done_panel = VBoxContainer.new()
	done_panel.visible = false
	done_panel.alignment = BoxContainer.ALIGNMENT_CENTER
	done_panel.add_theme_constant_override("separation", 12)
	done_panel.anchor_left = 0.5
	done_panel.anchor_top = 0.5
	done_panel.anchor_right = 0.5
	done_panel.anchor_bottom = 0.5
	done_panel.offset_left = -160
	done_panel.offset_top = -100
	done_panel.offset_right = 160
	done_panel.offset_bottom = 100
	add_child(done_panel)

	_show_round()

func _show_round() -> void:
	if current_round >= challenges.size():
		_show_done()
		return
	var c = challenges[current_round]
	prompt_label.text = c["prompt"]
	for i in range(3):
		buttons[i].text = c["options"][i]
		buttons[i].visible = true
	feedback_label.text = ""
	progress_bar.value = current_round
	score_label.text = "Score: %d" % score

func _pick(idx: int) -> void:
	if waiting:
		return
	waiting = true
	var c = challenges[current_round]
	var chosen = c["options"][idx]
	var correct = idx == c["answer"]

	# Button click animation
	var btn = buttons[idx]
	var b_tween = create_tween()
	b_tween.tween_property(btn, "scale", Vector2(0.95, 0.95), 0.1)
	b_tween.tween_property(btn, "scale", Vector2(1.0, 1.0), 0.1)

	if correct:
		var combo_val = current_round + 1 # simplistic combo for this game
		var pts = 10 + combo_val * 5
		score += pts
		feedback_label.add_theme_color_override("font_color", Color(0.4, 1.0, 0.5))
		
		var praises = ["Spot On!", "Perfect!", "Great Memory!", "Excellent!", "Doctor's Orders!"]
		var praise = praises[randi() % praises.size()]
		feedback_label.text = "🎉 %s +%d" % [praise, pts]
		
		# Animate feedback label pop
		feedback_label.scale = Vector2(0.5, 0.5)
		var f_tween = create_tween()
		f_tween.tween_property(feedback_label, "scale", Vector2(1.2, 1.2), 0.2).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		f_tween.tween_property(feedback_label, "scale", Vector2(1.0, 1.0), 0.1)
	else:
		feedback_label.add_theme_color_override("font_color", Color(1.0, 0.6, 0.4))
		var near_misses = ["Oops!", "Not quite!", "Almost!", "Careful!"]
		feedback_label.text = "💫 %s It was: %s" % [near_misses[randi() % near_misses.size()], c["options"][c["answer"]]]
		
		# Shake feedback
		var s_tween = create_tween()
		s_tween.tween_property(feedback_label, "position:x", feedback_label.position.x + 10, 0.05)
		s_tween.tween_property(feedback_label, "position:x", feedback_label.position.x - 10, 0.05)
		s_tween.tween_property(feedback_label, "position:x", feedback_label.position.x + 10, 0.05)
		s_tween.tween_property(feedback_label, "position:x", feedback_label.position.x, 0.05)

	score_label.text = "Score: %d" % score

	await get_tree().create_timer(1.0).timeout
	waiting = false
	current_round += 1
	_show_round()

func _show_done() -> void:
	prompt_label.text = ""
	for btn in buttons:
		btn.visible = false
	feedback_label.text = ""
	progress_bar.value = challenges.size()

	# ── Animated victory container ──
	var anim_box = VBoxContainer.new()
	anim_box.alignment = BoxContainer.ALIGNMENT_CENTER
	anim_box.add_theme_constant_override("separation", 16)
	done_panel.add_child(anim_box)

	# ── Star sprite: 2816x1536 (ratio 1.83:1) → display at 130x71 ──
	var star = TextureRect.new()
	var star_tex = load("res://decorations/star.png")
	star.texture = star_tex
	star.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	star.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	star.custom_minimum_size = Vector2(130, 71)
	star.pivot_offset = Vector2(65, 35)
	anim_box.add_child(star)

	var title = Label.new()
	title.text = "Pills Matched!"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 26)
	title.add_theme_color_override("font_color", Color.WHITE)
	anim_box.add_child(title)

	# ── Score text ──
	var slbl = Label.new()
	slbl.text = "%d points" % score
	slbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	slbl.add_theme_font_size_override("font_size", 24)
	slbl.add_theme_color_override("font_color", Color(1, 0.85, 0.24))
	anim_box.add_child(slbl)

	# ── Health/energy bar based on score ──
	var bar_path: String
	var pct: float = clamp(float(score) / 100.0, 0.0, 1.0)
	if pct >= 0.9:
		bar_path = "res://decorations/fullhealth.png"
	elif pct >= 0.65:
		bar_path = "res://decorations/70full.png"
	elif pct >= 0.4:
		bar_path = "res://decorations/50full.png"
	elif pct >= 0.15:
		bar_path = "res://decorations/20full.png"
	else:
		bar_path = "res://decorations/emptybar.png"

	var bar = TextureRect.new()
	bar.texture = load(bar_path)
	bar.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	bar.custom_minimum_size = Vector2(240, 80)
	anim_box.add_child(bar)

	# Animated entrance for the whole container
	anim_box.scale = Vector2(0.1, 0.1)
	anim_box.pivot_offset = Vector2(120, 100)
	var win_tween = create_tween().set_parallel(true)
	win_tween.tween_property(anim_box, "scale", Vector2(1.0, 1.0), 0.6).set_trans(Tween.TRANS_SPRING).set_ease(Tween.EASE_OUT)
	win_tween.tween_property(star, "rotation", TAU, 0.8).set_ease(Tween.EASE_OUT) # 360 spin

	var done_btn = Button.new()
	done_btn.text = "Back to Map"
	done_btn.custom_minimum_size = Vector2(180, 50)
	var style = StyleBoxFlat.new()
	style.bg_color = Color(1, 0.85, 0.24)
	style.corner_radius_top_left = 16
	style.corner_radius_top_right = 16
	style.corner_radius_bottom_left = 16
	style.corner_radius_bottom_right = 16
	done_btn.add_theme_stylebox_override("normal", style)
	done_btn.add_theme_color_override("font_color", Color(0.1, 0.1, 0.1))
	done_btn.add_theme_font_size_override("font_size", 16)
	done_btn.pressed.connect(func(): game_finished.emit(score))

	# Button pulses slightly to attract clicks
	var pulse = create_tween().set_loops()
	done_btn.pivot_offset = Vector2(90, 25)
	pulse.tween_property(done_btn, "scale", Vector2(1.05, 1.05), 0.8).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(done_btn, "scale", Vector2(1.0, 1.0), 0.8).set_trans(Tween.TRANS_SINE)

	done_panel.add_child(done_btn)
	done_panel.visible = true
