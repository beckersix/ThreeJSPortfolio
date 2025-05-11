/**
 * GridManager.js
 * Manages a large grid of cubes with dynamic effects from multiple sources
 */

class GridManager {
    constructor(scene, options = {}) {
        this.scene = scene;
        
        // Configure grid options with defaults
        this.config = Object.assign({
            // Grid dimensions
            gridSizeX: 550,
            gridSizeZ: 550,
            spacing: 1.6,
            baseHeight: -15,
            gridX: 0,
            gridZ: -50,
            
            // Cube properties
            cubeSize: 0.8,
            cubeColor: 0x00ffcc,
            initialScale: 0.2,
            maxScale: 2.0,  // Maximum scale for cubes
            
            // Effect parameters
            splineFalloff: 0.00000001,  // How quickly the spline effect falls off with distance
            splineHeight: 25,          // Maximum height effect from spline
            effectorFalloff: 0.0005,   // How quickly effector effects fall off with distance
            effectorHeight: 15,        // Maximum height effect from effectors
            
            // Performance settings
            batchSize: 300,
            initialFalloff: 0.00000001
        }, options);
        
        // Set up collections
        this.cubes = {};          // All cube data indexed by key
        this.effectors = [];      // All active effectors (player, custom, etc.)
        this.visualizers = {};    // Visual representations of effectors
        
        // Initialize physics values
        this.time = 0;            // Internal time counter for animations
        this.noiseScale = 0.02;   // Scale factor for noise
        this.noiseSpeed = 0.2;    // Speed of noise animation
        this.noiseAmplitude = 0.5; // Height of noise effect
        
        // Create spatial data structure
        this.initQuadTree();
        
        // Create instanced mesh for all cubes
        this.createInstancedMesh();
        
        // Set ready flag
        this.ready = false;
    }
    
    // Initialize the quadtree for spatial partitioning
    initQuadTree() {
        const halfX = (this.config.gridSizeX - 1) * this.config.spacing / 2;
        const halfZ = (this.config.gridSizeZ - 1) * this.config.spacing / 2;
        
        const boundary = {
            x: this.config.gridX,
            z: this.config.gridZ,
            width: halfX + 100,  // Add margin
            height: halfZ + 100  // Add margin
        };
        
        this.quadTree = new QuadTree(boundary, 8);
    }
    
    // Create the instanced mesh for all cubes
    createInstancedMesh() {
        console.log('Creating instanced mesh for cubes...');
        try {
            // Create geometry and material
            const cubeGeo = new THREE.BoxGeometry(
                this.config.cubeSize, 
                this.config.cubeSize, 
                this.config.cubeSize
            );
            
            const cubeMat = new THREE.MeshStandardMaterial({ 
                color: this.config.cubeColor,
                roughness: 0.5,
                metalness: 0.8
            });
            
            // Calculate total cubes
            const totalCubes = this.config.gridSizeX * this.config.gridSizeZ;
            console.log(`Creating instanced mesh for ${totalCubes} cubes...`);
            
            // Create instanced mesh
            this.instancedMesh = new THREE.InstancedMesh(cubeGeo, cubeMat, totalCubes);
            this.instancedMesh.castShadow = true;
            this.instancedMesh.receiveShadow = true;
            
            // Add to scene
            this.scene.add(this.instancedMesh);
            console.log('Instanced mesh added to scene successfully');
        } catch (error) {
            console.error('Error creating instanced mesh:', error);
        }
    }
    
