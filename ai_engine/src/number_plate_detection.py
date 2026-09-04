import cv2
import numpy as np
import re
import os
from collections import Counter


# ============================================================
# LAZY EASYOCR INITIALIZATION
# ============================================================

ocr_reader = None


def get_ocr_reader():
    """
    Lazily initializes EasyOCR.

    OCR_GPU environment variable:
        true  -> force GPU
        false -> force CPU
        auto  -> automatically use GPU if CUDA is available

    Default: auto
    """
    global ocr_reader

    if ocr_reader is not None:
        return ocr_reader if ocr_reader is not False else None

    try:
        import easyocr

        gpu_setting = os.getenv("OCR_GPU", "auto").strip().lower()

        if gpu_setting == "true":
            use_gpu = True
        elif gpu_setting == "false":
            use_gpu = False
        else:
            try:
                import torch
                use_gpu = bool(torch.cuda.is_available())
            except Exception:
                use_gpu = False

        print(
            f"[NUMBER PLATE] Initializing EasyOCR "
            f"(GPU={'ON' if use_gpu else 'OFF'})..."
        )

        ocr_reader = easyocr.Reader(
            ["en"],
            gpu=use_gpu,
            verbose=False
        )

        print(
            f"[NUMBER PLATE] EasyOCR initialized successfully "
            f"(GPU={'ON' if use_gpu else 'OFF'})"
        )

    except Exception as exc:
        print(f"[NUMBER PLATE] EasyOCR initialization failed: {exc}")
        ocr_reader = False

    return ocr_reader if ocr_reader is not False else None


# ============================================================
# CONFIGURATION
# ============================================================

MIN_PLATE_WIDTH = 30
MIN_PLATE_HEIGHT = 10

PLATE_CONFIRM_FRAMES = 3
PLATE_IOU_THRESHOLD = 0.30
PLATE_MAX_MISSED_FRAMES = 10

OCR_MIN_CONFIDENCE = 0.35
OCR_HISTORY_LENGTH = 8

PLATE_PADDING = 0.10
OCR_SCALE = 3

PLATE_DEBUG = True

# OCR characters allowed on a normal registration plate.
OCR_ALLOWLIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

# Keep multiple candidates during localization.
MAX_PLATE_CANDIDATES = 4


# ============================================================
# UI LABEL & GARBAGE WORD BLACKLIST
# ============================================================

GARBAGE_WORDS = {
    "RESTR", "RESTRICTED", "PERSON", "PERSONS", "ZONE",
    "OBJECT", "OBJECTS", "CAR", "TRUCK", "BUS",
    "MOTORCYCLE", "VEHICLE", "VEHICLES", "DETECTION",
    "HAND", "HANDS", "THREAT", "SCORE", "LEVEL",
    "INSIDE", "NORMAL", "INTRUSION", "CARRIED",
    "BORDER", "RESTRICT", "SYSTEM", "CAMERA",
    "PLATE", "NUMBER", "LICENSE", "LICENCE",
    "WARNING", "ALERT", "UNKNOWN"
}


# ============================================================
# INDIAN LICENSE PLATE DATA
# ============================================================

INDIAN_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DN",
    "DL", "GA", "GJ", "HR", "HP", "JK", "JH", "KA", "KL",
    "LA", "LD", "MP", "MH", "MN", "ML", "MZ", "NL", "OD",
    "PY", "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK",
    "UA", "WB", "BH"
}


# Standard modern Indian registration formats.
INDIAN_PLATE_PATTERNS = [
    re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$"),
    re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$"),
    re.compile(r"^[A-Z]{2,3}[0-9]{4}$"),
]


# ============================================================
# DEBUG CROP SAVER
# ============================================================

def save_debug_crop(plate_crop, vehicle_id=0, frame_counter=0) -> str:
    """
    Saves the latest plate crop.

    Maximum of 20 JPEG crops are retained.
    """
    if not PLATE_DEBUG:
        return None

    if plate_crop is None or plate_crop.size == 0:
        return None

    debug_dir = os.path.join("debug", "plates")
    os.makedirs(debug_dir, exist_ok=True)

    filename = f"vehicle_{vehicle_id}_frame_{frame_counter}.jpg"
    filepath = os.path.join(debug_dir, filename)

    try:
        cv2.imwrite(filepath, plate_crop)
    except Exception:
        return None

    try:
        files = [
            os.path.join(debug_dir, f)
            for f in os.listdir(debug_dir)
            if f.lower().endswith(".jpg")
        ]

        files.sort(key=os.path.getmtime)

        while len(files) > 20:
            os.remove(files.pop(0))

    except Exception:
        pass

    return filepath


