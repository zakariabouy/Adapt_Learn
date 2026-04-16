extends Node2D

signal game_finished(score: int)

var score: int = 0
var stress_level: float = 0.0
var car_scene = preload("res://games/frogger/scenes/car.tscn")
var lanes = [164, 141, 114, 93, 3, -25, -51, -94, -115]
var cleared_lanes = []

func _ready() -> void:
	$CanvasLayer/ScoreLabel.text = "0"
	$CanvasLayer/StressBar.value = 0.0
	$CanvasLayer/PauseMenu.visible = false
	
	var path = ProjectSettings.globalize_path("res://games/frogger/graphics/stress_popup.png")
	if FileAccess.file_exists(path):
		var img = Image.load_from_file(path)
		if img != null:
			var tex = ImageTexture.create_from_image(img)
			var style = StyleBoxTexture.new()
			style.texture = tex
			$CanvasLayer/PauseMenu.add_theme_stylebox_override("panel", style)
			if has_node("CanvasLayer/PauseMenu/Label"):
				$CanvasLayer/PauseMenu/Label.visible = false

func _process(delta: float) -> void:
	if has_node("Objects/Player") and not get_tree().paused:
		var py = $Objects/Player.position.y
		for lane in lanes:
			if py < lane and not cleared_lanes.has(lane):
				cleared_lanes.append(lane)
				score += 1
				$CanvasLayer/ScoreLabel.text = str(score)
	
	if Input.is_action_pressed("ui_up") and Input.is_key_pressed(KEY_SHIFT):
		if not get_tree().paused:
			stress_level += 50.0 * delta
	if Input.is_action_pressed("ui_down") and Input.is_key_pressed(KEY_SHIFT):
		stress_level -= 50.0 * delta
		
	stress_level = clamp(stress_level, 0.0, 100.0)
	$CanvasLayer/StressBar.value = stress_level
	
	if stress_level >= 100.0 and not get_tree().paused:
		_trigger_stress_pause()
	elif stress_level < 80.0 and get_tree().paused:
		_resume_from_stress()

func _trigger_stress_pause() -> void:
	get_tree().paused = true
	$CanvasLayer/PauseMenu.visible = true
	if $Audio/SFX_StressMax.stream:
		$Audio/SFX_StressMax.play()

func _resume_from_stress() -> void:
	get_tree().paused = false
	$CanvasLayer/PauseMenu.visible = false
	score += 5
	$CanvasLayer/ScoreLabel.text = str(score)

var last_spawn_time = {}

func _on_car_timer_timeout() -> void:
	var markers = $CarStartPositions.get_children()
	var current_time = Time.get_ticks_msec()
	
	var safe_markers = []
	for marker in markers:
		if not last_spawn_time.has(marker) or (current_time - last_spawn_time[marker]) > 1000:
			safe_markers.append(marker)
			
	if safe_markers.size() > 0:
		var spawner = safe_markers[randi() % safe_markers.size()]
		last_spawn_time[spawner] = current_time
		var car = car_scene.instantiate()
		car.position = spawner.position
		add_child(car)

func _on_goal_reached() -> void:
	cleared_lanes.clear()
	$CanvasLayer/WinPopup.visible = true
	if $Audio/SFX_Win.stream:
		$Audio/SFX_Win.play()
	await get_tree().create_timer(2.0).timeout
	$CanvasLayer/WinPopup.visible = false
	game_finished.emit(score)

func _add_coin_score() -> void:
	score += 5
	$CanvasLayer/ScoreLabel.text = str(score)
	if $Audio/SFX_Win.stream:
		$Audio/SFX_Win.play()

func reset_score() -> void:
	score = 0
	cleared_lanes.clear()
	$CanvasLayer/ScoreLabel.text = "0"



