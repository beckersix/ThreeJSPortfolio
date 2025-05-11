/**
 * SceneController.js
 * A class for managing the overall 3D scene
 */

// QuadTree implementation for spatial partitioning of the cube grid.
// This allows for efficient queries of cubes near a given position.
class QuadTree {
    constructor(boundary, capacity = 8) {
        this.boundary = boundary; // {x, z, width, height}
        this.capacity = capacity; // Max cubes before subdivision
        this.cubes = [];
        this.divided = false;
        this.northEast = null;
        this.northWest = null;
        this.southEast = null;
        this.southWest = null;
    }

    // Subdivide this quad into four quads
    subdivide() {
        const x = this.boundary.x;
        const z = this.boundary.z;
        const w = this.boundary.width / 2;
        const h = this.boundary.height / 2;

        this.northEast = new QuadTree({x: x + w, z: z - h, width: w, height: h}, this.capacity);
        this.northWest = new QuadTree({x: x - w, z: z - h, width: w, height: h}, this.capacity);
        this.southEast = new QuadTree({x: x + w, z: z + h, width: w, height: h}, this.capacity);
        this.southWest = new QuadTree({x: x - w, z: z + h, width: w, height: h}, this.capacity);

        this.divided = true;

        // Move existing cubes into children
        for (let i = 0; i < this.cubes.length; i++) {
            this.northEast.insert(this.cubes[i]) ||
            this.northWest.insert(this.cubes[i]) ||
            this.southEast.insert(this.cubes[i]) ||
            this.southWest.insert(this.cubes[i]);
        }
        
        this.cubes = []; // Clear this node's cubes
    }

    // Insert a cube into this quad
    insert(cube) {
        // Check if cube is in this quad's boundary
        if (!this.contains(cube)) {
            return false;
        }

        // If there's space, add the cube here
        if (this.cubes.length < this.capacity && !this.divided) {
            this.cubes.push(cube);
            return true;
        }

        // Otherwise, subdivide if needed and add to children
        if (!this.divided) {
            this.subdivide();
        }

        return this.northEast.insert(cube) ||
               this.northWest.insert(cube) ||
               this.southEast.insert(cube) ||
               this.southWest.insert(cube);
    }

    // Check if a cube is within this quad's boundary
    contains(cube) {
        return cube.x >= this.boundary.x - this.boundary.width &&
               cube.x <= this.boundary.x + this.boundary.width &&
               cube.z >= this.boundary.z - this.boundary.height &&
               cube.z <= this.boundary.z + this.boundary.height;
    }

    // Query all cubes in a circular range
    query(range, found = []) {
        // Range is {x, z, radius}
        
        // Early return if range doesn't intersect this quad
        if (!this.intersectsCircle(range)) {
            return found;
        }

        // Check cubes in this quad
        for (let i = 0; i < this.cubes.length; i++) {
            const cube = this.cubes[i];
            const dx = cube.x - range.x;
            const dz = cube.z - range.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist <= range.radius) {
                found.push(cube);
            }
        }

        // Recursively check children if this quad is divided
        if (this.divided) {
            this.northEast.query(range, found);
            this.northWest.query(range, found);
            this.southEast.query(range, found);
            this.southWest.query(range, found);
        }

        return found;
    }

    // Check if this quad intersects with a circle
    intersectsCircle(circle) {
        // Find closest point to circle center within rectangle
        const closestX = Math.max(this.boundary.x - this.boundary.width, 
                         Math.min(circle.x, this.boundary.x + this.boundary.width));
        const closestZ = Math.max(this.boundary.z - this.boundary.height, 
                         Math.min(circle.z, this.boundary.z + this.boundary.height));
        
        // Calculate distance between closest point and circle center
        const dx = closestX - circle.x;
        const dz = closestZ - circle.z;
        const distanceSquared = dx*dx + dz*dz;
        
        return distanceSquared <= (circle.radius * circle.radius);
    }
}

