/**
 * SceneController.js
 * A class for managing the overall 3D scene, now with refactored GridManager integration
 */

// SceneController class - manages the overall 3D scene
function SceneController() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.player = null; // The player object (cone)
    this.clock = new THREE.Clock(); // Clock for animations
    this.splineLoader = null;
    this.cameraController = null;
    this.scrollY = 0; // Track scroll position
    this.initialized = false;
    this.sceneFilePath = '/static/models/Scene.obj';
    
    // Reference to GridManager
    this.gridManager = null;
    
    // Wave animation properties - independent of camera movement
    this.waveTime = 0;
    this.waveSpeed = 0.2; // Slower for smoother animation
    this.waveAmplitude = 1.5; // Subtler amplitude
    this.waveFrequency = 0.01; // Lower frequency for wider, smoother waves
    
    // Preloader elements
    this.preloader = {
        overlay: document.getElementById('preloader'),
        progressBar: document.getElementById('progress-bar'),
        progressText: document.getElementById('progress-text'),
        loadingText: document.getElementById('loading-text')
    };
    this.loadingProgress = 0;
    
    // Store test effectors
    this.testEffectors = [];
}

// Initialize the scene
SceneController.prototype.init = function() {
    // Update preloader status
    this.updatePreloader(5, 'Creating scene...');
    
    if (this.initialized) return;
    
    // Create scene
    this.scene = new THREE.Scene();
    
    // Add atmospheric fog for depth and mood
    const fogColor = new THREE.Color(0x89a7c2);  // Soft blue-gray color
    this.scene.fog = new THREE.FogExp2(fogColor, 0.0085);  // Exponential fog with moderate density
    
    // Create a gradient background
    const topColor = new THREE.Color(0x1c3a5e);  // Deep blue
    const bottomColor = new THREE.Color(0xc5d5e5);  // Light blue-gray
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, topColor.getStyle());
    gradient.addColorStop(1, bottomColor.getStyle());
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2, 512);
    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;
    
    // Add debug floor grid (commented out for production)
    //const gridHelper = new THREE.GridHelper(10000, 10000);
    //gridHelper.position.y = 0;
    //this.scene.add(gridHelper);
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 50, 2080); // Higher and further back
    this.camera.lookAt(0, -10, 0); // Tilt downward
    
    // Create renderer with enhanced settings for atmosphere
    this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        logarithmicDepthBuffer: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    document.body.appendChild(this.renderer.domElement);
    
    // Add lighting
    this.updatePreloader(15, 'Setting up lighting...');
    this.setupLighting();
    
    // Create player
    this.updatePreloader(20, 'Creating player...');    
    this.createPlayer();

    // Initialize SplineLoader for loading OBJ models with camera paths
    this.splineLoader = new SplineLoader(this.scene);
    
    // Initialize GridManager first (don't wait for OBJ model)
    this.updatePreloader(25, 'Creating cube grid...');
    this.initializeGridManager();
    
    // Load the OBJ model with camera path
    this.updatePreloader(22, 'Loading 3D models...');
    
    // Path to your OBJ file - using the existing Scene.obj file
    const objPath = './static/models/Scene.obj';
    
    this.splineLoader.loadOBJModel(objPath, (loader, error) => {
        if (error) {
            console.error('Failed to load OBJ model:', error);
        } else {
            console.log('OBJ model loaded successfully');
            // If the model has a camera path, use it
            if (loader && loader.cameraPath) {
                console.log('Using camera path from OBJ model');
                // Keep a reference to the loaded camera path
                this.objCameraPath = loader.cameraPath;
                
                // Log path details for debugging
                console.log('Camera path points:', loader.cameraPath.points ? loader.cameraPath.points.length : 'none');
                console.log('First point:', loader.cameraPath.points ? loader.cameraPath.points[0] : 'none');
                console.log('Last point:', loader.cameraPath.points ? loader.cameraPath.points[loader.cameraPath.points.length-1] : 'none');
                
                // Update GridManager with camera path if necessary
                if (this.gridManager) {
                    this.gridManager.cameraPath = this.objCameraPath;
                }
            } else {
                console.error('No camera path found in OBJ model');
            }
        }
        
        // After model loads, add test effectors
        this.createTestEffectors();
    });
    
    // Configure camera controller for interaction
    this.cameraController = new CameraController(this.camera, this.player);
    
    // Setup animation loop
    this.animate();
    
    // Add window resize handler
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Mark as initialized
    this.initialized = true;
};

