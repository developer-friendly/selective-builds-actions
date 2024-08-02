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

  core.info(`Changed apps: ${changedApps.join(", ")}`);
  core.info(`Number of changed apps: ${numChangedApps}`);

  core.setOutput("apps", changedApps);
  core.setOutput("length", numChangedApps);
}

async function main(store, newHashes) {
  var storeKey = process.env.STORE_KEY || "app_hashes";

  var changedApps = await markChanges(store, newHashes, storeKey);

  githubOutput(changedApps);
}

async function post(store, newHashes) {
  var storeKey = process.env.STORE_KEY || "app_hashes";

  await store.hset(storeKey, newHashes);
}

try {
  var url = core.getInput("redis-url");
  var token = core.getInput("redis-token");

  var store = new Redis({ url, token });

  var isPost = !!core.getState("isPost");
  var appRootPath = core.getInput("path") || ".";
  var newHashes = calculateAllHashes(appRootPath);

  await store.ping();

  if (!isPost) {
    await main(store, newHashes);
  } else {
    await post(store, newHashes);
  }
} catch (error) {
  core.setFailed(error.message);
}
