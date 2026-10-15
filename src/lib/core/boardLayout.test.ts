import { expect, it } from 'vitest';
import { centeredPosition, stackPosition } from './boardLayout';
it('centers the actual item dimensions on the viewport world point', () => { expect(centeredPosition({ width: 240, height: 160 }, { x: -150, y: 300 })).toEqual({ x: -270, y: 220 }); });
it('uses the same stagger for moves and multi-file drops', () => { expect(stackPosition(0)).toEqual({ x: 40, y: 40 }); expect(stackPosition(2)).toEqual({ x: 92, y: 92 }); expect(stackPosition(1, { x: 300, y: 200 })).toEqual({ x: 326, y: 226 }); });
