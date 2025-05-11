/**
 * controls.js
 * Handles the HTML UI controls for the Three.js portfolio
 */

// Global reference to controls
window.portfolioControls = null;

// Initialize controls when the page is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, waiting for scene initialization...');
    
    // Listen for the custom initialization events from SceneController
    window.addEventListener('sceneInitialized', function(event) {
        console.log('Received sceneInitialized event, initializing controls...');
        initControlsWithSceneController(event.detail.sceneController);
    });
    
    window.addEventListener('sceneFullyLoaded', function(event) {
        console.log('Received sceneFullyLoaded event, scene is fully loaded with all models');
        // We could refresh the controls here if needed
        if (window.portfolioControls) {
            console.log('Refreshing controls with fully loaded scene');
            // Update any controls that depend on the fully loaded scene
        }
    });
    
    // Listen for the legacy initialization event
    window.addEventListener('portfolioInitialized', function(event) {
        console.log('Received portfolioInitialized event, initializing controls...');
        initControlsWithSceneController(event.detail.sceneController);
    });
    
    // Also try the regular initialization approach as a fallback
    initControls();
});

// Function to initialize controls with a provided scene controller
function initControlsWithSceneController(sceneControllerInstance) {
    if (!sceneControllerInstance || !sceneControllerInstance.initialized) {
        console.error('Invalid scene controller provided to initControlsWithSceneController');
        return;
    }
    
    console.log('Initializing controls with provided scene controller...');
    setupControls(sceneControllerInstance);
}

// Wait for scene to initialize
function initControls() {
    // Find scene controller in the global scope
    let sceneControllerInstance = null;
    
    // Look for scene controller in various possible locations
    if (window.sceneController) {
        sceneControllerInstance = window.sceneController;
        console.log('Found sceneController in window:', window.sceneController);
    }
    
    // If not found or not initialized, wait and try again
    if (!sceneControllerInstance || !sceneControllerInstance.initialized) {
        console.log('Waiting for scene controller to initialize...');
        setTimeout(initControls, 500);
        return;
    }
    
    console.log('Scene controller found, initializing controls...');
    setupControls(sceneControllerInstance);
}

// Setup all controls with the provided scene controller
function setupControls(sceneControllerInstance) {
    // Check if controls are already initialized
    if (window.portfolioControls) {
        console.log('Controls already initialized, skipping...');
        return;
    }
    
    // Get references to scene components
    const cameraController = sceneControllerInstance.cameraController;
    const gridManager = sceneControllerInstance.gridManager;
    
    // Debug camera controller
    console.log('Camera controller:', cameraController);
    if (cameraController) {
        console.log('Camera offset:', cameraController.offset);
        console.log('Camera smoothing:', cameraController.smoothing);
        console.log('Mouse rotation:', cameraController.mouseRotation);
    } else {
        console.error('Camera controller not found in scene controller');
    }
    
    // Debug grid manager
    console.log('Grid manager:', gridManager);
    if (gridManager) {
        console.log('Grid noise amplitude:', gridManager.noiseAmplitude);
        console.log('Grid noise scale:', gridManager.noiseScale);
        console.log('Grid noise speed:', gridManager.noiseSpeed);
        console.log('Grid config:', gridManager.config);
    } else {
        console.error('Grid manager not found in scene controller');
    }
    
    // Store original values for reset functionality
    const originalValues = {
        camera: {
            offset: cameraController && cameraController.offset ? cameraController.offset.clone() : new THREE.Vector3(0, 25, 45),
            smoothing: cameraController ? cameraController.smoothing || 0.05 : 0.05,
            mouseRotation: cameraController && cameraController.mouseRotation ? { ...cameraController.mouseRotation } : {
                enabled: true,
                sensitivity: 0.000005,
                maxYaw: 0.01,
                maxPitch: 0.01,
                damping: 0.7
            }
        },
        grid: {
            noiseAmplitude: gridManager ? gridManager.noiseAmplitude || 0.5 : 0.5,
            noiseScale: gridManager ? gridManager.noiseScale || 0.02 : 0.02,
            noiseSpeed: gridManager ? gridManager.noiseSpeed || 0.2 : 0.2
        },
        performance: {
            cullingDistance: gridManager && gridManager.config ? (gridManager.config.cullingDistance || 100) : 100,
            maxCubesPerFrame: gridManager && gridManager.config ? (gridManager.config.maxCubesPerFrame || 1000) : 1000,
            updateInterval: gridManager && gridManager.config ? (gridManager.config.updateInterval || 5) : 5,
            maxUpdateDistance: gridManager && gridManager.config ? (gridManager.config.maxUpdateDistance || 120) : 120
        }
    };
    
    console.log('Original values:', originalValues);
    
    // Initialize UI controls
    if (cameraController) {
        initCameraControls(cameraController, originalValues.camera);
    }
    
    if (gridManager) {
        initGridControls(gridManager, originalValues.grid);
        initPerformanceControls(gridManager, originalValues.performance);
    }
    
    initModelLoader(sceneControllerInstance);
    
    if (cameraController && gridManager) {
        initScenePresets(cameraController, gridManager);
    }
    
    initMinimizeButton();
    
    // Add a global reference for debugging
    window.portfolioControls = {
        sceneController: sceneControllerInstance,
        cameraController: cameraController,
        gridManager: gridManager,
        originalValues: originalValues
    };
    
    console.log('Controls initialized successfully');
    console.log('Access controls via window.portfolioControls for debugging');
    
    // Add a test function to directly manipulate camera
    window.testCameraControls = function() {
        if (cameraController && cameraController.offset) {
            console.log('Testing camera controls...');
            console.log('Before: Camera offset =', cameraController.offset.clone());
            cameraController.offset.y += 10;
            console.log('After: Camera offset =', cameraController.offset.clone());
            return 'Camera height increased by 10';
        } else {
            return 'Camera controller not available';
        }
    };
}

