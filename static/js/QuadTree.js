/**
 * QuadTree.js
 * Spatial partitioning for efficient proximity queries
 */

class QuadTree {
    constructor(boundary, capacity = 8, depth = 0) {
        this.boundary = boundary; // {x, z, width, height}
        this.capacity = capacity; // Max items before subdivision
        this.items = [];          // Generic items (can be cubes or effectors)
        this.divided = false;
        this.depth = depth;       // Track the depth of this node for visualization
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
        const nextDepth = this.depth + 1;

        this.northEast = new QuadTree({x: x + w, z: z - h, width: w, height: h}, this.capacity, nextDepth);
        this.northWest = new QuadTree({x: x - w, z: z - h, width: w, height: h}, this.capacity, nextDepth);
        this.southEast = new QuadTree({x: x + w, z: z + h, width: w, height: h}, this.capacity, nextDepth);
        this.southWest = new QuadTree({x: x - w, z: z + h, width: w, height: h}, this.capacity, nextDepth);

        this.divided = true;

        // Move existing items into children
        for (let i = 0; i < this.items.length; i++) {
            this.northEast.insert(this.items[i]) ||
            this.northWest.insert(this.items[i]) ||
            this.southEast.insert(this.items[i]) ||
            this.southWest.insert(this.items[i]);
        }
        
        this.items = []; // Clear this node's items
    }

    // Insert an item into this quad
    insert(item) {
        // Check if item is in this quad's boundary
        if (!this.contains(item)) {
            return false;
        }

        // If there's space, add the item here
        if (this.items.length < this.capacity && !this.divided) {
            // Store the quadtree depth on the item for visualization
            if (item.key) { // It's a cube with a key
                item.quadTreeDepth = this.depth;
            }
            this.items.push(item);
            return true;
        }

        // Otherwise, subdivide if needed and add to children
        if (!this.divided) {
            this.subdivide();
        }

        return this.northEast.insert(item) ||
               this.northWest.insert(item) ||
               this.southEast.insert(item) ||
               this.southWest.insert(item);
    }

    // Check if an item is within this quad's boundary
    contains(item) {
        return item.x >= this.boundary.x - this.boundary.width &&
               item.x <= this.boundary.x + this.boundary.width &&
               item.z >= this.boundary.z - this.boundary.height &&
               item.z <= this.boundary.z + this.boundary.height;
    }

    // Query all items in a circular range
    query(range, found = []) {
        // Range is {x, z, radius}
        
        // Early return if range doesn't intersect this quad
        if (!this.intersectsCircle(range)) {
            return found;
        }

        // Check items in this quad
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const dx = item.x - range.x;
            const dz = item.z - range.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist <= range.radius) {
                found.push(item);
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
    
    // Get all items in the tree (for debugging or visualization)
    getAllItems() {
        let allItems = [...this.items];
        
        if (this.divided) {
            allItems = allItems.concat(
                this.northEast.getAllItems(),
                this.northWest.getAllItems(),
                this.southEast.getAllItems(),
                this.southWest.getAllItems()
            );
        }
        
        return allItems;
    }
    
    // Clear the tree (remove all items)
    clear() {
        this.items = [];
        this.divided = false;
        this.northEast = null;
        this.northWest = null;
        this.southEast = null;
        this.southWest = null;
    }
}

// Export the QuadTree class
window.QuadTree = QuadTree;
