import cv2
import numpy as np
import re
import os

# Lazy EasyOCR initialization
ocr_reader = None

def get_ocr_reader():
    global ocr_reader
    if ocr_reader is None:
        try:
            import easyocr
            ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        except Exception:
            ocr_reader = False
    return ocr_reader if ocr_reader is not False else None


# ============================================================
# TEMPORAL STABILITY, PADDING & ENHANCEMENT CONFIGURATION
# ============================================================

MIN_PLATE_WIDTH = 30
MIN_PLATE_HEIGHT = 10
PLATE_CONFIRM_FRAMES = 3
PLATE_IOU_THRESHOLD = 0.3
PLATE_MAX_MISSED_FRAMES = 10
OCR_MIN_CONFIDENCE = 0.35
OCR_HISTORY_LENGTH = 8

PLATE_PADDING = 0.10   # 10% padding around plate bounding box
OCR_SCALE = 3          # Upscaling scale factor
PLATE_DEBUG = True     # Debug mode flag for saving/inspecting crops


# ============================================================
# UI LABEL & GARBAGE WORD BLACKLIST
# ============================================================

GARBAGE_WORDS = {
    "RESTR", "RESTRICTED", "PERSON", "PERSONS", "ZONE", "OBJECT", "OBJECTS",
    "CAR", "TRUCK", "BUS", "MOTORCYCLE", "VEHICLE", "VEHICLES", "DETECTION",
    "HAND", "HANDS", "THREAT", "SCORE", "LEVEL", "INSIDE", "NORMAL", "INTRUSION",
    "CARRIED", "BORDER", "RESTRICT", "SYSTEM", "CAMERA"
}


# ============================================================
# REGEX PATTERNS FOR INDIAN LICENSE PLATES
# ============================================================

INDIAN_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DN", "DL", "GA", "GJ",
    "HR", "HP", "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML",
    "MZ", "NL", "OD", "PY", "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK",
    "UA", "WB", "BH"
}

# Standard Indian registration format: (State 2 letters)(RTO 1-2 digits)(Series 1-3 letters)(Number 4 digits)
INDIAN_PLATE_PATTERN = re.compile(
    r"^([A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2}|[A-Z]{2,3}[0-9]{4})$"
)


# ============================================================
# DEBUG CROP SAVER (debug/plates/)
# ============================================================

def save_debug_crop(plate_crop, vehicle_id=0, frame_counter=0) -> str:
    """
    Saves plate crop image to debug/plates/vehicle_<id>_frame_<frame>.jpg.
    Maintains a maximum of 20 recent debug crops.
    """
    if plate_crop is None or plate_crop.size == 0:
        return None

    debug_dir = os.path.join("debug", "plates")
    os.makedirs(debug_dir, exist_ok=True)

    filename = f"vehicle_{vehicle_id}_frame_{frame_counter}.jpg"
    filepath = os.path.join(debug_dir, filename)
    cv2.imwrite(filepath, plate_crop)

    try:
        files = [os.path.join(debug_dir, f) for f in os.listdir(debug_dir) if f.endswith(".jpg")]
        files.sort(key=os.path.getmtime)
        while len(files) > 20:
            os.remove(files.pop(0))
    except Exception:
        pass

    return filepath


# ============================================================
# SHARPNESS & IMAGE QUALITY METRICS
# ============================================================

def compute_sharpness(img) -> float:
    """
    Computes image sharpness using Laplacian variance.
    Higher values indicate a sharper, clearer image.
    """
    if img is None or img.size == 0:
        return 0.0
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def compute_quality_score(plate_crop, bbox) -> float:
    """
    Calculates overall plate image quality score combining:
    - Plate size (area / width)
    - Laplacian variance sharpness
    """
    if plate_crop is None or plate_crop.size == 0 or bbox is None:
        return 0.0

    bw = bbox[2] - bbox[0]
    bh = bbox[3] - bbox[1]
    area = bw * bh

    sharpness = compute_sharpness(plate_crop)

    # Score combines physical area and relative sharpness
    score = float(area) * (1.0 + (sharpness / 100.0))
    return round(score, 2)


# ============================================================
# OCR CHARACTER DISAMBIGUATION & NORMALIZATION
# ============================================================

