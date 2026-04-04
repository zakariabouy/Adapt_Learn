from shared.models import TelemetryEvent, EngagementState

def classify_engagement(event: TelemetryEvent) -> EngagementState:
    """
    Classify the student's engagement state based on telemetry data.
    """
    # DISTRACTED if tab_focused is False AND time_on_page > 30
    if not event.tabFocused and event.timeOnPage > 30:
        return EngagementState.DISTRACTED
    
    # BORED if scroll_velocity > 800
    if event.scrollVelocity > 800:
        return EngagementState.BORED
    
    # FRUSTRATED if click_count > 8 AND response_latency > 5000
    if event.clickCount > 8 and (event.responseLatency or 0) > 5000:
        return EngagementState.FRUSTRATED
    
    # ENGAGED if scroll_velocity is between 50 and 400 AND tab_focused is True
    if 50 <= event.scrollVelocity <= 400 and event.tabFocused:
        return EngagementState.ENGAGED
    
    # NEUTRAL as the default fallback
    return EngagementState.NEUTRAL

def should_trigger(state: EngagementState) -> bool:
    """
    Determine if an adaptation trigger should be fired based on the engagement state.
    Returns True if the state is anything other than ENGAGED or NEUTRAL.
    """
    return state not in [EngagementState.ENGAGED, EngagementState.NEUTRAL]
