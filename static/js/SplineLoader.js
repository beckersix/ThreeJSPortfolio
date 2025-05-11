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
    this.roadObject = null; // Store the road object for collision detection
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
    
    // Clear any existing instanced meshes
    this.instancedMeshes = [];
    this.effectors = [];
    
    console.log('Loading OBJ model from:', url);
    
    this.objLoader.load(url, function(object) {
        console.log('OBJ model loaded successfully');
        
        // Count all meshes in the OBJ file for debugging
        let totalMeshCount = 0;
        let meshNames = [];
        let meshPositions = [];
        object.traverse(child => {
            if (child.type === 'Mesh' && child.geometry) {
                totalMeshCount++;
                meshNames.push(child.name);
                
                // Get world position for debugging
                child.updateMatrixWorld(true);
                const position = new THREE.Vector3();
                position.setFromMatrixPosition(child.matrixWorld);
                meshPositions.push(`${child.name}: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
            }
        });
        console.log(`Total meshes in OBJ file: ${totalMeshCount}`);
        console.log('All mesh names:', meshNames);
        console.log('All mesh positions:', meshPositions);
        
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
        
        // Force update of all world matrices to ensure correct world positions
        object.updateMatrixWorld(true);
        
        // Log all object names and types in the OBJ hierarchy
        console.log('=== UPDATING WORLD MATRICES FOR ALL OBJECTS ===');
        function logNames(obj, depth = 0) {
            console.log(' '.repeat(depth * 2) + obj.name + ' (' + obj.type + ')');
            
            // Log position information for debugging
            if (obj.type === 'Mesh' || obj.type === 'Object3D') {
                const worldPos = new THREE.Vector3();
                worldPos.setFromMatrixPosition(obj.matrixWorld);
                console.log(' '.repeat(depth * 2) + '  World Position:', 
                          worldPos.x.toFixed(2), worldPos.y.toFixed(2), worldPos.z.toFixed(2));
            }
            
            if (obj.children) obj.children.forEach(child => logNames(child, depth + 1));
        }
        SplineLoader.prototype.logNames = logNames;
        logNames(object);
        
        // Collect meshes by type for instancing
        const meshEntries = [];
        
        // Traverse the object to collect all meshes
        object.traverse(function(child) {
            // Skip the camera path object
            if (child.name === 'camera_path') {
                child.visible = false;
                return;
            }
            
            // Only process meshes with geometry
            if (child.type === 'Mesh' && child.geometry) {
                // Skip camera path objects
                if (child.name === 'camera_path') {
                    child.visible = false;
                    return;
                }
                
                // Check if this is an effector
                const isEffector = child.name.toLowerCase().includes('effector') || 
                                  child.name.toLowerCase().includes('effect') || 
                                  child.name.toLowerCase().includes('emitter');
                
                if (isEffector) {
                    // Make the original object invisible
                    child.visible = false;
                    
                    // Get a random vertex from the geometry as the effector point
                    let position;
                    
                    if (child.geometry && child.geometry.isBufferGeometry) {
                        // Get the position attribute from the buffer geometry
                        const positionAttr = child.geometry.getAttribute('position');
                        
                        if (positionAttr && positionAttr.count > 0) {
                            // Select a random vertex
                            const randomVertexIndex = Math.floor(Math.random() * positionAttr.count);
                            position = new THREE.Vector3();
                            position.fromBufferAttribute(positionAttr, randomVertexIndex);
                            
                            // Apply the object's world matrix to get the world position
                            child.updateMatrixWorld(true);
                            position.applyMatrix4(child.matrixWorld);
                            
                            console.log(`Selected random vertex ${randomVertexIndex} from ${positionAttr.count} vertices for effector ${child.name}`);
                        } else {
                            // Fallback to object position if no vertices
                            position = new THREE.Vector3();
                            child.updateMatrixWorld(true);
                            position.setFromMatrixPosition(child.matrixWorld);
                            console.log(`No vertices found in geometry for ${child.name}, using center position`);
                        }
                    } else {
                        // Fallback to object position if no geometry
                        position = new THREE.Vector3();
                        child.updateMatrixWorld(true);
                        position.setFromMatrixPosition(child.matrixWorld);
                        console.log(`No geometry found for ${child.name}, using center position`);
                    }
                    
                    // Add to effectors list with position only
                    self.effectors.push({
                        name: child.name,
                        position: position
                    });
                    
                    console.log(`Added effector position: ${child.name} at random vertex (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
                } else {
                    // For non-effectors, make sure they're visible and apply a colorful material
                    child.visible = true;
                    
                    // Check if this is a road
                    const isRoad = child.name.toLowerCase().includes('road') || 
                                  child.name.toLowerCase().includes('path') || 
                                  child.name.toLowerCase().includes('track') || 
                                  child.name.toLowerCase().includes('street');
                    
                    if (isRoad) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0x0a0a0a, // Very dark black
                            roughness: 0.9,   // Very rough
                            metalness: 0.1,   // Low metalness
                            envMapIntensity: 0.2 // Low reflection
                        });
                    } else {
                        // Regular object with random color
                        const colorIndex = Math.floor(Math.random() * colors.length);
                        child.material = new THREE.MeshStandardMaterial({
                            color: colors[colorIndex],
                            roughness: 0.5,
                            metalness: 0.8
                        });
                    }
                    
                    // Disable frustum culling to ensure all objects are rendered
                    child.frustumCulled = false;
                    
                    // Push to meshes array
                    self.instancedMeshes.push(child);
                }
                
                // Log the object for debugging
                child.updateMatrixWorld(true);
            }
        });
        
        // Skip mesh collection, just add the objects directly
        console.log('Adding the scene to the main scene...');
        self.scene.add(object);
        
        // Count meshes in the scene
        console.log(`Added ${self.instancedMeshes.length} visible meshes to the scene`);
        
        // Look for camera path
        const cameraPathObj = self._findObjectByName(object, 'camera_path');
        if (cameraPathObj) {
            console.log('Found camera path object:', cameraPathObj);
            const points = self._extractPoints(cameraPathObj);
            if (points.length > 0) {
                self.cameraPath = new THREE.CatmullRomCurve3(points);
                console.log('Created camera path with', points.length, 'points');
                
                // Create a visual representation of the path (for debugging)
                const geometry = new THREE.BufferGeometry().setFromPoints(
                    self.cameraPath.getPoints(100)
                );
                const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
                const curve = new THREE.Line(geometry, material);
                self.scene.add(curve);
            }
        } else {
            console.log('No camera path found, creating default path');
            self.createSineWaveSpline();
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

// Find the road object in the loaded model for collision detection
SplineLoader.prototype.findRoadObject = function(object) {
    // Check if this object is the road based on name
    if (object.name && (
        object.name.toLowerCase().includes('road') ||
        object.name.toLowerCase().includes('path') ||
        object.name.toLowerCase().includes('track') ||
        object.name.toLowerCase().includes('street')
    )) {
        console.log(`Found road object: ${object.name}`);
        
        // Store the road object for collision detection
        this.roadObject = object;
        
        // If it has geometry, log details
        if (object.geometry) {
            console.log(`Road geometry: vertices=${object.geometry.attributes?.position?.count || 'unknown'}`);
            
            // Create a bounding box for the road
            if (!object.geometry.boundingBox) {
                object.geometry.computeBoundingBox();
            }
            
            // Log the bounding box
            const box = object.geometry.boundingBox;
            if (box) {
                console.log(`Road bounding box: min=(${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}), ` +
                            `max=(${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)})`);
            }
        }
        
        return true;
    }
    
    // Recursively check children
    if (object.children && object.children.length > 0) {
        for (let i = 0; i < object.children.length; i++) {
            if (this.findRoadObject(object.children[i])) {
                return true;
            }
        }
    }
    
    return false;
};

// Find all objects named 'effector' or 'effector.XXX' in the loaded model
SplineLoader.prototype.findEffectors = function(object) {
    // We only want to clear once at the beginning of the model loading process
    // This static flag ensures we're not clearing the array during recursive calls
    if (!SplineLoader._effectorSearchInitialized) {
        console.log('=== EFFECTOR DETECTION STARTED ===');
        this.effectors = [];
        SplineLoader._effectorSearchInitialized = true;
        
        // Reset this flag when loading is completed (after a delay)
        setTimeout(() => {
            SplineLoader._effectorSearchInitialized = false;
            console.log('=== EFFECTOR DETECTION COMPLETED ===');
            console.log(`Found ${this.effectors.length} effectors in OBJ model:`);
            
            // Create a table for better visualization of effector positions
            console.table(this.effectors.map(e => ({
                name: e.name,
                x: parseFloat(e.position.x.toFixed(2)),
                y: parseFloat(e.position.y.toFixed(2)),
                z: parseFloat(e.position.z.toFixed(2))
            })));
            
            this.effectors.forEach(e => {
                // Make sure the effector object is visible
                if (e.object) {
                    e.object.visible = true;
                    console.log(`  - Made ${e.name} visible`);
                    
                    // Apply a special material to make it stand out
                    if (e.object.material) {
                        e.object.material = new THREE.MeshStandardMaterial({
                            color: 0xff00ff, // Bright pink
                            emissive: 0xff00ff,
                            emissiveIntensity: 0.5,
                            metalness: 1.0,
                            roughness: 0.2
                        });
                    }
                }
            });
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
        // Make sure the effector is visible
        object.visible = true;
        
        // Calculate the center position of the geometry (average of all vertices)
        let position;
        
        if (object.geometry && object.geometry.attributes && object.geometry.attributes.position) {
            // Get position attribute from geometry
            const positionAttr = object.geometry.attributes.position;
            const vertexCount = positionAttr.count;
            
            if (vertexCount > 0) {
                // Calculate the center by averaging all vertices
                const center = new THREE.Vector3();
                const tempVertex = new THREE.Vector3();
                
                // Sum all vertex positions
                for (let i = 0; i < vertexCount; i++) {
                    tempVertex.fromBufferAttribute(positionAttr, i);
                    center.add(tempVertex);
                }
                
                // Divide by vertex count to get average
                center.divideScalar(vertexCount);
                
                // Apply object's world matrix to get world position
                object.updateMatrixWorld(true);
                position = center.clone().applyMatrix4(object.matrixWorld);
                
                console.log(`USING GEOMETRY CENTER: ${object.name} (avg of ${vertexCount} vertices) at position (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
            } else {
                console.log(`No vertices found in ${object.name}, using world position`);
                position = new THREE.Vector3();
                object.updateMatrixWorld(true);
                position.setFromMatrixPosition(object.matrixWorld);
            }
        } else {
            // Fallback to world position if no geometry
            position = new THREE.Vector3();
            object.updateMatrixWorld(true);
            position.setFromMatrixPosition(object.matrixWorld);
            console.log(`No geometry found for ${object.name}, using world position (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
        }
        
        // Apply a special material to make it stand out
        if (object.material) {
            object.material = new THREE.MeshStandardMaterial({
                color: 0xff00ff, // Bright pink
                emissive: 0xff00ff,
                emissiveIntensity: 0.5,
                metalness: 1.0,
                roughness: 0.2
            });
        }
        
        // Store the effector with its position
        this.effectors.push({
            name: object.name,
            position: position,
            object: object
        });
        
        console.log(`Added effector: ${object.name} and made it visible`);
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

// Get all instanced meshes
SplineLoader.prototype.getInstancedMeshes = function() {
    if (!this.instancedMeshes) {
        console.warn('InstancedMeshes array is undefined, initializing empty array');
        this.instancedMeshes = [];
    }
    
    console.log(`Returning ${this.instancedMeshes.length} instanced meshes from SplineLoader`);
    return this.instancedMeshes;
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