# ============================================================
# IMAGE QUALITY
# ============================================================

def compute_sharpness(img) -> float:
    """
    Laplacian variance sharpness measurement.
    Higher = sharper.
    """
    if img is None or img.size == 0:
        return 0.0

    try:
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img

        return float(cv2.Laplacian(gray, cv2.CV_64F).var())

    except Exception:
        return 0.0


def compute_brightness(img) -> float:
    """
    Returns average grayscale brightness.
    """
    if img is None or img.size == 0:
        return 0.0

    try:
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img

        return float(np.mean(gray))

    except Exception:
        return 0.0


def compute_contrast(img) -> float:
    """
    Returns grayscale standard deviation.
    """
    if img is None or img.size == 0:
        return 0.0

    try:
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img

        return float(np.std(gray))

    except Exception:
        return 0.0


def compute_quality_score(plate_crop, bbox) -> float:
    """
    Combines:
        - physical plate area
        - sharpness
        - contrast
        - reasonable brightness

    This is used to prefer good OCR frames.
    """
    if plate_crop is None or plate_crop.size == 0 or bbox is None:
        return 0.0

    try:
        bw = max(1, bbox[2] - bbox[0])
        bh = max(1, bbox[3] - bbox[1])

        area = float(bw * bh)

        sharpness = compute_sharpness(plate_crop)
        contrast = compute_contrast(plate_crop)
        brightness = compute_brightness(plate_crop)

        sharpness_component = min(sharpness / 150.0, 4.0)
        contrast_component = min(contrast / 40.0, 2.0)

        # Avoid heavily over/under exposed crops.
        brightness_bonus = 1.0
        if 45.0 <= brightness <= 220.0:
            brightness_bonus = 1.15

        score = (
            area
            * (1.0 + sharpness_component)
            * (1.0 + contrast_component * 0.25)
            * brightness_bonus
        )

        return round(float(score), 2)

    except Exception:
        return 0.0


# ============================================================
# OCR NORMALIZATION
# ============================================================

def clean_ocr_text(raw_text: str) -> str:
    """
    Basic OCR cleanup only.
    Does NOT perform aggressive character replacement.
    """
    if not raw_text:
        return ""

    return re.sub(
        r"[^A-Z0-9]",
        "",
        raw_text.upper()
    )


def _generate_ambiguity_variants(text: str):
    """
    Generates limited OCR correction variants.

    Important:
    We do NOT blindly convert every 0->O or O->0.

    Instead, we create alternatives and let Indian plate
    validation decide which interpretation is plausible.
    """
    text = clean_ocr_text(text)

    if not text:
        return []

    variants = {text}

    ambiguity_map = {
        "0": ["O"],
        "O": ["0"],
        "1": ["I"],
        "I": ["1"],
        "5": ["S"],
        "S": ["5"],
        "8": ["B"],
        "B": ["8"],
        "2": ["Z"],
        "Z": ["2"],
        "6": ["G"],
        "G": ["6"],
    }

    # Only modify a small number of characters to avoid
    # combinatorial explosion.
    for index, char in enumerate(text):
        replacements = ambiguity_map.get(char, [])

        for replacement in replacements:
            chars = list(text)
            chars[index] = replacement
            variants.add("".join(chars))

    return list(variants)


def normalize_ocr_text(raw_text: str) -> str:
    """
    Normalizes OCR output.

    First checks the original OCR output.
    Then evaluates ambiguity-corrected variants and prefers
    a valid Indian registration if available.
    """
    clean = clean_ocr_text(raw_text)

    if len(clean) < 4:
        return clean

    variants = _generate_ambiguity_variants(clean)

    # Prefer exact valid Indian plate.
    for candidate in variants:
        if validate_indian_plate(candidate):
            return candidate

    # Otherwise keep original OCR output.
    return clean


# ============================================================
# PLATE VALIDATION
# ============================================================

