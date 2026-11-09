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
  'opencv-morphology': { title: 'Python OpenCV: clean a mask with morphology', filename: 'morphology.py', note: 'Run on a companion computer with Python, numpy and opencv-python installed. Supply your own frame.png. Tune the threshold and kernel size on your images: a larger kernel removes bigger specks but also trims the target. Opening does not fill dark holes.', code: `import cv2

frame = cv2.imread("frame.png")
if frame is None:
    raise FileNotFoundError("Provide frame.png")
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
_, mask = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
for name, image in (("before", mask), ("after", opened)):
    labels, _ = cv2.connectedComponents(image, connectivity=8)
    # Label 0 is the background, so subtract it from the count.
    print(name, "pixels:", cv2.countNonZero(image), "components:", labels - 1)
cv2.imwrite("opened.png", opened)
` },
  'opencv-contours': { title: 'Python OpenCV: clean, measure and label contours', filename: 'contours.py', note: 'Requires Python, numpy and opencv-python 4 or later, where findContours returns two values. The closing and opening smooth speckled outlines but also trim thin details. The labels come from simple geometric rules for clean, flat shapes; they are not a trained classifier.', code: `import math
import cv2

CLEAN = True  # False measures the raw mask, as the browser lab does

frame = cv2.imread("frame.png")
if frame is None:
    raise FileNotFoundError("Provide frame.png")
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
_, mask = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY)
if CLEAN:
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)  # fill dark notches
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)   # remove white specks
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
for contour in sorted(contours, key=lambda c: cv2.boundingRect(c)[:2]):
    area = cv2.contourArea(contour)
    if area < 50:  # skip leftover specks
        continue
    perimeter = cv2.arcLength(contour, True)
    corners = len(cv2.approxPolyDP(contour, 0.04 * perimeter, True))
    circularity = 4 * math.pi * area / perimeter ** 2
    _, _, w, h = cv2.boundingRect(contour)
    if corners == 3:
        label = "triangle"
    elif circularity >= 0.83:
        label = "circle"
    elif corners == 4:
        label = "square" if 0.9 < w / h < 1.1 else "rectangle"
    else:
        label = "polygon"
    print(label, "area:", area, "perimeter:", round(perimeter, 1),
          "corners:", corners, "circularity:", round(circularity, 3))
` },
  'opencv-otsu': { title: 'Python OpenCV: Otsu thresholds with and without equalization', filename: 'otsu.py', note: 'Requires Python, numpy and opencv-python. Otsu needs an 8-bit single-channel image and assumes two intensity groups. Compare each mask with the object you expect: higher contrast does not guarantee a better split.', code: `import cv2

frame = cv2.imread("frame.png")
if frame is None:
    raise FileNotFoundError("Provide frame.png")
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
variants = {"none": gray, "global": cv2.equalizeHist(gray), "clahe": clahe.apply(gray)}
for name, image in variants.items():
    otsu, mask = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    print(name, "spread:", round(float(image.std()), 2), "otsu:", otsu,
          "selected:", cv2.countNonZero(mask))
    cv2.imwrite(f"otsu-{name}.png", mask)
` },
  'opencv-perspective': { title: 'Python OpenCV: rectify a card from four corners', filename: 'perspective.py', note: 'Requires Python, numpy and opencv-python. The output here is square; use the real width-to-height ratio of your card or page. If your lens bends straight lines, undistort the frame with camera calibration data first.', code: `import cv2
import numpy as np

frame = cv2.imread("frame.png")
if frame is None:
    raise FileNotFoundError("Provide frame.png")
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
_, mask = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
card = None
for contour in sorted(contours, key=cv2.contourArea, reverse=True):
    approx = cv2.approxPolyDP(contour, 0.04 * cv2.arcLength(contour, True), True)
    if len(approx) == 4:
        card = approx.reshape(4, 2).astype(np.float32)
        break
if card is None:
    raise SystemExit("No four-corner outline found; nothing was warped.")
total, diff = card.sum(axis=1), card[:, 1] - card[:, 0]
corners = np.float32([card[total.argmin()], card[diff.argmin()],
                      card[total.argmax()], card[diff.argmax()]])  # TL, TR, BR, BL
size = 400
target = np.float32([[0, 0], [size - 1, 0], [size - 1, size - 1], [0, size - 1]])
H = cv2.getPerspectiveTransform(corners, target)
cv2.imwrite("rectified.png", cv2.warpPerspective(frame, H, (size, size)))
print("TL, TR, BR, BL:", corners.tolist())
` },
  'opencv-hough': { title: 'Python OpenCV: Hough lane segments and round markers', filename: 'hough.py', note: 'Requires Python, numpy and opencv-python. Both Hough calls return None when nothing passes the vote threshold. Tune thresholds on your own frames and filter results by expected angle or radius: Hough votes for any straight or round edge.', code: `import math
import cv2
import numpy as np

frame = cv2.imread("frame.png")
if frame is None:
    raise FileNotFoundError("Provide frame.png")
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
smoothed = cv2.GaussianBlur(gray, (3, 3), 0)
edges = cv2.Canny(smoothed, 50, 120, apertureSize=3, L2gradient=True)
lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 30, minLineLength=20, maxLineGap=5)
for x1, y1, x2, y2 in ([] if lines is None else lines.reshape(-1, 4).tolist()):
    angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
    print("segment", (x1, y1), (x2, y2), "angle:", round(angle, 1))
circles = cv2.HoughCircles(smoothed, cv2.HOUGH_GRADIENT, 1, 20, param1=120,
                           param2=15, minRadius=6, maxRadius=30)
for x, y, r in ([] if circles is None else circles[0].tolist()):
    print("circle centre:", (round(x, 1), round(y, 1)), "radius:", round(r, 1))
` },
  'opencv-template': { title: 'Python OpenCV: normalized template matching', filename: 'template.py', note: 'Requires Python and opencv-python. Cut pad-template.png from a frame taken at the same scale and viewing angle as the search frames: this matcher is neither scale- nor rotation-invariant. The 0.6 threshold is an example; choose yours from labelled test frames.', code: `import cv2

frame = cv2.imread("frame.png", cv2.IMREAD_GRAYSCALE)
template = cv2.imread("pad-template.png", cv2.IMREAD_GRAYSCALE)
if frame is None or template is None:
    raise FileNotFoundError("Provide frame.png and pad-template.png")
scores = cv2.matchTemplate(frame, template, cv2.TM_CCOEFF_NORMED)
_, best, _, top_left = cv2.minMaxLoc(scores)  # top_left is (x, y)
detected = best >= 0.6
result = {"score": round(best, 3), "top_left": top_left, "detected": detected}
if detected:
    half = (frame.shape[1] - 1) / 2
    centre_x = top_left[0] + (template.shape[1] - 1) / 2
    result["normalized_x"] = round((centre_x - half) / half, 3)
print(result)
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
