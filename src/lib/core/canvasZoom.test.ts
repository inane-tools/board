import { expect, it } from 'vitest';
import { stepCanvasZoom } from './canvasZoom';
it('uses clean, reversible zoom steps', () => { expect(stepCanvasZoom(1, 1)).toBe(1.25); expect(stepCanvasZoom(1.25, 1)).toBe(1.5); expect(stepCanvasZoom(1.5, -1)).toBe(1.25); expect(stepCanvasZoom(1.25, -1)).toBe(1); });
it('snaps old fractional zoom values in the requested direction and clamps bounds', () => { expect(stepCanvasZoom(1.137, 1)).toBe(1.25); expect(stepCanvasZoom(1.137, -1)).toBe(1); expect(stepCanvasZoom(3, 1)).toBe(3); expect(stepCanvasZoom(.25, -1)).toBe(.25); });