def validate_indian_plate(text: str) -> bool:
    """
    Strict Indian plate validation.

    Requirements:
        - reasonable length
        - valid state code OR BH format
        - sufficient numeric content
        - registration format match
        - no UI garbage words
    """
    if not text:
        return False

    clean_text = clean_ocr_text(text)

    if len(clean_text) < 5 or len(clean_text) > 13:
        return False

    if clean_text in GARBAGE_WORDS:
        return False

    for garbage in GARBAGE_WORDS:
        if len(garbage) >= 5 and garbage in clean_text:
            return False

    # BH-series format:
    # 22BH1234AB
    if (
        len(clean_text) >= 8
        and re.match(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$", clean_text)
    ):
        return True

    prefix = clean_text[:2]

    if prefix not in INDIAN_STATE_CODES:
        return False

    # Strong standard format.
    for pattern in INDIAN_PLATE_PATTERNS:
        if pattern.match(clean_text):
            return True

    return False


def validate_foreign_plate(text: str) -> bool:
    """
    Conservative foreign plate validation.
    """
    if not text:
        return False

    clean_text = clean_ocr_text(text)

    if len(clean_text) < 5 or len(clean_text) > 11:
        return False

    if clean_text in GARBAGE_WORDS:
        return False

    for garbage in GARBAGE_WORDS:
        if len(garbage) >= 5 and garbage in clean_text:
            return False

    if validate_indian_plate(clean_text):
        return False

    has_letters = bool(re.search(r"[A-Z]", clean_text))
    has_digits = bool(re.search(r"[0-9]", clean_text))

    return has_letters and has_digits


# ============================================================
# GEOMETRY HELPERS
# ============================================================

def order_points(pts):
    """
    Orders points:
        top-left
        top-right
        bottom-right
        bottom-left
    """
    rect = np.zeros((4, 2), dtype="float32")

    s = pts.sum(axis=1)

    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    diff = np.diff(pts, axis=1)

    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect


def contour_iou(box_a, box_b):
    """
    IoU for x1,y1,x2,y2 boxes.
    """
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)

    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0

    intersection = (ix2 - ix1) * (iy2 - iy1)

    area_a = max(1, (ax2 - ax1) * (ay2 - ay1))
    area_b = max(1, (bx2 - bx1) * (by2 - by1))

    return intersection / float(area_a + area_b - intersection)


def contour_rectangularity(contour):
    """
    Measures how rectangular the contour is.
    """
    area = cv2.contourArea(contour)

    if area <= 0:
        return 0.0

    x, y, w, h = cv2.boundingRect(contour)

    rect_area = max(1, w * h)

    return float(area / rect_area)


# ============================================================
# PERSPECTIVE CORRECTION
# ============================================================

def correct_plate_perspective(vehicle_crop, contour):
    """
    Perspective-corrects a quadrilateral plate.

    Falls back to a minimum-area rectangle when a clean
    four-point polygon cannot be obtained.
    """
    if vehicle_crop is None:
        return None

    if contour is None or len(contour) < 4:
        return None

    try:
        peri = cv2.arcLength(contour, True)

        approx = cv2.approxPolyDP(
            contour,
            0.025 * peri,
            True
        )

        pts = None

        if len(approx) == 4:
            pts = approx.reshape(4, 2).astype("float32")

        else:
            rect = cv2.minAreaRect(contour)
            box = cv2.boxPoints(rect)
            pts = box.astype("float32")

        rect = order_points(pts)

        tl, tr, br, bl = rect

        width_a = np.linalg.norm(br - bl)
        width_b = np.linalg.norm(tr - tl)

        height_a = np.linalg.norm(tr - br)
        height_b = np.linalg.norm(tl - bl)

        max_width = max(int(width_a), int(width_b))
        max_height = max(int(height_a), int(height_b))

        if max_width < 25 or max_height < 10:
            return None

        aspect_ratio = max_width / float(max_height)

        if not (1.5 <= aspect_ratio <= 8.0):
            return None

        destination = np.array(
            [
                [0, 0],
                [max_width - 1, 0],
                [max_width - 1, max_height - 1],
                [0, max_height - 1],
            ],
            dtype="float32"
        )

        matrix = cv2.getPerspectiveTransform(
            rect,
            destination
        )

        warped = cv2.warpPerspective(
            vehicle_crop,
            matrix,
            (max_width, max_height),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE
        )

        if warped is None or warped.size == 0:
            return None

        return warped

    except Exception:
        return None


# ============================================================
# PLATE CANDIDATE EXTRACTION
# ============================================================

