export interface Point { x: number; y: number; }
export function centeredPosition(size: { width: number; height: number }, center: Point): Point { return { x: Math.round(center.x - size.width / 2), y: Math.round(center.y - size.height / 2) }; }
export function stackPosition(index: number, origin: Point = { x: 40, y: 40 }): Point { return { x: Math.round(origin.x + index * 26), y: Math.round(origin.y + index * 26) }; }
