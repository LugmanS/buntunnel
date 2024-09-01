import type { Server, ServerWebSocket } from "bun";
import type { Requests } from "./types";
import { getSubdomain, tunnelClientHostnames } from "./util";

const port = 8080 || process.env.PORT;

console.log(`Buntunnel server listing on port ${port}`);

const clients = new Map<string, ServerWebSocket<unknown>>();
const requests: Requests = new Map();

async function requestHandler(req: Request, server: Server) {
  const { url: reqUrl } = req;
  const url = new URL(reqUrl);
  // Handle request from BunTunnel client
  if (tunnelClientHostnames.includes(url.hostname)) {
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) {
        return;
      }
      return new Response("Upgrade failed", { status: 500 });
    } else {
      return new Response("Not found", { status: 404 });
    }
  }
  // Handle tunnel requests
  const clientSlug = getSubdomain(reqUrl);
  if (!clientSlug || !clients.has(clientSlug)) {
    return new Response("Not found", { status: 404 });
  }
  const client = clients.get(clientSlug);
  if (!client) {
    return new Response("Not found", { status: 404 });
  }

  console.log(`Request for client: ${clientSlug} to route to ${reqUrl}`);

  const requestId = crypto.randomUUID();
  const bodyBuffer = await req.arrayBuffer();

  client.send(
    JSON.stringify({
      type: "proxied-request",
      data: {
        requestId,
        request: {
          method: req.method,
          headers: req.headers,
          body: Buffer.from(bodyBuffer).toString("base64"),
          url: req.url,
        },
      },
    })
  );

  const responsePromise = new Promise<Response>((resolve, reject) => {
    const requestTimeoutId = setTimeout(() => {
      requests.delete(requestId);
      reject(new Error("Request timed out"));
    }, 20000);

    requests.set(requestId, (isSuccessful, requestResponse) => {
      if (!isSuccessful) {
        resolve(
          new Response(
            "Traffic was successfully tunneled to the agent, but the agent failed to establish a connection to the upstream web service.",
            { status: 500 }
          )
        );
        return;
      }

      clearTimeout(requestTimeoutId);
      const body = Buffer.from(requestResponse.body, "base64").toString();
      const response = new Response(body, {
        status: requestResponse.status,
        headers: requestResponse.headers,
      });
      resolve(response);
    });
  });

  try {
    return await responsePromise;
  } catch (e) {
    return new Response("Request timed out", { status: 408 });
  }
}

function socketMessageHandler(
  ws: ServerWebSocket<unknown>,
  message: string | Buffer
) {
  if (typeof message !== "string") return;
  const data = JSON.parse(message);

  if (data.type === "register-client") {
    clients.set(data.data.clientId, ws);
    ws.send(JSON.stringify({ type: "client-registered", data: null }));
    return;
  }

  if (data.type === "proxied-request-response") {
    const requestId = data.data.requestId;
    if (!requests.has(requestId)) return;

    const requestResponseHandler = requests.get(requestId);
    if (!requestResponseHandler) return;
    requestResponseHandler(data.isSuccessful, data.data.response);
    requests.delete(requestId);
    return;
  }
}

Bun.serve({
  port,
  async fetch(req, server) {
    return await requestHandler(req, server);
  },
  websocket: {
    message(ws, message) {
      socketMessageHandler(ws, message);
    },
    open(ws) {
      // ws.send(JSON.stringify({ type: "connected", data: null }));
    },
    close(ws, code, message) {},
  },
});
