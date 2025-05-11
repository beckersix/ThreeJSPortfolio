/**
 * UIController.js
 * Provides a user interface for controlling various aspects of the 3D scene
 */

function UIController(sceneController, cameraController, gridManager) {
    this.sceneController = sceneController;
    this.cameraController = cameraController;
    this.gridManager = gridManager;
    
    // Store original values for reset functionality
    this.originalValues = {
        camera: {
            offset: this.cameraController.offset.clone(),
            lookAhead: this.cameraController.lookAhead,
            smoothing: this.cameraController.smoothing,
            mouseRotation: { ...this.cameraController.mouseRotation }
        },
        grid: {
            noiseAmplitude: this.gridManager.noiseAmplitude,
            noiseScale: this.gridManager.noiseScale,
            noiseSpeed: this.gridManager.noiseSpeed,
            maxCubesPerFrame: this.gridManager.config.maxCubesPerFrame,
            cullingDistance: this.gridManager.config.cullingDistance,
            updateInterval: this.gridManager.config.updateInterval
        }
    };
    
    // Create UI container
    this.container = document.createElement('div');
    this.container.id = 'ui-controls';
    this.container.style.position = 'fixed';
    this.container.style.top = '10px';
    this.container.style.right = '10px';
    this.container.style.width = '300px';
    this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.container.style.color = 'white';
    this.container.style.padding = '10px';
    this.container.style.borderRadius = '5px';
    this.container.style.fontFamily = 'Arial, sans-serif';
    this.container.style.zIndex = '10000';
    this.container.style.maxHeight = '80vh';
    this.container.style.overflowY = 'auto';
    this.container.style.pointerEvents = 'auto';
    
    // Add minimize/maximize button
    this.minimizeButton = document.createElement('button');
    this.minimizeButton.textContent = '−';
    this.minimizeButton.style.position = 'absolute';
    this.minimizeButton.style.top = '5px';
    this.minimizeButton.style.right = '5px';
    this.minimizeButton.style.width = '25px';
    this.minimizeButton.style.height = '25px';
    this.minimizeButton.style.border = 'none';
    this.minimizeButton.style.borderRadius = '3px';
    this.minimizeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    this.minimizeButton.style.color = 'white';
    this.minimizeButton.style.cursor = 'pointer';
    this.container.appendChild(this.minimizeButton);
    
    // Content container (for minimize/maximize)
    this.content = document.createElement('div');
    this.content.style.marginTop = '20px';
    this.container.appendChild(this.content);
    
    // Initialize UI
    this.isMinimized = false;
    this.initUI();
    
    // Add to document
    document.body.appendChild(this.container);
    
    // Setup event listeners
    this.setupEventListeners();
}

UIController.prototype.initUI = function() {
    // Create sections
    this.createCameraControls();
    this.createGridControls();
    this.createPerformanceControls();
    this.createModelLoader();
    this.createPresetButtons();
};

UIController.prototype.setupEventListeners = function() {
    const self = this;
    
    // Minimize/maximize button
    this.minimizeButton.addEventListener('click', function() {
        self.toggleMinimize();
    });
};

UIController.prototype.toggleMinimize = function() {
    if (this.isMinimized) {
        this.content.style.display = 'block';
        this.minimizeButton.textContent = '−';
        this.container.style.width = '300px';
    } else {
        this.content.style.display = 'none';
        this.minimizeButton.textContent = '+';
        this.container.style.width = '30px';
    }
    this.isMinimized = !this.isMinimized;
};

UIController.prototype.createSection = function(title) {
    const section = document.createElement('div');
    section.style.marginBottom = '15px';
    
    const header = document.createElement('h3');
    header.textContent = title;
    header.style.margin = '0 0 5px 0';
    header.style.padding = '5px';
    header.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    header.style.borderRadius = '3px';
    section.appendChild(header);
    
    this.content.appendChild(section);
    return section;
};

UIController.prototype.createSlider = function(section, label, min, max, value, step, callback) {
    const container = document.createElement('div');
    container.style.margin = '5px 0';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between';
    
    const labelElem = document.createElement('label');
    labelElem.textContent = label;
    labelElem.style.width = '40%';
    container.appendChild(labelElem);
    
    const sliderContainer = document.createElement('div');
    sliderContainer.style.width = '50%';
    sliderContainer.style.display = 'flex';
    sliderContainer.style.alignItems = 'center';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.style.width = '100%';
    sliderContainer.appendChild(slider);
    
    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = value;
    valueDisplay.style.marginLeft = '10px';
    valueDisplay.style.width = '40px';
    valueDisplay.style.textAlign = 'right';
    sliderContainer.appendChild(valueDisplay);
    
    container.appendChild(sliderContainer);
    section.appendChild(container);
    
    // Set up event listener
    slider.addEventListener('input', function() {
        valueDisplay.textContent = parseFloat(this.value).toFixed(step.toString().split('.')[1] ? step.toString().split('.')[1].length : 0);
        callback(parseFloat(this.value));
    });
    
    return slider;
};

