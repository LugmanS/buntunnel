#!/usr/bin/env node

import http from "http";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const buntunnelServerUrl = "http://localhost:8080/ws";
const urlRegex =
  /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

yargs(hideBin(process.argv))
  .command(
    "$0 <url>",
    "Start a Buntunnel",
    (yargs) => {
      yargs.positional("url", {
        describe: "URL to tunnel",
        type: "string",
      });
    },
    (argv) => {
      tunnelHandler(argv.url);
    }
  )
  .parse();

function tunnelHandler(url) {
  // if (!url || !urlRegex.test(url)) {
  //   console.error("❌ Invalid URL");
  //   return;
  // }

  const destinationUrl = new URL(url);
  const socket = new WebSocket(buntunnelServerUrl);
  // const clientId = crypto.randomUUID();
  const clientId = "b048405a-3cba-446d-939b-aefd22553197";

  socket.addEventListener("open", (event) => {
    socket.send(
      JSON.stringify({ type: "register-client", data: { clientId } })
    );
  });

  socket.addEventListener("message", async (event) => {
    if (typeof event.data !== "string") return;
    const data = JSON.parse(event.data);

    if (data.type === "client-registered") {
      console.log("✅ Connected to Buntunnel server");
      console.log(`🔗 Hosted url: https://${clientId}.buntunnel.com`);
    }

    if (data.type === "proxied-request") {
      const { requestId, request: requestData } = data.data;
      const requestedUrl = new URL(requestData.url);

      const options = {
        hostname: destinationUrl.hostname,
        port: destinationUrl.port,
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
        });
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
