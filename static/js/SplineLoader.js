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
        self.scene.add(object);
        // Log all object names and types in the OBJ hierarchy
        function logNames(obj, depth = 0) {
            console.log(' '.repeat(depth * 2) + obj.name + ' (' + obj.type + ')');
            if (obj.children) obj.children.forEach(child => logNames(child, depth + 1));
        }
        logNames(object);
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