// Initialize camera controls
function initCameraControls(cameraController, originalValues) {
    console.log('Initializing camera controls...');
    
    // Safety check
    if (!cameraController || !cameraController.offset) {
        console.error('Camera controller or offset not available');
        return;
    }
    
    // Log current camera values for debugging
    console.log('Current camera offset:', cameraController.offset);
    console.log('Current camera smoothing:', cameraController.smoothing);
    console.log('Current mouse rotation settings:', cameraController.mouseRotation);
    
    // Camera height
    const heightSlider = document.getElementById('camera-height');
    const heightValue = document.getElementById('camera-height-value');
    
    if (heightSlider && heightValue) {
        // Set initial value
        heightSlider.value = cameraController.offset.y;
        heightValue.textContent = cameraController.offset.y;
        
        // Add direct event listener
        heightSlider.oninput = function() {
            const value = parseFloat(this.value);
            heightValue.textContent = value;
            
            // Update camera controller
            cameraController.offset.y = value;
            
            // Force an immediate camera update by using setOffset
            if (typeof cameraController.setOffset === 'function') {
                cameraController.setOffset(cameraController.offset.x, value, cameraController.offset.z);
            }
            
            console.log('Camera height updated:', value);
        };
    }
    
    // Camera distance
    const distanceSlider = document.getElementById('camera-distance');
    const distanceValue = document.getElementById('camera-distance-value');
    
    if (distanceSlider && distanceValue) {
        // Set initial value
        distanceSlider.value = cameraController.offset.z;
        distanceValue.textContent = cameraController.offset.z;
        
        // Add direct event listener
        distanceSlider.oninput = function() {
            const value = parseFloat(this.value);
            distanceValue.textContent = value;
            
            // Update camera controller
            cameraController.offset.z = value;
            
            // Force an immediate camera update by using setOffset
            if (typeof cameraController.setOffset === 'function') {
                cameraController.setOffset(cameraController.offset.x, cameraController.offset.y, value);
            }
            
            console.log('Camera distance updated:', value);
        };
    }
    
    // Camera smoothing
    const smoothingSlider = document.getElementById('camera-smoothing');
    const smoothingValue = document.getElementById('camera-smoothing-value');
    
    if (smoothingSlider && smoothingValue) {
        // Set initial value
        smoothingSlider.value = cameraController.smoothing;
        smoothingValue.textContent = cameraController.smoothing.toFixed(2);
        
        // Add direct event listener
        smoothingSlider.oninput = function() {
            const value = parseFloat(this.value);
            smoothingValue.textContent = value.toFixed(2);
            
            // Update camera controller
            cameraController.smoothing = value;
            
            // Use the setter method if available
            if (typeof cameraController.setSmoothing === 'function') {
                cameraController.setSmoothing(value);
            }
            
            console.log('Camera smoothing updated:', value);
        };
    }
    
    // Mouse rotation toggle
    const mouseRotationCheckbox = document.getElementById('mouse-rotation');
    
    if (mouseRotationCheckbox && cameraController.mouseRotation) {
        // Set initial value
        mouseRotationCheckbox.checked = cameraController.mouseRotation.enabled;
        
        // Add direct event listener
        mouseRotationCheckbox.onchange = function() {
            cameraController.mouseRotation.enabled = this.checked;
            console.log('Mouse rotation enabled:', this.checked);
        };
    }
    
    // Mouse sensitivity
    const sensitivitySlider = document.getElementById('mouse-sensitivity');
    const sensitivityValue = document.getElementById('mouse-sensitivity-value');
    
    if (sensitivitySlider && sensitivityValue && cameraController.mouseRotation) {
        // Set initial value
        sensitivitySlider.value = cameraController.mouseRotation.sensitivity;
        sensitivityValue.textContent = cameraController.mouseRotation.sensitivity.toFixed(9);
        
        // Add direct event listener
        sensitivitySlider.oninput = function() {
            const value = parseFloat(this.value);
            sensitivityValue.textContent = value.toFixed(9);
            cameraController.mouseRotation.sensitivity = value;
            console.log('Mouse sensitivity updated:', value);
        };
    }
    
    // Reset camera button
    const resetButton = document.getElementById('reset-camera');
    
    if (resetButton) {
        // Add direct event listener
        resetButton.onclick = function() {
            console.log('Resetting camera to original values');
            
            // Reset camera values
            if (originalValues.offset) {
                cameraController.offset.copy(originalValues.offset);
                
                // Force an immediate camera update by using setOffset
                if (typeof cameraController.setOffset === 'function') {
                    cameraController.setOffset(
                        originalValues.offset.x,
                        originalValues.offset.y,
                        originalValues.offset.z
                    );
                }
            }
            
            if (originalValues.smoothing !== undefined) {
                cameraController.smoothing = originalValues.smoothing;
                
                // Use the setter method if available
                if (typeof cameraController.setSmoothing === 'function') {
                    cameraController.setSmoothing(originalValues.smoothing);
                }
            }
            
            if (cameraController.mouseRotation && originalValues.mouseRotation) {
                cameraController.mouseRotation.enabled = originalValues.mouseRotation.enabled;
                cameraController.mouseRotation.sensitivity = originalValues.mouseRotation.sensitivity;
                cameraController.mouseRotation.maxYaw = originalValues.mouseRotation.maxYaw;
                cameraController.mouseRotation.maxPitch = originalValues.mouseRotation.maxPitch;
                cameraController.mouseRotation.damping = originalValues.mouseRotation.damping;
            }
            
            // Update UI to match
            updateCameraUI(cameraController);
            
            console.log('Camera reset complete');
        };
    }
    
    console.log('Camera controls initialization complete');
}

