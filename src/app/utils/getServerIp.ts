import os from "os";
import config from "../config";

// SERVER_IP from .env wins (use the public IP/domain on a hosted server);
// otherwise the first non-internal IPv4 address of this machine.
export const getServerIp = () => {
  if (config.serverIp) return config.serverIp;

  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return "localhost";
};
