/**
 * CameraController.js
 * A class for controlling camera movement along a spline path
 */

// CameraController class - handles camera movement along a spline path
function CameraController(camera, target) {
    this.camera = camera;
    this.target = target; // The object to follow (e.g., cone)
    this.offset = new THREE.Vector3(0, 2, 15); // Default camera offset
    this.lookAhead = 0.01; // How far ahead to look
    this.smoothing = 0.01; // Camera movement smoothing factor
    this.currentPosition = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
}

// Initialize the camera controller
CameraController.prototype.init = function() {
    // Set initial camera position
    this.camera.position.set(0, 2, 10);
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
        // Get current position on the path
        const pathPosition = splineLoader.getPointOnPath(progress);
        if (!pathPosition) return;

        // Camera offset: always in front (+Z) and above (+Y) the character (reverse direction)
        const cameraOffset = new THREE.Vector3(0, 2, 6); // 2 up, 6 in front
        const desiredPosition = pathPosition.clone().add(cameraOffset);
        this.currentPosition.lerp(desiredPosition, this.smoothing);
        this.camera.position.copy(this.currentPosition);

        // Always look backward (-Z in world coordinates) from the character's position
        const lookAtTarget = pathPosition.clone().add(new THREE.Vector3(0, 1, -8)); // 1 up, 8 backward
        this.currentLookAt.lerp(lookAtTarget, this.smoothing);
        this.camera.up.set(0, 1, 0); // Ensure Y is always up
        this.camera.lookAt(this.currentLookAt);
        this.camera.rotation.z = 0;

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