    // Create the grid of cubes with progress callback
    createGrid(onProgress) {
        this.ready = false;
        console.log('Starting grid creation with GridManager...');
        
        try {
            // Check if instanced mesh was created properly
            if (!this.instancedMesh) {
                console.error('Instanced mesh is not defined - recreating');
                this.createInstancedMesh();
                
                // If still not created, can't proceed
                if (!this.instancedMesh) {
                    console.error('Failed to create instanced mesh, cannot generate grid');
                    if (onProgress) onProgress(1.0); // Signal completion despite error
                    return;
                }
            }
            
            // Grid calculations
            const halfX = (this.config.gridSizeX - 1) * this.config.spacing / 2;
            const halfZ = (this.config.gridSizeZ - 1) * this.config.spacing / 2;
            const dummy = new THREE.Object3D();
            
            let cubesCreated = 0;
            const totalCubes = this.config.gridSizeX * this.config.gridSizeZ;
            console.log(`Creating grid of ${this.config.gridSizeX}x${this.config.gridSizeZ} = ${totalCubes} cubes`);
            
            // Process batches of cubes
            const processBatch = (ix, iz) => {
                try {
                    const batchSize = Math.min(this.config.gridSizeZ - iz, this.config.batchSize);
                    const batchStartIndex = cubesCreated;
                    
                    for (let i = 0; i < batchSize; i++) {
                        const currentIz = iz + i;
                        
                        // Calculate position
                        const px = ix * this.config.spacing - halfX + this.config.gridX;
                        const pz = currentIz * this.config.spacing - halfZ + this.config.gridZ;
                        let baseY = this.config.baseHeight;
                        
                        // Create cube data
                        const key = `${ix}_${currentIz}`;
                        const currentIndex = batchStartIndex + i;
                        const cube = { 
                            x: px, 
                            z: pz, 
                            baseY, 
                            y: baseY, // Current y (may change with effects)
                            i: currentIndex, 
                            key,
                            scale: this.config.initialScale,
                            // Add additional physics properties
                            velocity: 0,
                            acceleration: 0,
                            noise: 0
                        };
                        
                        // Store and index the cube
                        this.cubes[key] = cube;
                        
                        // Add to spatial index
                        this.quadTree.insert(cube);
                        
                        // Set initial matrix
                        dummy.position.set(px, baseY, pz);
                        dummy.scale.set(this.config.initialScale, this.config.initialScale, this.config.initialScale);
                        dummy.updateMatrix();
                        this.instancedMesh.setMatrixAt(currentIndex, dummy.matrix);
                    }
                    
                    // Update instance matrix after each batch
                    this.instancedMesh.instanceMatrix.needsUpdate = true;
                    
                    // Update progress counter
                    cubesCreated += batchSize;
                    const progress = Math.min(cubesCreated / totalCubes, 1);
                    
                    // Report progress
                    if (onProgress) {
                        onProgress(progress);
                    }
                    
                    // Check if done or continue with next batch
                    const isLastBatch = ix >= this.config.gridSizeX - 1 && 
                                      iz + batchSize >= this.config.gridSizeZ;
                    
                    if (isLastBatch) {
                        // Complete
                        this.ready = true;
                        if (onProgress) onProgress(1.0); // 100% complete
                        console.log(`Grid creation complete. Created ${cubesCreated} cubes.`);
                    } else {
                        // Continue with next batch
                        let nextIx = ix;
                        let nextIz = iz + batchSize;
                        
                        if (nextIz >= this.config.gridSizeZ) {
                            nextIx++;
                            nextIz = 0;
                        }
                        
                        // Schedule next batch (use requestAnimationFrame for better performance with rendering)
                        requestAnimationFrame(() => processBatch(nextIx, nextIz));
                    }
                } catch (error) {
                    console.error(`Error processing batch at ${ix},${iz}:`, error);
                    // Try to continue with next batch despite error
                    if (onProgress) onProgress(1.0); // Signal completion to hide loader
                }
            };
            
            // Start batch processing
            processBatch(0, 0);
        } catch (error) {
            console.error('Error in grid creation:', error);
            if (onProgress) onProgress(1.0); // Signal completion despite error
        }
    }
    
    // Add an effector (source of influence on the grid)
    addEffector(effector) {
        // Validate effector
        if (!effector || !effector.position) {
            console.error('Invalid effector:', effector);
            return false;
        }
        
        // Add to collection
        this.effectors.push(effector);
        
        // Create visualizer if requested
        if (effector.visualize) {
            this.createEffectorVisualizer(effector);
        }
        
        return true;
    }
    
    // Remove an effector by reference or id
    removeEffector(effectorOrId) {
        const id = typeof effectorOrId === 'string' ? effectorOrId : effectorOrId.id;
        
        // Find effector index
        const index = this.effectors.findIndex(e => e.id === id);
        if (index === -1) return false;
        
        // Remove from collection
        this.effectors.splice(index, 1);
        
        // Remove visualizer if it exists
        if (this.visualizers[id]) {
            this.scene.remove(this.visualizers[id]);
            delete this.visualizers[id];
        }
        
        return true;
    }
    
    // Create a visual representation of an effector
    createEffectorVisualizer(effector) {
        if (!effector.id || this.visualizers[effector.id]) {
            return; // Already exists or no ID
        }
        
        // Create mesh based on effector type
        let mesh;
        
        if (effector.visualizerType === 'sphere') {
            const geometry = new THREE.SphereGeometry(5, 16, 16);
            const material = new THREE.MeshStandardMaterial({
                color: effector.color || 0x00ffff,
                emissive: effector.emissive || 0x003333,
                wireframe: effector.wireframe !== undefined ? effector.wireframe : true
            });
            
            mesh = new THREE.Mesh(geometry, material);
        } else if (effector.visualizerType === 'cone') {
            const geometry = new THREE.ConeGeometry(3, 6, 24);
            const material = new THREE.MeshStandardMaterial({
                color: effector.color || 0xff0000,
                emissive: effector.emissive || 0x330000,
                wireframe: effector.wireframe !== undefined ? effector.wireframe : false
            });
            
            mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = Math.PI; // Point downward
        } else {
            // Default box
            const geometry = new THREE.BoxGeometry(4, 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: effector.color || 0xffff00,
                wireframe: true
            });
            
            mesh = new THREE.Mesh(geometry, material);
        }
        
