/**
 * main.js
 * Main entry point for the Three.js portfolio application
 */

// Initialize the application when the page loads
window.onload = function() {
    // Create scene controller and initialize it directly
    sceneController = new SceneController();
    sceneController.init();
};
