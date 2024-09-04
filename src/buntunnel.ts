import type { Server, ServerWebSocket } from "bun";
import type { Requests, WebsocketData } from "./types";
import { getSubdomain, tunnelClientHostnames } from "./util";
import { nanoid } from "nanoid";

const port = 8080 || process.env.PORT;

console.log(`Buntunnel server listing on port ${port}`);

const clients = new Map<string, ServerWebSocket<unknown>>();
const requests: Requests = new Map();

async function requestHandler(req: Request, server: Server) {
  const { url: reqUrl } = req;
  const url = new URL(reqUrl);
  // Socket connection from buntunnel client
  if (tunnelClientHostnames.includes(url.hostname)) {
    if (url.pathname !== "/ws")
      return new Response("Not found", { status: 404 });
    const upgrade = server.upgrade(req, {
      data: {
        clientId: nanoid(),
      },
    });
    if (upgrade) return;
    console.error("ERROR::SOCKET-HANDLER:Upgrade failed for url:", reqUrl);
    return new Response("Upgrade failed", { status: 500 });
  }

  const clientId = getSubdomain(reqUrl);
  if (!clientId || !clients.has(clientId)) {
    console.error(
      "NOTICE::REQUEST-HANDLER:Client not found for clientId:",
      clientId
    );
    return new Response("Not found", { status: 404 });
  }
  const client = clients.get(clientId);
  if (!client) {
    return new Response("Not found", { status: 404 });
  }

  const requestId = crypto.randomUUID();
  console.log(
    `INFO::REQUEST-HANDLER:Procesing for client:${clientId}, url:${url.pathname.concat(
      url.search
    )} with requestId:${requestId}`
  );
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
      console.log(
        `ERROR::REQUEST-HANDLER:No response from client:${clientId} for requestId:${requestId}`
      );
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
      console.log(
        `INFO::REQUEST-HANDLER:Successfully processed for client:${clientId}, url:${url.pathname.concat(
          url.search
        )} with requestId:${requestId}`
      );
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

Bun.serve<WebsocketData>({
  port,
  async fetch(req, server) {
    return await requestHandler(req, server);
  },
  websocket: {
    message(ws, message) {
      socketMessageHandler(ws, message);
    },
    open(ws) {
      console.log(
        `INFO::WEBSOCKET-HANDLER:ClinentId:${ws.data.clientId} connected`
      );
      clients.set(ws.data.clientId, ws);
      ws.send(
        JSON.stringify({
          type: "client-registered",
          data: { clientId: ws.data.clientId },
        })
      );
    },
    close(ws, code, message) {
      console.log(
        `INFO::WEBSOCKET-HANDLER:ClinentId:${ws.data.clientId} disconnected`
      );
    },
  },
});
