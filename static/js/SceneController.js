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
    console.log('Initializing SceneController...');
    
    // Update preloader status
    this.updatePreloader(5, 'Creating scene...');
    
    if (this.initialized) {
        console.log('SceneController already initialized, skipping initialization');
        return;
    }
    
    // Create scene
    this.scene = new THREE.Scene();
    
    // Add atmospheric fog for depth and mood
    // Using a lighter fog that works well with HDRI
    const fogColor = new THREE.Color(0x89a7c2);  // Soft blue-gray color
    this.scene.fog = new THREE.FogExp2(fogColor, 0.007);  // Reduced density for HDRI compatibility
    
    // Create camera with extended far plane to see distant objects
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 10000);
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
    
    // Create camera controller
    this.cameraController = new CameraController(this.camera, this.player);
    this.cameraController.init();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load environment map
    this.updatePreloader(30, 'Loading environment...');
    this.loadHDRIEnvironment();
    
    // Path to your OBJ file
    const objPath = './static/models/Scene.obj';
    
    // Load the OBJ model with camera path
    this.updatePreloader(40, 'Loading 3D models...');
    
    const self = this; // Store reference to this for callbacks
    
    // Load the OBJ model
    this.splineLoader.loadOBJModel(objPath, (loader, error) => {
        if (error) {
            console.error('Failed to load OBJ model:', error);
        } else {
            console.log('OBJ model loaded successfully');
            
            // Verify instanced meshes are loaded
            const instancedMeshes = this.splineLoader.getInstancedMeshes();
            console.log(`SceneController: Loaded ${instancedMeshes.length} instanced mesh groups`);
            
            // Calculate scene bounds for proper camera positioning
            const sceneBounds = new THREE.Box3();
            
            instancedMeshes.forEach((mesh, index) => {
                console.log(`SceneController: Instanced mesh #${index} '${mesh.name}', instances: ${mesh.count}`);
                
                // Ensure frustum culling is disabled for all instanced meshes
                mesh.frustumCulled = false;
                
                // Expand scene bounds to include this mesh
                const meshBounds = new THREE.Box3().setFromObject(mesh);
                sceneBounds.union(meshBounds);
                
                console.log(`Mesh '${mesh.name}' bounds:`, 
                    `Min (${meshBounds.min.x.toFixed(2)}, ${meshBounds.min.y.toFixed(2)}, ${meshBounds.min.z.toFixed(2)})`, 
                    `Max (${meshBounds.max.x.toFixed(2)}, ${meshBounds.max.y.toFixed(2)}, ${meshBounds.max.z.toFixed(2)})`);
            });
            
            // Add a debug helper to visualize the scene boundaries
            const sceneBoundsHelper = new THREE.Box3Helper(sceneBounds, 0xff0000);
            this.scene.add(sceneBoundsHelper);
            
            // Log the overall scene bounds
            console.log('Overall scene bounds:', 
                `Min (${sceneBounds.min.x.toFixed(2)}, ${sceneBounds.min.y.toFixed(2)}, ${sceneBounds.min.z.toFixed(2)})`, 
                `Max (${sceneBounds.max.x.toFixed(2)}, ${sceneBounds.max.y.toFixed(2)}, ${sceneBounds.max.z.toFixed(2)})`);
            
            // No debug panel or controls as they exist in the other UI
            
            // Store the scene bounds for later use
            this.sceneBounds = sceneBounds;
            
            // If the model has a camera path, use it
            if (loader && loader.cameraPath) {
                self.objCameraPath = loader.cameraPath;
                console.log('Camera path loaded from OBJ model');
            }
            
            // Initialize GridManager after OBJ model loads
            self.updatePreloader(60, 'Creating cube grid...');
            self.initializeGridManager();
            
            // Create test effectors
            self.updatePreloader(80, 'Creating test effectors...');
            self.createTestEffectors();
            
            // Initialize UI Controller if it doesn't already exist
            self.updatePreloader(95, 'Setting up UI controls...');
            if (!self.uiController) {
                console.log('Creating UI Controller');
                self.uiController = new UIController(self, self.cameraController, self.gridManager);
            } else {
                console.log('UI Controller already exists, skipping creation');
            }
            
            // Hide preloader when everything is ready
            self.updatePreloader(100, 'Ready!');
            setTimeout(() => self.hidePreloader(), 500);
            
            // Mark as initialized
            self.initialized = true;
            console.log('Scene controller initialized successfully');
            
            // Dispatch an event to notify that everything is fully loaded
            const loadedEvent = new CustomEvent('sceneFullyLoaded', {
                detail: { sceneController: self }
            });
            window.dispatchEvent(loadedEvent);
            
            // Also dispatch the sceneInitialized event for backward compatibility
            const initEvent = new CustomEvent('sceneInitialized', {
                detail: { sceneController: self }
            });
            window.dispatchEvent(initEvent);
        }
    });
    
    // Start animation loop
    this.animate();
    
    // Add window resize handler
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Set up global reference for debugging
    window.sceneController = this;
};

