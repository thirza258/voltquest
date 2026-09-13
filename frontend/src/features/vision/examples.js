/** Companion Python examples are displayed/exported only. They are never evaluated by the browser. */
export const VISION_EXAMPLES = {
  'opencv-threshold': { title: 'Python OpenCV: image to mask', filename: 'threshold.py', note: 'Run on a companion computer with Python, numpy and opencv-python installed. Supply your own frame.png; the browser sandbox uses generated images.', code: `import cv2
import numpy as np

frame = cv2.imread("frame.png")  # BGR on Python OpenCV
if frame is None:
    raise FileNotFoundError("Provide frame.png")
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
_, mask = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
y, x = np.nonzero(mask)
observation = {"detected": len(x) >= 16,
               "area_fraction": len(x) / mask.size,
               "normalized_x": float((x.mean() - (mask.shape[1]-1)/2)
                                      / max(1, (mask.shape[1]-1)/2)) if len(x) >= 16 else 0.0}
print(observation)
cv2.imwrite("mask.png", mask)
` },
  'opencv-color': { title: 'Python OpenCV: HSV marker measurement', filename: 'marker.py', note: 'This companion example selects a color and reports an offset. It does not recognize a landing site or command a flight controller.', code: `import cv2
import numpy as np

frame = cv2.imread("frame.png")
if frame is None:
    raise FileNotFoundError("Provide frame.png")
hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
mask = cv2.inRange(hsv, np.array([40, 80, 60], dtype=np.uint8),
                  np.array([90, 255, 255], dtype=np.uint8))
y, x = np.nonzero(mask)
detected = len(x) >= 16
cx = float(x.mean()) if detected else None
error_x = (cx - (frame.shape[1]-1)/2) / max(1, (frame.shape[1]-1)/2) if detected else 0.0
print({"detected": detected, "normalized_x": error_x,
       "area_fraction": len(x) / mask.size})
cv2.imwrite("marker-mask.png", mask)
` },
  'opencv-edges': { title: 'Python OpenCV: blurred Canny edges', filename: 'edges.py', note: 'Use the same blur and threshold settings as the browser to compare outputs on a local image.', code: `import cv2

frame = cv2.imread("frame.png")
if frame is None:
    raise FileNotFoundError("Provide frame.png")
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
smoothed = cv2.GaussianBlur(gray, (5, 5), 0)
edges = cv2.Canny(smoothed, 50, 120, apertureSize=3, L2gradient=True)
cv2.imwrite("edges.png", edges)
print("Edge pixels:", cv2.countNonZero(edges))
` },
  'attention-head': { title: 'Python / NumPy: one attention head', filename: 'attention.py', note: 'A minimal numerical example with fixed vectors, not a trained vision transformer. A full ViT needs learned projections, positional embeddings, transformer blocks and a task head.', code: `import numpy as np

# Two illustrative token embeddings, each with two features.
X = np.array([[1.0, 0.0], [0.0, 1.0]])
Q, K, V = X, X, X  # identity projections for this experiment
scores = Q @ K.T / np.sqrt(K.shape[-1])
scores -= scores.max(axis=-1, keepdims=True)  # stable softmax
weights = np.exp(scores)
weights /= weights.sum(axis=-1, keepdims=True)
context = weights @ V
print("Attention weights:", weights)
print("Row sums:", weights.sum(axis=-1))
print("Context:", context)
` },
  'iot-http-adapter': { title: 'Companion integration: OpenCV to an HTTP device', filename: 'vision_http.py', note: 'Run against a local test server or your own verified device endpoint. The virtual VoltQuest server is reached through the browser integration bench, not through an external network URL.', code: `import argparse
import json
import urllib.request
import cv2
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("--image", default="frame.png")
parser.add_argument("--base-url", required=True)  # your local test/device endpoint
args = parser.parse_args()
frame = cv2.imread(args.image)
if frame is None:
    raise FileNotFoundError(args.image)
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
_, mask = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
detected = np.count_nonzero(mask) >= 16
path = "/on" if detected else "/off"
with urllib.request.urlopen(args.base_url.rstrip("/") + path, timeout=2) as response:
    print(json.dumps({"detected": bool(detected), "status": response.status,
                      "body": response.read(1024).decode("utf-8", errors="replace")}))
` },
  'ros-vision-node': { title: 'Companion integration: an OpenCV ROS 2 publisher', filename: 'vision_node.py', note: 'Requires a sourced ROS 2 Python environment, geometry_msgs, numpy and cv2 on a companion computer. This saved-frame exercise publishes at 10 Hz; it does not run ROS 2 or access a camera in the browser. Use a simulated receiver with a command timeout.', code: `import cv2
import numpy as np
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist

class VisionNode(Node):
    def __init__(self):
        super().__init__("vision_line")
        self.declare_parameter("image_path", "frame.png")
        self.publisher = self.create_publisher(Twist, "/cmd_vel", 10)
        self.timer = self.create_timer(0.1, self.update)

    def update(self):
        command = Twist()  # no target defaults to zero velocity
        frame = cv2.imread(self.get_parameter("image_path").value)
        if frame is not None:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            smoothed = cv2.GaussianBlur(gray, (5, 5), 0)
            edges = cv2.Canny(smoothed, 50, 120, apertureSize=3, L2gradient=True)
            y, x = np.nonzero(edges)
            if len(x) >= 16:
                half_width = max(1, (frame.shape[1]-1)/2)
                error = (x.mean() - (frame.shape[1]-1)/2) / half_width
                command.linear.x = 0.15
                command.angular.z = float(np.clip(-error, -0.8, 0.8))
        self.publisher.publish(command)

rclpy.init()
node = VisionNode()
try:
    rclpy.spin(node)
except KeyboardInterrupt:
    pass
finally:
    if rclpy.ok():
        node.publisher.publish(Twist())
        node.destroy_node()
        rclpy.shutdown()
# The driver still needs its own timeout: a process crash may skip this cleanup.
` },
}
