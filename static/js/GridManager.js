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
            gridSizeX: 100,     // Reduced from 350 for better performance
            gridSizeZ: 500,     // Reduced from 500 for better performance
            spacing: 4,       // Increased from 1.6 to spread out cubes more
            baseHeight: -18,
            gridX: 0,
            gridZ: -50,
            
            // Cube properties
            cubeSize: 100,
            cubeColor: 0x00ffcc,
            initialScale: .3,
            maxScale: 4.0,  // Maximum scale for cubes
            
            // Effect parameters
            splineFalloff: 0.00000001,  // How quickly the spline effect falls off with distance
            splineHeight: 25,          // Maximum height effect from spline
            effectorFalloff: 0.0005,   // How quickly effector effects fall off with distance
            effectorHeight: 15,        // Maximum height effect from effectors
            
            // Performance settings
            batchSize: 200,    // Increased from 300 for faster loading
            initialFalloff: 0.00000001,
            
            // Optimization settings
            cullingDistance: 100,      // Distance beyond which cubes aren't processed
            updateInterval: 5,         // Only update every N frames
            maxCubesPerFrame: 1000,    // Maximum cubes to process per frame
            lodFactor: 2,            // Level of detail factor (higher = more aggressive culling)
            useSimpleMaterial: true    // Use simpler material for better performance
        }, options);
        
        // Frame counter for update interval
        this._frameCounter = 0;
        
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
            
            // Create material matching the UltraHDR example
            // Using MeshStandardMaterial like in the example
            const cubeMat = new THREE.MeshStandardMaterial({ 
                color: this.config.cubeColor,
                roughness: 0.0,         // No roughness for perfect reflections
                metalness: 1.0,         // Full metalness for maximum reflections
                envMapIntensity: 1.0    // Default environment map intensity
            });
            
            // The UltraHDR example uses a simple MeshStandardMaterial with
            // roughness and metalness parameters that are updated dynamically
            
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
            
            // Create a single matrix update buffer for better performance
            // This avoids updating the instance matrix for every cube
            const matrices = [];
            const cubeData = [];
            
            // Pre-allocate all cube data at once instead of in batches
            // This is much faster than creating cubes in small batches
            console.time('Grid data generation');
            
            // Create all cube data in a single pass
            for (let ix = 0; ix < this.config.gridSizeX; ix++) {
                for (let iz = 0; iz < this.config.gridSizeZ; iz++) {
                    // Calculate position
                    const px = ix * this.config.spacing - halfX + this.config.gridX;
                    const pz = iz * this.config.spacing - halfZ + this.config.gridZ;
                    let baseY = this.config.baseHeight;
                    
                    // Create cube data
                    const key = `${ix}_${iz}`;
                    const currentIndex = cubesCreated;
                    const cube = { 
                        x: px, 
                        z: pz, 
                        baseY, 
                        y: baseY,
                        i: currentIndex, 
                        key,
                        scale: this.config.initialScale,
                        velocity: 0,
                        acceleration: 0,
                        noise: 0
                    };
                    
                    // Store cube data
                    this.cubes[key] = cube;
                    cubeData.push(cube);
                    
                    // Create matrix
                    dummy.position.set(px, baseY, pz);
                    dummy.scale.set(this.config.initialScale, this.config.initialScale, this.config.initialScale);
                    dummy.updateMatrix();
                    
                    // Store matrix
                    matrices.push(dummy.matrix.clone());
                    
                    // Update counter
                    cubesCreated++;
                    
                    // Report progress periodically
                    if (cubesCreated % 1000 === 0 && onProgress) {
                        const progress = Math.min(cubesCreated / totalCubes * 0.5, 0.5); // First 50%
                        onProgress(progress);
                    }
                }
            }
            console.timeEnd('Grid data generation');
            
            // Now insert all cubes into the quadtree at once
            console.time('Quadtree insertion');
            if (onProgress) onProgress(0.6); // 60%
            
            // Insert cubes into quadtree in batches to avoid blocking the main thread
            const insertQuadtreeBatch = (startIdx, batchSize) => {
                const endIdx = Math.min(startIdx + batchSize, cubeData.length);
                
                for (let i = startIdx; i < endIdx; i++) {
                    this.quadTree.insert(cubeData[i]);
                }
                
                if (endIdx < cubeData.length) {
                    // Report progress
                    if (onProgress) {
                        const progress = 0.6 + (endIdx / cubeData.length) * 0.2; // 60-80%
                        onProgress(progress);
                    }
                    
                    // Continue with next batch
                    setTimeout(() => insertQuadtreeBatch(endIdx, batchSize), 0);
                } else {
                    // All cubes inserted into quadtree
                    console.timeEnd('Quadtree insertion');
                    
                    // Now update the instance matrices
                    console.time('Matrix updates');
                    if (onProgress) onProgress(0.8); // 80%
                    
                    // Update all matrices at once
                    for (let i = 0; i < matrices.length; i++) {
                        this.instancedMesh.setMatrixAt(i, matrices[i]);
                    }
                    
                    // Mark instance matrix as needing update only once
                    this.instancedMesh.instanceMatrix.needsUpdate = true;
                    console.timeEnd('Matrix updates');
                    
                    // Complete
                    this.ready = true;
                    if (onProgress) onProgress(1.0); // 100% complete
                    console.log(`Grid creation complete. Created ${cubesCreated} cubes.`);
                }
            };
            
            // Start quadtree insertion with a large batch size
            insertQuadtreeBatch(0, 5000);
            
        } catch (error) {
            console.error('Error in grid creation:', error);
            if (onProgress) onProgress(1.0); // Signal completion despite error
        }
    }
    
    // Add an effector (source of influence on the grid)
    addEffector(effector) {
        console.log('=== GRID MANAGER: ADDING EFFECTOR ===');
        console.log('Received effector:', effector.name || 'unnamed');
        
        // Validate effector
        if (!effector) {
            console.error('Invalid effector (null or undefined)');
            return false;
        }
        
        // Check for position
        if (!effector.position) {
            console.error('Effector missing position:', effector);
            return false;
        }
        
        // Log the incoming position
        console.log(`INCOMING POSITION: ${JSON.stringify({
            x: effector.position.x,
            y: effector.position.y,
            z: effector.position.z
        })}`);
        
        // Ensure position is a Vector3
        if (!(effector.position instanceof THREE.Vector3)) {
            console.log('Position is not a Vector3, attempting to convert...');
            // Try to convert to Vector3 if it has x, y, z properties
            if (effector.position.x !== undefined && 
                effector.position.y !== undefined && 
                effector.position.z !== undefined) {
                const oldPos = {
                    x: effector.position.x,
                    y: effector.position.y,
                    z: effector.position.z
                };
                
                effector.position = new THREE.Vector3(
                    effector.position.x,
                    effector.position.y,
                    effector.position.z
                );
                
                console.log(`Converted position from (${oldPos.x}, ${oldPos.y}, ${oldPos.z}) to Vector3`);
            } else {
                console.error('Effector position is not a Vector3 and cannot be converted:', effector.position);
                return false;
            }
        }
        
        // Ensure required properties
        if (!effector.id) {
            effector.id = `effector_${this.effectors.length}`;
            console.log(`Assigned ID: ${effector.id}`);
        }
        
        if (effector.active === undefined) {
            effector.active = true;
        }
        
        if (!effector.radius) {
            effector.radius = 100; // Default radius
            console.log(`Using default radius: ${effector.radius}`);
        }
        
        // Log the final position before adding to collection
        console.log(`FINAL POSITION: (${effector.position.x.toFixed(2)}, ${effector.position.y.toFixed(2)}, ${effector.position.z.toFixed(2)})`);
        
        // Add to collection
        this.effectors.push(effector);
        
        // Create visualizer if requested
        if (effector.visualize) {
            console.log('Creating visualizer for effector');
            this.createEffectorVisualizer(effector);
        }
        
        console.log(`EFFECTOR ADDED SUCCESSFULLY: ${effector.name || effector.id} at position (${effector.position.x.toFixed(2)}, ${effector.position.y.toFixed(2)}, ${effector.position.z.toFixed(2)})`);
        console.log('=== END ADDING EFFECTOR ===');
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
        
        // Create a group to hold the visualizer components
        const group = new THREE.Group();
        
        // Create primary mesh based on effector type
        let primaryMesh;
        
        if (effector.visualizerType === 'sphere') {
            const geometry = new THREE.SphereGeometry(5, 16, 16);
            const material = new THREE.MeshStandardMaterial({
                color: effector.color || 0x00ffff,
                emissive: effector.emissive || 0x003333,
                wireframe: effector.wireframe !== undefined ? effector.wireframe : false,
                transparent: true,
                opacity: 0.7,
                metalness: 0.8,
                roughness: 0.2
            });
            
            primaryMesh = new THREE.Mesh(geometry, material);
            
            // Add outer wireframe for better visibility
            const wireGeometry = new THREE.SphereGeometry(5.2, 16, 16);
            const wireMaterial = new THREE.MeshBasicMaterial({
                color: effector.color || 0x00ffff,
                wireframe: true,
                transparent: true,
                opacity: 0.5
            });
            const wireMesh = new THREE.Mesh(wireGeometry, wireMaterial);
            group.add(wireMesh);
            
        } else if (effector.visualizerType === 'cone') {
            const geometry = new THREE.ConeGeometry(3, 6, 24);
            const material = new THREE.MeshStandardMaterial({
                color: effector.color || 0xff0000,
                emissive: effector.emissive || 0x330000,
                wireframe: effector.wireframe !== undefined ? effector.wireframe : false,
                transparent: true,
                opacity: 0.8,
                metalness: 0.7,
                roughness: 0.3
            });
            
            primaryMesh = new THREE.Mesh(geometry, material);
            primaryMesh.rotation.x = Math.PI; // Point downward
            
            // Add outer wireframe
            const wireGeometry = new THREE.ConeGeometry(3.2, 6.2, 24);
            const wireMaterial = new THREE.MeshBasicMaterial({
                color: effector.color || 0xff0000,
                wireframe: true,
                transparent: true,
                opacity: 0.5
            });
            const wireMesh = new THREE.Mesh(wireGeometry, wireMaterial);
            wireMesh.rotation.x = Math.PI; // Point downward
            group.add(wireMesh);
            
        } else {
            // Default is a glowing orb
            const geometry = new THREE.SphereGeometry(4, 16, 16);
            const material = new THREE.MeshStandardMaterial({
                color: effector.color || 0xffff00,
                emissive: effector.color || 0xffff00,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.7
            });
            
            primaryMesh = new THREE.Mesh(geometry, material);
            
            // Add pulsing ring
            const ringGeometry = new THREE.TorusGeometry(6, 0.5, 16, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: effector.color || 0xffff00,
                transparent: true,
                opacity: 0.5,
                wireframe: true
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI / 2; // Make it horizontal
            group.add(ring);
            
            // Add animation to the ring
            const animate = () => {
                if (this.visualizers[effector.id]) {
                    ring.rotation.z += 0.01;
                    requestAnimationFrame(animate);
                }
            };
            animate();
        }
        
        // Add primary mesh to the group
        group.add(primaryMesh);
        
        // Add a point light
        const light = new THREE.PointLight(
            effector.lightColor || effector.color || 0xffffff,
            effector.lightIntensity || 0.8,
            effector.lightDistance || 50
        );
        light.position.set(0, 0, 0);
        group.add(light);
        
        // Add radius indicator (subtle circle on the ground)
        const radiusGeometry = new THREE.RingGeometry(effector.radius - 0.5, effector.radius, 32);
        const radiusMaterial = new THREE.MeshBasicMaterial({
            color: effector.color || 0xffffff,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        const radiusRing = new THREE.Mesh(radiusGeometry, radiusMaterial);
        radiusRing.rotation.x = Math.PI / 2; // Lay flat on the ground
        radiusRing.position.y = -5; // Slightly above the ground
        group.add(radiusRing);
        
        // Position the visualizer group
        group.position.copy(effector.position);
        
        // Store and add to scene
        this.visualizers[effector.id] = group;
        this.scene.add(group);
        
        return group;
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
        
        // Update time - use a fixed time increment for consistent animation speed
        // This makes the wave animation independent of player position
        this.time += 0.01; // Fixed increment for consistent wave speed
        
        // Find player effector for distance-based culling
        let playerPosition = null;
        const playerEffector = this.effectors.find(e => e.id === 'player');
        if (playerEffector && playerEffector.position) {
            playerPosition = playerEffector.position;
        }
        
        // If no player found, try to find any active effector to use as reference
        if (!playerPosition) {
            const anyEffector = this.effectors.find(e => e.active && e.position);
            if (anyEffector) {
                playerPosition = anyEffector.position;
            }
        }
        
        // Define the maximum distance for cube updates
        // This is the key optimization - we only process cubes within this distance
        const maxUpdateDistance = 120; // Units in world space
        const maxUpdateDistanceSq = maxUpdateDistance * maxUpdateDistance; // Square for faster comparison
        
        // Find cubes that need to be processed
        const cubesToProcess = new Set();
        const dummy = new THREE.Object3D();
        
        // Update visualizers only every few frames to save performance
        if (!this._frameCounter) this._frameCounter = 0;
        this._frameCounter++;
        
        if (this._frameCounter % 3 === 0) { // Update visualizers every 3 frames
            // Ensure all effectors have visualizers and are positioned correctly
            this.effectors.forEach(effector => {
                if (effector.visualize !== false) {
                    // Create visualizer if it doesn't exist
                    if (!this.visualizers[effector.id]) {
                        this.createEffectorVisualizer(effector);
                    }
                    
                    // Update visualizer position to match effector
                    if (this.visualizers[effector.id] && effector.position) {
                        this.visualizers[effector.id].position.copy(effector.position);
                    }
                }
            });
        }
        
        // If we have a player position, only query cubes near the player
        if (playerPosition) {
            // Query cubes around the player with the maximum update distance
            const nearbyCubes = this.quadTree.query({
                x: playerPosition.x,
                z: playerPosition.z,
                radius: maxUpdateDistance
            });
            
            // Add these cubes to the processing set
            nearbyCubes.forEach(cube => cubesToProcess.add(cube.key));
            
            // Now add additional cubes that are near active effectors (within their radius)
            for (const effector of this.effectors) {
                if (!effector.active || effector.id === 'player') continue; // Skip player, already processed
                
                // Make sure position is valid
                if (!effector.position || isNaN(effector.position.x) || isNaN(effector.position.z)) {
                    console.error('Invalid effector position:', effector);
                    continue;
                }
                
                // Check if this effector is close enough to the player to be relevant
                const dx = effector.position.x - playerPosition.x;
                const dz = effector.position.z - playerPosition.z;
                const distSq = dx*dx + dz*dz;
                
                // Only process effectors that are within the player's view distance + their radius
                if (distSq > (maxUpdateDistance + effector.radius) * (maxUpdateDistance + effector.radius)) {
                    continue; // Skip effectors too far from player
                }
                
                // Use the effector's radius to query cubes
                const queryRadius = (effector.radius || 100) * 1.2;
                
                // Query cubes around this effector
                const nearbyCubes = this.quadTree.query({
                    x: effector.position.x,
                    z: effector.position.z,
                    radius: queryRadius
                });
                
                // Update visualizer position if it exists
                if (this._frameCounter % 3 === 0 && this.visualizers[effector.id]) {
                    this.visualizers[effector.id].position.copy(effector.position);
                }
                
                // Add to processing set (auto-deduplicates)
                nearbyCubes.forEach(cube => cubesToProcess.add(cube.key));
            }
        } else {
            // Fallback if no player position: process cubes near all active effectors
            for (const effector of this.effectors) {
                if (!effector.active) continue;
                
                // Make sure position is valid
                if (!effector.position || isNaN(effector.position.x) || isNaN(effector.position.z)) {
                    console.error('Invalid effector position:', effector);
                    continue;
                }
                
                // Use a larger radius to ensure we catch all affected cubes
                const queryRadius = (effector.radius || 100) * 1.2;
                
                // Query cubes around this effector
                const nearbyCubes = this.quadTree.query({
                    x: effector.position.x,
                    z: effector.position.z,
                    radius: queryRadius
                });
                
                // Add to processing set (auto-deduplicates)
                nearbyCubes.forEach(cube => cubesToProcess.add(cube.key));
            }
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
                // Using a more gentle falloff curve
                const distRatio = dist / (effector.radius || 100);
                // Using a cubic falloff for more gradual transition
                const falloff = Math.max(0, 1 - (distRatio * distRatio * distRatio));
                
                // Skip if negligible effect
                if (falloff < 0.005) continue;
                
                // Calculate height effect with a gentler easing function
                // Using a quintic easing (power of 5) for an even more gradual effect
                const gentleEasing = falloff * falloff * falloff * falloff * falloff;
                const raise = (effector.maxRaise || this.config.effectorHeight) * gentleEasing;
                
                // Calculate scale effect (closer = larger)
                let scaleFactor = this.config.initialScale;
                
                // Extend the scale effect to a larger radius (1.5x the normal radius)
                const scaleRadius = (effector.radius || 100) * 1.5;
                
                if (dist < scaleRadius) {
                    // Calculate the ratio based on the extended scale radius
                    const scaleRatio = dist / scaleRadius;
                    const t = 1 - scaleRatio;
                    
                    // Use a more gradual falloff for scale effect
                    // This keeps more tiles at larger scale before falling off
                    const smoothT = Math.pow(t, 2); // Quadratic falloff for gentler transition
                    
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
            wireframe: false
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