UIController.prototype.createCheckbox = function(section, label, checked, callback) {
    const container = document.createElement('div');
    container.style.margin = '5px 0';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.style.marginRight = '10px';
    container.appendChild(checkbox);
    
    const labelElem = document.createElement('label');
    labelElem.textContent = label;
    container.appendChild(labelElem);
    
    section.appendChild(container);
    
    // Set up event listener
    checkbox.addEventListener('change', function() {
        callback(this.checked);
    });
    
    return checkbox;
};

UIController.prototype.createButton = function(section, label, callback) {
    const button = document.createElement('button');
    button.textContent = label;
    button.style.margin = '5px 5px 5px 0';
    button.style.padding = '5px 10px';
    button.style.backgroundColor = 'rgba(0, 120, 255, 0.7)';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '3px';
    button.style.cursor = 'pointer';
    
    section.appendChild(button);
    
    // Set up event listener
    button.addEventListener('click', callback);
    
    return button;
};

UIController.prototype.createDropdown = function(section, label, options, callback) {
    const container = document.createElement('div');
    container.style.margin = '5px 0';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between';
    
    const labelElem = document.createElement('label');
    labelElem.textContent = label;
    labelElem.style.width = '40%';
    container.appendChild(labelElem);
    
    const select = document.createElement('select');
    select.style.width = '55%';
    select.style.padding = '3px';
    select.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    select.style.color = 'white';
    select.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    select.style.borderRadius = '3px';
    
    // Add options
    options.forEach(function(option) {
        const optionElem = document.createElement('option');
        optionElem.value = option.value;
        optionElem.textContent = option.label;
        select.appendChild(optionElem);
    });
    
    container.appendChild(select);
    section.appendChild(container);
    
    // Set up event listener
    select.addEventListener('change', function() {
        callback(this.value);
    });
    
    return select;
};

UIController.prototype.createCameraControls = function() {
    const section = this.createSection('Camera Controls');
    const self = this;
    
    // Camera offset controls
    this.createSlider(section, 'Height', 0, 30, this.cameraController.offset.y, 1, function(value) {
        self.cameraController.offset.y = value;
    });
    
    this.createSlider(section, 'Distance', 10, 100, this.cameraController.offset.z, 5, function(value) {
        self.cameraController.offset.z = value;
    });
    
    this.createSlider(section, 'Smoothing', 0.01, 0.2, this.cameraController.smoothing, 0.01, function(value) {
        self.cameraController.smoothing = value;
    });
    
    // Mouse rotation controls
    this.createCheckbox(section, 'Enable Mouse Rotation', this.cameraController.mouseRotation.enabled, function(checked) {
        self.cameraController.mouseRotation.enabled = checked;
    });
    
    this.createSlider(section, 'Sensitivity', 0.000001, 0.00001, this.cameraController.mouseRotation.sensitivity, 0.000001, function(value) {
        self.cameraController.mouseRotation.sensitivity = value;
    });
    
    this.createSlider(section, 'Max Rotation', 0.005, 0.05, this.cameraController.mouseRotation.maxYaw, 0.005, function(value) {
        self.cameraController.mouseRotation.maxYaw = value;
        self.cameraController.mouseRotation.maxPitch = value;
    });
    
    this.createSlider(section, 'Damping', 0.1, 0.95, this.cameraController.mouseRotation.damping, 0.05, function(value) {
        self.cameraController.mouseRotation.damping = value;
    });
    
    // Reset button
    this.createButton(section, 'Reset Camera', function() {
        self.cameraController.offset.copy(self.originalValues.camera.offset);
        self.cameraController.lookAhead = self.originalValues.camera.lookAhead;
        self.cameraController.smoothing = self.originalValues.camera.smoothing;
        self.cameraController.mouseRotation = { ...self.originalValues.camera.mouseRotation };
        self.updateUIValues();
    });
};

