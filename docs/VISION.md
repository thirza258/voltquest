# Computer vision courses, tutorials and integration

`/vision` offers twelve courses with runnable labs. Each `/vision/:lessonId` page has three theory
sections, two formula cards, four experiment steps, two practice questions, five exam questions and
companion Python examples. The courses run in this order:
1. OpenCV/IoT fundamentals, HSV drone markers, and Canny/ROS robot integration (1–3).
2. Six classical OpenCV techniques (4–9, added 2026-11-09): morphology, contours and shape
   analysis, histograms with equalization and Otsu, perspective correction, the Hough transform,
   and template matching.
3. Vision-transformer attention, deployment and evaluation, and a distinct cross-device capstone (10–12).
`/sandbox?bench=vision` opens free exploration; `&lesson=<id>` copies any course configuration.

The user requested courses explaining **how to integrate** computer vision, plus another tutorial
combining IoT, drones and robotics. `/vision/vision-integration` opens the connected-device capstone.
Courses and tutorial hubs expose both paths. All twelve courses have 80% passing exams with review and
retry, using the shared browser-local self-study progress rules in COURSES.md.

## Processing and transformer scope

`engine/vision/model.js` creates deterministic 128 × 128 RGBA images with target masks for six editable
scenes:
- an IoT indicator, a green drone pad and a white robot line;
- three added for the classical courses: three shapes (circle, square, triangle), two road lanes,
  and a tilted marker card.

The settings that change a scene:
- position, brightness, pixel noise and occlusion;
- contrast, which squeezes intensities toward mid-grey;
- salt-and-pepper specks, from a second coordinate hash;
- card tilt, which narrows the card's far edge;
- drone-pad scale. The scenes are generated teaching inputs, not camera
feeds or Pi camera emulation. Source, mask, selected-pixel count, fraction, centroid, normalized
horizontal error and compatible-mask IoU are shown. Canny boundary pixels do not receive filled-mask IoU.

`engine/vision/opencv.js` runs **actual OpenCV 4.12.0**, injected for plain-Node tests. It uses
RGBA→gray, GaussianBlur, threshold, RGB→HSV/inRange, and Canny with L2 gradients. The six classical
modes use:

| Mode | OpenCV calls | Details reported |
| --- | --- | --- |
| Morphology | `morphologyEx` with a rectangular kernel (open, close, erode, dilate; 3/5/7; 1–3 iterations) | Pixels and `connectedComponentsWithStats` before and after |
| Contours | `findContours` (external), `contourArea`, `arcLength`, `approxPolyDP`, `boundingRect` | Each shape with area, perimeter, corners and circularity 4πA/P². Roundness ≥ 0.83 wins before the corner count, because a pixel circle can simplify to four corners. |
| Histogram | `equalizeHist` or `CLAHE` (8 × 8 tiles), then threshold with `THRESH_OTSU` | Otsu's threshold, plus 32-bin histograms and spread before and after |
| Perspective | Largest four-cornered outline, corners ordered TL, TR, BR, BL, `getPerspectiveTransform`, `warpPerspective` | Corners; the card is rectified onto the full frame |
| Hough | Canny, then `HoughLinesP` or `HoughCircles` | Segments with angle and length, or circles |
| Template | `matchTemplate` with `TM_CCOEFF_NORMED` against a 48 × 48 pad cut from a clean scale-1 scene, then `minMaxLoc` | Score, location and the detection threshold |

Every mode returns a binary mask measured by `maskMetrics`, so observations and device adapters keep
working. Intersection-over-union is reported for filled masks, including Hough circles, and not for
Canny edges or Hough lines. Every native Mat, vector, CLAHE object, ROI and transform is deleted in
`finally`, including failure paths. The dependency is pinned to
`@techstark/opencv-js@4.12.0-release.1`; its prebuilt JS/WASM asset is emitted by Vite via `?url` and
loaded from the same host only when an OpenCV pipeline opens. No CDN or cloud processing is used.
The approximately 10.9 MB raw asset is separate from the initial JS payload; first lab loading displays
status. The package is prebuilt; no TypeScript code or build step was introduced. Apache-2.0 license
is included at `/licenses/opencv.txt`.