def normalize_ocr_text(raw_text: str) -> str:
    """
    Cleans raw OCR text: uppercase, removes non-alphanumeric noise,
    and applies Indian license plate character substitution rules (0/O, 1/I, 5/S, 8/B, 2/Z).
    """
    if not raw_text:
        return ""

    clean = re.sub(r"[^A-Z0-9]", "", raw_text.upper())

    if len(clean) < 4:
        return clean

    char_list = list(clean)
    letter_map = {'0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z'}
    digit_map = {'O': '0', 'I': '1', 'S': '5', 'B': '8', 'Z': '2', 'Q': '0', 'G': '6'}

    if len(char_list) >= 8:
        for i in range(2):
            if char_list[i] in letter_map:
                char_list[i] = letter_map[char_list[i]]

        for i in range(2, 4):
            if char_list[i] in digit_map:
                char_list[i] = digit_map[char_list[i]]

        for i in range(len(char_list) - 4, len(char_list)):
            if char_list[i] in digit_map:
                char_list[i] = digit_map[char_list[i]]

    return "".join(char_list)


def validate_indian_plate(text: str) -> bool:
    """
    Validates whether normalized OCR text matches valid Indian vehicle registration format.
    Must NOT be a garbage word, must contain digits, and must start with a valid Indian state code prefix.
    """
    if not text or len(text) < 5 or len(text) > 13:
        return False

    clean_text = text.upper().strip()

    if clean_text in GARBAGE_WORDS:
        return False

    for gw in GARBAGE_WORDS:
        if len(gw) >= 4 and gw in clean_text:
            return False

    digits = re.findall(r"\d", clean_text)
    if len(digits) < 2:
        return False

    if len(clean_text) >= 8 and clean_text[:2].isdigit() and clean_text[2:4] == "BH":
        return True

    prefix = clean_text[:2]
    if prefix in INDIAN_STATE_CODES:
        if INDIAN_PLATE_PATTERN.match(clean_text):
            return True
        if len(clean_text) >= 5 and clean_text[2].isdigit():
            return True

    return False


def validate_foreign_plate(text: str) -> bool:
    """
    Validates whether text is a plausible, legitimate foreign plate.
    Requires positive evidence: clean alphanumeric text, both letters AND digits,
    not matching garbage UI words, and not an Indian plate.
    """
    if not text or len(text) < 5 or len(text) > 11:
        return False

    clean_text = text.upper().strip()

    if clean_text in GARBAGE_WORDS:
        return False

    for gw in GARBAGE_WORDS:
        if len(gw) >= 4 and gw in clean_text:
            return False

    has_letters = bool(re.search(r"[A-Z]", clean_text))
    has_digits = bool(re.search(r"[0-9]", clean_text))

    if not (has_letters and has_digits):
        return False

    if validate_indian_plate(clean_text):
        return False

    return True


# ============================================================
# PERSPECTIVE CORRECTION FOR ANGLED PLATES
# ============================================================

def order_points(pts):
    """
    Orders 4 quadrilateral coordinates: top-left, top-right, bottom-right, bottom-left.
    """
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def correct_plate_perspective(vehicle_crop, contour):
    """
    Transforms an angled plate quadrilateral contour into a flat rectangular front-facing crop.
    Returns None if reliable 4-corner polygon is not found.
    """
    if contour is None or len(contour) < 4:
        return None

    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.03 * peri, True)

    if len(approx) == 4:
        pts = approx.reshape(4, 2).astype("float32")
        rect = order_points(pts)
        (tl, tr, br, bl) = rect

        widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
        widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
        maxWidth = max(int(widthA), int(widthB))

        heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
        heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
        maxHeight = max(int(heightA), int(heightB))

        if maxWidth < 25 or maxHeight < 10:
            return None

        aspect_ratio = maxWidth / float(maxHeight)
        if 1.5 <= aspect_ratio <= 7.0:
            dst = np.array([
                [0, 0],
                [maxWidth - 1, 0],
                [maxWidth - 1, maxHeight - 1],
                [0, maxHeight - 1]
            ], dtype="float32")

            M = cv2.getPerspectiveTransform(rect, dst)
            warped = cv2.warpPerspective(vehicle_crop, M, (maxWidth, maxHeight))
            return warped

    return None


