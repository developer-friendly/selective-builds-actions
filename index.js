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

  core.setOutput("apps", changedApps);
  core.setOutput("length", numChangedApps);
}

async function main(store, appRootPath) {
  var storeKey = process.env.STORE_KEY || "app_hashes";
  var appRootPath = process.argv[2] || ".";

  var newHashes = calculateAllHashes(appRootPath);
  var changedApps = await markChanges(store, newHashes, storeKey);

  githubOutput(changedApps);
}

async function post(store, appRootPath) {
  var storeKey = process.env.STORE_KEY || "app_hashes";

  var newHashes = calculateAllHashes(appRootPath);

  await writeChangedHashes(store, newHashes, storeKey);
}

try {
  var url = core.getInput("redis-url");
  var token = core.getInput("redis-token");

  var redisClient = new Redis({ url, token });

  var isPost = !!core.getState("isPost");
  var store = await redisClient.connect();
  var appRootPath = core.getInput("path") || ".";

  await store.ping();

  if (!isPost) {
    await main(store, appRootPath);
    core.setState("isPost", "true");
  } else {
    await post(store, appRootPath);
  }
} catch (error) {
  core.setFailed(error.message);
}
