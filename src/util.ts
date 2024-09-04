import { customAlphabet } from "nanoid";

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