# ============================================================
# PLATE LOCALIZATION INSIDE VEHICLE BOUNDING BOX
# ============================================================

def localize_number_plate(vehicle_crop, padding=PLATE_PADDING):
    """
    Finds rectangular number plate candidate inside a vehicle crop ROI.
    Performs perspective correction for angled plates and applies 10% padding.
    Returns: (plate_crop, (x1, y1, x2, y2)_in_vehicle_crop) or (None, None).
    """
    if vehicle_crop is None or vehicle_crop.size == 0:
        return None, None

    vh, vw = vehicle_crop.shape[:2]
    if vh < 20 or vw < 20:
        return None, None

    gray = cv2.cvtColor(vehicle_crop, cv2.COLOR_BGR2GRAY)

    rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 5))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, rect_kernel)

    sobel_x = cv2.Sobel(blackhat, cv2.CV_32F, 1, 0, ksize=-1)
    sobel_x = np.absolute(sobel_x)
    max_val = np.max(sobel_x)
    if max_val > 0:
        sobel_x = (255 * (sobel_x / max_val)).astype("uint8")
    else:
        sobel_x = sobel_x.astype("uint8")

    sobel_x = cv2.GaussianBlur(sobel_x, (5, 5), 0)
    _, thresh = cv2.threshold(sobel_x, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)

    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (17, 3))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, close_kernel)

    contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_candidate_contour = None
    best_candidate_bbox = None
    max_score = 0

    for c in contours:
        (x, y, w, h) = cv2.boundingRect(c)
        aspect_ratio = w / float(h)
        area = w * h
        vehicle_area = vw * vh

        if w >= MIN_PLATE_WIDTH and h >= MIN_PLATE_HEIGHT and 1.5 <= aspect_ratio <= 7.0 and (0.003 * vehicle_area <= area <= 0.30 * vehicle_area):
            vertical_score = 1.5 if (y + h / 2) > (vh * 0.3) else 1.0
            score = area * vertical_score

            if score > max_score:
                max_score = score
                best_candidate_contour = c
                best_candidate_bbox = (x, y, w, h)

    if best_candidate_contour is not None and best_candidate_bbox is not None:
        px, py, pw, ph = best_candidate_bbox

        warped = correct_plate_perspective(vehicle_crop, best_candidate_contour)

        pad_w = int(pw * padding)
        pad_h = int(ph * padding)
        x1 = max(0, px - pad_w)
        y1 = max(0, py - pad_h)
        x2 = min(vw, px + pw + pad_w)
        y2 = min(vh, py + ph + pad_h)

        if warped is not None and warped.shape[0] >= 12 and warped.shape[1] >= 35:
            plate_crop = warped
        else:
            plate_crop = vehicle_crop[y1:y2, x1:x2]

        return plate_crop, (x1, y1, x2, y2)

    # Fallback ROI: bottom 40% center of vehicle crop
    fy1 = int(vh * 0.55)
    fy2 = int(vh * 0.95)
    fx1 = int(vw * 0.15)
    fx2 = int(vw * 0.85)

    fallback_crop = vehicle_crop[fy1:fy2, fx1:fx2]
    return fallback_crop, (fx1, fy1, fx2, fy2)



# ============================================================
# MULTI-VARIANT IMAGE PREPROCESSING PIPELINE
# ============================================================