// SceneController class - manages the overall 3D scene
function SceneController() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.player = null; // The player object (cone)
    this.cubes = []; // Array for colored cubes
    this.clock = new THREE.Clock(); // Clock for animations
    this.splineLoader = null;
    this.cameraController = null;
    this.scrollY = 0; // Track scroll position
    this.initialized = false;
    this.sceneFilePath = '/static/models/Scene.obj';
    
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
    this.scene.fog = new THREE.FogExp2(fogColor, 0.0045);  // Exponential fog with moderate density
    
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
    
    // Add debug floor grid
    const gridHelper = new THREE.GridHelper(10000, 10000);
    gridHelper.position.y = 0;
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
    
    // Skip the fallback spline and only use the OBJ path
    // this.createSineWaveSpline();
    
    // Load the OBJ model with camera path
    // This will happen asynchronously
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
            } else {
                console.error('No camera path found in OBJ model');
            }
        }
    });
    
    // Start creating the cube grid (this will proceed asynchronously)
    this.updatePreloader(25, 'Creating cube grid...');
    setTimeout(() => {
        // Using setTimeout to ensure preloader updates are visible
        this.createCubes(); 
    }, 200);
    
    // Configure camera controller for interaction
    this.cameraController = new CameraController(this.camera, this.player);
    
    // Setup animation loop
    this.animate();
    
    // Add window resize handler
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Mark as initialized
    this.initialized = true;
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

// Create player object (cone)
SceneController.prototype.createPlayer = function() {
    const coneGeometry = new THREE.ConeGeometry(0.5, 1, 16);
    const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.player = new THREE.Mesh(coneGeometry, coneMaterial);
    this.player.position.set(0, 0, 0);
    this.player.rotation.x = Math.PI; // Pointing forward
    this.scene.add(this.player);
};