        // Add light if requested
        if (effector.light) {
            const light = new THREE.PointLight(
                effector.lightColor || effector.color || 0xffffff,
                effector.lightIntensity || 1,
                effector.lightDistance || 30
            );
            light.position.set(0, 0, 0);
            mesh.add(light);
        }
        
        // Position the visualizer
        mesh.position.copy(effector.position);
        
        // Store and add to scene
        this.visualizers[effector.id] = mesh;
        this.scene.add(mesh);
        
        console.log(`Created visualizer for effector ${effector.id}`, mesh.position);
        
        return mesh;
    }
    
    // Update effector position
    updateEffectorPosition(effectorId, position) {
        // Find effector
        const effector = this.effectors.find(e => e.id === effectorId);
        if (!effector) return false;
        
        // Update position
        effector.position.copy(position);
        
        // Update visualizer if it exists
        if (this.visualizers[effectorId]) {
            this.visualizers[effectorId].position.copy(position);
        }
        
        return true;
    }
    
    // Apply spline-based height modulation
    applySplineEffect(spline, progress) {
        if (!spline || !this.instancedMesh) return;
        
        this._cachedSplineHeight = null;
        this._cachedSplinePoint = null;
        
        // Get current point on spline
        if (progress !== undefined && spline.getPoint) {
            const pathPt = spline.getPoint(progress);
            this._cachedSplineHeight = pathPt.y;
            this._cachedSplinePoint = pathPt.clone();
            
            // Debug info
            if (Math.random() < 0.01) { // Only log occasionally
                console.log(`Spline point at progress ${progress}:`, pathPt);
                console.log(`Using spline falloff: ${this.config.splineFalloff}`);
            }
        }
    }
    
    // Update all cube positions/scales based on effectors and time
    update(deltaTime) {
        if (!this.instancedMesh || !this.ready) return;
        
        // Update time
        if (deltaTime !== undefined) {
            this.time += deltaTime * this.noiseSpeed;
        }
        
        // Find cubes that need to be processed
        const cubesToProcess = new Set();
        const dummy = new THREE.Object3D();
        
        // First add cubes near each effector
        for (const effector of this.effectors) {
            if (!effector.active) continue;
            
            // Query cubes around this effector
            const nearbyCubes = this.quadTree.query({
                x: effector.position.x,
                z: effector.position.z,
                radius: effector.radius || 100
            });
            
            // Add to processing set (auto-deduplicates)
            nearbyCubes.forEach(cube => cubesToProcess.add(cube.key));
        }
        
        // Process each cube
        let cubesProcessed = 0;
        
        for (const cubeKey of cubesToProcess) {
            const cube = this.cubes[cubeKey];
            if (!cube) continue;
            cubesProcessed++;
            
            // Variables to track cumulative effects from all effectors
            let totalRaise = 0;
            let maxScale = this.config.initialScale; // Default minimum scale
            
            // Process each effector's influence on this cube
            for (const effector of this.effectors) {
                // Skip inactive effectors
                if (!effector.active) continue;
                
                // Calculate distance from cube to effector
                const dx = cube.x - effector.position.x;
                const dz = cube.z - effector.position.z;
                const distSq = dx*dx + dz*dz;
                const dist = Math.sqrt(distSq);
                
                // Skip if too far away
                if (dist > (effector.radius || 100)) continue;
                
                // Calculate falloff factor (0-1, higher closer to effector)
                const distRatio = dist / (effector.radius || 100);
                const falloff = Math.max(0, 1 - (distRatio * distRatio));
                
                // Skip if negligible effect
                if (falloff < 0.005) continue;
                
                // Calculate height effect with cubic easing
                const cubicEasing = falloff * falloff * falloff;
                const raise = (effector.maxRaise || this.config.effectorHeight) * cubicEasing;
                
                // Calculate scale effect (closer = larger)
                let scaleFactor = this.config.initialScale;
                if (dist < (effector.radius || 100)) {
                    const t = 1 - distRatio;
                    const smoothT = t * t * t; // Cubic easing
                    const maxEffectorScale = effector.maxScale || this.config.maxScale;
                    scaleFactor = this.config.initialScale + 
                                  smoothT * (maxEffectorScale - this.config.initialScale);
                }
                
                // Add this effector's contribution
                totalRaise += raise;
                
                // Use max scale from any effector
                maxScale = Math.max(maxScale, scaleFactor);
            }
            
            // Apply spline effect if available
            if (this._cachedSplinePoint) {
                const dx = cube.x - this._cachedSplinePoint.x;
                const dz = cube.z - this._cachedSplinePoint.z;
                const distSq = dx*dx + dz*dz;
                
                // Apply spline-based height using configured falloff
                const splineFalloff = 1 / (1 + this.config.splineFalloff * distSq);
                const splineRaise = this.config.splineHeight * splineFalloff;
                
                totalRaise += splineRaise;
            }
            
            // Apply noise effect if enabled
            if (this.noiseAmplitude > 0) {
                // Use simple sine wave noise for now
                // Could be replaced with Perlin/Simplex noise for more organic feel
                const noiseX = cube.x * this.noiseScale + this.time;
                const noiseZ = cube.z * this.noiseScale + this.time * 0.7;
                const noise = Math.sin(noiseX) * Math.cos(noiseZ) * this.noiseAmplitude;
                
                totalRaise += noise;
            }
            
            // Cap maximum height if a spline height reference exists
            if (this._cachedSplineHeight) {
                const maxHeight = this._cachedSplineHeight - 1;
                totalRaise = Math.min(totalRaise, maxHeight - cube.baseY);
            }
            
            // Set final position and scale
            const finalY = cube.baseY + totalRaise;
            
            dummy.position.set(cube.x, finalY, cube.z);
            dummy.scale.set(maxScale, maxScale, maxScale);
            dummy.updateMatrix();
            
            // Update instance matrix
            this.instancedMesh.setMatrixAt(cube.i, dummy.matrix);
            
            // Update cube data
            cube.y = finalY;
            cube.scale = maxScale;
        }
        
        // Mark instance matrix as needing update if any cubes were processed
        if (cubesToProcess.size > 0) {
            this.instancedMesh.instanceMatrix.needsUpdate = true;
        }
    }
    
    // Create player effector
    createPlayerEffector(playerObject) {
        return this.addEffector({
            id: 'player',
            name: 'Player',
            position: playerObject.position,
            active: true,
            radius: 100,
            maxRaise: 15,
            maxScale: 2.0,
            color: 0xff0000,
            emissive: 0x330000,
            visualize: false, // We already have a player model
            visualizerType: 'cone'
        });
    }
    
    // Create custom effector
    createEffector(options) {
        const id = options.id || `effector_${this.effectors.length}`;
        
        return this.addEffector(Object.assign({
            id: id,
            name: options.name || id,
            position: options.position || new THREE.Vector3(0, 0, 0),
            active: true,
            radius: 100,
            maxRaise: 25,
            maxScale: 1.5,
            color: 0x00ffff,
            emissive: 0x003333,
            visualize: true,
            visualizerType: 'sphere',
            wireframe: true,
            light: true,
            lightColor: 0x00ffff,
            lightIntensity: 1,
            lightDistance: 30
        }, options));
    }
    
    // Set global noise parameters
    setNoiseParameters(amplitude, scale, speed) {
        if (amplitude !== undefined) this.noiseAmplitude = amplitude;
        if (scale !== undefined) this.noiseScale = scale;
        if (speed !== undefined) this.noiseSpeed = speed;
    }
    
    // Dispose and clean up resources
    dispose() {
        // Clean up visualizers
        for (const id in this.visualizers) {
            this.scene.remove(this.visualizers[id]);
            // Dispose of geometries and materials
            const visualizer = this.visualizers[id];
            if (visualizer.geometry) visualizer.geometry.dispose();
            if (visualizer.material) visualizer.material.dispose();
        }
        
        // Clean up instanced mesh
        if (this.instancedMesh) {
            this.scene.remove(this.instancedMesh);
            if (this.instancedMesh.geometry) this.instancedMesh.geometry.dispose();
            if (this.instancedMesh.material) this.instancedMesh.material.dispose();
        }
        
        // Clear collections
        this.visualizers = {};
        this.effectors = [];
        this.cubes = {};
        
        // Clear quadtree
        if (this.quadTree) this.quadTree.clear();
    }
    
    // Get the number of cubes in the grid
    getCubeCount() {
        return Object.keys(this.cubes).length;
    }
    
    // Get the number of active effectors
    getEffectorCount() {
        return this.effectors.filter(e => e.active).length;
    }
}

// Export the GridManager class
window.GridManager = GridManager;
console.log('GridManager class defined and exported successfully');