def _build_localization_images(gray):
    """
    Generates several independent localization maps.

    This is more robust than depending on one blackhat pipeline.
    """
    images = []

    # --------------------------------------------------------
    # 1. Blackhat + horizontal gradient
    # --------------------------------------------------------
    blackhat_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (13, 5)
    )

    blackhat = cv2.morphologyEx(
        gray,
        cv2.MORPH_BLACKHAT,
        blackhat_kernel
    )

    sobel_x = cv2.Sobel(
        blackhat,
        cv2.CV_32F,
        1,
        0,
        ksize=3
    )

    sobel_x = np.absolute(sobel_x)

    max_value = np.max(sobel_x)

    if max_value > 0:
        sobel_x = (
            255 * (sobel_x / max_value)
        ).astype(np.uint8)
    else:
        sobel_x = sobel_x.astype(np.uint8)

    sobel_x = cv2.GaussianBlur(
        sobel_x,
        (5, 5),
        0
    )

    _, blackhat_thresh = cv2.threshold(
        sobel_x,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )

    close_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (17, 3)
    )

    blackhat_thresh = cv2.morphologyEx(
        blackhat_thresh,
        cv2.MORPH_CLOSE,
        close_kernel
    )

    images.append(blackhat_thresh)

    # --------------------------------------------------------
    # 2. Canny edge detection
    # --------------------------------------------------------
    edges = cv2.Canny(
        gray,
        70,
        180
    )

    edge_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (15, 3)
    )

    edges = cv2.morphologyEx(
        edges,
        cv2.MORPH_CLOSE,
        edge_kernel
    )

    images.append(edges)

    # --------------------------------------------------------
    # 3. Bright plate detection
    # --------------------------------------------------------
    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    enhanced = clahe.apply(gray)

    _, bright = cv2.threshold(
        enhanced,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )

    bright_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (17, 3)
    )

    bright = cv2.morphologyEx(
        bright,
        cv2.MORPH_CLOSE,
        bright_kernel
    )

    images.append(bright)

    return images


def _collect_plate_candidates(vehicle_crop):
    """
    Collects multiple plate candidates from different localization
    strategies and scores them geometrically.
    """
    vh, vw = vehicle_crop.shape[:2]

    gray = cv2.cvtColor(
        vehicle_crop,
        cv2.COLOR_BGR2GRAY
    )

    localization_images = _build_localization_images(gray)

    candidates = []

    vehicle_area = float(vw * vh)

    for localization_image in localization_images:

        contours, _ = cv2.findContours(
            localization_image.copy(),
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )

        for contour in contours:

            x, y, w, h = cv2.boundingRect(contour)

            if w < MIN_PLATE_WIDTH or h < MIN_PLATE_HEIGHT:
                continue

            area = float(w * h)

            if area < vehicle_area * 0.002:
                continue

            if area > vehicle_area * 0.35:
                continue

            aspect_ratio = w / float(max(1, h))

            if not (1.5 <= aspect_ratio <= 8.0):
                continue

            # Plate is generally in lower/middle region of vehicle.
            center_y = y + h / 2.0

            if center_y < vh * 0.20:
                vertical_score = 0.65
            elif center_y > vh * 0.95:
                vertical_score = 0.55
            elif center_y > vh * 0.35:
                vertical_score = 1.15
            else:
                vertical_score = 0.90

            rectangularity = contour_rectangularity(contour)

            # Ideal plate aspect ratio is generally around 2-5.
            aspect_score = 1.0

            if 2.0 <= aspect_ratio <= 5.5:
                aspect_score = 1.25
            elif 1.7 <= aspect_ratio <= 7.0:
                aspect_score = 1.0
            else:
                aspect_score = 0.75

            # Prefer moderately sized candidates.
            relative_area = area / vehicle_area

            area_score = 1.0

            if 0.01 <= relative_area <= 0.15:
                area_score = 1.25
            elif relative_area <= 0.25:
                area_score = 1.0
            else:
                area_score = 0.75

            score = (
                aspect_score
                * area_score
                * vertical_score
                * (0.7 + rectangularity)
                * area
            )

            candidates.append({
                "contour": contour,
                "bbox": (x, y, x + w, y + h),
                "score": float(score),
                "aspect_ratio": float(aspect_ratio),
                "rectangularity": float(rectangularity)
            })

    # --------------------------------------------------------
    # Sort and remove duplicate candidates.
    # --------------------------------------------------------
    candidates.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    selected = []

    for candidate in candidates:

        duplicate = False

        for existing in selected:
            if contour_iou(
                candidate["bbox"],
                existing["bbox"]
            ) > 0.50:
                duplicate = True
                break

        if not duplicate:
            selected.append(candidate)

        if len(selected) >= MAX_PLATE_CANDIDATES:
            break

    return selected


# ============================================================
# PLATE LOCALIZATION
# ============================================================