// Helper function to update camera UI elements
function updateCameraUI(cameraController) {
    if (!cameraController) return;
    
    // Camera height
    const heightSlider = document.getElementById('camera-height');
    const heightValue = document.getElementById('camera-height-value');
    
    if (heightSlider && heightValue && cameraController.offset) {
        heightSlider.value = cameraController.offset.y;
        heightValue.textContent = cameraController.offset.y;
    }
    
    // Camera distance
    const distanceSlider = document.getElementById('camera-distance');
    const distanceValue = document.getElementById('camera-distance-value');
    
    if (distanceSlider && distanceValue && cameraController.offset) {
        distanceSlider.value = cameraController.offset.z;
        distanceValue.textContent = cameraController.offset.z;
    }
    
    // Camera smoothing
    const smoothingSlider = document.getElementById('camera-smoothing');
    const smoothingValue = document.getElementById('camera-smoothing-value');
    
    if (smoothingSlider && smoothingValue && cameraController.smoothing !== undefined) {
        smoothingSlider.value = cameraController.smoothing;
        smoothingValue.textContent = cameraController.smoothing.toFixed(2);
    }
    
    // Mouse rotation
    const mouseRotationCheckbox = document.getElementById('mouse-rotation');
    
    if (mouseRotationCheckbox && cameraController.mouseRotation) {
        mouseRotationCheckbox.checked = cameraController.mouseRotation.enabled;
    }
    
    // Mouse sensitivity
    const sensitivitySlider = document.getElementById('mouse-sensitivity');
    const sensitivityValue = document.getElementById('mouse-sensitivity-value');
    
    if (sensitivitySlider && sensitivityValue && cameraController.mouseRotation) {
        sensitivitySlider.value = cameraController.mouseRotation.sensitivity;
        sensitivityValue.textContent = cameraController.mouseRotation.sensitivity.toFixed(9);
    }
    
    console.log('Camera controls initialized');
}

// Initialize grid controls
function initGridControls(gridManager, originalValues) {
    console.log('Initializing grid controls...');
    
    // Safety check
    if (!gridManager) {
        console.error('Grid manager not available');
        return;
    }
    
    // Noise amplitude
    const amplitudeSlider = document.getElementById('noise-amplitude');
    const amplitudeValue = document.getElementById('noise-amplitude-value');
    
    if (amplitudeSlider && amplitudeValue) {
        const currentAmplitude = gridManager.noiseAmplitude !== undefined ? 
            gridManager.noiseAmplitude : originalValues.noiseAmplitude;
            
        amplitudeSlider.value = currentAmplitude;
        amplitudeValue.textContent = currentAmplitude.toFixed(1);
        
        amplitudeSlider.addEventListener('input', function() {
            const value = parseFloat(this.value);
            amplitudeValue.textContent = value.toFixed(1);
            
            // Use setNoiseParameters if available, otherwise set directly
            if (typeof gridManager.setNoiseParameters === 'function') {
                gridManager.setNoiseParameters(value, undefined, undefined);
            } else {
                gridManager.noiseAmplitude = value;
            }
            
            console.log('Noise amplitude updated:', value);
        });
    }
    
    // Noise scale
    const scaleSlider = document.getElementById('noise-scale');
    const scaleValue = document.getElementById('noise-scale-value');
    
    if (scaleSlider && scaleValue) {
        // Set initial value
        scaleSlider.value = gridManager.noiseScale;
        scaleValue.textContent = gridManager.noiseScale.toFixed(2);
        
        // Add direct event listener
        scaleSlider.oninput = function() {
            const value = parseFloat(this.value);
            scaleValue.textContent = value.toFixed(2);
            gridManager.noiseScale = value;
            console.log('Noise scale updated:', value);
        };
    }
    
    // Noise speed
    const speedSlider = document.getElementById('noise-speed');
    const speedValue = document.getElementById('noise-speed-value');
    
    if (speedSlider && speedValue) {
        // Set initial value
        speedSlider.value = gridManager.noiseSpeed;
        speedValue.textContent = gridManager.noiseSpeed.toFixed(1);
        
        // Add direct event listener
        speedSlider.oninput = function() {
            const value = parseFloat(this.value);
            speedValue.textContent = value.toFixed(1);
            gridManager.noiseSpeed = value;
            console.log('Noise speed updated:', value);
        };
    }
    
    // Player radius
    const radiusSlider = document.getElementById('player-radius');
    const radiusValue = document.getElementById('player-radius-value');
    
    if (radiusSlider && radiusValue) {
        // Find player effector
        let playerRadius = 100; // Default value
        if (gridManager.effectors && gridManager.effectors.length > 0) {
            const playerEffector = gridManager.effectors.find(e => e.id === 'player');
            if (playerEffector) {
                playerRadius = playerEffector.radius;
            }
        }
        
        // Set initial value
        radiusSlider.value = playerRadius;
        radiusValue.textContent = playerRadius;
        
        // Add direct event listener
        radiusSlider.oninput = function() {
            const value = parseFloat(this.value);
            radiusValue.textContent = value;
            
            // Update player effector radius
            if (gridManager.effectors && gridManager.effectors.length > 0) {
                const playerEffector = gridManager.effectors.find(e => e.id === 'player');
                if (playerEffector) {
                    playerEffector.radius = value;
                    console.log('Player radius updated:', value);
                } else {
                    console.warn('Player effector not found');
                }
            } else {
                console.warn('No effectors found in grid manager');
            }
        };
    }
    
    // Reset grid button
    const resetButton = document.getElementById('reset-grid');
    
    if (resetButton) {
        // Add direct event listener
        resetButton.onclick = function() {
            console.log('Resetting grid to original values');
            
            // Reset grid values
            if (originalValues.noiseAmplitude !== undefined) {
                gridManager.noiseAmplitude = originalValues.noiseAmplitude;
            }
            
            if (originalValues.noiseScale !== undefined) {
                gridManager.noiseScale = originalValues.noiseScale;
            }
            
            if (originalValues.noiseSpeed !== undefined) {
                gridManager.noiseSpeed = originalValues.noiseSpeed;
            }
            
            // Update player effector radius
            if (gridManager.effectors && gridManager.effectors.length > 0) {
                const playerEffector = gridManager.effectors.find(e => e.id === 'player');
                if (playerEffector) {
                    playerEffector.radius = 100; // Default value
                }
            }
            
            // Update UI to match
            updateGridUI(gridManager);
            
            console.log('Grid settings reset complete');
        };
    }
    
    console.log('Grid controls initialization complete');
}

