// Keep the latest requested destination separate from the photo being animated.
// Repeated clicks accumulate; distant dot selections skip intermediate photos.
export function createCarouselNavigation({ count, prepare, render, onError = () => {} }) {
  const wrap = index => (index % count + count) % count;
  let active = 0;
  let requested = 0;
  let version = 0;
  let running = false;
  let task = Promise.resolve();
  async function drain() {
    running = true;
    try {
      while (requested !== active) {
        const target = requested;
        const revision = version;
        if (!await prepare(target)) {
          if (revision !== version) continue;
          requested = active;
          onError();
          break;
        }
        if (revision !== version) continue;
        const from = active;
        const forward = wrap(target - from);
        const direction = forward === 1 ? 1 : forward === count - 1 ? -1 : 0;
        active = target;
        await render({ from, to: target, direction });
      }
    } finally { running = false; }
  }
  function goTo(index) {
    requested = wrap(index);
    version++;
    if (!running) task = drain();
    return task;
  }
  return { goTo, step: direction => goTo(requested + direction),
    get activeIndex() { return active; }, whenIdle: () => task };
}

// Only the nearby window stays referenced as decoded images, rather than
// downloading and retaining every full-size photo as soon as the page opens.
export function createImagePreloader(urls, makeImage = () => new Image()) {
  const cache = new Map();
  const wrap = index => (index % urls.length + urls.length) % urls.length;
  function load(index) {
    index = wrap(index);
    if (cache.has(index)) return cache.get(index).promise;
    const image = makeImage();
    const entry = { image, ready: false };
    cache.set(index, entry);
    image.decoding = "async";
    image.fetchPriority = "low";
    entry.promise = (async () => {
      try {
        const loaded = new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
        image.src = urls[index];
        await loaded;
        if (image.decode) await image.decode();
        entry.ready = true;
        return true;
      } catch {
        if (cache.get(index) === entry) cache.delete(index);
        return false;
      }
    })();
    return entry.promise;
  }
  return { load,
    ready: index => Boolean(cache.get(wrap(index))?.ready),
    warm(index) {
      const nearby = new Set([0, -1, 1, -2, 2, -3, 3].map(offset => wrap(index + offset)));
      for (const key of cache.keys()) if (!nearby.has(key)) cache.delete(key);
      for (const key of nearby) void load(key);
    } };
}
