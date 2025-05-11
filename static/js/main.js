/**
 * main.js
 * Main entry point for the Three.js portfolio application
 */

// Global reference to controllers
window.sceneController = null;
window.uiController = null;

// Initialize the application when the page loads
window.onload = function() {
    console.log('Window loaded, initializing scene controller...');
    
    // Create scene controller and initialize it
    // Assign directly to window.sceneController to make it globally accessible
    window.sceneController = new SceneController();
    window.sceneController.init();
    
    console.log('Scene controller initialized:', window.sceneController);
    console.log('Scene controller initialized state:', window.sceneController.initialized);
    
    // Wait for scene to initialize before creating UI
    setTimeout(function() {
        console.log('Checking scene controller initialization status...');
        if (window.sceneController.initialized) {
            console.log('Scene controller is fully initialized');
            
            // Create UI controller manually if it wasn't created in SceneController
            if (!window.sceneController.uiController) {
                console.log('Initializing UI Controller manually');
                window.uiController = new UIController(
                    window.sceneController, 
                    window.sceneController.cameraController, 
                    window.sceneController.gridManager
                );
            } else {
                console.log('UI Controller already initialized');
                window.uiController = window.sceneController.uiController;
            }
            
            // Force a global flag to indicate everything is ready
            window.portfolioInitialized = true;
            
            // Dispatch a custom event to notify other scripts
            const initEvent = new CustomEvent('portfolioInitialized', {
                detail: {
                    sceneController: window.sceneController,
                    uiController: window.uiController
                }
            });
            window.dispatchEvent(initEvent);
            
            console.log('Portfolio initialization complete, event dispatched');
        } else {
            console.error('Scene not initialized properly after timeout');
            console.log('Current scene controller state:', window.sceneController);
        }
    }, 2000); // Wait 2 seconds to ensure scene is fully loaded
};
