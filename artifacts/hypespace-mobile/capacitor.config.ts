import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.discoversolutions.hypespace",
  appName: "HypeSpace",
  webDir: "../hypespace/dist/public",
  server: {
    // In dev, developers can uncomment this to point at a LAN dev server:
    // url: "http://192.168.1.X:5173",
    // cleartext: true,
    androidScheme: "https",
  },
};

export default config;
