import {
  calculateAllHashes,
  getCurrentAppHashes,
  compareHashes,
} from "./common.js";
import core from "@actions/core";
import { Redis } from "@upstash/redis";

async function markChanges(store, newHashes, storeKey) {
  var oldHashes = await getCurrentAppHashes(store, storeKey);
  return compareHashes(oldHashes, newHashes);
}

function githubOutput(changedApps) {
  var numChangedApps = changedApps.length;

  var stringifyApps = JSON.stringify({ directory: changedApps });

  core.info(`Changed apps: ${stringifyApps}`);
  core.info(`Number of changed apps: ${numChangedApps}`);

  core.setOutput("matrix", stringifyApps);
  core.setOutput("length", numChangedApps);
}

async function mark(store, newHashes) {
  var storeKey = process.env.STORE_KEY || "app_hashes";

  var changedApps = await markChanges(store, newHashes, storeKey);

  githubOutput(changedApps);
}

async function submit(store, newHashes) {
  var storeKey = process.env.STORE_KEY || "app_hashes";

  await store.hset(storeKey, newHashes);
}

try {
  var url = core.getInput("redis-url");
  var token = core.getInput("redis-token");
  var mode = core.getInput("mode");
  var exclusions = core.getMultilineInput("exclusions");

  var store = new Redis({ url, token });

  var appRootPath = core.getInput("path") || ".";
  var newHashes = calculateAllHashes(appRootPath);

  newHashes = newHashes.filter(function filterOutExclusions(hash) {
    return !exclusions.some(function isExcluded(exclusion) {
      return hash.includes(exclusion);
    });
  });

  await store.ping();

  if (mode == "mark") {
    await mark(store, newHashes);
  } else if (mode == "submit") {
    await submit(store, newHashes);
  }
} catch (error) {
  core.setFailed(error.message);
}
