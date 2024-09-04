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