// Initialize GridManager
SceneController.prototype.initializeGridManager = function() {
    console.log('Initializing GridManager...');
    
    // Configure GridManager
    const gridOptions = {
        gridSizeX: 350,
        gridSizeZ: 1000,
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
            id: 'player',
            name: 'Player',
            position: this.player.position,
            radius: 40,
            maxRaise: 15,
            maxScale: 2.0,
            active: true,
            color: 0xff0000,
            visualize: false // We already have a player model
        });
    }
    
    // Note: We don't add effectors from SplineLoader here anymore
    // They will be added after the OBJ model is fully loaded
    // in the createTestEffectors method
};

// Set up scene lighting
SceneController.prototype.setupLighting = function() {
    // Load HDRI environment map for lighting and reflections
    this.loadHDRIEnvironment();
    
    // Add a subtle ambient light as fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientLight);
    
    // Add directional light for shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 512;
    directionalLight.shadow.mapSize.height = 512;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 50;
    this.scene.add(directionalLight);
};

// Load and setup environment map using standard TextureLoader
SceneController.prototype.loadHDRIEnvironment = function() {
    const self = this;
    
    // Update preloader
    this.updatePreloader(18, 'Loading environment map...');
    
    // Material parameters for reflective surfaces
    const params = {
        metalness: 1.0,
        roughness: 0.0,
        exposure: 1,
        emissive: 3
    };
    
    // Configure renderer for physically correct lighting
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = params.exposure;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    
    // Create a standard TextureLoader
    const textureLoader = new THREE.TextureLoader();
    
    // Path to your converted HDR file (jpg format)
    const hdrPath = './static/HDRI.hdr.jpg';
    
    // Load the environment map
    textureLoader.load(hdrPath, function(texture) {
        // Set mapping to equirectangular reflection mapping
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.needsUpdate = true;
        
        // Set scene background and environment
        self.scene.background = texture;
        self.scene.environment = texture; // This enables reflections on materials
        
        // Store the environment map for later access
        self.environmentMap = texture;
        
        // Update material settings for all objects in the scene
        self.updateSceneMaterials(params);
        
        // Update preloader
        self.updatePreloader(20, 'Environment map loaded!');
        console.log('Environment map loaded successfully');
    }, 
    // Progress callback
    function(xhr) {
        if (xhr.total) {
            const progress = 15 + (xhr.loaded / xhr.total) * 3;
            self.updatePreloader(progress, 'Loading environment map...');
        }
    },
    // Error callback 
    function(error) {
        console.error('Error loading environment map:', error);
        // Fall back to procedural environment
        self.createProceduralEnvironment();
    });
    
};

// Update all materials in the scene to match UltraHDR example settings
SceneController.prototype.updateSceneMaterials = function(params) {
    // Update the grid manager materials if available
    if (this.gridManager && this.gridManager.instancedMesh) {
        const material = this.gridManager.instancedMesh.material;
        
        // Apply UltraHDR example-like settings
        if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
            material.roughness = params.roughness;
            material.metalness = params.metalness;
            material.needsUpdate = true;
        }
    }
    
    // Update any other objects in the scene
    this.scene.traverse((object) => {
        if (object.isMesh && object.material) {
            const material = object.material;
            
            // Apply UltraHDR example-like settings
            if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
                material.roughness = params.roughness;
                material.metalness = params.metalness;
                material.needsUpdate = true;
            }
        }
    });
};

// Create a procedural environment if HDR loading fails
SceneController.prototype.createProceduralEnvironment = function() {
    console.log('Creating procedural environment map');
    
    // Create a simple procedural environment for reflections
    const colors = [0x0000ff, 0x00ffff, 0xffff00, 0xff0000, 0x00ff00, 0xff00ff];
    const envMap = this.createProceduralCubeMap(colors);
    
    // Set scene environment for reflections
    this.scene.environment = envMap;
    
    // Create a nice gradient background
    this.createGradientBackground();
    
    // Update preloader
    this.updatePreloader(20, 'Procedural environment loaded!');
}

