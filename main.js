import {
  calculateAllHashes,
  getCurrentAppHashes,
  compareHashes,
  redisClient,
} from "./common.js";
import core from "@actions/core";

async function markChanges(store, newHashes, storeKey) {
  var oldHashes = await getCurrentAppHashes(store, storeKey);
  return compareHashes(oldHashes, newHashes);
}

function githubOutput(changedApps) {
  var numChangedApps = changedApps.length;

  core.setOutput("apps", changedApps);
  core.setOutput("length", numChangedApps);
}

try {
  var store = await redisClient.connect();
  var storeKey = process.env.STORE_KEY || "app_hashes";
  var appRootPath = process.argv[2] || ".";

  var newHashes = calculateAllHashes(appRootPath);
  var changedApps = await markChanges(store, newHashes, storeKey);

  githubOutput(changedApps);
} catch (error) {
  console.error(error);
} finally {
  store.quit();
}