// Initialize GridManager
SceneController.prototype.initializeGridManager = function() {
    console.log('Initializing GridManager...');
    
    // Configure GridManager
    const gridOptions = {
        gridSizeX: 550,
        gridSizeZ: 550,
        spacing: 1.6,
        baseHeight: -15,
        gridX: 0,
        gridZ: -50,
        cubeSize: 0.8,
        cubeColor: 0x00ffcc,
        // Camera path may not be available yet
        cameraPath: this.objCameraPath
    };
    
    // Create GridManager instance
    this.gridManager = new GridManager(this.scene, gridOptions);
    console.log('GridManager created with options:', gridOptions);
    
    // Create the cube grid with batch processing to prevent UI freeze
    this.gridManager.createGrid((progress) => {
        // Convert progress to a value between 30 and 98
        const scaledProgress = 30 + (progress * 68);
        console.log(`Grid creation progress: ${Math.round(progress * 100)}%`);
        this.updatePreloader(scaledProgress, `Creating cube grid: ${Math.round(progress * 100)}%`);
        
        // When grid creation completes
        if (progress === 1) {
            setTimeout(() => {
                this.updatePreloader(100, 'Complete!');
                setTimeout(() => this.hidePreloader(), 300);
            }, 200);
        }
    });
    
    // Add the player as an effector
    if (this.player) {
        console.log('Adding player as effector');
        this.gridManager.addEffector({
            name: 'player',
            object: this.player,
            position: this.player.position,
            radius: 100,  // Make sure property names match what GridManager expects
            maxRaise: 15,
            maxScale: 1.5,
            active: true
        });
    }
    
    // Add any other loaded effectors from SplineLoader
    if (this.splineLoader && this.splineLoader.effectors) {
        this.splineLoader.effectors.forEach(effector => {
            this.gridManager.addEffector({
                name: effector.name,
                object: effector.object,
                position: effector.position,
                effectRadius: 100,
                maxRaise: 25,
                falloffFactor: 0.0003,
                color: 0x00ffff
            });
        });
    }
};

// Set up scene lighting
SceneController.prototype.setupLighting = function() {
    // Soft ambient fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    // Visually effective directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 100;
    this.scene.add(directionalLight);
};

// Create test effectors (visible objects that affect the grid)
SceneController.prototype.createTestEffectors = function() {
    console.log('Creating test effectors');
    
    // Create 3 test effectors at different positions
    const positions = [
        { x: 50, y: 5, z: 50 },
        { x: -50, y: 5, z: -50 },
        { x: 0, y: 5, z: -100 }
    ];
    
    // Store references to our test effectors
    this.testEffectors = [];
    
    // Create each effector
    positions.forEach((pos, index) => {
        // Create a visible sphere with the "effector" name
        const geometry = new THREE.SphereGeometry(5, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x003333,
            wireframe: true
        });
        
        const effector = new THREE.Mesh(geometry, material);
        effector.position.set(pos.x, pos.y, pos.z);
        effector.name = 'effector.' + (index + 1); // Named as effector.1, effector.2, etc.
        
        // Add a point light
        const light = new THREE.PointLight(0x00ffff, 1, 30);
        light.position.set(0, 0, 0);
        effector.add(light);
        
        // Add to scene
        this.scene.add(effector);
        
        // Store reference
        this.testEffectors.push(effector);
        
        console.log(`Created test effector ${effector.name} at position:`, pos);
    });
    
    // If the SplineLoader exists, manually add these to its effectors array
    if (this.splineLoader) {
        positions.forEach((pos, index) => {
            const effector = this.testEffectors[index];
            this.splineLoader.effectors.push({
                name: effector.name,
                position: effector.position,
                object: effector
            });
        });
        console.log('Added test effectors to SplineLoader.effectors array');
    } else {
        console.log('SplineLoader not available yet, effectors will be found during scene traversal');
    }
    
    // If GridManager is already initialized, add these effectors to it
    if (this.gridManager) {
        this.testEffectors.forEach(effector => {
            this.gridManager.addEffector({
                name: effector.name,
                object: effector,
                position: effector.position,
                effectRadius: 100,
                maxRaise: 25,
                falloffFactor: 0.0003,
                color: 0x00ffff
            });
        });
    }
};

