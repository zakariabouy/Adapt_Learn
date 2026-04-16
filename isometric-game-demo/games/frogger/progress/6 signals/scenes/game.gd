extends Node2D


func _on_finish_area_2d_body_entered(body: Node2D) -> void:
	print(body)
	print("has entered")