UIController.prototype.createGridControls = function() {
    const section = this.createSection('Grid Controls');
    const self = this;
    
    // Noise controls
    this.createSlider(section, 'Noise Amplitude', 0, 2, this.gridManager.noiseAmplitude, 0.1, function(value) {
        self.gridManager.setNoiseParameters(value, undefined, undefined);
    });
    
    this.createSlider(section, 'Noise Scale', 0.01, 0.1, this.gridManager.noiseScale, 0.01, function(value) {
        self.gridManager.setNoiseParameters(undefined, value, undefined);
    });
    
    this.createSlider(section, 'Noise Speed', 0.1, 1, this.gridManager.noiseSpeed, 0.1, function(value) {
        self.gridManager.setNoiseParameters(undefined, undefined, value);
    });
    
    // Effector controls
    if (this.gridManager.effectors && this.gridManager.effectors.length > 0) {
        const playerEffector = this.gridManager.effectors.find(e => e.id === 'player');
        if (playerEffector) {
            this.createSlider(section, 'Player Radius', 50, 200, playerEffector.radius, 10, function(value) {
                playerEffector.radius = value;
            });
            
            this.createSlider(section, 'Max Raise', 5, 30, playerEffector.maxRaise, 1, function(value) {
                playerEffector.maxRaise = value;
            });
        }
    }
    
    // Reset button
    this.createButton(section, 'Reset Grid', function() {
        self.gridManager.setNoiseParameters(
            self.originalValues.grid.noiseAmplitude,
            self.originalValues.grid.noiseScale,
            self.originalValues.grid.noiseSpeed
        );
        self.updateUIValues();
    });
};

UIController.prototype.createPerformanceControls = function() {
    const section = this.createSection('Performance Controls');
    const self = this;
    
    // Culling distance
    this.createSlider(section, 'Culling Distance', 50, 500, this.gridManager.config.cullingDistance, 50, function(value) {
        self.gridManager.config.cullingDistance = value;
    });
    
    // Max cubes per frame
    this.createSlider(section, 'Max Cubes/Frame', 1000, 10000, this.gridManager.config.maxCubesPerFrame, 1000, function(value) {
        self.gridManager.config.maxCubesPerFrame = value;
    });
    
    // Update interval
    this.createSlider(section, 'Update Interval', 1, 5, this.gridManager.config.updateInterval, 1, function(value) {
        self.gridManager.config.updateInterval = Math.round(value);
    });
    
    // Quality presets
    const qualityOptions = [
        { value: 'low', label: 'Low Quality' },
        { value: 'medium', label: 'Medium Quality' },
        { value: 'high', label: 'High Quality' }
    ];
    
    this.createDropdown(section, 'Quality Preset', qualityOptions, function(value) {
        switch (value) {
            case 'low':
                self.gridManager.config.cullingDistance = 100;
                self.gridManager.config.maxCubesPerFrame = 2000;
                self.gridManager.config.updateInterval = 3;
                break;
            case 'medium':
                self.gridManager.config.cullingDistance = 200;
                self.gridManager.config.maxCubesPerFrame = 5000;
                self.gridManager.config.updateInterval = 2;
                break;
            case 'high':
                self.gridManager.config.cullingDistance = 300;
                self.gridManager.config.maxCubesPerFrame = 8000;
                self.gridManager.config.updateInterval = 1;
                break;
        }
        self.updateUIValues();
    });
    
    // Stats toggle
    this.createCheckbox(section, 'Show Performance Stats', false, function(checked) {
        if (checked) {
            if (!self.stats) {
                // Create stats if they don't exist
                self.createStats();
            }
            self.stats.dom.style.display = 'block';
        } else if (self.stats) {
            self.stats.dom.style.display = 'none';
        }
    });
};

UIController.prototype.createStats = function() {
    // Check if Stats.js is available
    if (typeof Stats === 'undefined') {
        console.error('Stats.js not loaded. Performance monitoring unavailable.');
        return;
    }
    
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.left = '10px';
    this.stats.dom.style.top = '10px';
    document.body.appendChild(this.stats.dom);
    
    // Set up animation loop to update stats
    const self = this;
    const animate = function() {
        self.stats.update();
        requestAnimationFrame(animate);
    };
    animate();
};