// Create player object (cone)
SceneController.prototype.createPlayer = function() {
    // Larger cone geometry
    const coneGeometry = new THREE.ConeGeometry(2.5, 5, 24);
    
    // Brighter and more reflective material
    const coneMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0x330000,  // Slight emissive glow
        metalness: 0.7,      // More metallic look
        roughness: 0.2       // Smoother surface for more reflections
    });
    
    this.player = new THREE.Mesh(coneGeometry, coneMaterial);
    this.player.position.set(0, 2.5, 0); // Lifted up a bit so it doesn't sink into the grid
    this.player.rotation.x = Math.PI; // Pointing forward
    
    // Add a subtle point light attached to the player
    const playerLight = new THREE.PointLight(0xff3333, 1, 20);
    playerLight.position.set(0, 1, 0);
    this.player.add(playerLight);
    
    // Cast shadows
    this.player.castShadow = true;
    
    this.scene.add(this.player);
};

// Update the preloader with progress information
SceneController.prototype.updatePreloader = function(progress, message) {
    // Debug log to see preloader updates
    console.log('Updating preloader:', progress, message);
    
    if (!this.preloader || !this.preloader.overlay) {
        console.error('Preloader elements not available', this.preloader);
        return;
    }
    
    // Force DOM update even if progress is the same or lower
    this.loadingProgress = progress;
    
    // Update the visual elements immediately with forced layout refresh
    this.preloader.progressBar.style.width = this.loadingProgress + '%';
    this.preloader.progressText.textContent = this.loadingProgress + '%';
    if (message) {
        this.preloader.loadingText.textContent = message;
    }
    
    // Force browser to reflow - helps ensure visual updates
    void this.preloader.overlay.offsetWidth;
    
    // Only hide preloader when complete and after a delay
    if (this.loadingProgress >= 100) {
        console.log('Loading complete, hiding preloader after delay');
        setTimeout(() => this.hidePreloader(), 1000);
    }
};

// Hide the preloader with a fade effect
SceneController.prototype.hidePreloader = function() {
    console.log('Hiding preloader, grid manager status:', this.gridManager ? 'created' : 'not created');
    console.log('Camera path status:', this.objCameraPath ? 'loaded from OBJ' : 'not loaded');
    
    if (!this.preloader || !this.preloader.overlay) {
        console.error('Preloader elements not available');
        return;
    }
    
    // Make sure critical components are ready before hiding preloader
    if (!this.gridManager || !this.gridManager.ready) {
        console.warn('Grid not ready, delaying preloader hide');
        setTimeout(() => this.hidePreloader(), 500);
        return;
    }
    
    this.preloader.overlay.style.opacity = 0;
    
    // Remove from DOM after fade animation completes
    setTimeout(() => {
        this.preloader.overlay.style.display = 'none';
        console.log('Preloader hidden, scene should be fully loaded');
    }, 1000);
};

