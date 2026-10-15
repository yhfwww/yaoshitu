// 坐标系几何与碰撞布局
export const UNIT = 7; // 每单位（1 分）对应的世界像素
export const PLOT = UNIT * 100; // 700
export const MARGIN = 44; // 四周留白（轴标签）
export const WORLD = PLOT + MARGIN * 2; // 788

export const POINT_R = 7; // 点半径（世界像素）

// 世界坐标：x = 紧急（右大），y = 重要（上大，SVG y 向下故取反）
export function worldX(urgency: number): number {
  return MARGIN + urgency * UNIT;
}
export function worldY(importance: number): number {
  return MARGIN + (100 - importance) * UNIT;
}

export function worldToUrgency(x: number): number {
  return (x - MARGIN) / UNIT;
}
export function worldToImportance(y: number): number {
  return 100 - (y - MARGIN) / UNIT;
}

export interface LaidPoint {
  id: string;
  urgency: number;
  importance: number;
  x: number;
  y: number;
}

// 点碰撞处理：把落在同一网格单元的点做小圆环散开，避免完全重叠遮挡
export function layoutPoints(
  points: { id: string; urgency: number; importance: number }[],
): LaidPoint[] {
  const CELL = 3;
  const groups = new Map<string, { id: string; urgency: number; importance: number }[]>();
  for (const p of points) {
    const cx = Math.round(p.urgency / CELL);
    const cy = Math.round(p.importance / CELL);
    const key = `${cx},${cy}`;
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  const out: LaidPoint[] = [];
  for (const group of groups.values()) {
    const n = group.length;
    if (n === 1) {
      const p = group[0];
      out.push({
        ...p,
        x: worldX(p.urgency),
        y: worldY(p.importance),
      });
    } else {
      const radius = Math.min(2.6, 0.9 + n * 0.5);
      group.forEach((p, k) => {
        const ang = (2 * Math.PI * k) / n;
        const u = clamp(p.urgency + Math.cos(ang) * radius, 1, 100);
        const i = clamp(p.importance + Math.sin(ang) * radius, 1, 100);
        out.push({ id: p.id, urgency: u, importance: i, x: worldX(u), y: worldY(i) });
      });
    }
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
