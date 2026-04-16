# letter_flip_game.gd — Playable Letter Flip mini-game (Dyslexia)
# Standalone scene: CanvasLayer with full UI built in code.
extends CanvasLayer

signal game_finished(score: int)

var challenges: Array[Dictionary] = [
	{ "prompt": "Which one is the letter B?", "options": ["b", "d"], "answer": "b" },
	{ "prompt": "Which one is the letter Q?", "options": ["p", "q"], "answer": "q" },
	{ "prompt": "Which word means 'existed'?", "options": ["was", "saw"], "answer": "was" },
	{ "prompt": "Which one is the letter M?", "options": ["m", "w"], "answer": "m" },
	{ "prompt": "Which word means 'not yes'?", "options": ["on", "no"], "answer": "no" },
	{ "prompt": "Which is an animal?", "options": ["dog", "bog"], "answer": "dog" },
]

var current_round: int = 0
var score: int = 0
var combo: int = 0
var waiting: bool = false

# UI refs
var bg: ColorRect
var prompt_label: Label
var score_label: Label
var combo_label: Label
var progress_bar: ProgressBar
var btn_a: Button
var btn_b: Button
var feedback_label: Label
var done_panel: VBoxContainer

func _ready() -> void:
	layer = 20

	# ── Background ──
	bg = ColorRect.new()
	bg.color = Color(0.06, 0.08, 0.14, 1.0)
	bg.anchor_right = 1.0
	bg.anchor_bottom = 1.0
	add_child(bg)

	# ── Center container ──
	var center = VBoxContainer.new()
	center.anchor_left = 0.5
	center.anchor_top = 0.5
	center.anchor_right = 0.5
	center.anchor_bottom = 0.5
	center.offset_left = -200
	center.offset_top = -180
	center.offset_right = 200
	center.offset_bottom = 180
	center.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_theme_constant_override("separation", 14)
	add_child(center)

	# ── Header row ──
	var header = HBoxContainer.new()
	header.alignment = BoxContainer.ALIGNMENT_CENTER
	header.add_theme_constant_override("separation", 20)
	center.add_child(header)

	score_label = Label.new()
	score_label.text = "Score: 0"
	score_label.add_theme_font_size_override("font_size", 20)
	score_label.add_theme_color_override("font_color", Color(1, 0.85, 0.24))
	header.add_child(score_label)

	combo_label = Label.new()
	combo_label.text = ""
	combo_label.add_theme_font_size_override("font_size", 18)
	combo_label.add_theme_color_override("font_color", Color(1, 0.42, 0.42))
	header.add_child(combo_label)

	# ── Progress ──
	progress_bar = ProgressBar.new()
	progress_bar.max_value = challenges.size()
	progress_bar.value = 0
	progress_bar.custom_minimum_size = Vector2(300, 14)
	progress_bar.show_percentage = false
	center.add_child(progress_bar)

	# ── Prompt ──
	prompt_label = Label.new()
	prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	prompt_label.add_theme_font_size_override("font_size", 26)
	prompt_label.add_theme_color_override("font_color", Color.WHITE)
	prompt_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	center.add_child(prompt_label)

	# ── Spacer ──
	var spacer = Control.new()
	spacer.custom_minimum_size = Vector2(0, 10)
	center.add_child(spacer)

	# ── Option buttons ──
	var btn_row = HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 24)
	center.add_child(btn_row)

	btn_a = _make_option_btn()
	btn_a.pressed.connect(func(): _pick(0))
	btn_row.add_child(btn_a)

	btn_b = _make_option_btn()
	btn_b.pressed.connect(func(): _pick(1))
	btn_row.add_child(btn_b)

	# ── Feedback ──
	feedback_label = Label.new()
	feedback_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	feedback_label.add_theme_font_size_override("font_size", 22)
	feedback_label.add_theme_color_override("font_color", Color.GREEN)
	center.add_child(feedback_label)

	# ── Done panel (hidden) ──
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

func _make_option_btn() -> Button:
	var btn = Button.new()
	btn.custom_minimum_size = Vector2(120, 120)
	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.15, 0.17, 0.22)
	style.corner_radius_top_left = 18
	style.corner_radius_top_right = 18
	style.corner_radius_bottom_left = 18
	style.corner_radius_bottom_right = 18
	style.border_width_left = 3
	style.border_width_right = 3
	style.border_width_top = 3
	style.border_width_bottom = 3
	style.border_color = Color(0.3, 0.35, 0.4)
	btn.add_theme_stylebox_override("normal", style)
	var hover_style = style.duplicate()
	hover_style.border_color = Color(0.3, 0.8, 0.75)
	btn.add_theme_stylebox_override("hover", hover_style)
	btn.add_theme_font_size_override("font_size", 42)
	btn.add_theme_color_override("font_color", Color.WHITE)
	return btn