UIController.prototype.createModelLoader = function() {
    const section = this.createSection('Model Loader');
    const self = this;
    
    // Model selection
    const modelOptions = [
        { value: 'cone', label: 'Default Cone' },
        { value: 'sphere', label: 'Sphere' },
        { value: 'cube', label: 'Cube' },
        { value: 'custom', label: 'Custom FBX' }
    ];
    
    this.createDropdown(section, 'Player Model', modelOptions, function(value) {
        if (value === 'custom') {
            // Show file input
            self.fileInput.style.display = 'block';
        } else {
            // Hide file input
            self.fileInput.style.display = 'none';
            
            // Change player model
            self.changePlayerModel(value);
        }
    });
    
    // File input for custom FBX
    const fileContainer = document.createElement('div');
    fileContainer.style.margin = '10px 0';
    
    const fileLabel = document.createElement('label');
    fileLabel.textContent = 'Upload FBX:';
    fileLabel.style.display = 'block';
    fileLabel.style.marginBottom = '5px';
    fileContainer.appendChild(fileLabel);
    
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.fbx';
    this.fileInput.style.display = 'none';
    this.fileInput.style.width = '100%';
    this.fileInput.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    this.fileInput.style.color = 'white';
    this.fileInput.style.padding = '5px';
    this.fileInput.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    this.fileInput.style.borderRadius = '3px';
    fileContainer.appendChild(this.fileInput);
    
    section.appendChild(fileContainer);
    
    // Set up event listener for file input
    this.fileInput.addEventListener('change', function(event) {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            const url = URL.createObjectURL(file);
            self.loadCustomModel(url);
        }
    });
};

UIController.prototype.changePlayerModel = function(modelType) {
    // Find the player object in the scene
    const playerObject = this.sceneController.player;
    if (!playerObject) {
        console.error('Player object not found');
        return;
    }
    
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
    
    // Create material
    const material = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.7,
        roughness: 0.3,
        emissive: 0x330000
    });
    
    // Create mesh and add to player
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    
    // Adjust position based on geometry
    if (modelType === 'cone') {
        mesh.rotation.x = Math.PI; // Point downward
    }
    
    playerObject.add(mesh);
};

UIController.prototype.loadCustomModel = function(url) {
    const self = this;
    
    // Check if FBXLoader is available
    if (typeof THREE.FBXLoader === 'undefined') {
        console.error('FBXLoader not available. Cannot load custom model.');
        return;
    }
    
    // Find the player object in the scene
    const playerObject = this.sceneController.player;
    if (!playerObject) {
        console.error('Player object not found');
        return;
    }
    
    // Create loader
    const loader = new THREE.FBXLoader();
    
    // Load model
    loader.load(url, function(object) {
        // Remove existing model
        while (playerObject.children.length > 0) {
            playerObject.remove(playerObject.children[0]);
        }
        
        // Scale model to appropriate size
        object.scale.set(0.05, 0.05, 0.05);
        
        // Add to player
        playerObject.add(object);
        
        console.log('Custom model loaded successfully');
    }, undefined, function(error) {
        console.error('Error loading custom model:', error);
    });
};

UIController.prototype.createPresetButtons = function() {
    const section = this.createSection('Scene Presets');
    const self = this;
    
    // Create a container for preset buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexWrap = 'wrap';
    buttonContainer.style.justifyContent = 'space-between';
    section.appendChild(buttonContainer);
    
    // Preset 1: Aerial View
    this.createButton(buttonContainer, 'Aerial View', function() {
        self.cameraController.offset.set(0, 50, 10);
        self.gridManager.setNoiseParameters(0.8, 0.02, 0.2);
        self.updateUIValues();
    });
    
    // Preset 2: Close-up
    this.createButton(buttonContainer, 'Close-up', function() {
        self.cameraController.offset.set(0, 5, 20);
        self.gridManager.setNoiseParameters(0.3, 0.05, 0.5);
        self.updateUIValues();
    });
    
    // Preset 3: Side View
    this.createButton(buttonContainer, 'Side View', function() {
        self.cameraController.offset.set(30, 10, 30);
        self.gridManager.setNoiseParameters(1.0, 0.01, 0.3);
        self.updateUIValues();
    });
    
    // Preset 4: Calm Waves
    this.createButton(buttonContainer, 'Calm Waves', function() {
        self.cameraController.offset.set(0, 15, 45);
        self.gridManager.setNoiseParameters(0.2, 0.03, 0.1);
        self.updateUIValues();
    });
    
    // Preset 5: Stormy Seas
    this.createButton(buttonContainer, 'Stormy Seas', function() {
        self.cameraController.offset.set(0, 20, 40);
        self.gridManager.setNoiseParameters(1.5, 0.04, 0.8);
        self.updateUIValues();
    });
};

UIController.prototype.updateUIValues = function() {
    // This method will be implemented to update UI controls when values change programmatically
    // For now, we'll just reload the UI
    this.content.innerHTML = '';
    this.initUI();
};

// Export the UIController class
window.UIController = UIController;
