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

async function main() {
  var store = await redisClient.connect();
  var storeKey = process.env.STORE_KEY || "app_hashes";
  var appRootPath = process.argv[2] || ".";

  var newHashes = calculateAllHashes(appRootPath);
  var changedApps = await markChanges(store, newHashes, storeKey);

  githubOutput(changedApps);
}

async function post() {
  var store = await redisClient.connect();
  var storeKey = process.env.STORE_KEY || "app_hashes";
  var appRootPath = process.argv[2] || ".";

  var newHashes = calculateAllHashes(appRootPath);

  await writeChangedHashes(store, newHashes, storeKey);
}

try {
  var isPost = !!core.getState('isPost');
  if (!isPost) {
    await main();
    core.setState('isPost', 'true');
  } else {
    await post();
  }
} catch (error) {
  core.setFailed(error.message);
}
