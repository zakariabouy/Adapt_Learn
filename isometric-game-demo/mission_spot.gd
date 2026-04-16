# mission_spot.gd — The floating-arrow marker in the world
# Uses Arrow.png from decorations/ for the visual indicator.
extends Area2D

var mission_data: Dictionary = {}
var player_inside: bool = false
var arrow_sprite: Sprite2D
var label_node: Label
var prompt_node: Label
var tween_ref: Tween

func setup(data: Dictionary, world_pos: Vector2) -> void:
	mission_data = data
	position = world_pos
	name = "MissionSpot_" + data.get("id", "unknown")

func _ready() -> void:
	# ── Collision shape (circle, radius 45) ──
	var shape = CircleShape2D.new()
	shape.radius = 45.0
	var col = CollisionShape2D.new()
	col.shape = shape
	add_child(col)

	# ── Arrow sprite from Arrow.png ──
	arrow_sprite = Sprite2D.new()
	var arrow_tex = load("res://decorations/Arrow.png")
	arrow_sprite.texture = arrow_tex
	arrow_sprite.position = Vector2(0, -60)
	arrow_sprite.scale = Vector2(0.07, 0.07)
	# Tint the arrow with the mission's color
	var col_value: Color = mission_data.get("color", Color(1, 0.85, 0.24))
	arrow_sprite.modulate = col_value
	add_child(arrow_sprite)

	# ── Glow circle on the ground ──
	var glow_circle = Polygon2D.new()
	var pts: PackedVector2Array = PackedVector2Array()
	for i in range(24):
		var angle = i * (TAU / 24.0)
		pts.append(Vector2(cos(angle), sin(angle)) * 30.0)
	glow_circle.polygon = pts
	glow_circle.color = Color(col_value.r, col_value.g, col_value.b, 0.25)
	glow_circle.position = Vector2(0, 0)
	add_child(glow_circle)

	# ── Pixel font ──
	var pixel_font = load("res://games/frogger/fonts/Better VCR 9.0.1.ttf")

	# ── Game name label ──
	label_node = Label.new()
	var icon = mission_data.get("icon", "")
	var label_text = mission_data.get("name", "Mission")
	if icon != "":
		label_text = icon + " " + label_text
	label_node.text = label_text
	label_node.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label_node.position = Vector2(-60, -95)
	label_node.size = Vector2(120, 20)
	label_node.add_theme_font_override("font", pixel_font)
	label_node.add_theme_font_size_override("font_size", 10)
	label_node.add_theme_color_override("font_color", Color.WHITE)
	label_node.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	label_node.add_theme_constant_override("shadow_offset_x", 1)
	label_node.add_theme_constant_override("shadow_offset_y", 1)
	add_child(label_node)

	# ── "Press E" prompt (hidden until player is near) ──
	prompt_node = Label.new()
	prompt_node.text = "[ E ] to play"
	prompt_node.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	prompt_node.position = Vector2(-50, -40)
	prompt_node.size = Vector2(100, 20)
	prompt_node.add_theme_font_override("font", pixel_font)
	prompt_node.add_theme_font_size_override("font_size", 9)
	prompt_node.add_theme_color_override("font_color", Color(1, 1, 0.6))
	prompt_node.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	prompt_node.add_theme_constant_override("shadow_offset_x", 1)
	prompt_node.add_theme_constant_override("shadow_offset_y", 1)
	prompt_node.visible = false
	add_child(prompt_node)

	# ── Signals ──
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

	# ── Start the bobbing animation ──
	_start_bob()

func _start_bob() -> void:
	tween_ref = create_tween().set_loops()
	tween_ref.tween_property(arrow_sprite, "position:y", -70.0, 0.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tween_ref.tween_property(arrow_sprite, "position:y", -50.0, 0.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

func _on_body_entered(body: Node) -> void:
	if body is CharacterBody2D:
		player_inside = true
		prompt_node.visible = true

func _on_body_exited(body: Node) -> void:
	if body is CharacterBody2D:
		player_inside = false
		prompt_node.visible = false

func _unhandled_input(event: InputEvent) -> void:
	if player_inside and event.is_action_pressed("interact"):
		GameManager.request_interact(mission_data)
