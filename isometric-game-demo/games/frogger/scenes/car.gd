extends Area2D

var direction: Vector2 = Vector2.LEFT
var speed: float = 100.0

var textures = [
	preload("res://games/frogger/graphics/cars/green.png"),
	preload("res://games/frogger/graphics/cars/red.png"),
	preload("res://games/frogger/graphics/cars/yellow.png")
]

func _ready() -> void:
	$Sprite2D.texture = textures[randi() % textures.size()]
	
	if position.x < 0:
		direction = Vector2.RIGHT
		$Sprite2D.flip_h = true

func _process(delta: float) -> void:
	position += direction * speed * delta

func _on_screen_exited() -> void:
	queue_free()
