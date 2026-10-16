import test from "node:test";
import assert from "node:assert/strict";
import { createCarouselNavigation, createImagePreloader } from "../public/carousel-engine.js";

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test("rapid next clicks retain their destination without walking through every intermediate photo", async () => {
  const animation = deferred(); const shown = [];
  const navigation = createCarouselNavigation({ count: 37, prepare: async () => true,
    render: move => { shown.push(move); return shown.length === 1 ? animation.promise : undefined; } });
  navigation.step(1); await tick();
  navigation.step(1); navigation.step(1); navigation.step(1);
  animation.resolve(); await navigation.whenIdle();
  assert.equal(navigation.activeIndex, 4);
  assert.deepEqual(shown.map(move => move.to), [1, 4]);
  assert.equal(shown[1].direction, 0);
});

test("navigation wraps both ways and a direction reversal during motion cancels the extra request", async () => {
  const animation = deferred(); let moves = 0;
  const navigation = createCarouselNavigation({ count: 37, prepare: async () => true,
    render: () => ++moves === 1 ? animation.promise : undefined });
  navigation.step(-1); await tick();
  navigation.step(-1); navigation.step(1);
  animation.resolve(); await navigation.whenIdle();
  assert.equal(navigation.activeIndex, 36);
  await navigation.step(1); assert.equal(navigation.activeIndex, 0);
});

test("a stale slow download cannot override a newer dot selection", async () => {
  const download = deferred(); const shown = [];
  const navigation = createCarouselNavigation({ count: 37,
    prepare: index => index === 10 ? download.promise : Promise.resolve(true),
    render: move => { shown.push(move.to); } });
  navigation.goTo(10); navigation.goTo(25);
  download.resolve(true); await navigation.whenIdle();
  assert.deepEqual(shown, [25]);
});

test("failed downloads retain the current photo and allow a subsequent retry", async () => {
  let succeeds = false; let errors = 0;
  const navigation = createCarouselNavigation({ count: 37, prepare: async () => succeeds,
    render: () => {}, onError: () => errors++ });
  await navigation.step(1); assert.equal(navigation.activeIndex, 0); assert.equal(errors, 1);
  succeeds = true; await navigation.step(1); assert.equal(navigation.activeIndex, 1);
});

test("nearby photos are decoded in advance, shared by requests and released outside the seven-photo window", async () => {
  const images = [];
  class ImageStub {
    constructor() { images.push(this); }
    set src(value) { this.url = value; queueMicrotask(() => this.onload()); }
    async decode() { this.decoded = true; }
  }
  const loader = createImagePreloader(Array.from({ length: 37 }, (_, i) => `photo-${i}`), () => new ImageStub());
  loader.warm(0); await tick();
  assert.equal(images.length, 7);
  assert.ok(images.every(image => image.decoded));
  await Promise.all([loader.load(1), loader.load(1)]); assert.equal(images.length, 7);
  loader.warm(1); await tick(); assert.equal(images.length, 8);
  assert.equal(loader.ready(4), true); assert.equal(loader.ready(34), false);
});