def localize_number_plate(
    vehicle_crop,
    padding=PLATE_PADDING
):
    """
    Finds the strongest number plate candidate.

    Uses multiple localization strategies and geometric scoring.

    Returns:
        (plate_crop, local_bbox)
    """
    if vehicle_crop is None or vehicle_crop.size == 0:
        return None, None

    vh, vw = vehicle_crop.shape[:2]

    if vh < 20 or vw < 20:
        return None, None

    candidates = _collect_plate_candidates(
        vehicle_crop
    )

    # --------------------------------------------------------
    # Candidate found
    # --------------------------------------------------------
    if candidates:

               # Candidates are already ranked by localization quality.
        # Prefer a candidate that produces a plate-like crop with
        # useful image quality instead of blindly trusting the
        # largest/geometrically strongest contour.

        best = candidates[0]
        best_score = -1.0

        for candidate in candidates[:MAX_PLATE_CANDIDATES]:

            cx1, cy1, cx2, cy2 = candidate["bbox"]

            cw = cx2 - cx1
            ch = cy2 - cy1

            if cw <= 0 or ch <= 0:
                continue

            pad_w_test = max(2, int(cw * padding))
            pad_h_test = max(2, int(ch * padding))

            tx1 = max(0, cx1 - pad_w_test)
            ty1 = max(0, cy1 - pad_h_test)
            tx2 = min(vw, cx2 + pad_w_test)
            ty2 = min(vh, cy2 + pad_h_test)

            test_crop = vehicle_crop[
                ty1:ty2,
                tx1:tx2
            ]

            if test_crop is None or test_crop.size == 0:
                continue

            sharpness = compute_sharpness(test_crop)
            contrast = compute_contrast(test_crop)

            # Candidate geometry score supplied by
            # _collect_plate_candidates().
            geometry_score = float(
                candidate.get("score", 0.0)
            )

            # Quality bonus prevents a large but blurry
            # rectangle from always winning.
            quality_bonus = 0.0

            if sharpness >= 40:
                quality_bonus += 0.08

            if sharpness >= 100:
                quality_bonus += 0.08

            if contrast >= 20:
                quality_bonus += 0.05

            # Very small candidates are unreliable.
            size_bonus = 0.0

            if cw >= 60 and ch >= 18:
                size_bonus += 0.05

            total_score = (
                geometry_score
                + quality_bonus
                + size_bonus
            )

            if total_score > best_score:
                best_score = total_score
                best = candidate

        x1, y1, x2, y2 = best["bbox"]

        pw = x2 - x1
        ph = y2 - y1

        pad_w = max(
            2,
            int(pw * padding)
        )

        pad_h = max(
            2,
            int(ph * padding)
        )

        crop_x1 = max(
            0,
            x1 - pad_w
        )

        crop_y1 = max(
            0,
            y1 - pad_h
        )

        crop_x2 = min(
            vw,
            x2 + pad_w
        )

        crop_y2 = min(
            vh,
            y2 + pad_h
        )

        # Try perspective correction first.
        warped = correct_plate_perspective(
            vehicle_crop,
            best["contour"]
        )

        if (
            warped is not None
            and warped.size > 0
            and warped.shape[0] >= 12
            and warped.shape[1] >= 35
        ):
            plate_crop = warped
        else:
            plate_crop = vehicle_crop[
                crop_y1:crop_y2,
                crop_x1:crop_x2
            ]

        return (
            plate_crop,
            (
                crop_x1,
                crop_y1,
                crop_x2,
                crop_y2
            )
        )

    # --------------------------------------------------------
    # Fallback
    #
    # Important: use a relatively tight lower-center ROI
    # rather than feeding the entire vehicle to OCR.
    # --------------------------------------------------------
    fy1 = int(vh * 0.50)
    fy2 = int(vh * 0.94)

    fx1 = int(vw * 0.12)
    fx2 = int(vw * 0.88)

    if fy2 <= fy1 or fx2 <= fx1:
        return None, None

    fallback_crop = vehicle_crop[
        fy1:fy2,
        fx1:fx2
    ]

    if fallback_crop.size == 0:
        return None, None

    return (
        fallback_crop,
        (fx1, fy1, fx2, fy2)
    )


# ============================================================
# OCR PREPROCESSING
# ============================================================

