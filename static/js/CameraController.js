/**
 * CameraController.js
 * A class for controlling camera movement along a spline path
 */

// CameraController class - handles camera movement along a spline path
function CameraController(camera, target) {
    this.camera = camera;
    this.target = target; // The object to follow (e.g., cone)
    this.offset = new THREE.Vector3(0, 5, 25); // Default camera offset
    this.lookAhead = 0.01; // How far ahead to look
    this.smoothing = 0.05; // Camera movement smoothing factor
    this.currentPosition = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
}

// Initialize the camera controller
CameraController.prototype.init = function() {
    // Set initial camera position
    this.camera.position.set(0, 2, 50);
    this.camera.lookAt(0, 0, 0);
    
    // Store initial positions
    this.currentPosition.copy(this.camera.position);
    this.currentLookAt.set(0, 0, 0);
};

// Update camera position based on target and spline
// Camera is always behind and above the character, always looks forward (+Z), never flips
CameraController.prototype.update = function(splineLoader, progress) {
    if (!splineLoader || !splineLoader.cameraPath) return;
    try {
        // Ensure progress is within valid range
        const safeProgress = Math.max(0, Math.min(progress, 1));
        
        // Get current position on the path
        const pathPosition = splineLoader.getPointOnPath(safeProgress);
        if (!pathPosition) {
            console.warn('Failed to get path position at progress:', safeProgress);
            return;
        }

        // Log position occasionally for debugging
        if (Math.random() < 0.05) { // Only log 1% of the time to avoid console spam
            console.log(`Camera following path at progress: ${safeProgress.toFixed(3)}`, pathPosition);
        }

        // Use the configured camera offset from this.offset
        const desiredPosition = pathPosition.clone().add(this.offset);
        
        // Use adaptive smoothing based on distance and vertical movement
        const distance = this.currentPosition.distanceTo(desiredPosition);
        
        // Calculate vertical distance separately for more gentle Y transitions
        const verticalDistance = Math.abs(this.currentPosition.y - desiredPosition.y);
        
        // Use different smoothing factors for horizontal and vertical movement
        // Horizontal movement can be faster, vertical should be more gradual
        const horizontalSmoothing = distance > 20 ? 0.15 : 0.05;
        
        // Make vertical transitions extra smooth - lower values = smoother
        // Use an extremely low smoothing factor for vertical movement to prevent abrupt changes
        const verticalSmoothing = Math.min(0.008, 0.005 + (0.005 * (1 - Math.min(verticalDistance / 15, 1))));
        
        // Log offset occasionally for debugging
        if (Math.random() < 0.005) {
            console.log('Camera offset:', this.offset);
            console.log('Vertical distance:', verticalDistance);
            console.log('Vertical smoothing:', verticalSmoothing);
        }
        
        // Apply horizontal smoothing to X and Z
        this.currentPosition.x += (desiredPosition.x - this.currentPosition.x) * horizontalSmoothing;
        this.currentPosition.z += (desiredPosition.z - this.currentPosition.z) * horizontalSmoothing;
        
        // Apply extra-smooth vertical transition to Y
        this.currentPosition.y += (desiredPosition.y - this.currentPosition.y) * verticalSmoothing;
        
        this.camera.position.copy(this.currentPosition);

        // Always look at a point ahead of the character's position
        // Use the lookAhead property to control how far ahead to look
        const lookAtTarget = pathPosition.clone().add(new THREE.Vector3(0, 1, -this.offset.z * 0.1)); // Look ahead proportional to offset
        this.currentLookAt.lerp(lookAtTarget, horizontalSmoothing);
        this.camera.up.set(0, 1, 0); // Ensure Y is always up
        this.camera.lookAt(this.currentLookAt);
        this.camera.rotation.z = 0; // Prevent camera roll

        // Update target (player) position
        if (this.target) {
            this.target.position.copy(pathPosition);
        }
    } catch (error) {
        console.error('Error updating camera:', error);
    }
};

// Set camera offset (distance from target)
CameraController.prototype.setOffset = function(x, y, z) {
    this.offset.set(x, y, z);
    console.log('Camera offset set to:', this.offset);
    return this; // Allow method chaining
};

// Adjust camera offset (add to current offset)
CameraController.prototype.adjustOffset = function(x, y, z) {
    this.offset.x += x || 0;
    this.offset.y += y || 0;
    this.offset.z += z || 0;
    console.log('Camera offset adjusted to:', this.offset);
    return this; // Allow method chaining
};

// Reset camera position immediately (no lerping)
CameraController.prototype.resetPosition = function(pathPosition) {
    if (!pathPosition) return this;
    
    // Immediately set camera position without lerping
    const newPosition = pathPosition.clone().add(this.offset);
    this.currentPosition.copy(newPosition);
    this.camera.position.copy(newPosition);
    
    // Also reset look target
    const lookAtTarget = pathPosition.clone().add(new THREE.Vector3(0, 1, -this.offset.z * 0.1));
    this.currentLookAt.copy(lookAtTarget);
    this.camera.lookAt(this.currentLookAt);
    
    console.log('Camera position reset to:', newPosition);
    return this; // Allow method chaining
};

// Set how far ahead the camera should look
CameraController.prototype.setLookAhead = function(value) {
    this.lookAhead = value;
};

// Set smoothing factor for camera movement
CameraController.prototype.setSmoothing = function(value) {
    this.smoothing = Math.max(0, Math.min(1, value));
};

// Export the CameraController class
window.CameraController = CameraController;
