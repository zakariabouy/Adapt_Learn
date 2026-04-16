extends CharacterBody2D

var speed: float = 150.0
var start_position: Vector2
var was_moving = false
var bubble_timer: float = 3.0

func _ready() -> void:
	start_position = position
	$Hitbox.area_entered.connect(_on_area_entered)

func _process(delta: float) -> void:
	if has_node("GoalBubble"):
		bubble_timer -= delta
		if bubble_timer <= 0:
			$GoalBubble.queue_free()

func _physics_process(_delta: float) -> void:
	var direction = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	velocity = direction * speed
	
	var is_moving = velocity.length() > 0
	if is_moving and not was_moving:
		var root = get_tree().current_scene
		if root and root.has_node("Audio/SFX_Step"):
			var sfx = root.get_node("Audio/SFX_Step")
			if sfx.stream:
				sfx.play()
	was_moving = is_moving
	
	move_and_slide()

func _on_area_entered(area: Area2D) -> void:
	if area.is_in_group("cars"):
		die()
	elif area.name == "FinishArea2D":
		position = start_position
		var root = get_tree().current_scene
		if root and root.has_method("_on_goal_reached"):
			root._on_goal_reached()

func die() -> void:
	position = start_position
	var root = get_tree().current_scene
	if root and root.has_node("Audio/SFX_Death"):
		var sfx = root.get_node("Audio/SFX_Death")
		if sfx.stream:
			sfx.play()
	if root and root.has_method("reset_score"):
		root.reset_score()
