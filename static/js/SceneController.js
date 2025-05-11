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
    this.scene.fog = new THREE.FogExp2(fogColor, 0.0035);  // Exponential fog with moderate density
    
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
    
    // First create a simple sine wave spline as a fallback
    this.createSineWaveSpline();
    console.log('Fallback spline initialized:', this.spline);
    
    // Then try to load the OBJ model with camera path
    // This will happen asynchronously
    this.updatePreloader(22, 'Loading 3D models...');
    
    // Path to your OBJ file - using the existing Scene.obj file
    const objPath = './static/models/Scene.obj';
    
    this.splineLoader.loadOBJModel(objPath, (loader, error) => {
        if (error) {
            console.warn('Failed to load OBJ model:', error);
            console.log('Using fallback sine wave spline instead');
        } else {
            console.log('OBJ model loaded successfully');
            // If the model has a camera path, use it instead of the sine wave
            if (loader && loader.cameraPath) {
                console.log('Using camera path from OBJ model');
                // Keep a reference to the loaded camera path
                this.objCameraPath = loader.cameraPath;
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

    // Grid configuration
    const gridSizeZ = 500; // Reduced from 700 for faster loading
    const gridSizeX = 500; // Reduced from 400 for faster loading
    const spacing = 1.6;
    const halfX = (gridSizeX - 1) * spacing / 2;
    const halfZ = (gridSizeZ - 1) * spacing / 2;
    const size = 1.5;
    const color = 0x00ffcc;
    const gridY = -35; // Base grid height
    const gridZ = -50;
    const gridX = 0;
    const InitialFalloff = 0.00001;
    
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
    
    // Initialize with the spline if available
    const spline = this.spline;
    console.log('Using spline:', spline);
    
    // For tracking progress
    let cubesCreated = 0;
    let lastProgressUpdate = 0;
    
    // Use batch processing with timeouts to allow UI updates
    const processBatch = (ix, iz) => {
        // Process a small batch of cubes - smaller batches for more frequent updates
        const batchSize = Math.min(gridSizeZ - iz, 20); 
        
        for (let i = 0; i < batchSize; i++) {
            const currentIz = iz + i;
            if (currentIz >= gridSizeZ) break; // Safety check
            
            const px = ix * spacing - halfX + gridX;
            const pz = currentIz * spacing - halfZ + gridZ;
            
            // Regular cube creation code
            let baseY = gridY;
            if (spline) {
                // Find closest point on spline in XZ 
                let closestT = 0;
                let minDist = Infinity;
                const steps = 100; // Reduced for faster processing
                
                // First coarse search
                for (let t = 0; t <= steps; t++) {
                    const tt = t / steps;
                    const pt = spline.getPoint(tt);
                    const dXZ = Math.sqrt((pt.x - px) * (pt.x - px) + (pt.z - pz) * (pt.z - pz));
                    if (dXZ < minDist) {
                        minDist = dXZ;
                        closestT = tt;
                    }
                }
                
                const pathPt = spline.getPoint(closestT);
                
                // Simple falloff function
                const falloffDist = Math.max(minDist, 0.001); // Prevent division by zero
                const falloff = Math.exp(-0.005 * falloffDist * falloffDist);
                
                // Apply falloff to height with smooth transition
                baseY = gridY + (pathPt.y - gridY) * falloff * 0.7;
            }
            
            const key = `${ix}_${currentIz}`;
            const cube = { x: px, z: pz, baseY, i: cubesCreated, key };
            this.cubeGridPositions[key] = cube;
            
            // Insert into quadtree for spatial queries
            this.quadTree.insert(cube);
            
            // Set initial matrix
            const matrix = new THREE.Matrix4().makeTranslation(px, baseY, pz);
            this.cubeInstancedMesh.setMatrixAt(cubesCreated, matrix);
            cubesCreated++;
            
            // Update progress with each batch
            // Scale to 30-90% range (60% of total loading allocated to cube creation)
            const progress = Math.floor((cubesCreated / totalCubes) * 60);
            if (progress > lastProgressUpdate) {
                lastProgressUpdate = progress;
                // Make preloader immediately visible with cube updates
                this.updatePreloader(30 + progress, `Creating grid: ${cubesCreated.toLocaleString()} / ${totalCubes.toLocaleString()} cubes`);
                console.log(`Progress: ${progress}% - Created ${cubesCreated} cubes`);
            }
        }
        
        // Move to next batch
        const nextIz = iz + batchSize;
        if (nextIz < gridSizeZ) {
            // Continue this row with a slight delay to let DOM update
            setTimeout(() => processBatch(ix, nextIz), 5); // Small delay to allow UI updates
        } else if (ix + 1 < gridSizeX) {
            // Move to next row
            setTimeout(() => processBatch(ix + 1, 0), 5); // Small delay to allow UI updates
        } else {
            // All done, add to scene
            this.scene.add(this.cubeInstancedMesh);
            this.cubeInstancedMesh.instanceMatrix.needsUpdate = true;
            console.log(`Completed creating ${cubesCreated} cubes`);
            
            // Create the floor grid now that cube grid is complete
            this.createFloorGrid();
            
            // Update preloader when all is complete
            this.updatePreloader(95, 'Finalizing scene...');
            
            // Make sure the spline is properly initialized
            if (!this.spline) {
                console.log('Re-creating spline as it was lost...');
                this.createSineWaveSpline();
                console.log('Spline re-initialized:', this.spline);
            }
            
            // Ensure camera controller is set up
            if (!this.cameraController && this.camera && this.player) {
                console.log('Re-initializing camera controller...');
                this.cameraController = new CameraController(this.camera, this.player);
            }
            
            // Complete the loading after a longer delay to ensure everything is ready
            setTimeout(() => {
                console.log('Scene fully loaded and ready!');
                this.updatePreloader(100, 'Ready!');
            }, 2000);
        }
    };
    
    // Start the batched processing
    console.log('Starting batch processing...');
    processBatch(0, 0);
    
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

// Creates a simple sine wave spline for testing
SceneController.prototype.createSineWaveSpline = function(numPoints = 40) {
    const points = [];
    
    // Generate a sine wave path
    for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        
        // Make a curved path with sine waves
        const x = 20 * Math.sin(t * Math.PI * 2);
        const y = 10 + 5 * Math.sin(t * Math.PI * 4);
        const z = -100 * t; // Go forward in Z
        
        points.push(new THREE.Vector3(x, y, z));
    }
    
    // Create a smooth curve through the points
    this.spline = new THREE.CatmullRomCurve3(points);
    console.log('Created sine wave spline with', points.length, 'points');
};

// Hide the preloader with a fade effect
SceneController.prototype.hidePreloader = function() {
    console.log('Hiding preloader, cube grid status:', this.cubeInstancedMesh ? 'created' : 'not created');
    console.log('Spline status:', this.spline ? 'created' : 'not created');
    
    if (!this.preloader || !this.preloader.overlay) {
        console.error('Preloader elements not available');
        return;
    }
    
    // Make sure critical components are ready before hiding preloader
    if (!this.cubeInstancedMesh || !this.spline) {
        console.warn('Critical components not ready, delaying preloader hide');
        setTimeout(() => this.hidePreloader(), 1000);
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
    const self = this;
    
    // Handle window resizing
    window.addEventListener('resize', function() {
        self.camera.aspect = window.innerWidth / window.innerHeight;
        self.camera.updateProjectionMatrix();
        self.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Handle scrolling to move along the camera path
    window.addEventListener('scroll', function() {
        self.scrollY = window.scrollY;
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
    const progress = Math.min(this.scrollY / scrollMax, 1);
    
    // Update camera controller
    // Priority 1: Use the loaded OBJ camera path if available
    if (this.splineLoader && this.splineLoader.cameraPath && this.cameraController) {
        this.cameraController.update(this.splineLoader, progress);
    }
    // Priority 2: Use the OBJ camera path reference if available
    else if (this.objCameraPath && this.cameraController) {
        // Create a compatible adapter for the OBJ camera path
        if (!this._objPathAdapter) {
            this._objPathAdapter = {
                cameraPath: this.objCameraPath,
                getPointOnPath: function(t) {
                    return this.cameraPath.getPoint(t);
                }
            };
        }
        // Make sure the adapter has the latest path
        this._objPathAdapter.cameraPath = this.objCameraPath;
        // Use the adapter with the camera controller
        this.cameraController.update(this._objPathAdapter, progress);
    }
    // Priority 3: Fallback to the sine wave spline
    else if (this.spline && this.cameraController) {
        // Create a compatible adapter for the spline
        if (!this._splineAdapter) {
            this._splineAdapter = {
                cameraPath: this.spline,
                getPointOnPath: function(t) {
                    return this.cameraPath.getPoint(t);
                }
            };
        }
        // Make sure the adapter has the latest spline
        this._splineAdapter.cameraPath = this.spline;
        // Use the adapter with the camera controller
        this.cameraController.update(this._splineAdapter, progress);
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
        // Much simpler animation approach
        const effectCenter = player;
        const effectRadius = 50;
        const queryRadius = 100; // Slightly larger search radius
        const dummy = new THREE.Object3D();
        
        // Use quadtree for fast spatial query - only process cubes that could be affected
        const nearbyCubes = this.quadTree.query({
            x: effectCenter.x,
            z: effectCenter.z,
            radius: queryRadius
        });
        
        console.log(`Processing ${nearbyCubes.length} cubes out of ${Object.keys(this.cubeGridPositions).length} total`); 
        
        // Set to keep track of the indices we've processed this frame
        const processed = new Set();
        
        // Process nearby cubes
        for (const cube of nearbyCubes) {
            // Fast distance calculation
            const dx = cube.x - effectCenter.x;
            const dz = cube.z - effectCenter.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            processed.add(cube.i);
            
            // Simple Gaussian falloff - no complex blending needed
            if (dist < effectRadius) {
                const falloff = Math.exp(-0.01 * dist * dist);
                const raise = falloff * 8 * 0.5; // 50% height reduction
                
                // Apply the height effect
                dummy.position.set(cube.x, cube.baseY + raise, cube.z);
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
        if (!this._initializedGrid || 
            Math.abs(camera.x - this._lastCameraPos.x) > 50 || 
            Math.abs(camera.z - this._lastCameraPos.z) > 50) {
            
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
