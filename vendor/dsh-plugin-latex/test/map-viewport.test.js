import test from "node:test";
import assert from "node:assert/strict";
import { zoomAt, fitMap } from "../client/map-viewport.js";

test("zoom preserves the document coordinate under the pointer, including limits", () => {
  const view = { scale: 0.8, x: -430, y: 150 }, point = { x: 320, y: 240 };
  for (const scale of [0.001, 0.4, 1.7, 10]) {
    const next = zoomAt(view, scale, point);
    assert.ok(next.scale >= 0.08 && next.scale <= 2.4);
    assert.ok(Math.abs((point.x - next.x) / next.scale - (point.x - view.x) / view.scale) < 1e-8);
    assert.ok(Math.abs((point.y - next.y) / next.scale - (point.y - view.y) / view.scale) < 1e-8);
  }
});
test("fit centers large and small maps with space for controls", () => {
  for (const [width, height] of [[2400, 5000], [300, 180]]) {
    const view = fitMap(width, height, 1100, 800);
    assert.ok(width * view.scale <= 1100 - 64);
    assert.ok(height * view.scale <= 800 - 96);
    assert.equal(view.x * 2 + width * view.scale, 1100);
    assert.equal(view.y * 2 + height * view.scale, 800);
  }
});
