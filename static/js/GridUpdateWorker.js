/**
 * GridUpdateWorker.js
 * Web Worker for asynchronous grid updates, offloading calculations from the main thread
 */

// Worker context doesn't have access to THREE.js, so we implement simple math functions
const Vector3 = {
    distanceSquared: function(x1, y1, z1, x2, y2, z2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        const dz = z1 - z2;
        return dx * dx + dy * dy + dz * dz;
    },
    
    distance: function(x1, y1, z1, x2, y2, z2) {
        return Math.sqrt(this.distanceSquared(x1, y1, z1, x2, y2, z2));
    }
};

// Process a batch of cubes and calculate their new positions and scales
function processCubeBatch(cubes, effectors, time, config) {
    const results = [];
    
    // Process each cube
    for (const cube of cubes) {
        // Variables to track cumulative effects
        let totalRaise = 0;
        let maxScale = config.initialScale;
        
        // Process each effector's influence on this cube
        for (const effector of effectors) {
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
            const raise = (effector.maxRaise || config.effectorHeight) * gentleEasing;
            
            // Calculate scale effect (closer = larger)
            let scaleFactor = config.initialScale;
            
            // Extend the scale effect to a larger radius (1.5x the normal radius)
            const scaleRadius = (effector.radius || 100) * 1.5;
            
            if (dist < scaleRadius) {
                // Calculate the ratio based on the extended scale radius
                const scaleRatio = dist / scaleRadius;
                const t = 1 - scaleRatio;
                
                // Use a more gradual falloff for scale effect
                // This keeps more tiles at larger scale before falling off
                const smoothT = Math.pow(t, 2); // Quadratic falloff for gentler transition
                
                const maxEffectorScale = effector.maxScale || config.maxScale;
                scaleFactor = config.initialScale + 
                              smoothT * (maxEffectorScale - config.initialScale);
            }
            
            // Add this effector's contribution
            totalRaise += raise;
            
            // Use max scale from any effector
            maxScale = Math.max(maxScale, scaleFactor);
        }
        
        // Apply spline effect if available
        if (config.splinePoint) {
            const dx = cube.x - config.splinePoint.x;
            const dz = cube.z - config.splinePoint.z;
            const distSq = dx*dx + dz*dz;
            
            // Apply spline-based height using configured falloff
            const splineFalloff = 1 / (1 + config.splineFalloff * distSq);
            const splineRaise = config.splineHeight * splineFalloff;
            
            totalRaise += splineRaise;
        }
        
        // Apply noise effect if enabled
        if (config.noiseAmplitude > 0) {
            // Use simple sine wave noise for now
            // Could be replaced with Perlin/Simplex noise for more organic feel
            const noiseX = cube.x * config.noiseScale + time;
            const noiseZ = cube.z * config.noiseScale + time * 0.7;
            const noise = Math.sin(noiseX) * Math.cos(noiseZ) * config.noiseAmplitude;
            
            totalRaise += noise;
        }
        
        // Cap maximum height if a spline height reference exists
        if (config.splineHeight) {
            const maxHeight = config.splineHeight - 1;
            totalRaise = Math.min(totalRaise, maxHeight - cube.baseY);
        }
        
        // Set final position and scale
        const finalY = cube.baseY + totalRaise;
        
        // Add result to the batch
        results.push({
            index: cube.i,
            y: finalY,
            scale: maxScale
        });
    }
    
    return results;
}

// Set up event listener for messages from the main thread
self.addEventListener('message', function(e) {
    const data = e.data;
    
    if (data.command === 'processBatch') {
        const { cubes, effectors, time, config, batchId } = data;
        
        // Process the cube batch
        const results = processCubeBatch(cubes, effectors, time, config);
        
        // Send results back to main thread
        self.postMessage({
            command: 'batchComplete',
            results: results,
            batchId: batchId
        });
    }
});

// Notify main thread that the worker is ready
self.postMessage({ command: 'ready' });
