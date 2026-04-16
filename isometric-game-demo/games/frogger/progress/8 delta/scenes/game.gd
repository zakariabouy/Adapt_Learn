extends Node2D

var car_scene: PackedScene = preload("res://games/frogger/scenes/car.tscn")

func _on_finish_area_2d_body_entered(body: Node2D) -> void:
	print(body)
	print("has entered")


func _on_car_timer_timeout() -> void:
	var car = car_scene.instantiate() as Area2D
	var pos_marker = $CarStartPositions.get_children().pick_random() as Marker2D
	car.position = pos_marker.position
	$Objects.add_child(car)
	