// Helper function to update grid UI elements
function updateGridUI(gridManager) {
    if (!gridManager) return;
    
    // Noise amplitude
    const amplitudeSlider = document.getElementById('noise-amplitude');
    const amplitudeValue = document.getElementById('noise-amplitude-value');
    
    if (amplitudeSlider && amplitudeValue && gridManager.noiseAmplitude !== undefined) {
        amplitudeSlider.value = gridManager.noiseAmplitude;
        amplitudeValue.textContent = gridManager.noiseAmplitude.toFixed(1);
    }
    
    // Noise scale
    const scaleSlider = document.getElementById('noise-scale');
    const scaleValue = document.getElementById('noise-scale-value');
    
    if (scaleSlider && scaleValue && gridManager.noiseScale !== undefined) {
        scaleSlider.value = gridManager.noiseScale;
        scaleValue.textContent = gridManager.noiseScale.toFixed(2);
    }
    
    // Noise speed
    const speedSlider = document.getElementById('noise-speed');
    const speedValue = document.getElementById('noise-speed-value');
    
    if (speedSlider && speedValue && gridManager.noiseSpeed !== undefined) {
        speedSlider.value = gridManager.noiseSpeed;
        speedValue.textContent = gridManager.noiseSpeed.toFixed(1);
    }
    
    // Player radius
    const radiusSlider = document.getElementById('player-radius');
    const radiusValue = document.getElementById('player-radius-value');
    
    if (radiusSlider && radiusValue) {
        let playerRadius = 100; // Default value
        if (gridManager.effectors && gridManager.effectors.length > 0) {
            const playerEffector = gridManager.effectors.find(e => e.id === 'player');
            if (playerEffector) {
                playerRadius = playerEffector.radius;
            }
        }
        
        radiusSlider.value = playerRadius;
        radiusValue.textContent = playerRadius;
    }
}

