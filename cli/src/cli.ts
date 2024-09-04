#!/usr/bin/env node

import http from "http";
import WebSocket from "ws";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { BaseConnectionConfig, BtArgs } from "./types";

const defaultServerUrl = "wss://app.buntunnel.site/ws";

const argv = yargs(hideBin(process.argv))
  .option("port", {
    alias: "p",
    description: "Port number to tunnel",
    type: "number",
  })
  .option("url", {
    alias: "u",
    description: "URL to tunnel",
    type: "string",
  })
  .option("server-url", {
    description:
      "Websocket server endpoint.Use if you are running your own server.",
    type: "string",
  })
  .check((argv) => {
    if (argv.port && (argv.port < 1 || argv.port > 65535)) {
      throw new Error("Please provide a valid port number.");
    }
    if (argv.url && !isValidUrl(argv.url)) {
      throw new Error("Please provide a valid url.");
    }
    if (!argv.url && !argv.port) {
      throw new Error("Please provide a url or port number.");
    }
    if (argv.url && argv.port) {
      throw new Error("Please provide either a url or port number.");
    }
    if (argv["server-url"] && !isValidUrl(argv["server-url"])) {
      throw new Error("Please provide a valid server url.");
    }
    return true;
  }).argv;

function tunnelHandler(
  baseConnectionConfig: BaseConnectionConfig,
  socketEnpoint: string
) {
  const socket = new WebSocket(socketEnpoint);
  let clientId = null;

  socket.addEventListener("open", () => {
    console.log(`⌛️ Setting up your tunnel...`);
  });

  socket.addEventListener("message", async (event) => {
    if (typeof event.data !== "string") return;
    const data = JSON.parse(event.data);

    if (data.type === "client-registered") {
      clientId = data.data.clientId;
      if (!clientId) return console.log(`❌ Unable to establish tunnel`);
      console.log(`✨ Tunnel established`);
      console.log(`🔗 Buntunnel: https://${clientId}.buntunnel.site \n`);
    }

    if (data.type === "proxied-request") {
      const { requestId, request: requestData } = data.data;
      const requestedUrl = new URL(requestData.url);

      const options: http.RequestOptions = {
        ...baseConnectionConfig,
        path: requestedUrl.pathname,
        method: requestData.method,
        headers: requestData.headers,
      };

      const proxyRequest = http.request(options, (response) => {
        let responseBody = "";
        response.on("data", (chunk) => {
          responseBody += chunk;
        });

        response.on("end", () => {
          const body = Buffer.from(responseBody).toString("base64");
          socket.send(
            JSON.stringify({
              type: "proxied-request-response",
              isSuccessful: true,
              data: {
                requestId,
                response: {
                  status: response.statusCode,
                  headers: response.headers,
                  body,
                },
              },
            })
          );
          console.log(
            `${response.statusCode}  ${requestData.method} ${requestedUrl.pathname}${requestedUrl.search}`
          );
        });
      });

      proxyRequest.on("error", (error) => {
        console.error(
          `502  ${requestData.method} ${requestedUrl.pathname}${requestedUrl.search}`
        );
        socket.send(
          JSON.stringify({
            type: "proxied-request-response",
            isSuccessful: false,
            data: { requestId },
          })
        );
        return;
      });

      proxyRequest.write(Buffer.from(requestData.body, "base64"));
      proxyRequest.end();
    }
  });

  socket.addEventListener("error", (event) => {
    console.log(event);
    console.error(
      "Unable to connect to Buntunnel server. Please try after some time."
    );
  });

  socket.addEventListener("close", (event) => {
    console.log(event);
    console.log("Disconnected from Buntunnel server");
  });
}

function isValidUrl(input: string) {
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (err) {
    return false;
  }
}

function main() {
  const { port, url, "server-url": serverUrl } = argv as BtArgs;
  const socketEndpoint = serverUrl || defaultServerUrl;
  const baseConnectionConfig = {
    hostname: url ? new URL(url).hostname : "127.0.0.1",
    port: url ? Number(new URL(url).port) : port || 8080,
  };
  tunnelHandler(baseConnectionConfig, socketEndpoint);
}

main();
