/**
 * SplineLoader.js
 * Loads an FBX scene and extracts a CatmullRomCurve3 from an object named 'camera_path'.
 */

function SplineLoader(scene) {
    this.scene = scene;
    this.fbxLoader = new THREE.FBXLoader();
    this.objLoader = null; // Lazy init
    this.cameraPath = null;
    this.pathPoints = [];
    this.effectors = []; // Initialize the effectors array
}

// Returns a point on the camera path at parameter t (0 to 1)
SplineLoader.prototype.getPointOnPath = function(t) {
    if (this.cameraPath && typeof this.cameraPath.getPoint === 'function') {
        return this.cameraPath.getPoint(t);
    }
    return null;
};

// Loads an OBJ scene and extracts the camera path
SplineLoader.prototype.loadOBJModel = function(url, callback) {
    const self = this;
    if (!this.objLoader) {
        this.objLoader = new THREE.OBJLoader();
    }
    this.objLoader.load(url, function(object) {
        // Before adding to scene, apply materials with different colors but same properties as cubes
        // Define a set of vibrant colors to use for objects
        const colors = [
            0x00ffcc, // Original cube color
            0xff1493, // Deep pink
            0x4169e1, // Royal blue
            0xff8c00, // Dark orange
            0x32cd32, // Lime green
            0x9932cc, // Dark orchid
            0xff4500, // Orange red
            0x00bfff, // Deep sky blue
            0xffff00, // Yellow
            0x00ff7f  // Spring green
        ];
        
        let colorIndex = 0;
        
        // Recursively traverse the object tree and apply materials
        function applyMaterials(obj) {
            // Skip the camera path object as it should remain invisible
            if (obj.name === 'camera_path') {
                obj.visible = false; // Hide camera path
                return;
            }
            
            // Only apply material to meshes with geometry
            if (obj.type === 'Mesh' && obj.geometry) {
                // Pick a color from our palette and cycle through them
                const color = colors[colorIndex % colors.length];
                colorIndex++;
                
                // Create a new material with the same properties as our cubes
                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.5,
                    metalness: 0.8
                });
                
                // Apply this material to the object
                obj.material = material;
                console.log(`Applied color ${color.toString(16)} to ${obj.name}`);
            }
            
            // Process children recursively
            if (obj.children && obj.children.length > 0) {
                obj.children.forEach(child => applyMaterials(child));
            }
        }
        
        // Apply materials to all objects
        applyMaterials(object);
        
        // Now add to scene
        self.scene.add(object);
        
        // Log all object names and types in the OBJ hierarchy
        function logNames(obj, depth = 0) {
            console.log(' '.repeat(depth * 2) + obj.name + ' (' + obj.type + ')');
            if (obj.children) obj.children.forEach(child => logNames(child, depth + 1));
        }
        SplineLoader.prototype.logNames = logNames;
        logNames(object);
        
        // Find all effectors in the scene and store them
        if (!self.effectors) {
            self.effectors = [];
        }
        self.findEffectors(object);
            
        // Find 'camera_path' and extract points
        const cameraPathObj = self._findObjectByName(object, 'camera_path');
        if (cameraPathObj && cameraPathObj.geometry) {
            self.pathPoints = self._extractPoints(cameraPathObj);
            if (self.pathPoints.length > 1) {
                // Resample the curve for smoothness
                const tempCurve = new THREE.CatmullRomCurve3(self.pathPoints);
                self.pathPoints = tempCurve.getSpacedPoints(200);
                self.cameraPath = new THREE.CatmullRomCurve3(self.pathPoints);
            }
        }
        
        if (cameraPathObj) {
            console.log('camera_path object:', cameraPathObj);
            if (cameraPathObj.geometry) {
                console.log('camera_path geometry:', cameraPathObj.geometry);
                if (cameraPathObj.geometry.attributes && cameraPathObj.geometry.attributes.position) {
                    console.log('position attribute:', cameraPathObj.geometry.attributes.position);
                    console.log('position count:', cameraPathObj.geometry.attributes.position.count);
                } else {
                    console.log('No position attribute found on camera_path geometry');
                }
            } else {
                console.log('camera_path has no geometry');
            }
        }
        
        if (callback) callback(self);
    }, undefined, function(error) {
        if (callback) callback(null, error);
    });
};