// Create a huge flat grid of cubes in X-Z plane using GPU instancing
SceneController.prototype.createCubes = function() {
    console.log('Creating cube grid...');
    
    // Update preloader status at start
    this.updatePreloader(30, 'Building cube grid...');
    
    // Remove previous instanced mesh if present
    if (this.cubeInstancedMesh) {
        this.scene.remove(this.cubeInstancedMesh);
        this.cubeInstancedMesh.dispose && this.cubeInstancedMesh.dispose();
    }
    
    // Reset cubes array and positions
    this.cubes = [];
    this.cubeGridPositions = {};

    // Grid configuration - SIGNIFICANTLY reduced for better performance
    const gridSizeZ = 550; // Reduced from 500 for much faster loading
    const gridSizeX = 250; // Reduced from 500 for much faster loading
    const spacing = 1.6;
    const halfX = (gridSizeX - 1) * spacing / 2;
    const halfZ = (gridSizeZ - 1) * spacing / 2;
    const size = 1.5;
    const color = 0x00ffcc;
    const gridY = -25; // Base grid height
    const gridZ = -50;
    const gridX = 0;
    const InitialFalloff = 0.0001;
    
    console.log(`Creating grid ${gridSizeX}x${gridSizeZ} (${gridSizeX * gridSizeZ} total cubes)`);
    
    // Create quadtree for spatial queries
    const boundary = {
        x: gridX,
        z: gridZ,
        width: halfX + 100, // Add margin
        height: halfZ + 100  // Add margin
    };
    this.quadTree = new QuadTree(boundary, 8);
    
    // Create instanced mesh for efficiency
    const cubeGeo = new THREE.BoxGeometry(size, size, size);
    const cubeMat = new THREE.MeshStandardMaterial({ 
        color: color,
        roughness: 0.5,
        metalness: 0.8
    });
    
    // Each cube will be positioned using a matrix transformation
    const totalCubes = gridSizeX * gridSizeZ;
    this.cubeInstancedMesh = new THREE.InstancedMesh(cubeGeo, cubeMat, totalCubes);
    this.cubeInstancedMesh.castShadow = true;
    this.cubeInstancedMesh.receiveShadow = true;
    
    // We're using the OBJ camera path instead of a local spline
    console.log('Using OBJ camera path for terrain:', this.objCameraPath ? 'available' : 'not yet loaded');
    
    // For tracking progress
    let cubesCreated = 0;
    let lastProgressUpdate = 0;
    
    // Use batch processing with timeouts to allow UI updates
    const processBatch = (ix, iz) => {
        // Process a much larger batch of cubes for better performance
        const batchSize = Math.min(gridSizeZ - iz, 300); // Increased to 250 for faster loading
        const dummy = new THREE.Object3D(); // Reuse a single dummy object for all matrix calculations
        
        // Precompute spline points for faster lookup - using more samples for smoother effect
        const splinePoints = [];
        const splineSteps = 50; // Increased for smoother spline sampling
        
        // Use the OBJ camera path for terrain height adjustment
        if (this.objCameraPath) {
            for (let t = 0; t <= splineSteps; t++) {
                const tt = t / splineSteps;
                splinePoints.push(this.objCameraPath.getPoint(tt));
            }
            
            // Log spline points for debugging
            if (ix === 0 && iz === 0) {
                console.log(`Precomputed ${splinePoints.length} spline points for terrain`);
            }
        }
        
        // Calculate actual batch size based on remaining cubes in this row
        const actualBatchSize = Math.min(batchSize, gridSizeZ - iz);
        const batchStartIndex = cubesCreated; // Remember starting index for this batch
        
        for (let i = 0; i < actualBatchSize; i++) {
            const currentIz = iz + i;
            
            const px = ix * spacing - halfX + gridX;
            const pz = currentIz * spacing - halfZ + gridZ;
            
            // Regular cube creation code
            let baseY = gridY;
            
            if (this.objCameraPath) {
                // Use precomputed points for faster lookup
                let closestT = 0;
                let minDist = Infinity;
                
                // Faster distance calculation using squared distance (avoid sqrt)
                for (let t = 0; t < splinePoints.length; t++) {
                    const pt = splinePoints[t];
                    const dx = pt.x - px;
                    const dz = pt.z - pz;
                    const distSq = dx*dx + dz*dz; // Squared distance is faster than sqrt
                    
                    if (distSq < minDist) {
                        minDist = distSq;
                        closestT = t / splineSteps;
                    }
                }
                
                const pathPt = this.objCameraPath.getPoint(closestT);
                
                // Calculate distance-based height that comes up closer to the spline
                // Use a base height that's closer to the spline height
                const splineHeight = pathPt.y;
                const baseHeight = splineHeight - 5; // Start just 5 units below the spline
                
                // Use an extremely gentle falloff that extends very far in X and Z
                const falloff = 1 / (1 + 0.00001 * minDist * minDist); // Very gentle falloff
                
                // Apply smoothstep for even smoother transitions at the edges
                const smoothFalloff = falloff * falloff * (3 - 2 * falloff);
                
                // Calculate height as a blend between grid base and spline-relative height
                // This makes terrain come up closer to the spline but still follow its contour
                const maxRaise = 15; // Maximum height raise
                const raise = smoothFalloff * maxRaise;
                
                // Apply the height effect - blend between grid base and spline-relative height
                baseY = gridY + raise;
                
                // Ensure we don't exceed the spline height
                baseY = Math.min(baseY, splineHeight - 1);
            }
            
            const key = `${ix}_${currentIz}`;
            const currentIndex = batchStartIndex + i; // Calculate exact index for this cube
            const cube = { x: px, z: pz, baseY, i: currentIndex, key };
            this.cubeGridPositions[key] = cube;
            
            // Insert into quadtree for spatial queries
            this.quadTree.insert(cube);
            
            // Set initial matrix - using the dummy object for better performance
            dummy.position.set(px, baseY, pz);
            dummy.updateMatrix();
            this.cubeInstancedMesh.setMatrixAt(currentIndex, dummy.matrix);
        }
        
        // Update cube count based on actual number created in this batch
        cubesCreated += actualBatchSize;
        
        // Calculate progress, capping at 98% to ensure we reach 100% at the end
        const progress = Math.min(30 + (cubesCreated / totalCubes) * 68, 98);
        
        // Only update UI every 5% to reduce DOM updates but still show progress
        if (progress - lastProgressUpdate >= 5) {
            this.updatePreloader(progress, `Creating cubes: ${cubesCreated}/${totalCubes}`);
            lastProgressUpdate = progress;
        }
        
        // Check if we're done or need to continue with next batch
        const isLastBatch = ix >= gridSizeX - 1 && iz + batchSize >= gridSizeZ;
        
        // Always update the instance matrix after each batch
        this.cubeInstancedMesh.instanceMatrix.needsUpdate = true;
        
        if (isLastBatch) {
            // This is the final batch - complete the loading process
            console.log('Final batch complete! Total cubes created:', cubesCreated);
            
            // Force update to 100% and hide preloader AFTER matrix update
            // Use a slight delay to ensure the GPU has time to process the matrix update
            setTimeout(() => {
                this.updatePreloader(100, 'Complete!');
                // Wait a bit longer before hiding the preloader
                setTimeout(() => this.hidePreloader(), 300);
            }, 100);
        } else {
            // Continue with next batch
            let nextIx = ix;
            let nextIz = iz + batchSize;
            
            if (nextIz >= gridSizeZ) {
                nextIx++;
                nextIz = 0;
            }
            
            // Use requestAnimationFrame for better performance
            // This ensures the current frame is rendered before processing the next batch
            requestAnimationFrame(() => processBatch(nextIx, nextIz));
        }
    };
    
    // Start the batched processing
    console.log('Starting batch processing...');
    processBatch(0, 0);
    
    // Mark instance matrix as needing update
    this.cubeInstancedMesh.instanceMatrix.needsUpdate = true;
    
    // Add to scene immediately
    this.scene.add(this.cubeInstancedMesh);
    
    // Use return to exit early - the rest happens asynchronously
    return;
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

// Create a floor grid for visual reference
SceneController.prototype.createFloorGrid = function() {
    console.log('Creating floor grid...');
    
    // Remove existing grid if any
    if (this.floorGrid) {
        this.scene.remove(this.floorGrid);
    }
    
    // Create a grid helper with 100 divisions of size 2
    this.floorGrid = new THREE.GridHelper(400, 100, 0x444444, 0x222222);
    this.floorGrid.position.y = -35.1; // Just below the cubes
    this.scene.add(this.floorGrid);
    console.log('Floor grid created');
};

// This function has been removed as we're now using the OBJ spline
// for both camera path and terrain height adjustment
SceneController.prototype.createSineWaveSpline = function() {
    console.log('Sine wave spline creation skipped - using OBJ spline instead');
    return null;
};

// Hide the preloader with a fade effect
SceneController.prototype.hidePreloader = function() {
    console.log('Hiding preloader, cube grid status:', this.cubeInstancedMesh ? 'created' : 'not created');
    console.log('Camera path status:', this.objCameraPath ? 'loaded from OBJ' : 'not loaded');
    
    if (!this.preloader || !this.preloader.overlay) {
        console.error('Preloader elements not available');
        return;
    }
    
    // Make sure critical components are ready before hiding preloader
    // Only check for cube mesh since we might not have the camera path yet
    if (!this.cubeInstancedMesh) {
        console.warn('Cube grid not ready, delaying preloader hide');
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
            console.log('Camera path:', this.objCameraPath || this.spline);
            console.log('Current progress:', window.scrollY / (document.body.scrollHeight - window.innerHeight));
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
    // Don't force preloader to 100% on first animation frame
    // Let the cube creation process control the preloader
    
    const self = this;
    
    requestAnimationFrame(function() {
        self.animate();
    });
    
    // Calculate progress (0 to 1) based on scroll position
    const scrollMax = document.body.scrollHeight - window.innerHeight;
    // Use window.pageYOffset as a fallback for older browsers
    const currentScroll = window.scrollY || window.pageYOffset || 0;
    const progress = Math.max(0, Math.min(currentScroll / scrollMax, 1));
    
    // Debug scroll position
    if (this._debugScroll) {
        console.log(`Scroll: ${currentScroll}/${scrollMax} = ${progress}`);
        this._debugScroll = false; // Only log once
    }
    
    // Update camera controller with proper path following
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

    // --- Only update cubes if player or camera has moved ---
    if (!this._lastPlayerPos) this._lastPlayerPos = {x: null, y: null, z: null};
    if (!this._lastCameraPos) this._lastCameraPos = {x: null, y: null, z: null};
    const player = this.player ? this.player.position : {x:0, y:0, z:0};
    const camera = this.camera.position;
    const playerMoved = player.x !== this._lastPlayerPos.x || player.y !== this._lastPlayerPos.y || player.z !== this._lastPlayerPos.z;
    const cameraMoved = camera.x !== this._lastCameraPos.x || camera.y !== this._lastCameraPos.y || camera.z !== this._lastCameraPos.z;

    // Animate cubes only if player or camera moved
    if ((playerMoved || cameraMoved) && this.cubeInstancedMesh && this.quadTree) {
        // More optimized animation approach with reasonable radius
        const effectCenter = player;
        const effectRadius = 80; // Reduced radius for better performance
        const queryRadius = 100; // Smaller search radius to reduce lag
        const dummy = new THREE.Object3D();
        
        // Use quadtree for fast spatial query - only process cubes that could be affected
        const nearbyCubes = this.quadTree.query({
            x: effectCenter.x,
            z: effectCenter.z,
            radius: queryRadius
        });
        
        // Only log occasionally to reduce console overhead
        if (Math.random() < 0.01) {
            console.log(`Processing ${nearbyCubes.length} cubes out of ${Object.keys(this.cubeGridPositions).length} total`);
        }
        
        // Set to keep track of the indices we've processed this frame
        const processed = new Set();
        
        // Process nearby cubes
        for (const cube of nearbyCubes) {
            // Fast distance calculation - use squared distance where possible to avoid sqrt
            const dx = cube.x - effectCenter.x;
            const dz = cube.z - effectCenter.z;
            const distSq = dx*dx + dz*dz;
            
            // Only calculate actual distance when needed
            const dist = Math.sqrt(distSq);
            
            processed.add(cube.i);
            
            // Massively wide falloff that spans the entire visible area
            if (dist < effectRadius) {
                // Use a much gentler falloff for smoother, less intense camera effect
                const falloff = 1 / (1 + 0.00002 * dist * dist); // Gentler falloff for smoother effect
                
                // Apply double smoothstep for extremely smooth transitions
                let smoothFalloff = falloff * falloff * (3 - 2 * falloff);
                // Apply second smoothstep for even smoother result
                smoothFalloff = smoothFalloff * smoothFalloff * (3 - 2 * smoothFalloff);
                
                // Calculate maximum height raise with reduced intensity
                const maxRaise = 8; // Reduced from 15 for less intense effect
                const raise = smoothFalloff * maxRaise;
                
                // Get current path position to ensure we don't exceed spline height
                // Cache the spline height calculation to avoid redundant calculations
                if (!this._cachedSplineHeight || this._lastProgressCheck !== window.scrollY) {
                    const scrollMax = document.body.scrollHeight - window.innerHeight;
                    const progress = Math.max(0, Math.min(window.scrollY / scrollMax, 1));
                    
                    if (this.objCameraPath) {
                        const pathPt = this.objCameraPath.getPoint(progress);
                        this._cachedSplineHeight = pathPt.y;
                        this._lastProgressCheck = window.scrollY;
                    } else {
                        this._cachedSplineHeight = 0;
                    }
                }
                
                const splineHeight = this._cachedSplineHeight;
                
                // Apply the height effect but ensure it doesn't exceed spline height
                const playerHeight = Math.min(cube.baseY + raise, splineHeight - 1);
                dummy.position.set(cube.x, playerHeight, cube.z);
                dummy.updateMatrix();
                this.cubeInstancedMesh.setMatrixAt(cube.i, dummy.matrix);
            } else {
                // Outside effect radius - restore to original height
                dummy.position.set(cube.x, cube.baseY, cube.z);
                dummy.updateMatrix();
                this.cubeInstancedMesh.setMatrixAt(cube.i, dummy.matrix);
            }
        }
        
        // If this is the first frame or a major camera movement, ensure ALL cubes are visible
        // This is essential for showing the entire grid properly
        // Only do this for very significant movements to reduce performance impact
        if (!this._initializedGrid || 
            Math.abs(camera.x - this._lastCameraPos.x) > 100 || 
            Math.abs(camera.z - this._lastCameraPos.z) > 100) {
            
            for (const key in this.cubeGridPositions) {
                const cube = this.cubeGridPositions[key];
                
                // Skip cubes we already processed above
                if (processed.has(cube.i)) continue;
                
                // Set all other cubes to their base height
                dummy.position.set(cube.x, cube.baseY, cube.z);
                dummy.updateMatrix();
                this.cubeInstancedMesh.setMatrixAt(cube.i, dummy.matrix);
            }
            
            this._initializedGrid = true;
        }
        
        this.cubeInstancedMesh.instanceMatrix.needsUpdate = true;
        // Store last positions
        this._lastPlayerPos = {x: player.x, y: player.y, z: player.z};
        this._lastCameraPos = {x: camera.x, y: camera.y, z: camera.z};
    }


    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
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
