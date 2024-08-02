import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import redis from 'redis';
import * as core from "@actions/core";

var REDIS_HOST = core.getInput("redis-host") || process.env.REDIS_HOST;
var REDIS_PORT = parseInt(
  core.getInput("redis-port") || process.env.REDIS_PORT || "6379",
);
var REDIS_PASSWORD =
  core.getInput("redis-password") || process.env.REDIS_PASSWORD;
var REDIS_SSL = core.getInput("redis-ssl") || process.env.REDIS_SSL == "true";

var redisClient = redis.createClient({
  password: REDIS_PASSWORD,
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    tls: REDIS_SSL,
  },
});

function* findFiles(directory) {
  var items = fs.readdirSync(directory);

  for (var item of items) {
    var fullPath = path.join(directory, item);
    if (fs.statSync(fullPath).isDirectory()) {
      yield* findFiles(fullPath);
    } else {
      yield fullPath;
    }
  }
}
function calculateFileHash(filePath) {
  var fileBuffer = fs.readFileSync(filePath);
  var hashSum = createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

function calculateDirectoryHash(directory) {
  var hashSum = createHash("sha256");

  for (var file of findFiles(directory)) {
    var fileHash = calculateFileHash(file);
    hashSum.update(fileHash);
  }

  return hashSum.digest("hex");
}

function calculateAllHashes(appRootPath) {
  var applications = fs.readdirSync(appRootPath).filter(function isDir(file) {
    return fs.statSync(`${appRootPath}/${file}`).isDirectory();
  });

  var directoryHashes = {};

  applications.forEach(function hashDir(appDir) {
    var rootPath = appRootPath.replace(/\/$/, "");
    directoryHashes[`${rootPath}/${appDir}`] = calculateDirectoryHash(
      `${rootPath}/${appDir}`,
    );
  });

  return directoryHashes;
}

async function getCurrentAppHashes(store, storeKey) {
  return await store.hGetAll(storeKey);
}

function compareHashes(oldHashes, newHashes) {
  var changedApps = [];
  for (var app in newHashes) {
    if (oldHashes[app] !== newHashes[app]) {
      changedApps.push(app);
    }
  }
  return changedApps;
}

export {
  calculateDirectoryHash,
  calculateAllHashes,
  getCurrentAppHashes,
  compareHashes,
  redisClient,
};