// Initialize performance controls
function initPerformanceControls(gridManager, originalValues) {
    console.log('Initializing performance controls...');
    
    // Safety check
    if (!gridManager) {
        console.error('Grid manager not available');
        return;
    }
    
    // Make sure config exists
    if (!gridManager.config) {
        gridManager.config = {};
    }
    
    // Set default values if not present
    if (gridManager.config.maxUpdateDistance === undefined) {
        gridManager.config.maxUpdateDistance = originalValues.maxUpdateDistance || 120;
    }
    
    if (gridManager.config.cullingDistance === undefined) {
        gridManager.config.cullingDistance = originalValues.cullingDistance || 100;
    }
    
    if (gridManager.config.maxCubesPerFrame === undefined) {
        gridManager.config.maxCubesPerFrame = originalValues.maxCubesPerFrame || 1000;
    }
    
    if (gridManager.config.updateInterval === undefined) {
        gridManager.config.updateInterval = originalValues.updateInterval || 5;
    }
    
    // Culling distance
    const cullingSlider = document.getElementById('culling-distance');
    const cullingValue = document.getElementById('culling-distance-value');
    
    if (cullingSlider && cullingValue) {
        // Use maxUpdateDistance if available, otherwise use cullingDistance
        const currentDistance = gridManager.config.maxUpdateDistance !== undefined ? 
            gridManager.config.maxUpdateDistance : 
            (gridManager.config.cullingDistance || originalValues.cullingDistance);
            
        // Set initial value
        cullingSlider.value = currentDistance;
        cullingValue.textContent = currentDistance;
        
        // Add direct event listener
        cullingSlider.oninput = function() {
            const value = parseFloat(this.value);
            cullingValue.textContent = value;
            
            // Update both properties to ensure compatibility
            gridManager.config.maxUpdateDistance = value;
            gridManager.config.cullingDistance = value;
            
            console.log('Culling distance updated:', value);
        };
    }
    
    // Max cubes per frame
    const maxCubesSlider = document.getElementById('max-cubes');
    const maxCubesValue = document.getElementById('max-cubes-value');
    
    if (maxCubesSlider && maxCubesValue) {
        const currentMaxCubes = gridManager.config.maxCubesPerFrame || originalValues.maxCubesPerFrame;
        
        // Set initial value
        maxCubesSlider.value = currentMaxCubes;
        maxCubesValue.textContent = currentMaxCubes;
        
        // Add direct event listener
        maxCubesSlider.oninput = function() {
            const value = parseFloat(this.value);
            maxCubesValue.textContent = value;
            gridManager.config.maxCubesPerFrame = value;
            console.log('Max cubes per frame updated:', value);
        };
    }
    
    // Update interval
    const intervalSlider = document.getElementById('update-interval');
    const intervalValue = document.getElementById('update-interval-value');
    
    if (intervalSlider && intervalValue) {
        const currentInterval = gridManager.config.updateInterval || originalValues.updateInterval;
        
        // Set initial value
        intervalSlider.value = currentInterval;
        intervalValue.textContent = currentInterval;
        
        // Add direct event listener
        intervalSlider.oninput = function() {
            const value = parseInt(this.value);
            intervalValue.textContent = value;
            gridManager.config.updateInterval = value;
            console.log('Update interval updated:', value);
        };
    }
    
    // Quality preset dropdown
    const qualitySelect = document.getElementById('quality-preset');
    
    if (qualitySelect) {
        // Set initial selection based on current values
        const currentValues = {
            maxUpdateDistance: gridManager.config.maxUpdateDistance || 120,
            maxCubesPerFrame: gridManager.config.maxCubesPerFrame || 5000,
            updateInterval: gridManager.config.updateInterval || 2
        };
        
        // Determine current quality preset
        if (currentValues.maxUpdateDistance <= 80 && 
            currentValues.maxCubesPerFrame <= 2000 && 
            currentValues.updateInterval >= 3) {
            qualitySelect.value = 'low';
        } else if (currentValues.maxUpdateDistance >= 180 && 
                 currentValues.maxCubesPerFrame >= 7000 && 
                 currentValues.updateInterval <= 1) {
            qualitySelect.value = 'high';
        } else {
            qualitySelect.value = 'medium';
        }
        
        // Add direct event listener
        qualitySelect.onchange = function() {
            let maxUpdateDistance, maxCubesPerFrame, updateInterval;
            
            switch (this.value) {
                case 'low':
                    maxUpdateDistance = 80;
                    maxCubesPerFrame = 2000;
                    updateInterval = 3;
                    break;
                case 'medium':
                    maxUpdateDistance = 120;
                    maxCubesPerFrame = 5000;
                    updateInterval = 2;
                    break;
                case 'high':
                    maxUpdateDistance = 200;
                    maxCubesPerFrame = 8000;
                    updateInterval = 1;
                    break;
            }
            
            // Update config values
            gridManager.config.maxUpdateDistance = maxUpdateDistance;
            gridManager.config.cullingDistance = maxUpdateDistance;
            gridManager.config.maxCubesPerFrame = maxCubesPerFrame;
            gridManager.config.updateInterval = updateInterval;
            
            // Update UI to match
            updatePerformanceUI(gridManager);
            
            console.log('Quality preset changed to:', this.value);
        };
    }
    
    // Stats toggle
    let stats = null;
    const statsCheckbox = document.getElementById('show-stats');
    
    if (statsCheckbox) {
        // Add direct event listener
        statsCheckbox.onchange = function() {
            if (this.checked) {
                if (!stats) {
                    try {
                        // Check if Stats is available
                        if (typeof Stats === 'undefined') {
                            console.error('Stats.js not loaded. Performance monitoring unavailable.');
                            return;
                        }
                        
                        // Create stats if they don't exist
                        stats = new Stats();
                        stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
                        stats.dom.style.position = 'absolute';
                        stats.dom.style.left = '10px';
                        stats.dom.style.top = '10px';
                        stats.dom.style.zIndex = '10000';
                        document.body.appendChild(stats.dom);
                        
                        // Set up animation loop to update stats
                        function updateStats() {
                            stats.update();
                            requestAnimationFrame(updateStats);
                        }
                        updateStats();
                        
                        console.log('Performance stats enabled');
                    } catch (error) {
                        console.error('Error initializing Stats.js:', error);
                        statsCheckbox.checked = false;
                    }
                } else {
                    stats.dom.style.display = 'block';
                    console.log('Performance stats shown');
                }
            } else if (stats) {
                stats.dom.style.display = 'none';
                console.log('Performance stats hidden');
            }
        };
    }
    
    console.log('Performance controls initialization complete');
}

