#!/usr/bin/env node

import http from "http";
import yargs from "yargs";
import WebSocket from "ws";
import { hideBin } from "yargs/helpers";

const buntunnelServerUrl = "http://localhost:8080/ws";

const argv = yargs(hideBin(process.argv))
  .option("port", {
    alias: "p",
    description: "Port number to tunnel",
    type: "number",
  })
  .check((argv) => {
    if (!argv.port) {
      throw new Error("Please provide a port number.");
    }
    if (argv.port && (argv.port < 1 || argv.port > 65535)) {
      throw new Error("Please provide a valid port number.");
    }
    return true;
  }).argv;

function tunnelHandler(port) {
  const socket = new WebSocket(buntunnelServerUrl);
  // const clientId = crypto.randomUUID();
  const clientId = "b048405a-3cba-446d-939b-aefd22553197";

  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({ type: "register-client", data: { clientId } })
    );
  });

  socket.addEventListener("message", async (event) => {
    if (typeof event.data !== "string") return;
    const data = JSON.parse(event.data);

    if (data.type === "client-registered") {
      console.log(`✨ Forwarding requests to: ${port}`);
      console.log(`🔗 Buntunnel: https://${clientId}.buntunnel.com \n`);
    }

    if (data.type === "proxied-request") {
      const { requestId, request: requestData } = data.data;
      const requestedUrl = new URL(requestData.url);

      const options = {
        hostname: "127.0.0.1",
        port: port,
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
        if (error.code === "ECONNREFUSED") {
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
        }

        console.error(error);
      });

      proxyRequest.write(Buffer.from(requestData.body, "base64"));
      proxyRequest.end();
    }
  });

  socket.addEventListener("error", (event) => {
    console.error(
      "Unable to connect to Buntunnel server. Please try after some time."
    );
  });

  socket.addEventListener("close", (event) => {
    console.log("Disconnected from Buntunnel server");
  });
}

function main() {
  if (argv.port) {
    tunnelHandler(argv.port);
  }
}

main();
