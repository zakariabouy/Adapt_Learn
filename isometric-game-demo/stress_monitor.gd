# stress_monitor.gd — Autoload singleton that connects to ESP32 WebSocket
# SETUP: Add to Autoload as "StressMonitor"
#        Change ESP32_IP to your ESP32's IP address (shown in Serial Monitor)
extends Node

# ─── CONFIG ───
const ESP32_IP: String = "192.168.1.100"  # ← Change to your ESP32's IP
const ESP32_PORT: int = 81

# ─── Signals ───
signal stress_updated(level: float)         # 0.0 = relaxed, 1.0 = max stress
signal stress_alert(is_stressed: bool)      # true when above threshold
signal connection_changed(connected: bool)

# ─── Stress thresholds ───
const STRESS_THRESHOLD: float = 0.65        # above this = "stressed"
const CALM_THRESHOLD: float = 0.35          # below this after being stressed = "calmed down"

# ─── State ───
var stress: float = 0.0
var raw_emg: int = 0
var is_stressed: bool = false
var is_connected: bool = false
var _socket: WebSocketPeer = WebSocketPeer.new()
var _was_stressed: bool = false

# ─── Demo mode (when no ESP32 is connected) ───
var demo_mode: bool = true
var _demo_stress: float = 0.2
var _demo_dir: float = 0.01

func _ready() -> void:
	_try_connect()

func _try_connect() -> void:
	var url = "ws://%s:%d" % [ESP32_IP, ESP32_PORT]
	var err = _socket.connect_to_url(url)
	if err != OK:
		print("StressMonitor: Cannot connect to ESP32 at %s — running in DEMO mode" % url)
		print("StressMonitor: Press UP/DOWN arrows to simulate stress in demo mode")
		demo_mode = true
	else:
		print("StressMonitor: Connecting to ESP32 at %s..." % url)

func _process(delta: float) -> void:
	if demo_mode:
		_process_demo(delta)
		return

	_socket.poll()
	var state = _socket.get_ready_state()

	match state:
		WebSocketPeer.STATE_OPEN:
			if not is_connected:
				is_connected = true
				demo_mode = false
				connection_changed.emit(true)
				print("StressMonitor: Connected to ESP32!")

			while _socket.get_available_packet_count() > 0:
				var data = _socket.get_packet().get_string_from_utf8()
				_parse_data(data)

		WebSocketPeer.STATE_CLOSED:
			if is_connected:
				is_connected = false
				connection_changed.emit(false)
				print("StressMonitor: Disconnected from ESP32, switching to demo mode")
			demo_mode = true

		WebSocketPeer.STATE_CONNECTING:
			pass  # still connecting

func _parse_data(json_str: String) -> void:
	var json = JSON.new()
	var err = json.parse(json_str)
	if err != OK:
		return
	var data = json.get_data()
	if data is Dictionary:
		if "stress" in data:
			stress = clamp(float(data["stress"]), 0.0, 1.0)
			raw_emg = int(data.get("raw", 0))
			_check_stress()
			stress_updated.emit(stress)

func _check_stress() -> void:
	if not is_stressed and stress >= STRESS_THRESHOLD:
		is_stressed = true
		stress_alert.emit(true)
	elif is_stressed and stress <= CALM_THRESHOLD:
		is_stressed = false
		stress_alert.emit(false)

# ─── Demo mode: simulate stress with keyboard ───
func _process_demo(delta: float) -> void:
	# Auto-drift stress slightly
	_demo_stress += _demo_dir * delta * 0.5
	if _demo_stress > 0.9:
		_demo_dir = -abs(_demo_dir)
	elif _demo_stress < 0.1:
		_demo_dir = abs(_demo_dir)

	stress = clamp(_demo_stress, 0.0, 1.0)
	_check_stress()
	stress_updated.emit(stress)

func _unhandled_input(event: InputEvent) -> void:
	if not demo_mode:
		return
	# In demo mode: Shift+Up = increase stress, Shift+Down = decrease
	if event is InputEventKey and event.pressed:
		if event.keycode == KEY_UP and event.shift_pressed:
			_demo_stress = clamp(_demo_stress + 0.15, 0.0, 1.0)
		elif event.keycode == KEY_DOWN and event.shift_pressed:
			_demo_stress = clamp(_demo_stress - 0.15, 0.0, 1.0)

# ─── Public API ───
func get_stress() -> float:
	return stress

func is_player_stressed() -> bool:
	return is_stressed

func calibrate_low() -> void:
	if is_connected:
		_socket.send_text("CAL_LOW")

func calibrate_high() -> void:
	if is_connected:
		_socket.send_text("CAL_HIGH")
