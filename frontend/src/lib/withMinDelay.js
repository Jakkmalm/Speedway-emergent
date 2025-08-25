// src/lib/withMinDelay.js
export const withMinDelay = (promise, ms) =>
  Promise.all([promise, new Promise((r) => setTimeout(r, ms))]).then(
    ([data]) => data
  );
// This utility function ensures that the promise resolves after at least `ms` milliseconds,