// Set up event listeners
SceneController.prototype.setupEventListeners = function() {
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this), false);
    
    // Handle scroll events
    window.addEventListener('scroll', (event) => {
        // Set debug flag to log scroll position once
        this._debugScroll = true;
    });
    
    // Handle key presses for camera control and debugging
    window.addEventListener('keydown', (event) => {
        // Debug key - press 'D' to log camera and path info
        if (event.key === 'd' || event.key === 'D') {
            console.log('Camera position:', this.camera.position);
            console.log('Camera offset:', this.cameraController.offset);
            console.log('Camera path:', this.objCameraPath);
            console.log('Current progress:', window.scrollY / (document.body.scrollHeight - window.innerHeight));
            
            // Log GridManager status if available
            if (this.gridManager) {
                console.log('GridManager status:', {
                    cubeCount: this.gridManager.getCubeCount(),
                    effectorCount: this.gridManager.getEffectorCount()
                });
            }
        }
        
        // Camera offset controls
        if (this.cameraController) {
            const offsetStep = event.shiftKey ? 10 : 2; // Larger steps with shift key
            
            // X-axis controls (left/right)
            if (event.key === 'ArrowLeft') {
                this.cameraController.adjustOffset(-offsetStep, 0, 0);
                event.preventDefault();
            } else if (event.key === 'ArrowRight') {
                this.cameraController.adjustOffset(offsetStep, 0, 0);
                event.preventDefault();
            }
            
            // Y-axis controls (up/down)
            if (event.key === 'ArrowUp') {
                if (event.ctrlKey) {
                    // Ctrl+Up: Move camera forward (closer to target)
                    this.cameraController.adjustOffset(0, 0, -offsetStep);
                } else {
                    // Up: Move camera higher
                    this.cameraController.adjustOffset(0, offsetStep, 0);
                }
                event.preventDefault();
            } else if (event.key === 'ArrowDown') {
                if (event.ctrlKey) {
                    // Ctrl+Down: Move camera backward (away from target)
                    this.cameraController.adjustOffset(0, 0, offsetStep);
                } else {
                    // Down: Move camera lower
                    this.cameraController.adjustOffset(0, -offsetStep, 0);
                }
                event.preventDefault();
            }
            
            // Reset camera position with 'R'
            if (event.key === 'r' || event.key === 'R') {
                // Get current position on path
                const scrollMax = document.body.scrollHeight - window.innerHeight;
                const progress = Math.max(0, Math.min(window.scrollY / scrollMax, 1));
                const pathAdapter = this.objCameraPath ? {
                    getPointOnPath: (t) => this.objCameraPath.getPoint(t)
                } : null;
                
                if (pathAdapter) {
                    const pathPosition = pathAdapter.getPointOnPath(progress);
                    this.cameraController.resetPosition(pathPosition);
                }
                event.preventDefault();
            }
        }
    });
};

// Animation loop
SceneController.prototype.animate = function() {
    const self = this;
    
    requestAnimationFrame(function() {
        self.animate();
    });
    
    // Calculate progress (0 to 1) based on scroll position
    const scrollMax = document.body.scrollHeight - window.innerHeight;
    const currentScroll = window.scrollY || window.pageYOffset || 0;
    const progress = Math.max(0, Math.min(currentScroll / scrollMax, 1));
    
    // Debug scroll position (only log when changed)
    if (this._debugScroll) {
        console.log(`Scroll: ${currentScroll}/${scrollMax} = ${progress}`);
        this._debugScroll = false; // Only log once
    }
    
    // Update camera controller with proper path following
    this.updateCameraPath(progress);
    
    // Update player movement (if needed)
    this.updatePlayer();
    
    // Update GridManager effects
    if (this.gridManager) {
        // Update the GridManager with the current scroll progress
        this.gridManager.update(progress);
    }
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
};

// Update camera position along path
SceneController.prototype.updateCameraPath = function(progress) {
    // Create a path adapter if needed
    let pathAdapter = null;
    
    // Priority 1: Use the OBJ camera path reference if available
    if (this.objCameraPath) {
        if (!this._objPathAdapter) {
            this._objPathAdapter = {
                cameraPath: this.objCameraPath,
                getPointOnPath: function(t) {
                    return this.cameraPath.getPoint(Math.max(0, Math.min(t, 1)));
                }
            };
        }
        // Make sure the adapter has the latest path
        this._objPathAdapter.cameraPath = this.objCameraPath;
        pathAdapter = this._objPathAdapter;
    }
    // Priority 2: Use the loaded OBJ camera path if available
    else if (this.splineLoader && this.splineLoader.cameraPath) {
        if (!this._splineLoaderAdapter) {
            this._splineLoaderAdapter = {
                cameraPath: this.splineLoader.cameraPath,
                getPointOnPath: function(t) {
                    return this.cameraPath.getPoint(Math.max(0, Math.min(t, 1)));
                }
            };
        }
        // Make sure the adapter has the latest path
        this._splineLoaderAdapter.cameraPath = this.splineLoader.cameraPath;
        pathAdapter = this._splineLoaderAdapter;
    }
    
    // Update camera if we have a path and controller
    if (pathAdapter && this.cameraController) {
        this.cameraController.update(pathAdapter, progress);
    }
};

// Update player movement and interactions
SceneController.prototype.updatePlayer = function() {
    // Only update if player exists
    if (!this.player) return;
    
    // For now the player stays in place, but you could add movement here
    // This is a placeholder for future player movement code
};

// Handle window resize events
SceneController.prototype.onWindowResize = function() {
    // Update camera aspect ratio
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    
    // Update renderer size
    this.renderer.setSize(window.innerWidth, window.innerHeight);
};

// Export the SceneController class
window.SceneController = SceneController;
