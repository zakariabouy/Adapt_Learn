# mission_spawner.gd — Spawns floating-arrow MissionSpots on the map
# Only removes the specific completed arrow, not all of them.
extends Node2D

const MissionSpotScript = preload("res://mission_spot.gd")

# Maps mission_id → the spawned node
var spot_map: Dictionary = {}

func _ready() -> void:
	GameManager.mission_completed.connect(_on_mission_completed)
	# Spawn initial arrows after a frame so the scene tree is ready
	call_deferred("_spawn_initial")

func _spawn_initial() -> void:
	var missions = GameManager.active_missions
	var slots = GameManager.spawn_slots

	for i in range(missions.size()):
		if i >= slots.size():
			break
		_spawn_one(missions[i], slots[i])

func _spawn_one(data: Dictionary, slot: Vector2) -> void:
	var spot = Area2D.new()
	spot.set_script(MissionSpotScript)
	spot.setup(data, slot)
	spot.collision_layer = 0
	spot.collision_mask = 1
	add_child(spot)
	spot_map[data["id"]] = spot

func _on_mission_completed(mission_id: String) -> void:
	# Only remove the one arrow that was completed
	if mission_id in spot_map:
		var node = spot_map[mission_id]
		if is_instance_valid(node):
			node.queue_free()
		spot_map.erase(mission_id)
