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
  var appRootPath = core.getInput("path") || ".";
  var exclusions = core.getMultilineInput("exclusions").filter(Boolean);

  core.info(`Mode: ${mode}`);
  core.info(`App root path: ${appRootPath}`);
  core.info(`Exclusions: ${exclusions}`);

  var store = new Redis({ url, token });
  var ping = await store.ping();

  core.info(`Redis ping: ${ping}`);

  var newHashes = calculateAllHashes(appRootPath);

  core.info(`New hashes: ${JSON.stringify(newHashes)}`);

  newHashes = Object.fromEntries(
    Object.entries(newHashes).filter(function getInclusions([key]) {
      return !exclusions.some(function isExcluded(exclusion) {
        return key.includes(exclusion);
      });
    })
  );

  core.info(`New hashes after exclusions: ${JSON.stringify(newHashes)}`);

  if (mode == "mark") {
    await mark(store, newHashes);
  } else if (mode == "submit") {
    await submit(store, newHashes);
  }
} catch (error) {
  core.setFailed(error.message);
}
