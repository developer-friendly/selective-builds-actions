import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import * as core from "@actions/core";

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
  return await store.hgetall(storeKey);
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
};