The Emscripten module is a legacy self-resolving thenable. **Never `await cv` or `resolve(cv)`: it
loops indefinitely.** Wait for `onRuntimeInitialized` and resolve a wrapper `{cv}`. Node tests use
`createRequire` to avoid the test runner assimilating that thenable during module import.

The transformer explorer implements one real, fixed attention computation: mean RGB patch values
plus x/y coordinates form five-dimensional features; Q/K use identity projection; V uses mean RGB.
It computes one query row with stable softmax, weighted context and a selectable patch grid. Patch sizes
8/16/32 expose token count and the N² cost of a full attention matrix. Temperature and coordinate
weight are editable. It has **no pretrained model, training, classifier or object-recognition claim**.
The course explains learned patch projections, positional embeddings, heads, residual/MLP blocks and
held-out evaluation. Attention weights never become detector confidence or device commands.

## Integration contract and observable device responses

A current OpenCV result becomes `{detected, normalized_x, area_fraction}`. Fewer than 16 selected
pixels produces no target. During recomputation, old results are hidden and cannot be sent. A single
explicit Send observation uses three adapters:

| Destination | Transport and response |
| --- | --- |
| IoT | Actual virtual ESP32 `WebServer`/LED circuit; GET `/on` or `/off`; returned HTTP status/body shown. |
| Drone | Actual ESP32 firmware/interpreter and clamped props-off quad; serial L/C/R requests 1150/1200/1250 µs on motor 1; X requests 1000 µs and disarms. Actual pulse/RPM shown. |
| Robotics | Same deterministic differential-drive model as `/robotics`; `/cmd_vel` Twist requests forward 0.15 m/s and yaw `−ex`; no target requests zero. Each send advances one virtual second and displays actual pose. |

IoT/drone instances use the existing real Web Worker scheduler in browsers and inline scheduling in
unit tests. The connected bench starts only by explicit button, waits for at least 1.2 virtual seconds
of low ESC signal, and disposes both instances on unmount. Blur stops/disarms the devices. Starting
again repairs/resets the prepared rigs. Editing a scene does not automatically send a new command.
Attention mode disables sending because it produces no detection observation.

The drone adapter demonstrates signal integration, **not autonomous landing or flight mixing**. No
camera-to-body transform, real sensor, real robot team, external MQTT broker or hardware transport is
simulated. Companion Python examples cover OpenCV processing, a minimal NumPy attention head,
HTTP device integration and an ROS 2 `rclpy` publisher. They can be read/downloaded, never executed by
the browser/backend. They use user-supplied saved images and require the stated companion dependencies;
the ROS publisher is a file-based exercise, not a deployed camera driver. The browser model remains
the ROS 2 concepts choice authorized by the user.

## Persistence and content

`content/vision.json` is a frontend-only lazy catalogue. Vision files use `kind:'vision',version:1`
and the fields of `DEFAULT_VISION`. The settings added for the classical courses (`VISION_V1_ADDITIONS`)
may be missing from older files and load with their defaults; every original key is still required.
Validation rejects:
- unknown themes or modes;
- out-of-range or non-finite values, and invalid patch queries;
- reversed thresholds, `minRadius ≥ maxRadius` and unsupported kernel sizes.
`engine/vision/visionContent.test.js` runs every course preset through real OpenCV and checks:
- each new course teaches one of the six modes, and its preset really demonstrates it (opening
  reduces components, contours find shapes, Otsu finds a mask, the card is found, Hough finds lines
  or circles, the template matches);
- the numbering is consistent and the capstone comes last. Import is limited to 8 KB with replace
confirmation. One settings slot uses `vq.vision.project.v1`; JSON export/import supports extra copies.
Export measurements includes configuration, current metrics/attention, observation and device preview.
These files are independent of CircuitDoc, saved circuit accounts and showcase records.

The interface supports English/Indonesian and preserves state on language changes. Robotics narratives
are translated; vision course narratives and companion explanations currently use the documented English
fallback where no Indonesian message is authored. Code, units, identifiers and raw program diagnostics
remain canonical.