func _show_round() -> void:
	if current_round >= challenges.size():
		_show_done()
		return
	var c = challenges[current_round]
	prompt_label.text = c["prompt"]
	btn_a.text = c["options"][0]
	btn_b.text = c["options"][1]
	btn_a.visible = true
	btn_b.visible = true
	feedback_label.text = ""
	progress_bar.value = current_round
	score_label.text = "Score: %d" % score
	combo_label.text = "🔥 x%d" % combo if combo > 1 else ""

func _pick(idx: int) -> void:
	if waiting:
		return
	waiting = true
	var c = challenges[current_round]
	var chosen = c["options"][idx]
	var correct = chosen == c["answer"]

	# Button click animation
	var btn = btn_a if idx == 0 else btn_b
	var b_tween = create_tween()
	b_tween.tween_property(btn, "scale", Vector2(0.9, 0.9), 0.1)
	b_tween.tween_property(btn, "scale", Vector2(1.0, 1.0), 0.1)

	if correct:
		var pts = 10 + combo * 5
		score += pts
		combo += 1
		feedback_label.add_theme_color_override("font_color", Color(0.4, 1.0, 0.5))
		var praises = ["Awesome!", "Great Job!", "Smart Move!", "Incredible!", "You're on Fire!"]
		var praise = praises[randi() % praises.size()] if combo > 1 else "Correct!"
		feedback_label.text = "🎉 %s +%d" % [praise, pts]

		# Animate feedback label pop
		feedback_label.scale = Vector2(0.5, 0.5)
		var f_tween = create_tween()
		f_tween.tween_property(feedback_label, "scale", Vector2(1.2, 1.2), 0.2).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		f_tween.tween_property(feedback_label, "scale", Vector2(1.0, 1.0), 0.1)
	else:
		combo = 0
		feedback_label.add_theme_color_override("font_color", Color(1.0, 0.6, 0.4))
		var near_misses = ["Almost had it!", "Good try!", "So close!", "Next time!"]
		feedback_label.text = "💫 %s It was: %s" % [near_misses[randi() % near_misses.size()], c["answer"]]
		
		# Shake feedback
		var s_tween = create_tween()
		s_tween.tween_property(feedback_label, "position:x", feedback_label.position.x + 10, 0.05)
		s_tween.tween_property(feedback_label, "position:x", feedback_label.position.x - 10, 0.05)
		s_tween.tween_property(feedback_label, "position:x", feedback_label.position.x + 10, 0.05)
		s_tween.tween_property(feedback_label, "position:x", feedback_label.position.x, 0.05)

	score_label.text = "Score: %d" % score
	combo_label.text = "🔥 Streak x%d" % combo if combo > 1 else ""
	if combo >= 3:
		combo_label.add_theme_color_override("font_color", Color(1.0, 0.8, 0.2)) # Go gold on high streak
	else:
		combo_label.add_theme_color_override("font_color", Color(1, 0.42, 0.42))

	await get_tree().create_timer(1.0).timeout
	waiting = false
	current_round += 1
	_show_round()

func _show_done() -> void:
	prompt_label.text = ""
	btn_a.visible = false
	btn_b.visible = false
	progress_bar.value = challenges.size()
	feedback_label.text = ""

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
	title.text = "Game Over!"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 28)
	title.add_theme_color_override("font_color", Color.WHITE)
	anim_box.add_child(title)

	# ── Score text ──
	var score_lbl = Label.new()
	score_lbl.text = "%d points" % score
	score_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	score_lbl.add_theme_font_size_override("font_size", 24)
	score_lbl.add_theme_color_override("font_color", Color(1, 0.85, 0.24))
	anim_box.add_child(score_lbl)

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
	style.bg_color = Color(0.18, 0.77, 0.71)
	style.corner_radius_top_left = 16
	style.corner_radius_top_right = 16
	style.corner_radius_bottom_left = 16
	style.corner_radius_bottom_right = 16
	done_btn.add_theme_stylebox_override("normal", style)
	done_btn.add_theme_color_override("font_color", Color.WHITE)
	done_btn.add_theme_font_size_override("font_size", 16)
	done_btn.pressed.connect(func(): game_finished.emit(score))
	
	# Button pulses slightly to attract clicks
	var pulse = create_tween().set_loops()
	done_btn.pivot_offset = Vector2(90, 25)
	pulse.tween_property(done_btn, "scale", Vector2(1.05, 1.05), 0.8).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(done_btn, "scale", Vector2(1.0, 1.0), 0.8).set_trans(Tween.TRANS_SINE)
	
	done_panel.add_child(done_btn)
	done_panel.visible = true