// Helper function to update performance UI elements
function updatePerformanceUI(gridManager) {
    if (!gridManager || !gridManager.config) return;
    
    // Culling distance
    const cullingSlider = document.getElementById('culling-distance');
    const cullingValue = document.getElementById('culling-distance-value');
    
    if (cullingSlider && cullingValue) {
        const currentDistance = gridManager.config.maxUpdateDistance !== undefined ? 
            gridManager.config.maxUpdateDistance : gridManager.config.cullingDistance;
            
        if (currentDistance !== undefined) {
            cullingSlider.value = currentDistance;
            cullingValue.textContent = currentDistance;
        }
    }
    
    // Max cubes per frame
    const maxCubesSlider = document.getElementById('max-cubes');
    const maxCubesValue = document.getElementById('max-cubes-value');
    
    if (maxCubesSlider && maxCubesValue && gridManager.config.maxCubesPerFrame !== undefined) {
        maxCubesSlider.value = gridManager.config.maxCubesPerFrame;
        maxCubesValue.textContent = gridManager.config.maxCubesPerFrame;
    }
    
    // Update interval
    const intervalSlider = document.getElementById('update-interval');
    const intervalValue = document.getElementById('update-interval-value');
    
    if (intervalSlider && intervalValue && gridManager.config.updateInterval !== undefined) {
        intervalSlider.value = gridManager.config.updateInterval;
        intervalValue.textContent = gridManager.config.updateInterval;
    }
    
    // Quality preset
    const qualitySelect = document.getElementById('quality-preset');
    
    if (qualitySelect && gridManager.config) {
        const currentValues = {
            maxUpdateDistance: gridManager.config.maxUpdateDistance || 120,
            maxCubesPerFrame: gridManager.config.maxCubesPerFrame || 5000,
            updateInterval: gridManager.config.updateInterval || 2
        };
        
        if (currentValues.maxUpdateDistance <= 80 && 
            currentValues.maxCubesPerFrame <= 2000 && 
            currentValues.updateInterval >= 3) {
            qualitySelect.value = 'low';
        } else if (currentValues.maxUpdateDistance >= 180 && 
                 currentValues.maxCubesPerFrame >= 7000 && 
                 currentValues.updateInterval <= 1) {
            qualitySelect.value = 'high';
        } else {
            qualitySelect.value = 'medium';
        }
    }
}

// Initialize model loader
function initModelLoader(sceneController) {
    console.log('Initializing model loader...');
    
    // Safety check
    if (!sceneController || !sceneController.player) {
        console.error('Scene controller or player not available');
        return;
    }
    
    const modelSelect = document.getElementById('player-model');
    const fbxUpload = document.getElementById('fbx-upload');
    const fbxFile = document.getElementById('fbx-file');
    
    if (!modelSelect || !fbxUpload || !fbxFile) {
        console.error('Model loader UI elements not found');
        return;
    }
    
    // Show/hide FBX upload based on selection
    modelSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            fbxUpload.style.display = 'block';
        } else {
            fbxUpload.style.display = 'none';
            changePlayerModel(sceneController, this.value);
        }
    });
    
    // Handle file upload
    fbxFile.addEventListener('change', function(event) {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            const url = URL.createObjectURL(file);
            loadCustomModel(sceneController, url);
        }
    });
    
    console.log('Model loader initialized');
}

// Change player model
function changePlayerModel(sceneController, modelType) {
    console.log('Changing player model to:', modelType);
    
    // Find the player object in the scene
    const playerObject = sceneController.player;
    if (!playerObject) {
        console.error('Player object not found');
        return;
    }
    
    try {
        // Remove existing model
        while (playerObject.children.length > 0) {
            playerObject.remove(playerObject.children[0]);
        }
        
        // Create new geometry based on selected type
        let geometry;
        switch (modelType) {
            case 'cone':
                geometry = new THREE.ConeGeometry(2, 5, 32);
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(2.5, 32, 32);
                break;
            case 'cube':
                geometry = new THREE.BoxGeometry(4, 4, 4);
                break;
            default:
                geometry = new THREE.ConeGeometry(2, 5, 32);
        }
        
        // Create material - use MeshPhysicalMaterial for better reflections with HDRI
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xff0000,
            metalness: 0.7,
            roughness: 0.3,
            emissive: 0x330000,
            clearcoat: 0.5,
            clearcoatRoughness: 0.3,
            reflectivity: 1.0
        });
        
        // Create mesh and add to player
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Adjust position based on geometry
        if (modelType === 'cone') {
            mesh.rotation.x = Math.PI; // Point downward
        }
        
        playerObject.add(mesh);
        console.log('Player model changed successfully');
    } catch (error) {
        console.error('Error changing player model:', error);
    }
}

