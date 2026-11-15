import type { Polygon, Position } from 'geojson'

const M_PER_DEG = 111_320

export function scalePolygon(poly: Polygon, origin: Position, kAlong: number, kAcross: number, axisRad = 0): Polygon {
  const cosLat = Math.cos((origin[1] * Math.PI) / 180)
  const [c, s] = [Math.cos(axisRad), Math.sin(axisRad)]
  const ring = (r: Position[]): Position[] => r.map(([lon, lat]) => {
    const x = (lon - origin[0]) * cosLat, y = lat - origin[1]
    const u = (x * c + y * s) * kAlong, v = (-x * s + y * c) * kAcross
    return [origin[0] + (u * c - v * s) / cosLat, origin[1] + (u * s + v * c)]
  })
  return { type: 'Polygon', coordinates: poly.coordinates.map(ring) }
}

export function mainAxis(poly: Polygon, origin: Position): number {
  const cosLat = Math.cos((origin[1] * Math.PI) / 180)
  let best = 0, ang = 0
  for (const [lon, lat] of poly.coordinates[0]) {
    const x = (lon - origin[0]) * cosLat, y = lat - origin[1], d = x * x + y * y
    if (d > best) { best = d; ang = Math.atan2(y, x) }
  }
  return ang
}

export function centroid(poly: Polygon): Position {
  const r = poly.coordinates[0], n = r.length - 1
  let x = 0, y = 0
  for (let i = 0; i < n; i++) { x += r[i][0]; y += r[i][1] }
  return [x / n, y / n]
}

export function inPolygon(pt: Position, poly: Polygon): boolean {
  const r = poly.coordinates[0]
  let inside = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function ellipse(center: Position, aKm: number, bKm: number, n = 48): Polygon {
  const cosLat = Math.cos((center[1] * Math.PI) / 180)
  const ring: Position[] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI
    ring.push([center[0] + (aKm * Math.cos(t) * 1000) / (M_PER_DEG * cosLat), center[1] + (bKm * Math.sin(t) * 1000) / M_PER_DEG])
  }
  return { type: 'Polygon', coordinates: [ring] }
}

export function bufferLine(line: Position[], halfW: number[]): Polygon {
  const left: Position[] = [], right: Position[] = []
  line.forEach((p, i) => {
    const a = line[Math.max(i - 1, 0)], b = line[Math.min(i + 1, line.length - 1)]
    const cosLat = Math.cos((p[1] * Math.PI) / 180)
    const dx = (b[0] - a[0]) * cosLat, dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1
    const nx = -dy / len, ny = dx / len, w = halfW[i]
    const off = (sgn: number): Position => [p[0] + (sgn * nx * w) / (M_PER_DEG * cosLat), p[1] + (sgn * ny * w) / M_PER_DEG]
    left.push(off(1)); right.push(off(-1))
  })
  const ring = [...left, ...right.reverse()]
  return { type: 'Polygon', coordinates: [[...ring, ring[0]]] }
}

function dp(pts: Position[], tol: number): Position[] {
  if (pts.length < 3) return pts
  const [a, b] = [pts[0], pts[pts.length - 1]]
  let maxD = 0, idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1e-12
    const d = Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / len
    if (d > maxD) { maxD = d; idx = i }
  }
  return maxD > tol ? [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)] : [a, b]
}

function chaikin(ring: Position[], iterations: number): Position[] {
  let pts = ring.slice(0, -1)
  for (let k = 0; k < iterations; k++) {
    const next: Position[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]])
    }
    pts = next
  }
  return [...pts, pts[0]]
}

export function smoothPolygon(p: Polygon, tol = 0.0001, iterations = 2): Polygon {
  return {
    type: 'Polygon', coordinates: p.coordinates.map(r => {
      const s = dp(r.slice(0, -1), tol)
      return s.length < 4 ? r : chaikin([...s, s[0]], iterations)
    })
  }
}

const KM_PER_DEG = 111.32

const segKm = (a: Position, b: Position): number => {
  const cosLat = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
  return Math.hypot((b[0] - a[0]) * cosLat, b[1] - a[1]) * KM_PER_DEG
}

export function catmullRom(pts: Position[], samples = 14): Position[] {
  if (pts.length < 3) return pts
  const out: Position[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)]
    for (let k = 0; k < samples; k++) {
      const t = k / samples, t2 = t * t, t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

export function cumulativeKm(line: Position[]): number[] {
  const cum = [0]
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + segKm(line[i - 1], line[i]))
  return cum
}

export function projectOnLine(pt: Position, line: Position[], cum: number[]): { along: number; off: number } {
  let best = { along: 0, off: Infinity }
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1]
    const cosLat = Math.cos((pt[1] * Math.PI) / 180)
    const ax = (a[0] - pt[0]) * cosLat, ay = a[1] - pt[1]
    const dx = (b[0] - a[0]) * cosLat, dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0
    const off = Math.hypot(ax + t * dx, ay + t * dy) * KM_PER_DEG
    if (off < best.off) best = { along: cum[i] + t * (cum[i + 1] - cum[i]), off }
  }
  return best
}

export function sliceLine(line: Position[], cum: number[], km: number): { pts: Position[]; km: number[] } {
  const pts: Position[] = [], kms: number[] = []
  for (let i = 0; i < line.length; i++) {
    if (cum[i] <= km) { pts.push(line[i]); kms.push(cum[i]); continue }
    const t = (km - cum[i - 1]) / (cum[i] - cum[i - 1])
    pts.push([line[i - 1][0] + t * (line[i][0] - line[i - 1][0]), line[i - 1][1] + t * (line[i][1] - line[i - 1][1])])
    kms.push(km)
    break
  }
  return { pts, km: kms }
}