// Recursively find an object by name
SplineLoader.prototype._findObjectByName = function(object, name) {
    if (object.name === name) return object;
    if (object.children) {
        for (let i = 0; i < object.children.length; i++) {
            const found = this._findObjectByName(object.children[i], name);
            if (found) return found;
        }
    }
    return null;
};

// Extracts world-space points from geometry
SplineLoader.prototype._extractPoints = function(obj) {
    const points = [];
    const geom = obj.geometry;
    if (geom.isBufferGeometry && geom.attributes.position) {
        const pos = geom.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const point = new THREE.Vector3().fromBufferAttribute(pos, i);
            point.applyMatrix4(obj.matrixWorld);
            points.push(point);
        }
    } else if (geom.vertices) {
        geom.vertices.forEach(v => {
            points.push(v.clone().applyMatrix4(obj.matrixWorld));
        });
    }
    return points;
};

// Find all objects named 'effector' or 'effector.XXX' in the loaded model
SplineLoader.prototype.findEffectors = function(object) {
    // We only want to clear once at the beginning of the model loading process
    // This static flag ensures we're not clearing the array during recursive calls
    if (!SplineLoader._effectorSearchInitialized) {
        console.log('Starting new effector search, clearing previous effectors');
        this.effectors = [];
        SplineLoader._effectorSearchInitialized = true;
        
        // Reset this flag when loading is completed (after a delay)
        setTimeout(() => {
            SplineLoader._effectorSearchInitialized = false;
            console.log('Effector search completed, found', this.effectors.length, 'effectors');
            this.effectors.forEach(e => console.log(' -', e.name));
        }, 1000);
    }
    
    // Check for various effector naming patterns - be more flexible with detection
    if (object.name && (
        object.name === 'effector' || 
        object.name.startsWith('effector.') ||
        object.name.startsWith('Effector') ||
        object.name.toLowerCase().includes('effector') ||
        object.name.toLowerCase().includes('effect') ||
        object.name.toLowerCase().includes('emitter')
    )) {
        // Convert to world coordinates if needed
        object.updateMatrixWorld(true);
        const worldPosition = new THREE.Vector3();
        worldPosition.setFromMatrixPosition(object.matrixWorld);
        
        console.log('Found effector:', object.name);
        console.log('  Local position:', object.position.x, object.position.y, object.position.z);
        console.log('  World position:', worldPosition.x, worldPosition.y, worldPosition.z);
        
        this.effectors.push({
            name: object.name,
            position: worldPosition, // Use world position instead of local
            object: object
        });
        
        // Make the effector visible with a distinct material
        if (object.type === 'Mesh') {
            // Create a glowing material for the effector
            const effectorMaterial = new THREE.MeshStandardMaterial({
                color: 0x00ffff,
                emissive: 0x00aaaa,
                metalness: 0.9,
                roughness: 0.1
            });
            object.material = effectorMaterial;
            
            // Add a point light
            const effectorLight = new THREE.PointLight(0x00ffff, 1, 20);
            effectorLight.position.set(0, 1, 0);
            object.add(effectorLight);
        }
    }
    
    // Recursively check all children
    if (object.children && object.children.length > 0) {
        object.children.forEach(child => {
            this.findEffectors(child);
        });
    }
};

// Get stored effectors
SplineLoader.prototype.getEffectors = function() {
    if (!this.effectors) {
        console.warn('Effectors array is undefined, initializing empty array');
        this.effectors = [];
    }
    
    console.log(`Returning ${this.effectors.length} effectors from SplineLoader`);
    return this.effectors;
};

// Creates a simple sine wave spline for testing
SplineLoader.prototype.createSineWaveSpline = function(numPoints = 40) {
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
    this.cameraPath = new THREE.CatmullRomCurve3(points);
    console.log('Created sine wave spline with', points.length, 'points');
    return this.cameraPath;
};

// Export
window.SplineLoader = SplineLoader;
