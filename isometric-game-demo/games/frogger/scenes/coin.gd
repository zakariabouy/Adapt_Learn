extends Area2D

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D) -> void:
	if body.name == "Player":
		var root = get_tree().current_scene
		if root and root.has_method("_add_coin_score"):
			root._add_coin_score()
		queue_free()