// Load custom FBX model
function loadCustomModel(sceneController, url) {
    console.log('Loading custom FBX model...');
    
    // Find the player object in the scene
    const playerObject = sceneController.player;
    if (!playerObject) {
        console.error('Player object not found');
        return;
    }
    
    try {
        // Check if FBXLoader is available
        if (typeof THREE.FBXLoader === 'undefined') {
            console.error('FBXLoader not available. Cannot load custom model.');
            alert('FBXLoader not available. Cannot load custom model.');
            return;
        }
        
        // Create loader
        const loader = new THREE.FBXLoader();
        
        // Show loading indicator
        const loadingElement = document.getElementById('loading-text');
        if (loadingElement) {
            loadingElement.textContent = 'Loading FBX model...';
            loadingElement.style.display = 'block';
        }
        
        // Load model
        loader.load(url, function(object) {
            try {
                // Remove existing model
                while (playerObject.children.length > 0) {
                    playerObject.remove(playerObject.children[0]);
                }
                
                // Scale model to appropriate size
                object.scale.set(0.05, 0.05, 0.05);
                
                // Make sure model casts shadows
                object.traverse(function(child) {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Enhance materials for HDRI reflections
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => {
                                    mat.metalness = 0.7;
                                    mat.roughness = 0.3;
                                    mat.envMapIntensity = 1.0;
                                });
                            } else {
                                child.material.metalness = 0.7;
                                child.material.roughness = 0.3;
                                child.material.envMapIntensity = 1.0;
                            }
                        }
                    }
                });
                
                // Add to player
                playerObject.add(object);
                
                console.log('Custom model loaded successfully');
                
                // Hide loading indicator
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
            } catch (error) {
                console.error('Error processing loaded model:', error);
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
            }
        }, 
        // Progress callback
        function(xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        }, 
        // Error callback
        function(error) {
            console.error('Error loading custom model:', error);
            if (loadingElement) {
                loadingElement.textContent = 'Error loading model';
                setTimeout(() => {
                    loadingElement.style.display = 'none';
                }, 2000);
            }
        });
    } catch (error) {
        console.error('Error initializing FBX loader:', error);
    }
}

// Initialize scene presets
function initScenePresets(cameraController, gridManager) {
    console.log('Initializing scene presets...');
    
    // Safety checks
    if (!cameraController || !gridManager) {
        console.error('Camera controller or grid manager not available');
        return;
    }
    
    // Aerial View
    const aerialBtn = document.getElementById('preset-aerial');
    if (aerialBtn) {
        aerialBtn.addEventListener('click', function() {
            console.log('Applying aerial view preset');
            
            // Set camera position
            cameraController.offset.set(0, 50, 10);
            
            // Set grid parameters
            if (typeof gridManager.setNoiseParameters === 'function') {
                gridManager.setNoiseParameters(0.8, 0.02, 0.2);
            } else {
                gridManager.noiseAmplitude = 0.8;
                gridManager.noiseScale = 0.02;
                gridManager.noiseSpeed = 0.2;
            }
            
            // Update UI
            updateUIValues();
            console.log('Aerial view preset applied');
        });
    }
    
    // Close-up
    const closeupBtn = document.getElementById('preset-closeup');
    if (closeupBtn) {
        closeupBtn.addEventListener('click', function() {
            console.log('Applying close-up preset');
            
            // Set camera position
            cameraController.offset.set(0, 5, 20);
            
            // Set grid parameters
            if (typeof gridManager.setNoiseParameters === 'function') {
                gridManager.setNoiseParameters(0.3, 0.05, 0.5);
            } else {
                gridManager.noiseAmplitude = 0.3;
                gridManager.noiseScale = 0.05;
                gridManager.noiseSpeed = 0.5;
            }
            
            // Update UI
            updateUIValues();
            console.log('Close-up preset applied');
        });
    }
    
    // Side View
    const sideBtn = document.getElementById('preset-side');
    if (sideBtn) {
        sideBtn.addEventListener('click', function() {
            console.log('Applying side view preset');
            
            // Set camera position
            cameraController.offset.set(30, 10, 30);
            
            // Set grid parameters
            if (typeof gridManager.setNoiseParameters === 'function') {
                gridManager.setNoiseParameters(1.0, 0.01, 0.3);
            } else {
                gridManager.noiseAmplitude = 1.0;
                gridManager.noiseScale = 0.01;
                gridManager.noiseSpeed = 0.3;
            }
            
            // Update UI
            updateUIValues();
            console.log('Side view preset applied');
        });
    }
    
    // Calm Waves
    const calmBtn = document.getElementById('preset-calm');
    if (calmBtn) {
        calmBtn.addEventListener('click', function() {
            console.log('Applying calm waves preset');
            
            // Set camera position
            cameraController.offset.set(0, 20, 40);
            
            // Set grid parameters
            if (typeof gridManager.setNoiseParameters === 'function') {
                gridManager.setNoiseParameters(0.5, 0.03, 0.4);
            } else {
                gridManager.noiseAmplitude = 0.5;
                gridManager.noiseScale = 0.03;
                gridManager.noiseSpeed = 0.4;
            }
            
            // Update UI
            updateUIValues();
            console.log('Calm waves preset applied');
        });
    }
    
    // Storm
    const stormBtn = document.getElementById('preset-storm');
    if (stormBtn) {
        stormBtn.addEventListener('click', function() {
            console.log('Applying storm preset');
            
            // Set camera position
            cameraController.offset.set(0, 40, 60);
            
            // Set grid parameters
            if (typeof gridManager.setNoiseParameters === 'function') {
                gridManager.setNoiseParameters(1.5, 0.04, 0.8);
            } else {
                gridManager.noiseAmplitude = 1.5;
                gridManager.noiseScale = 0.04;
                gridManager.noiseSpeed = 0.8;
            }
            
            // Update UI
            updateUIValues();
            console.log('Storm preset applied');
        });
    }
    
    console.log('Scene presets initialized');
}

