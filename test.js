import assert from "node:assert/strict";
import { createCache } from "./index.js";

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test("stores and retrieves values", () => {
  const cache = createCache();
  cache.set("name", "Kaito");
  assert.equal(cache.get("name"), "Kaito");
});

test("supports different value types", () => {
  const cache = createCache();
  cache.set("null", null);
  cache.set("false", false);
  cache.set("zero", 0);
  cache.set("object", { ok: true });

  assert.equal(cache.get("null"), null);
  assert.equal(cache.get("false"), false);
  assert.equal(cache.get("zero"), 0);
  assert.deepEqual(cache.get("object"), { ok: true });
});

test("returns undefined for missing keys", () => {
  const cache = createCache();
  assert.equal(cache.get("missing"), undefined);
  assert.equal(cache.has("missing"), false);
});

test("updates existing keys", () => {
  const cache = createCache();
  cache.set("a", 1);
  cache.set("a", 2);

  assert.equal(cache.get("a"), 2);
  assert.equal(cache.size, 1);
});

test("deletes keys", () => {
  const cache = createCache();
  cache.set("a", 1);

  assert.equal(cache.delete("a"), true);
  assert.equal(cache.delete("a"), false);
  assert.equal(cache.has("a"), false);
});

test("clears all entries", () => {
  const cache = createCache();
  cache.set("a", 1);
  cache.set("b", 2);
  cache.clear();

  assert.equal(cache.size, 0);
});

test("enforces maximum size with LRU eviction", () => {
  const cache = createCache({ maxSize: 2 });
  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a");
  cache.set("c", 3);

  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("b"), false);
  assert.equal(cache.has("c"), true);
});

test("expires entries after TTL", async () => {
  const cache = createCache({ ttl: 30 });
  cache.set("a", 1);

  await new Promise(resolve => setTimeout(resolve, 60));

  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.size, 0);
});

test("supports per-entry TTL", async () => {
  const cache = createCache();
  cache.set("short", 1, 20);
  cache.set("permanent", 2);

  await new Promise(resolve => setTimeout(resolve, 40));

  assert.equal(cache.has("short"), false);
  assert.equal(cache.get("permanent"), 2);
});

test("getOrSet creates and caches values", async () => {
  const cache = createCache();
  let calls = 0;

  const factory = async () => {
    calls++;
    return 42;
  };

  assert.equal(await cache.getOrSet("x", factory), 42);
  assert.equal(await cache.getOrSet("x", factory), 42);
  assert.equal(calls, 1);
});

test("does not cache a rejected factory", async () => {
  const cache = createCache();

  await assert.rejects(
    cache.getOrSet("x", async () => {
      throw new Error("factory failed");
    }),
    /factory failed/
  );

  assert.equal(cache.has("x"), false);
});

test("prune removes expired entries", async () => {
  const cache = createCache();
  cache.set("a", 1, 20);
  cache.set("b", 2);

  await new Promise(resolve => setTimeout(resolve, 40));

  assert.equal(cache.prune(), 1);
  assert.equal(cache.has("b"), true);
});

test("validates configuration", () => {
  assert.throws(() => createCache({ ttl: -1 }), TypeError);
  assert.throws(() => createCache({ maxSize: 0 }), TypeError);
  assert.throws(() => createCache({ maxSize: 1.5 }), TypeError);
});

let failed = 0;

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

console.log(`\n${tests.length - failed}/${tests.length} tests passed`);

if (failed) process.exitCode = 1;
