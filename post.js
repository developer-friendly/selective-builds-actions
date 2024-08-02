import { calculateAllHashes, redisClient } from "./common.js";

async function writeChangedHashes(store, newHashes, storeKey) {
  return await store.hSet(storeKey, newHashes);
}

try {
  var store = await redisClient.connect();
  var storeKey = process.env.STORE_KEY || "app_hashes";
  var appRootPath = process.argv[2] || ".";

  var newHashes = calculateAllHashes(appRootPath);

  await writeChangedHashes(store, newHashes, storeKey);
} catch (error) {
  console.error(error);
} finally {
  store.quit();
}
