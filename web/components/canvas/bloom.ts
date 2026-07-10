/**
 * Bloom post-processing for a soft glow: draws the source canvas to an
 * offscreen half-resolution canvas, blurs it in a couple of passes via the
 * canvas `filter` CSS property, then composites it back over the target
 * with additive ("lighter") blending. Generic technique, not tied to any
 * particular scene data.
 */
import { BLOOM } from "./animation-constants";

export class BloomRenderer {
  private bloomCanvas: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D | null;
  private tempCanvas: HTMLCanvasElement;
  private tempCtx: CanvasRenderingContext2D | null;

  constructor(private intensity: number = BLOOM.intensity) {
    this.bloomCanvas = document.createElement("canvas");
    this.tempCanvas = document.createElement("canvas");
    this.bloomCtx = this.bloomCanvas.getContext("2d");
    this.tempCtx = this.tempCanvas.getContext("2d");
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width * BLOOM.scale));
    const h = Math.max(1, Math.round(height * BLOOM.scale));
    this.bloomCanvas.width = w;
    this.bloomCanvas.height = h;
    this.tempCanvas.width = w;
    this.tempCanvas.height = h;
  }

  apply(sourceCanvas: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D): void {
    const { bloomCtx, tempCtx } = this;
    const w = this.bloomCanvas.width;
    const h = this.bloomCanvas.height;
    if (!bloomCtx || !tempCtx || w === 0 || h === 0) return;

    bloomCtx.clearRect(0, 0, w, h);
    bloomCtx.drawImage(sourceCanvas, 0, 0, w, h);

    for (const radius of BLOOM.blurRadii) {
      tempCtx.clearRect(0, 0, w, h);
      tempCtx.filter = `blur(${radius}px)`;
      tempCtx.drawImage(this.bloomCanvas, 0, 0);
      tempCtx.filter = "none";

      bloomCtx.clearRect(0, 0, w, h);
      bloomCtx.drawImage(this.tempCanvas, 0, 0);
    }

    targetCtx.save();
    targetCtx.globalCompositeOperation = "lighter";
    targetCtx.globalAlpha = this.intensity;
    targetCtx.drawImage(this.bloomCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height);
    targetCtx.restore();
  }
}



