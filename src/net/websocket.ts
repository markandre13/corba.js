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

import * as http from "http"
import {
    server as WebSocketServer,
    client as WebSocketClient,
    request as WebSocketRequest,
    connection as WebSocketConnection,
    Message
} from "websocket"
import * as ws from "websocket"
import { ORB } from "corba.js"

// WebSocket close codes
enum CloseCode {
    CLOSE_NORMAL = 1000,
    CLOSE_GOING_AWAY,
    CLOSE_PROTOCOL_ERROR,
    CLOSE_UNSUPPORTED,
    CLOSE_1004,
    CLOSED_NO_STATUS,
    CLOSE_ABNORMAL,
    CLOSE_UNSUPPORTED_PAYLOAD,
    CLOSE_POLICY_VIOLATION,
    CLOSE_TOO_LARGE,
    CLOSE_MANDATORY_EXTENSION,
    CLOSE_SERVER_ERROR,
    CLOSE_SERVICE_RESTART,
    CLOSE_TRY_AGAIN_LATER,
    CLOSE_BAD_GATEWAY,
    CLOSE_TLS_HANDSHAKE_FAIL,
    CLOSE_EXTENSION = 2000,
    CLOSE_IANA = 3000,
    CLOSE_CUSTOM = 4000
}

export function listen(orb: ORB, port: number): Promise<WebSocketServer> {
    return new Promise<WebSocketServer>((resolve, reject) => {
        const httpServer = http.createServer()
        const wss = new (ws as any).default.server({ httpServer, autoAcceptConnections: true }) as WebSocketServer
        wss.on("request", (request: WebSocketRequest) => {
            request.accept()
        })
        wss.on("connect", (connection: WebSocketConnection) => {
            const clientORB = new ORB(orb)
            clientORB.socketSend = (buffer: ArrayBuffer) => { connection.sendBytes(Buffer.from(buffer)) }
            connection.on("error", (error: Error) => { clientORB.socketError(error) })
            connection.on("close", (code: number, desc: string) => { clientORB.socketClose() })
            connection.on("message", (message: Message) => {
                switch (message.type) {
                    case "binary":
                        const b = message.binaryData
                        clientORB.socketRcvd(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
                        break
                    case "utf8":
                        console.log(message.utf8Data)
                        break
                }
            })
        })
        httpServer.once("error", (error: Error) => reject(error))
        httpServer.listen(port, () => {
            console.log(`server is listening on port ${port}`)
            resolve(wss)
        })
    })
}

// connect ORB to WebSocket server
export function connect(orb: ORB, url: string): Promise<WebSocketConnection> {
    return new Promise<WebSocketConnection>((resolve, reject) => {
        const client = new (ws as any).default.client() as WebSocketClient
        client.once("connect", (connection: WebSocketConnection) => {
            orb.socketSend = (buffer: ArrayBuffer) => connection.sendBytes(Buffer.from(buffer))
            connection.on("error", (error: Error) => orb.socketError(error))
            connection.on("close", (code: number, desc: string) => orb.socketClose())
            connection.on("message", (m: Message) => {
                switch (m.type) {
                    case "binary":
                        const b = m.binaryData
                        orb.socketRcvd(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
                        break
                    case "utf8":
                        console.log(m.utf8Data)
                        break
                }
            })
            resolve(connection)
        })
        client.once("connectFailed", (error: Error) => reject(error))
        client.connect(url)
    })
}
