/*
*  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
*  Copyright (C) 2018, 2021 Mark-André Hopf <mhopf@mark13.org>
*
*  This program is free software: you can redistribute it and/or modify
*  it under the terms of the GNU Affero General Public License as published by
*  the Free Software Foundation, either version 3 of the License, or
*  (at your option) any later version.
*
*  This program is distributed in the hope that it will be useful,
*  but WITHOUT ANY WARRANTY; without even the implied warranty of
*  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*  GNU Affero General Public License for more details.
*
*  You should have received a copy of the GNU Affero General Public License
*  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { IncomingMessage } from "http"
import WebSocket, { Server as WebSocketServer } from "ws"
import * as ws from 'ws'

function listen(port: number): Promise<WebSocketServer> {
    return new Promise<WebSocketServer>((resolve, reject) => {
        // kludge: 'new WebSocketServer(...)' doesn't work but the following workaround
        const wss: WebSocketServer = new (ws as any).WebSocketServer({ port }, () => resolve(wss))
        wss.on("error", (error: any) => {
            switch (error.code) {
                case "EADDRINUSE":
                    reject(new Error(`another server is already running at ${error.address}:${error.port}`))
                    break
                default:
                    console.log(`ERROR CODE: ${error.code}`)
                    reject(error)
            }
        })
        wss.on("connection", (socket: WebSocket, request: IncomingMessage) => {
            console.log("new client")
            // console.log(request)
            // let orb = new ORB(this)
            // orb.socket = socket
            // orb.accept()
        })
        // wss.on("close", ...)
    })
}

describe("multiplexer/demultiplexer", function () {
    it.only("", async function () {
        const server = await listen(8080)

        // server.on('connection', function connection(ws) {
        //   ws.on('message', function incoming(message) {
        //     console.log('received: %s', message);
        //   });

        //   ws.send('something');
        // });

        const client = new WebSocket('ws://localhost:8080')
        client.on("open", () => {
            console.log("client: client is open")
            server.close()
            client.close()
        })
        // server.close()

        // client.on('open', function open() {
        //   client.send('something');
        // });

        // client.on('message', function incoming(message) {
        //   console.log('received: %s', message);
        // });

    })

})