def preprocess_plate_crop(
    plate_crop,
    base_scale=OCR_SCALE
):
    """
    Generates multiple OCR-ready images.

    Variants:
        A - clean grayscale
        B - CLAHE
        C - sharpened
        D - adaptive threshold
        E - Otsu
        F - bilateral + CLAHE
    """
    if plate_crop is None or plate_crop.size == 0:
        return []

    ph, pw = plate_crop.shape[:2]

    # Dynamic scaling:
    # small plates receive more enlargement.
    if ph < 24:
        scale = 5
    elif ph < 40:
        scale = 4
    elif ph < 70:
        scale = 3
    elif ph > 140:
        scale = 2
    else:
        scale = base_scale

    target_w = max(
        80,
        int(pw * scale)
    )

    target_h = max(
        24,
        int(ph * scale)
    )

    resized = cv2.resize(
        plate_crop,
        (target_w, target_h),
        interpolation=cv2.INTER_CUBIC
    )

    gray = cv2.cvtColor(
        resized,
        cv2.COLOR_BGR2GRAY
    )

    variants = []

    # --------------------------------------------------------
    # A. Original grayscale
    # --------------------------------------------------------
    variants.append(gray.copy())

    # --------------------------------------------------------
    # B. CLAHE
    # --------------------------------------------------------
    clahe = cv2.createCLAHE(
        clipLimit=2.5,
        tileGridSize=(8, 8)
    )

    clahe_img = clahe.apply(gray)

    variants.append(clahe_img)

    # --------------------------------------------------------
    # C. CLAHE + mild sharpening
    # --------------------------------------------------------
    sharpen_kernel = np.array(
        [
            [0, -1, 0],
            [-1, 5, -1],
            [0, -1, 0]
        ],
        dtype=np.float32
    )

    sharpened = cv2.filter2D(
        clahe_img,
        -1,
        sharpen_kernel
    )

    variants.append(sharpened)

    # --------------------------------------------------------
    # D. Adaptive threshold
    # --------------------------------------------------------
    adaptive = cv2.adaptiveThreshold(
        clahe_img,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        21,
        5
    )

    variants.append(adaptive)

    # --------------------------------------------------------
    # E. Otsu
    # --------------------------------------------------------
    denoised = cv2.GaussianBlur(
        clahe_img,
        (3, 3),
        0
    )

    _, otsu = cv2.threshold(
        denoised,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )

    variants.append(otsu)

    # --------------------------------------------------------
    # F. Bilateral + CLAHE
    # --------------------------------------------------------
    bilateral = cv2.bilateralFilter(
        gray,
        7,
        50,
        50
    )

    bilateral_clahe = clahe.apply(
        bilateral
    )

    variants.append(bilateral_clahe)

    return variants


# ============================================================
# OCR RESULT SCORING
# ============================================================

def plate_format_score(text):
    """
    Gives additional score to structurally plausible plates.
    """
    if not text:
        return 0.0

    clean = clean_ocr_text(text)

    if validate_indian_plate(clean):
        return 10.0

    if validate_foreign_plate(clean):
        return 6.0

    # Weak evidence.
    if len(clean) >= 5:
        return 1.0

    return 0.0


def score_ocr_candidate(
    text,
    confidence,
    image_quality
):
    """
    Scores an OCR hypothesis using:
        OCR confidence
        plate format validity
        image quality
    """
    if not text:
        return -1.0

    clean = clean_ocr_text(text)

    if len(clean) < 4:
        return -1.0

    format_score = plate_format_score(clean)

    confidence_score = float(confidence) * 5.0

    quality_score = min(
        float(image_quality) / 10000.0,
        2.0
    )

    return (
        format_score
        + confidence_score
        + quality_score
    )


# ============================================================
# TEMPORAL PLATE STATE
# ============================================================