// Create a procedural cube map for reflections
SceneController.prototype.createProceduralCubeMap = function(colors) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Create a cube texture with solid colors
    const textures = [];
    
    for (let i = 0; i < 6; i++) {
        // Clone the canvas for each face
        const faceCanvas = canvas.cloneNode();
        const faceContext = faceCanvas.getContext('2d');
        
        // Fill with a solid color
        faceContext.fillStyle = '#' + colors[i].toString(16).padStart(6, '0');
        faceContext.fillRect(0, 0, size, size);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(faceCanvas);
        texture.needsUpdate = true;
        textures.push(texture);
    }
    
    // Create cube texture
    const cubeTexture = new THREE.CubeTexture(textures);
    cubeTexture.needsUpdate = true;
    
    return cubeTexture;
};

// Create a gradient background as fallback
SceneController.prototype.createGradientBackground = function() {
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
    console.log('Created fallback gradient background');
};

// Use ONLY the effectors from the OBJ model with their actual positions
SceneController.prototype.createTestEffectors = function() {
    console.log('=== ADDING EFFECTORS TO GRID ===');
    
    // Clear any existing test effectors
    if (this.testEffectors && this.testEffectors.length > 0) {
        console.log(`Clearing ${this.testEffectors.length} existing test effectors`);
        this.testEffectors.forEach(effector => {
            if (effector && this.scene) {
                this.scene.remove(effector);
            }
        });
    }
    
    this.testEffectors = [];
    
    // Make sure the SplineLoader has been initialized and has found effectors
    if (!this.splineLoader) {
        console.error('SplineLoader not initialized');
        return;
    }
    
    // Force the SplineLoader to update its effectors list
    if (this.splineLoader.findEffectors && this.splineLoader.originalObject) {
        console.log('Refreshing effectors from original object');
        this.splineLoader.effectors = []; // Clear existing effectors
        this.splineLoader.findEffectors(this.splineLoader.originalObject);
    }
    
    // Check if we have effectors from the OBJ model via SplineLoader
    if (this.splineLoader.effectors && this.splineLoader.effectors.length > 0) {
        const effectorCount = this.splineLoader.effectors.length;
        
        // Create a collection of effector positions for console output
        const effectorPositions = this.splineLoader.effectors.map(e => {
            // Get position directly from the object's matrix
            if (e.object) {
                e.object.updateMatrixWorld(true);
                const position = new THREE.Vector3();
                position.setFromMatrixPosition(e.object.matrixWorld);
                return {
                    name: e.name,
                    x: parseFloat(position.x.toFixed(2)),
                    y: parseFloat(position.y.toFixed(2)),
                    z: parseFloat(position.z.toFixed(2))
                };
            } else {
                return { name: e.name, x: 0, y: 0, z: 0 };
            }
        });
        
        // Output effector positions as a table
        console.log(`Adding ${effectorCount} effectors to grid with ORIGINAL positions:`);
        console.table(effectorPositions);
        
        // Process each effector from the OBJ model
        this.splineLoader.effectors.forEach(effector => {
            // Skip if position is invalid
            if (!effector.position) {
                console.error(`Effector ${effector.name} has no position data`);
                return;
            }
            
            // No mesh creation - just add effector point to grid manager
            if (this.gridManager) {
                console.log(`ADDING EFFECTOR TO GRID: ${effector.name} at (${effector.position.x.toFixed(2)}, ${effector.position.y.toFixed(2)}, ${effector.position.z.toFixed(2)})`);
                
                // Add the effector to GridManager with its position
                this.gridManager.addEffector({
                    id: effector.name,
                    name: effector.name,
                    position: effector.position.clone(), // Clone to avoid reference issues
                    radius: 50,              // REDUCED from 100 to 50
                    maxRaise: 15,            // REDUCED from 25 to 15
                    maxScale: 1.5,           // REDUCED from 2.0 to 1.5
                    active: true,
                    color: 0x00ffff,
                    visualize: false
                });
            }
        });
        
        console.log(`=== EFFECTORS ADDED SUCCESSFULLY ===`);
    } else {
        console.log('No effectors found in OBJ model');
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
