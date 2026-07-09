console.log("worker started");

const heartbeat = setInterval(() => {
  console.log("can u feel the beat of my heart");
}, 6000);

function shutdown() {
  console.log("worker shutting down");
  clearInterval(heartbeat);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
