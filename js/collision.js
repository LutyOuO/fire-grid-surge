(function () {
  'use strict';

  // 墙体几何查询；无状态，无业务函数覆盖。
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  function insideWall(x, y, r) {
    r = r || 0;
    for (var i = 0; i < CONFIG.FIELD.WALLS.length; i++) {
      var w = CONFIG.FIELD.WALLS[i],
        cx = Math.max(w.x, Math.min(x, w.x + w.w)),
        cy = Math.max(w.y, Math.min(y, w.y + w.h)),
        dx = x - cx,
        dy = y - cy;
      if (dx * dx + dy * dy <= r * r) return true;
    }
    return false;
  }
  function segmentHitsWall(x1, y1, x2, y2, r) {
    var dx = x2 - x1,
      dy = y2 - y1,
      steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 24));
    for (var i = 1; i <= steps; i++) if (insideWall(x1 + dx * i / steps, y1 + dy * i / steps, r)) return true;
    return false;
  }
  function rayDistance(x, y, a) {
    var dx = Math.cos(a),
      dy = Math.sin(a),
      best = 99999,
      t;
    if (dx > 0) best = Math.min(best, (CONFIG.WORLD.WIDTH - x) / dx);else if (dx < 0) best = Math.min(best, (0 - x) / dx);
    if (dy > 0) best = Math.min(best, (CONFIG.WORLD.HEIGHT - y) / dy);else if (dy < 0) best = Math.min(best, (0 - y) / dy);
    for (var i = 0; i < CONFIG.FIELD.WALLS.length; i++) {
      var w = CONFIG.FIELD.WALLS[i],
        minX = w.x,
        maxX = w.x + w.w,
        minY = w.y,
        maxY = w.y + w.h,
        t0 = 0,
        t1 = best;
      if (Math.abs(dx) < .00001) {
        if (x < minX || x > maxX) continue;
      } else {
        var ax = (minX - x) / dx,
          bx = (maxX - x) / dx;
        if (ax > bx) {
          t = ax;
          ax = bx;
          bx = t;
        }
        t0 = Math.max(t0, ax);
        t1 = Math.min(t1, bx);
      }
      if (Math.abs(dy) < .00001) {
        if (y < minY || y > maxY) continue;
      } else {
        var ay = (minY - y) / dy,
          by = (maxY - y) / dy;
        if (ay > by) {
          t = ay;
          ay = by;
          by = t;
        }
        t0 = Math.max(t0, ay);
        t1 = Math.min(t1, by);
      }
      if (t1 >= Math.max(0, t0)) best = Math.min(best, Math.max(0, t0));
    }
    return Math.max(0, best - 2);
  }
  root.WallCollision = {
    inside: insideWall,
    segment: segmentHitsWall,
    rayDistance: rayDistance
  };
})();
