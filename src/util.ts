import { customAlphabet } from "nanoid";
import zlib from "zlib";

export function getSubdomain(url: string) {
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;
  const parts = hostname.split(".");
  if (parts.length > 2) {
    return parts.slice(0, -2).join(".");
  }
  return null;
}

export const tunnelClientHostnames = ["localhost", "app.buntunnel.site"];

export function generateClientId(clients: string[]) {
  const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 20);
  let clientId = nanoid();
  while (clients.includes(clientId)) {
    clientId = nanoid();
  }
  return clientId;
}

export function compressResponse(
  data: Buffer,
  acceptEncoding: string
): Promise<{ data: Buffer | string; encoding: string }> {
  return new Promise((resolve, reject) => {
    const acceptedEncodings = acceptEncoding
      .split(",")
      .map((item) => item.trim());

    if (acceptedEncodings.includes("br")) {
      zlib.brotliCompress(data, (err, result) => {
        if (err) reject(err);
        else resolve({ data: result, encoding: "br" });
      });
    } else if (acceptedEncodings.includes("gzip")) {
      zlib.gzip(data, (err, result) => {
        if (err) reject(err);
        else resolve({ data: result, encoding: "gzip" });
      });
    } else if (acceptedEncodings.includes("deflate")) {
      zlib.deflate(data, (err, result) => {
        if (err) reject(err);
        else resolve({ data: result, encoding: "deflate" });
      });
    } else {
      resolve({ data, encoding: "identity" });
    }
  });
}