class VehiclePlateState:
    """
    Maintains plate observations for a tracked vehicle.

    Uses:
        - OCR history
        - confidence
        - sharpness
        - image quality
        - temporal voting
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

    def add_ocr_sample(
        self,
        plate_number,
        country,
        confidence,
        plate_bbox=None,
        sharpness=0.0,
        quality_score=0.0
    ):
        """
        Adds an OCR observation for this tracked vehicle.
        """
        self.missed_frames = 0

        if plate_bbox is not None:
            self.last_plate_bbox = plate_bbox

        if plate_number and plate_number != "UNKNOWN":
            self.last_raw_text = plate_number

        self.plate_detection_count += 1

        if (
            self.plate_detection_count
            >= PLATE_CONFIRM_FRAMES
        ):
            self.confirmed_plate = True

        self.best_quality_score = max(
            self.best_quality_score,
            quality_score
        )

        self.best_sharpness = max(
            self.best_sharpness,
            sharpness
        )

        if (
            plate_number
            and plate_number != "UNKNOWN"
            and confidence >= OCR_MIN_CONFIDENCE
            and country in ["INDIA", "NON_INDIA"]
        ):

            normalized = normalize_ocr_text(
                plate_number
            )

            self.ocr_history.append({
                "plate_number": normalized,
                "country": country,
                "confidence": float(confidence),
                "sharpness": float(sharpness),
                "quality_score": float(quality_score)
            })

            if len(self.ocr_history) > OCR_HISTORY_LENGTH:
                self.ocr_history.pop(0)

        self.aggregate_stable_result()

    def mark_missed(self):
        self.missed_frames += 1

    def is_expired(self):
        return (
            self.missed_frames
            > PLATE_MAX_MISSED_FRAMES
        )

    def aggregate_stable_result(self):
        """
        Performs weighted temporal voting.

        Repeated observations of the same registration receive
        substantially more weight than a single high-confidence
        erroneous observation.
        """
        if not self.ocr_history:
            return

        vote_scores = {}

        for entry in self.ocr_history:

            number = entry["plate_number"]
            country = entry["country"]
            confidence = entry["confidence"]
            sharpness = entry.get(
                "sharpness",
                0.0
            )
            quality = entry.get(
                "quality_score",
                0.0
            )

            if not number:
                continue

            format_bonus = (
                4.0
                if country == "INDIA"
                else 2.0
            )

            confidence_weight = (
                1.0 + confidence
            )

            sharpness_weight = (
                1.0
                + min(
                    sharpness / 300.0,
                    1.5
                )
            )

            quality_weight = (
                1.0
                + min(
                    quality / 10000.0,
                    1.0
                )
            )

            total_weight = (
                format_bonus
                * confidence_weight
                * sharpness_weight
                * quality_weight
            )

            if number not in vote_scores:
                vote_scores[number] = {
                    "score": 0.0,
                    "count": 0,
                    "country": country,
                    "max_conf": 0.0
                }

            vote_scores[number]["score"] += (
                total_weight
            )

            vote_scores[number]["count"] += 1

            vote_scores[number]["max_conf"] = max(
                vote_scores[number]["max_conf"],
                confidence
            )

        if not vote_scores:
            return

        # Sort by weighted score.
        ranked = sorted(
            vote_scores.items(),
            key=lambda item: item[1]["score"],
            reverse=True
        )

        best_number, best_stats = ranked[0]

        # Require either:
        #   - repeated observation
        #   - or a highly confident Indian-format result.
        repeated = best_stats["count"] >= 2

        highly_confident_indian = (
            best_stats["country"] == "INDIA"
            and best_stats["max_conf"] >= 0.75
        )

        if repeated or highly_confident_indian:
            self.stable_plate_number = (
                best_number
            )

            self.stable_country = (
                best_stats["country"]
            )

            self.stable_confidence = round(
                best_stats["max_conf"],
                2
            )

    def to_dict(self, vehicle_type="car"):

        display_number = (
            self.stable_plate_number
            if self.stable_plate_number != "UNKNOWN"
            else self.last_raw_text
        )

        return {
            "vehicle_type": vehicle_type,
            "plate_number": display_number,
            "plate_country": self.stable_country,
            "plate_confidence": (
                self.stable_confidence
                if self.stable_country != "UNKNOWN"
                else 1.0
            ),
            "plate_bbox": (
                self.last_plate_bbox
                if self.confirmed_plate
                else None
            ),
            "candidate_found": (
                self.last_plate_bbox is not None
            ),
            "best_quality_score": round(
                self.best_quality_score,
                2
            ),
            "best_sharpness": round(
                self.best_sharpness,
                2
            )
        }


# ============================================================
# MAIN NUMBER PLATE PROCESSOR
# ============================================================

def process_number_plate(
    frame,
    vehicle_bbox,
    vehicle_type="car",
    vehicle_id=0,
    frame_counter=0
) -> dict:
    """
    Processes one vehicle frame.

    Pipeline:

        Vehicle ROI
            â†“
        Multi-method plate localization
            â†“
        Geometry scoring
            â†“
        Perspective correction
            â†“
        Quality measurement
            â†“
        Multiple preprocessing variants
            â†“
        EasyOCR
            â†“
        OCR allowlist
            â†“
        Candidate scoring
            â†“
        Indian / foreign validation
            â†“
        Best plate result
    """

    # --------------------------------------------------------
    # Validate frame
    # --------------------------------------------------------
    if frame is None or frame.size == 0:

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

    # --------------------------------------------------------
    # Extract vehicle bounding box
    # --------------------------------------------------------
    try:
        vx1, vy1, vx2, vy2 = map(
            int,
            vehicle_bbox
        )
    except Exception:

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

    fh, fw = frame.shape[:2]

    # Clamp coordinates.
    vx1 = max(
        0,
        min(vx1, fw - 1)
    )

    vy1 = max(
        0,
        min(vy1, fh - 1)
    )

    vx2 = max(
        0,
        min(vx2, fw)
    )

    vy2 = max(
        0,
        min(vy2, fh)
    )

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

    vehicle_crop = frame[
        vy1:vy2,
        vx1:vx2
    ]

    if vehicle_crop is None or vehicle_crop.size == 0:

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

    # --------------------------------------------------------
    # Localize plate
    # --------------------------------------------------------
    plate_crop, local_bbox = localize_number_plate(
        vehicle_crop,
        padding=PLATE_PADDING
    )

    if (
        plate_crop is None
        or plate_crop.size == 0
        or local_bbox is None
    ):

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

    # --------------------------------------------------------
    # Convert local vehicle bbox -> global frame bbox
    # --------------------------------------------------------
    lx1, ly1, lx2, ly2 = local_bbox

    global_plate_bbox = [
        vx1 + lx1,
        vy1 + ly1,
        vx1 + lx2,
        vy1 + ly2
    ]

    # --------------------------------------------------------
    # Save debug crop
    # --------------------------------------------------------
    crop_filepath = save_debug_crop(
        plate_crop,
        vehicle_id=vehicle_id,
        frame_counter=frame_counter
    )

    # --------------------------------------------------------
    # Quality metrics
    # --------------------------------------------------------
    sharpness = compute_sharpness(
        plate_crop
    )

    quality_score = compute_quality_score(
        plate_crop,
        global_plate_bbox
    )

    # --------------------------------------------------------
    # Generate OCR variants
    # --------------------------------------------------------
    variants = preprocess_plate_crop(
        plate_crop,
        base_scale=OCR_SCALE
    )

    reader = get_ocr_reader()

    best_text = ""
    best_conf = 0.0
    best_selection_score = -1.0
    best_country = "UNKNOWN"

    # --------------------------------------------------------
    # OCR
    # --------------------------------------------------------
    if reader is not None and variants:

        for variant_index, image_variant in enumerate(
            variants
        ):

            try:

                results = reader.readtext(
                    image_variant,
                    detail=1,
                    paragraph=False,
                    allowlist=OCR_ALLOWLIST,
                    min_size=8,
                    text_threshold=0.45,
                    low_text=0.25,
                    link_threshold=0.25,
                    mag_ratio=1.0
                )

                if not results:
                    continue

                for _, raw_text, raw_conf in results:

                    try:
                        confidence = float(
                            raw_conf
                        )
                    except Exception:
                        continue

                    if confidence < 0.20:
                        continue

                    clean_text = clean_ocr_text(
                        raw_text
                    )

                    if len(clean_text) < 4:
                        continue

                    # Generate corrected candidates.
                    candidates = (
                        _generate_ambiguity_variants(
                            clean_text
                        )
                    )

                    for candidate in candidates:

                        if not candidate:
                            continue

                        if validate_indian_plate(
                            candidate
                        ):
                            country = "INDIA"

                        elif validate_foreign_plate(
                            candidate
                        ):
                            country = "NON_INDIA"

                        else:
                            country = "UNKNOWN"

                        candidate_score = (
                            score_ocr_candidate(
                                candidate,
                                confidence,
                                quality_score
                            )
                        )

                        # Strong preference for valid Indian plates.
                        if country == "INDIA":
                            candidate_score += 8.0

                        elif country == "NON_INDIA":
                            candidate_score += 3.0

                        # Slight preference for longer,
                        # structured registration strings.
                        if len(candidate) >= 8:
                            candidate_score += 0.5

                        if candidate_score > best_selection_score:

                            best_selection_score = (
                                candidate_score
                            )

                            best_text = candidate

                            best_conf = confidence

                            best_country = country

            except Exception:
                # OCR failures should never stop the
                # camera processing loop.
                continue

    # --------------------------------------------------------
    # Final classification
    # --------------------------------------------------------
    if (
        best_conf >= OCR_MIN_CONFIDENCE
        and len(best_text) >= 5
    ):

        if validate_indian_plate(
            best_text
        ):
            country = "INDIA"
            plate_num = best_text

        elif validate_foreign_plate(
            best_text
        ):
            country = "NON_INDIA"
            plate_num = best_text

        else:
            country = "UNKNOWN"
            plate_num = best_text

    else:

        country = "UNKNOWN"

        plate_num = (
            best_text
            if best_text
            else "UNKNOWN"
        )

    # --------------------------------------------------------
    # Return result
    # --------------------------------------------------------
    return {
        "vehicle_type": vehicle_type,
        "plate_number": plate_num,
        "plate_country": country,
        "plate_confidence": round(
            best_conf,
            2
        ),
        "plate_bbox": global_plate_bbox,
        "candidate_found": True,
        "raw_ocr_result": (
            best_text
            if best_text
            else "EMPTY"
        ),
        "ocr_attempted": reader is not None,
        "sharpness": round(
            sharpness,
            2
        ),
        "quality_score": round(
            quality_score,
            2
        ),
        "crop_filepath": crop_filepath
    }
