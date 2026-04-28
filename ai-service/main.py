"""
Cleaning Supervision AI Microservice
Analyzes cleaning quality from photos/videos using computer vision
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import base64
import numpy as np
import cv2
import io
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Cleaning Supervision AI Service",
    version="1.0.0",
    description="AI microservice for cleaning quality analysis"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://backend:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ─── Models ────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    mediaId: str
    imageData: str  # base64 encoded
    analysisTypes: List[str] = ["quality", "cleanliness", "anomalies"]


class FrameRequest(BaseModel):
    frame: str  # base64 encoded


class Anomaly(BaseModel):
    type: str
    confidence: float
    description: str
    severity: str  # low, medium, high
    bbox: Optional[List[int]] = None


class AnalysisResponse(BaseModel):
    qualityScore: float
    cleanliness: float
    completeness: float
    anomalies: List[Anomaly]
    tags: List[str]
    brightness: float
    blurScore: float
    recommendation: str


# ─── Image Processor ───────────────────────────────────────────
class ImageAnalyzer:
    def decode_image(self, base64_data: str) -> np.ndarray:
        """Decode base64 image to OpenCV format"""
        img_bytes = base64.b64decode(base64_data)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image")
        return img

    def calculate_brightness(self, img: np.ndarray) -> float:
        """Calculate image brightness score 0-100"""
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        brightness = np.mean(hsv[:, :, 2])
        return round(float(brightness / 255 * 100), 1)

    def calculate_blur_score(self, img: np.ndarray) -> float:
        """Laplacian variance - higher = sharper"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
        # Normalize: >500 = sharp, <100 = blurry
        score = min(100.0, float(variance) / 5)
        return round(score, 1)

    def detect_cleanliness(self, img: np.ndarray) -> tuple[float, List[Anomaly]]:
        """
        Analyze cleanliness of the scene
        Returns (score 0-10, list of anomalies)
        """
        anomalies = []
        score = 10.0

        # Convert to different color spaces for analysis
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        # ── Detect large dark spots (stains, dirt) ──────────────
        _, thresh_dark = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY_INV)
        dark_contours, _ = cv2.findContours(thresh_dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        img_area = img.shape[0] * img.shape[1]
        for contour in dark_contours:
            area = cv2.contourArea(contour)
            relative_area = area / img_area
            if relative_area > 0.01:  # >1% of image area
                x, y, w, h = cv2.boundingRect(contour)
                confidence = min(0.95, relative_area * 10)
                severity = "high" if relative_area > 0.05 else "medium" if relative_area > 0.02 else "low"
                anomalies.append(Anomaly(
                    type="stain",
                    confidence=round(confidence, 2),
                    description=f"Tache détectée ({relative_area*100:.1f}% de la surface)",
                    severity=severity,
                    bbox=[x, y, w, h]
                ))
                score -= min(3.0, relative_area * 20)

        # ── Detect clutter / disorder ────────────────────────────
        edges = cv2.Canny(gray, 100, 200)
        edge_density = np.mean(edges) / 255
        if edge_density > 0.15:
            anomalies.append(Anomaly(
                type="disorder",
                confidence=min(0.9, edge_density * 3),
                description="Désordre potentiel détecté",
                severity="medium" if edge_density > 0.25 else "low",
            ))
            score -= min(2.0, edge_density * 5)

        # ── Detect streaks / marks ───────────────────────────────
        _, thresh_bright = cv2.threshold(gray, 230, 255, cv2.THRESH_BINARY)
        bright_pixels = np.sum(thresh_bright > 0) / img_area
        if bright_pixels > 0.1:
            anomalies.append(Anomaly(
                type="streak",
                confidence=0.7,
                description="Traces ou reflets anormaux",
                severity="low",
            ))
            score -= 1.0

        return max(0.0, round(score, 1)), anomalies

    def assess_completeness(self, img: np.ndarray) -> float:
        """Check if the image shows complete coverage of the area"""
        # Use image coverage analysis
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        non_black = np.sum(gray > 20) / gray.size
        # Good coverage: most of image is filled
        return round(min(10.0, non_black * 10), 1)

    def generate_tags(self, img: np.ndarray, cleanliness: float, brightness: float, blur: float) -> List[str]:
        """Generate descriptive tags"""
        tags = []
        if cleanliness >= 8: tags.append("propre")
        elif cleanliness >= 6: tags.append("acceptable")
        else: tags.append("non-conforme")

        if brightness < 30: tags.append("sous-éclairé")
        elif brightness > 80: tags.append("surexposé")
        else: tags.append("bonne-lumière")

        if blur < 20: tags.append("flou")
        elif blur > 60: tags.append("net")

        return tags

    def compute_quality_score(self, cleanliness: float, brightness: float, blur: float) -> float:
        """Overall quality score weighted average"""
        # Blur: bad blur kills the score
        blur_factor = min(1.0, blur / 50)
        # Brightness: too dark or too bright penalizes
        brightness_factor = 1.0 - abs(brightness - 55) / 55
        # Cleanliness is the main factor
        score = (cleanliness * 0.6 + brightness_factor * 10 * 0.2 + blur_factor * 10 * 0.2)
        return round(max(0.0, min(10.0, score)), 1)

    def generate_recommendation(self, score: float, anomalies: List[Anomaly]) -> str:
        """Generate actionable recommendation"""
        if score >= 8.5:
            return "Excellent travail ! Le nettoyage est conforme aux standards."
        elif score >= 7.0:
            high_severity = [a for a in anomalies if a.severity == "high"]
            if high_severity:
                return f"Bon travail, mais {len(high_severity)} anomalie(s) critique(s) à corriger."
            return "Travail satisfaisant. Quelques améliorations mineures possibles."
        elif score >= 5.0:
            return "Nettoyage insuffisant. Des zones nécessitent une attention particulière."
        else:
            return "Nettoyage non conforme. Une vérification immédiate est requise."


analyzer = ImageAnalyzer()


# ─── Routes ────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ai-service", "timestamp": datetime.utcnow().isoformat()}


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_media(request: AnalyzeRequest):
    """Analyze cleaning quality from a photo"""
    try:
        logger.info(f"Analyzing media: {request.mediaId}")

        img = analyzer.decode_image(request.imageData)
        brightness = analyzer.calculate_brightness(img)
        blur_score = analyzer.calculate_blur_score(img)
        cleanliness, anomalies = analyzer.detect_cleanliness(img)
        completeness = analyzer.assess_completeness(img)
        quality_score = analyzer.compute_quality_score(cleanliness, brightness, blur_score)
        tags = analyzer.generate_tags(img, cleanliness, brightness, blur_score)
        recommendation = analyzer.generate_recommendation(quality_score, anomalies)

        logger.info(f"Analysis complete: score={quality_score}, anomalies={len(anomalies)}")

        return AnalysisResponse(
            qualityScore=quality_score,
            cleanliness=cleanliness,
            completeness=completeness,
            anomalies=anomalies,
            tags=tags,
            brightness=brightness,
            blurScore=blur_score,
            recommendation=recommendation,
        )
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze-frame")
async def analyze_frame(request: FrameRequest):
    """Real-time frame analysis for live stream"""
    try:
        img = analyzer.decode_image(request.frame)
        brightness = analyzer.calculate_brightness(img)
        blur = analyzer.calculate_blur_score(img)
        cleanliness, anomalies = analyzer.detect_cleanliness(img)

        alerts = []
        if blur < 15:
            alerts.append("Image floue - ajustez la caméra")
        if brightness < 20:
            alerts.append("Luminosité insuffisante")
        if any(a.severity == "high" for a in anomalies):
            alerts.append("Anomalie détectée")

        return {
            "qualityScore": analyzer.compute_quality_score(cleanliness, brightness, blur),
            "anomalies": [a.dict() for a in anomalies[:3]],
            "alerts": alerts,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/mission-report")
async def generate_mission_report(data: dict):
    """Generate comprehensive mission quality report"""
    media_items = data.get("mediaItems", [])

    before_scores = [m.get("quality_score", 0) for m in media_items if m.get("phase") == "before" and m.get("quality_score")]
    after_scores = [m.get("quality_score", 0) for m in media_items if m.get("phase") == "after" and m.get("quality_score")]

    avg_before = sum(before_scores) / len(before_scores) if before_scores else None
    avg_after = sum(after_scores) / len(after_scores) if after_scores else None

    all_scores = [m.get("quality_score", 0) for m in media_items if m.get("quality_score")]
    overall = sum(all_scores) / len(all_scores) if all_scores else 0

    improvement = None
    if avg_before is not None and avg_after is not None:
        improvement = round(avg_after - avg_before, 1)

    all_anomalies = []
    for m in media_items:
        if m.get("anomalies"):
            all_anomalies.extend(m["anomalies"] if isinstance(m["anomalies"], list) else [])

    issues = list(set([a.get("description", "") for a in all_anomalies if a.get("severity") in ["high", "medium"]]))[:5]

    return {
        "overallScore": round(overall, 1),
        "beforeAfterComparison": {
            "before": avg_before,
            "after": avg_after,
            "improvement": improvement,
        },
        "issues": issues,
        "recommendation": "Très bon travail" if overall >= 8 else "Amélioration nécessaire" if overall >= 6 else "Non-conforme",
        "totalMediaAnalyzed": len(all_scores),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
