# exp_bar.gd — HUD: EXP bar (top-left) + Shop & Coins (top-right)
extends CanvasLayer

var bar: ProgressBar
var label: Label
var coin_label: Label

var current_exp: int = 70
var exp_to_next_level: int = 100
var level: int = 1
var coins: int = 145

func _ready() -> void:
	layer = 5

	# ═══════════════════════════════════════
	#  TOP-LEFT: EXP Bar
	# ═══════════════════════════════════════
	var exp_container = MarginContainer.new()
	exp_container.anchor_right = 0.0
	exp_container.anchor_bottom = 0.0
	exp_container.offset_left = 12
	exp_container.offset_top = 12
	exp_container.offset_right = 220
	exp_container.offset_bottom = 60
	add_child(exp_container)

	var vbox = VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 2)
	exp_container.add_child(vbox)

	# ── Level label ──
	label = Label.new()
	label.add_theme_font_size_override("font_size", 12)
	label.add_theme_color_override("font_color", Color(1.0, 0.95, 0.7))
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	label.add_theme_constant_override("shadow_offset_x", 1)
	label.add_theme_constant_override("shadow_offset_y", 1)
	vbox.add_child(label)

	# ── Progress bar ──
	bar = ProgressBar.new()
	bar.min_value = 0
	bar.max_value = exp_to_next_level
	bar.value = current_exp
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(196, 14)

	var bg_style = StyleBoxFlat.new()
	bg_style.bg_color = Color(0.12, 0.1, 0.15, 0.85)
	bg_style.border_color = Color(0.45, 0.35, 0.2)
	bg_style.set_border_width_all(1)
	bg_style.set_corner_radius_all(3)
	bar.add_theme_stylebox_override("background", bg_style)

	var fill_style = StyleBoxFlat.new()
	fill_style.bg_color = Color(0.95, 0.75, 0.2)
	fill_style.set_corner_radius_all(2)
	bar.add_theme_stylebox_override("fill", fill_style)

	vbox.add_child(bar)

	# ═══════════════════════════════════════
	#  TOP-RIGHT: Shop icon + Coins
	# ═══════════════════════════════════════
	var shop_container = HBoxContainer.new()
	shop_container.anchor_left = 1.0
	shop_container.anchor_right = 1.0
	shop_container.anchor_top = 0.0
	shop_container.anchor_bottom = 0.0
	shop_container.offset_left = -250
	shop_container.offset_top = 8
	shop_container.offset_right = -12
	shop_container.offset_bottom = 80
	shop_container.alignment = BoxContainer.ALIGNMENT_END
	shop_container.add_theme_constant_override("separation", 8)
	add_child(shop_container)

	# ── Coin icon (coin.png) ──
	var coin_tex = load("res://decorations/coin.png")
	var coin_icon = TextureRect.new()
	coin_icon.texture = coin_tex
	coin_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	coin_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	coin_icon.custom_minimum_size = Vector2(56, 56)
	shop_container.add_child(coin_icon)

	# ── Coin count ──
	coin_label = Label.new()
	coin_label.text = str(coins)
	coin_label.add_theme_font_size_override("font_size", 16)
	coin_label.add_theme_color_override("font_color", Color(1.0, 0.85, 0.3))
	coin_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	coin_label.add_theme_constant_override("shadow_offset_x", 1)
	coin_label.add_theme_constant_override("shadow_offset_y", 1)
	coin_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	shop_container.add_child(coin_label)

	# ── Spacer ──
	var spacer = Control.new()
	spacer.custom_minimum_size = Vector2(6, 0)
	shop_container.add_child(spacer)

	# ── Shop button (shop.png) ──
	var shop_tex = load("res://decorations/shop.png")
	var shop_btn = TextureButton.new()
	shop_btn.texture_normal = shop_tex
	shop_btn.ignore_texture_size = true
	shop_btn.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	shop_btn.custom_minimum_size = Vector2(72, 72)
	shop_btn.tooltip_text = "Shop"
	shop_container.add_child(shop_btn)

	# ── Init display ──
	_update_display()

	# Listen for mission completions
	GameManager.mission_completed.connect(_on_mission_completed)

func _on_mission_completed(_mission_id: String) -> void:
	add_exp(10)
	add_coins(5)

func add_exp(amount: int) -> void:
	current_exp += amount
	while current_exp >= exp_to_next_level:
		current_exp -= exp_to_next_level
		level += 1
		exp_to_next_level = 100 * level
	_update_display()

func add_coins(amount: int) -> void:
	coins += amount
	coin_label.text = str(coins)

func _update_display() -> void:
	bar.max_value = exp_to_next_level
	bar.value = current_exp
	label.text = "Lv. %d  EXP %d / %d" % [level, current_exp, exp_to_next_level]
