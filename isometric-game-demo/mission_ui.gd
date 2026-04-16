# mission_ui.gd — Popup with pixel-art assets + launches mini-games
extends CanvasLayer

const LetterFlipGame = preload("res://games/letter_flip_game.gd")
const DoseDodgeGame = preload("res://games/dose_dodge_game.gd")
const StressRunnerGame = preload("res://games/stress_runner_game.gd")
const MysticWoodsGame = preload("res://games/mystic_woods_game.gd")

var GAME_MAP: Dictionary = {
	# Frogger
	"fr1": "res://games/frogger/scenes/game.tscn",
	# Dyslexia
	"g1": LetterFlipGame,
	"g2": DoseDodgeGame,
	"g3": LetterFlipGame,
	"g6": DoseDodgeGame,
	# ADHD — stress runner (focus + calm under pressure)
	"a1": StressRunnerGame,
	"a2": StressRunnerGame,
	"a3": StressRunnerGame,
	"a4": StressRunnerGame,
	# Anxiety — Mystic Woods + calm-down missions
	"mw1": MysticWoodsGame,
	"n1": StressRunnerGame,
	"n2": StressRunnerGame,
	"n3": StressRunnerGame,
	"n4": StressRunnerGame,
	# Autism
	"u1": DoseDodgeGame,
	"u2": LetterFlipGame,
	"u3": DoseDodgeGame,
	"u4": LetterFlipGame,
}

var current_mission: Dictionary = {}
var active_game_node: Node = null

var overlay: ColorRect
var popup_bg: TextureRect
var icon_label: Label
var title_label: Label
var desc_label: Label
var open_btn: TextureButton
var close_btn: TextureButton

func _ready() -> void:
	layer = 10

	# ── Dark overlay ──
	overlay = ColorRect.new()
	overlay.color = Color(0, 0, 0, 0.6)
	overlay.anchor_right = 1.0
	overlay.anchor_bottom = 1.0
	overlay.visible = false
	add_child(overlay)

	# ── Popup background using popup.png ──
	# popup.png is 1515x1426 (ratio ~1.06:1). Viewport is 1152x648.
	# Display at ~380x358 → centered with offsets ±190 × ±179
	popup_bg = TextureRect.new()
	var popup_tex = load("res://decorations/popup.png")
	popup_bg.texture = popup_tex
	popup_bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	popup_bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	popup_bg.anchor_left = 0.5
	popup_bg.anchor_top = 0.5
	popup_bg.anchor_right = 0.5
	popup_bg.anchor_bottom = 0.5
	popup_bg.offset_left = -230
	popup_bg.offset_top = -195
	popup_bg.offset_right = 230
	popup_bg.offset_bottom = 195
	popup_bg.visible = false
	add_child(popup_bg)

	# ── Content container ──
	# The popup.png has an ornate border (~12% each side). Pad inward.
	var content = VBoxContainer.new()
	content.anchor_left = 0.0
	content.anchor_top = 0.0
	content.anchor_right = 1.0
	content.anchor_bottom = 1.0
	content.offset_left = 60
	content.offset_top = 70
	content.offset_right = -60
	content.offset_bottom = -65
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 10)
	popup_bg.add_child(content)

	# ── Icon ──
	icon_label = Label.new()
	icon_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	icon_label.add_theme_font_size_override("font_size", 36)
	content.add_child(icon_label)

	# ── Title ──
	title_label = Label.new()
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.add_theme_font_size_override("font_size", 20)
	title_label.add_theme_color_override("font_color", Color.WHITE)
	content.add_child(title_label)

	# ── Description ──
	desc_label = Label.new()
	desc_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	desc_label.add_theme_font_size_override("font_size", 14)
	desc_label.add_theme_color_override("font_color", Color(0.82, 0.85, 0.89))
	desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	desc_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	content.add_child(desc_label)

	var spacer = Control.new()
	spacer.custom_minimum_size = Vector2(0, 10)
	content.add_child(spacer)

	# ── Buttons row ── (single HBoxContainer, EXPAND_FILL+CENTER = true center)
	var btn_row = HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn_row.add_theme_constant_override("separation", 24)
	content.add_child(btn_row)

	# ── OPEN button: open.png 1239x741 (1.67:1) → 90x54 ──
	open_btn = TextureButton.new()
	var open_tex = load("res://decorations/open.png")
	open_btn.texture_normal = open_tex
	open_btn.ignore_texture_size = true
	open_btn.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	open_btn.custom_minimum_size = Vector2(90, 54)
	open_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	open_btn.pressed.connect(_on_play_pressed)
	btn_row.add_child(open_btn)

	# ── CLOSE button: close.png 1275x733 (1.74:1) → 90x52 ──
	close_btn = TextureButton.new()
	var close_tex = load("res://decorations/close.png")
	close_btn.texture_normal = close_tex
	close_btn.ignore_texture_size = true
	close_btn.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	close_btn.custom_minimum_size = Vector2(90, 52)
	close_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	close_btn.pressed.connect(_on_close_pressed)
	btn_row.add_child(close_btn)

	GameManager.mission_interact.connect(_on_mission_interact)

func _on_mission_interact(data: Dictionary) -> void:
	current_mission = data
	icon_label.text = data.get("icon", "?")
	title_label.text = data.get("name", "Mission")
	desc_label.text = data.get("desc", "Complete this mission!")
	overlay.visible = true
	popup_bg.visible = true

func _on_close_pressed() -> void:
	overlay.visible = false
	popup_bg.visible = false
	current_mission = {}
	GameManager.cancel_interact()

func _on_play_pressed() -> void:
	overlay.visible = false
	popup_bg.visible = false

	var mission_id: String = current_mission.get("id", "")

	# ── Web bridge: the mw1 arrow triggers the VARK assessment in the host app ──
	# When the Godot build is embedded in the AdaptLearn Next.js iframe, we post
	# a message to the parent window so it can route the student to /student/vark
	# instead of launching an in-engine mini-game.
	if mission_id == "mw1" and OS.has_feature("web"):
		GameManager._post_to_host({ "type": "open_vark" })
		GameManager.cancel_interact()
		current_mission = {}
		return

	var game_script = GAME_MAP.get(mission_id, LetterFlipGame)

	if typeof(game_script) == TYPE_STRING:
		var scene_res = load(game_script)
		active_game_node = scene_res.instantiate()
		get_tree().root.add_child(active_game_node)
	else:
		active_game_node = CanvasLayer.new()
		active_game_node.set_script(game_script)
		get_tree().root.add_child(active_game_node)
	
	if active_game_node.has_signal("game_finished"):
		active_game_node.game_finished.connect(_on_game_finished.bind(mission_id))
	elif active_game_node is Node2D:
		# Just in case the script is loaded but type checker isn't seeing signal
		active_game_node.connect("game_finished", _on_game_finished.bind(mission_id))

func _on_game_finished(game_score: int, mission_id: String) -> void:
	if active_game_node and is_instance_valid(active_game_node):
		active_game_node.queue_free()
		active_game_node = null

	GameManager.complete(mission_id)

	var sfx = get_node_or_null("SFX")
	if sfx and sfx is AudioStreamPlayer and sfx.stream:
		sfx.play()