// Initialize minimize button
function initMinimizeButton() {
    console.log('Initializing minimize button...');
    
    const minimizeButton = document.getElementById('minimize-button');
    const controlContent = document.getElementById('control-content');
    const controlPanel = document.getElementById('control-panel');
    
    if (!minimizeButton || !controlContent || !controlPanel) {
        console.error('Minimize button UI elements not found');
        return;
    }
    
    let isMinimized = false;
    
    // Add transition styles for smooth animation
    controlPanel.style.transition = 'width 0.3s ease-in-out';
    controlContent.style.transition = 'opacity 0.3s ease-in-out';
    
    minimizeButton.addEventListener('click', function() {
        try {
            if (isMinimized) {
                // Expand panel
                controlPanel.style.width = '300px';
                minimizeButton.textContent = '−';
                minimizeButton.title = 'Minimize Control Panel';
                
                // Show content with fade-in effect
                controlContent.style.opacity = '0';
                controlContent.style.display = 'block';
                
                // Use setTimeout to create a fade-in effect
                setTimeout(() => {
                    controlContent.style.opacity = '1';
                }, 50);
                
                console.log('Control panel expanded');
            } else {
                // Minimize panel
                controlContent.style.opacity = '0';
                minimizeButton.textContent = '+';
                minimizeButton.title = 'Expand Control Panel';
                
                // Wait for fade-out to complete before hiding
                setTimeout(() => {
                    controlContent.style.display = 'none';
                    controlPanel.style.width = '30px';
                }, 300);
                
                console.log('Control panel minimized');
            }
            
            isMinimized = !isMinimized;
        } catch (error) {
            console.error('Error toggling control panel:', error);
        }
    });
    
    // Add hover effect
    minimizeButton.addEventListener('mouseover', function() {
        this.style.backgroundColor = '#555';
    });
    
    minimizeButton.addEventListener('mouseout', function() {
        this.style.backgroundColor = '#333';
    });
    
    console.log('Minimize button initialized');
}

// Update UI values to match current settings
function updateUIValues() {
    console.log('Updating UI values to match current settings...');
    
    try {
        // Get references to scene components
        const sceneController = window.sceneController;
        if (!sceneController) {
            console.error('Scene controller not available');
            return;
        }
        
        const cameraController = sceneController.cameraController;
        const gridManager = sceneController.gridManager;
        
        if (!cameraController || !gridManager) {
            console.error('Camera controller or grid manager not available');
            return;
        }
        
        // Camera controls
        updateElementValue('camera-height', cameraController.offset.y);
        updateElementValue('camera-distance', cameraController.offset.z);
        
        if (cameraController.smoothing !== undefined) {
            updateElementValue('camera-smoothing', cameraController.smoothing, 2);
        }
        
        if (cameraController.mouseRotation) {
            const mouseRotationCheckbox = document.getElementById('mouse-rotation');
            if (mouseRotationCheckbox) {
                mouseRotationCheckbox.checked = cameraController.mouseRotation.enabled;
            }
            
            if (cameraController.mouseRotation.sensitivity !== undefined) {
                updateElementValue('mouse-sensitivity', cameraController.mouseRotation.sensitivity, 9);
            }
        }
        
        // Grid controls
        if (gridManager.noiseAmplitude !== undefined) {
            updateElementValue('noise-amplitude', gridManager.noiseAmplitude, 1);
        }
        
        if (gridManager.noiseScale !== undefined) {
            updateElementValue('noise-scale', gridManager.noiseScale, 2);
        }
        
        if (gridManager.noiseSpeed !== undefined) {
            updateElementValue('noise-speed', gridManager.noiseSpeed, 1);
        }
        
        // Find player effector
        if (gridManager.effectors && gridManager.effectors.length > 0) {
            const playerEffector = gridManager.effectors.find(e => e.id === 'player');
            if (playerEffector && playerEffector.radius !== undefined) {
                updateElementValue('player-radius', playerEffector.radius);
            }
        }
        
        // Performance controls
        if (gridManager.config) {
            // Handle both maxUpdateDistance and cullingDistance for compatibility
            const cullingDistance = gridManager.config.maxUpdateDistance !== undefined ? 
                gridManager.config.maxUpdateDistance : gridManager.config.cullingDistance;
                
            if (cullingDistance !== undefined) {
                updateElementValue('culling-distance', cullingDistance);
            }
            
            if (gridManager.config.maxCubesPerFrame !== undefined) {
                updateElementValue('max-cubes', gridManager.config.maxCubesPerFrame);
            }
            
            if (gridManager.config.updateInterval !== undefined) {
                updateElementValue('update-interval', gridManager.config.updateInterval);
            }
            
            // Set quality preset dropdown based on current values
            const qualitySelect = document.getElementById('quality-preset');
            if (qualitySelect) {
                if (cullingDistance <= 80 && 
                    gridManager.config.maxCubesPerFrame <= 2000 && 
                    gridManager.config.updateInterval >= 3) {
                    qualitySelect.value = 'low';
                } else if (cullingDistance >= 180 && 
                         gridManager.config.maxCubesPerFrame >= 7000 && 
                         gridManager.config.updateInterval <= 1) {
                    qualitySelect.value = 'high';
                } else {
                    qualitySelect.value = 'medium';
                }
            }
        }
        
        console.log('UI values updated successfully');
    } catch (error) {
        console.error('Error updating UI values:', error);
    }
}

// Helper function to update element value and display
function updateElementValue(elementId, value, decimals) {
    const slider = document.getElementById(elementId);
    const display = document.getElementById(`${elementId}-value`);
    
    if (!slider || !display) return;
    
    // Update slider
    slider.value = value;
    
    // Update display with optional formatting
    if (decimals !== undefined && typeof value === 'number') {
        display.textContent = value.toFixed(decimals);
    } else {
        display.textContent = value;
    }
}
