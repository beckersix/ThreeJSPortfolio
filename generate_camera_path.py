"""
This script creates a simple FBX file with a camera path curve.
Note: This requires the FBX Python SDK to be installed.
If you don't have the FBX SDK, you can download a sample FBX file instead.
"""
import sys
import math
try:
    import fbx
except ImportError:
    print("FBX SDK Python bindings not found. Please install the FBX SDK or use a pre-made FBX file.")
    print("You can download the FBX SDK from: https://www.autodesk.com/developer-network/platform-technologies/fbx-sdk-2020-0")
    sys.exit(1)

def create_camera_path_fbx(output_file="static/models/camera_path.fbx"):
    """Create an FBX file with a camera path curve"""
    # Initialize the FBX SDK
    sdk_manager = fbx.FbxManager.Create()
    if not sdk_manager:
        print("Error: Unable to create FBX Manager!")
        return False
    
    # Create an IOSettings object
    ios = fbx.FbxIOSettings.Create(sdk_manager, fbx.IOSROOT)
    sdk_manager.SetIOSettings(ios)
    
    # Create a new scene
    scene = fbx.FbxScene.Create(sdk_manager, "Camera Path Scene")
    
    # Create a path curve
    path = fbx.FbxNurbsCurve.Create(scene, "CameraPath")
    
    # Set curve properties
    path.SetOrder(3)  # Cubic curve
    path.SetDimension(fbx.FbxNurbsCurve.e3D)
    path.SetControlPointCount(10)  # 10 control points
    path.SetStep(4)  # Smoothness
    
    # Create control points for a simple path
    for i in range(10):
        t = i / 9.0  # Normalize to 0-1
        
        # Create a curved path
        x = math.sin(t * math.pi * 2) * 5
        y = 2 + math.sin(t * math.pi) * 1
        z = -i * 10
        
        # Set control point
        path.SetControlPointAt(fbx.FbxVector4(x, y, z), i)
    
    # Add the path to the scene's root node
    scene.GetRootNode().AddChild(path)
    
    # Create an exporter
    exporter = fbx.FbxExporter.Create(sdk_manager, "")
    
    # Initialize the exporter
    export_status = exporter.Initialize(output_file, -1, sdk_manager.GetIOSettings())
    if not export_status:
        print("Error: Unable to initialize exporter!")
        return False
    
    # Export the scene
    exporter.Export(scene)
    
    # Destroy the exporter and manager
    exporter.Destroy()
    sdk_manager.Destroy()
    
    print(f"FBX file created successfully: {output_file}")
    return True

if __name__ == "__main__":
    create_camera_path_fbx()