def preprocess_plate_crop(plate_crop, base_scale=OCR_SCALE):
    """
    Enlarges crop and generates 4 distinct enhancement variants for OCR:
    Variant A: Upscaled Grayscale
    Variant B: Upscaled Grayscale + CLAHE + Sharpening kernel
    Variant C: Upscaled Grayscale + Adaptive Gaussian Thresholding (Lighting resilience)
    Variant D: Upscaled Grayscale + Bilateral Filter Denoising + Otsu Thresholding (Blur resilience)
    """
    if plate_crop is None or plate_crop.size == 0:
        return []

    ph, pw = plate_crop.shape[:2]

    scale = base_scale
    if ph < 40:
        scale = 4
    elif ph > 120:
        scale = 2

    target_w = int(pw * scale)
    target_h = int(ph * scale)

    resized = cv2.resize(plate_crop, (target_w, target_h), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    var_a = gray.copy()

    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    enhanced_b = clahe.apply(gray)
    sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
    var_b = cv2.filter2D(enhanced_b, -1, sharpen_kernel)

    var_c = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 4
    )

    denoised_d = cv2.bilateralFilter(gray, 11, 17, 17)
    _, var_d = cv2.threshold(denoised_d, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return [var_a, var_b, var_c, var_d]


# ============================================================
# NUMBER PLATE OCR & TEMPORAL VOTING AGGREGATOR
# ============================================================

class VehiclePlateState:
    """
    Maintains temporal plate candidate tracking, OCR sliding window history,
    sharpness quality scores, and weighted voting aggregation for moving vehicles.
    """
    def __init__(self, vehicle_id):
        self.vehicle_id = vehicle_id
        self.plate_detection_count = 0
        self.missed_frames = 0
        self.confirmed_plate = False
        self.last_plate_bbox = None
        self.last_raw_text = "UNKNOWN"
        self.ocr_history = []
        self.stable_plate_number = "UNKNOWN"
        self.stable_country = "UNKNOWN"
        self.stable_confidence = 0.0
        self.best_quality_score = 0.0
        self.best_sharpness = 0.0

    def add_ocr_sample(self, plate_number, country, confidence, plate_bbox=None, sharpness=0.0, quality_score=0.0):
        self.missed_frames = 0
        if plate_bbox:
            self.last_plate_bbox = plate_bbox

        if plate_number and plate_number != "UNKNOWN":
            self.last_raw_text = plate_number

        self.plate_detection_count += 1
        if self.plate_detection_count >= PLATE_CONFIRM_FRAMES:
            self.confirmed_plate = True

        if quality_score > self.best_quality_score:
            self.best_quality_score = quality_score
        if sharpness > self.best_sharpness:
            self.best_sharpness = sharpness

        if confidence >= OCR_MIN_CONFIDENCE and country in ["INDIA", "NON_INDIA"]:
            self.ocr_history.append({
                "plate_number": plate_number,
                "country": country,
                "confidence": confidence,
                "sharpness": sharpness,
                "quality_score": quality_score
            })

            if len(self.ocr_history) > OCR_HISTORY_LENGTH:
                self.ocr_history.pop(0)

        self.aggregate_stable_result()

    def mark_missed(self):
        self.missed_frames += 1

    def is_expired(self):
        return self.missed_frames > PLATE_MAX_MISSED_FRAMES

    def aggregate_stable_result(self):
        if not self.ocr_history:
            return

        vote_scores = {}

        for entry in self.ocr_history:
            num = entry["plate_number"]
            c = entry["country"]
            conf = entry["confidence"]
            sh = entry.get("sharpness", 0.0)

            format_bonus = 3.0 if c == "INDIA" else (2.0 if c == "NON_INDIA" else 1.0)
            weight = (1.0 + conf) * format_bonus * (1.0 + (sh / 200.0))

            if num not in vote_scores:
                vote_scores[num] = {"score": 0.0, "count": 0, "country": c, "max_conf": conf}

            vote_scores[num]["count"] += 1
            vote_scores[num]["score"] += weight
            if conf > vote_scores[num]["max_conf"]:
                vote_scores[num]["max_conf"] = conf

        best_num = None
        max_score = 0.0

        for num, stats in vote_scores.items():
            if stats["score"] > max_score:
                max_score = stats["score"]
                best_num = num

        if best_num and vote_scores[best_num]["count"] >= 1:
            best_stats = vote_scores[best_num]
            self.stable_plate_number = best_num
            self.stable_country = best_stats["country"]
            self.stable_confidence = round(best_stats["max_conf"], 2)

    def to_dict(self, vehicle_type="car"):
        display_number = self.stable_plate_number if self.stable_plate_number != "UNKNOWN" else self.last_raw_text
        return {
            "vehicle_type": vehicle_type,
            "plate_number": display_number,
            "plate_country": self.stable_country,
            "plate_confidence": self.stable_confidence if self.stable_country != "UNKNOWN" else 1.0,
            "plate_bbox": self.last_plate_bbox if self.confirmed_plate else None,
            "candidate_found": self.last_plate_bbox is not None,
            "best_quality_score": round(self.best_quality_score, 2),
            "best_sharpness": round(self.best_sharpness, 2)
        }


def process_number_plate(frame, vehicle_bbox, vehicle_type="car", vehicle_id=0, frame_counter=0) -> dict:
    """
    Processes a single frame for a detected vehicle:
    1. Localizes plate candidate (with perspective correction & 10% padding)
    2. Saves debug crop image to debug/plates/
    3. Computes Laplacian sharpness & overall quality score
    4. Generates 4 preprocessing variants
    5. Runs EasyOCR across variants
    6. Evaluates format validity & selects best candidate
    7. Classifies country ("INDIA", "NON_INDIA", "UNKNOWN")
    """
    vx1, vy1, vx2, vy2 = vehicle_bbox
    fh, fw = frame.shape[:2]

    vx1 = max(0, min(vx1, fw - 1))
    vy1 = max(0, min(vy1, fh - 1))
    vx2 = max(0, min(vx2, fw))
    vy2 = max(0, min(vy2, fh))

    if vx2 <= vx1 or vy2 <= vy1:
        return {
            "vehicle_type": vehicle_type,
            "plate_number": "UNKNOWN",
            "plate_country": "UNKNOWN",
            "plate_confidence": 0.0,
            "plate_bbox": None,
            "candidate_found": False,
            "raw_ocr_result": "N/A",
            "ocr_attempted": False,
            "sharpness": 0.0,
            "quality_score": 0.0,
            "crop_filepath": None
        }

    vehicle_crop = frame[vy1:vy2, vx1:vx2]

    plate_crop, local_bbox = localize_number_plate(vehicle_crop, padding=PLATE_PADDING)

    if plate_crop is None or plate_crop.size == 0:
        return {
            "vehicle_type": vehicle_type,
            "plate_number": "UNKNOWN",
            "plate_country": "UNKNOWN",
            "plate_confidence": 0.0,
            "plate_bbox": None,
            "candidate_found": False,
            "raw_ocr_result": "N/A",
            "ocr_attempted": False,
            "sharpness": 0.0,
            "quality_score": 0.0,
            "crop_filepath": None
        }

    lx1, ly1, lx2, ly2 = local_bbox
    global_plate_bbox = [vx1 + lx1, vy1 + ly1, vx1 + lx2, vy1 + ly2]

    crop_filepath = save_debug_crop(plate_crop, vehicle_id=vehicle_id, frame_counter=frame_counter)

    sharpness = compute_sharpness(plate_crop)
    quality_score = compute_quality_score(plate_crop, global_plate_bbox)

    variants = preprocess_plate_crop(plate_crop, base_scale=OCR_SCALE)

    reader = get_ocr_reader()

    best_text = ""
    best_conf = 0.0
    best_selection_score = -1.0

    if reader is not None and len(variants) > 0:
        for img_variant in variants:
            try:
                results = reader.readtext(img_variant, detail=1)
                for bbox, text, conf in results:
                    norm_text = normalize_ocr_text(text)
                    if len(norm_text) >= 4:
                        if validate_indian_plate(norm_text):
                            score = 10.0 + conf
                        elif validate_foreign_plate(norm_text):
                            score = 8.0 + conf
                        else:
                            score = float(conf)

                        if score > best_selection_score:
                            best_selection_score = score
                            best_text = norm_text
                            best_conf = float(conf)
            except Exception:
                pass

    if best_conf >= OCR_MIN_CONFIDENCE and len(best_text) >= 5:
        if validate_indian_plate(best_text):
            country = "INDIA"
            plate_num = best_text
        elif validate_foreign_plate(best_text):
            country = "NON_INDIA"
            plate_num = best_text
        else:
            country = "UNKNOWN"
            plate_num = best_text
    else:
        country = "UNKNOWN"
        plate_num = best_text if best_text else "UNKNOWN"

    return {
        "vehicle_type": vehicle_type,
        "plate_number": plate_num,
        "plate_country": country,
        "plate_confidence": round(best_conf, 2),
        "plate_bbox": global_plate_bbox,
        "candidate_found": True,
        "raw_ocr_result": best_text if best_text else "EMPTY",
        "ocr_attempted": True,
        "sharpness": round(sharpness, 2),
        "quality_score": round(quality_score, 2),
        "crop_filepath": crop_filepath
    }
