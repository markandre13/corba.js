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

import { ORB } from "corba.js"
import { Connection } from "../orb/connection"
import { Protocol } from "../orb/protocol"

const InitialInitiatorRequestIdBiDirectionalIIOP = 0
const InitialResponderRequestIdBiDirectionalIIOP = 1

import * as http from "http"
import {
    server as WebSocketServer,
    client as WebSocketClient,
    request as WebSocketRequest,
    connection as WebSocketConnection,
    Message
} from "websocket"
import * as ws from "websocket"

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

export class WsProtocol implements Protocol {
    serverSocket?: http.Server
    // called by the ORB
    async connect(orb: ORB, host: string, port: number) {
        return new Promise<Connection>((resolve, reject) => {
            const socket = new (ws as any).default.client() as WebSocketClient
            socket.once("connectFailed", (error: Error) => reject(error))
            socket.once("connect", (wsConnection: WebSocketConnection) => {
                const connection = new WsConnection(wsConnection, orb)
                connection.requestId = InitialInitiatorRequestIdBiDirectionalIIOP
                wsConnection.on("error", (error: Error) => orb.socketError(connection, error))
                wsConnection.on("close", (code: number, desc: string) => orb.socketClosed(connection))
                wsConnection.on("message", (m: Message) => {
                    switch (m.type) {
                        case "binary":
                            const b = m.binaryData
                            orb.socketRcvd(connection, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
                            break
                        case "utf8":
                            console.log(m.utf8Data)
                            break
                    }
                })
                orb.addConnection(connection)
                resolve(connection)
            })
            const url = `ws://${host}:${port}/`
            // console.log(`WsProtocol.connect(orb, '${host}', ${port}) -> ${url}`)
            socket.connect(url)
        })
    }

    // create a server socket
    listen(orb: ORB, port: number): void {
        this.serverSocket = http.createServer()
        const wss = new (ws as any).default.server({ 
            httpServer: this.serverSocket,
            autoAcceptConnections: true // FIXME: this is a security issue?
        }) as WebSocketServer
        wss.on("request", (request: WebSocketRequest) => {
            request.accept()
            console.log(`accepted connection from ${request.host}`)
        })
        wss.on("connect", (wsConnection: WebSocketConnection) => {
            // console.log(`accepted connection from ${wsConnection}`)
            const connection = new WsConnection(wsConnection, orb)
            connection.requestId = InitialResponderRequestIdBiDirectionalIIOP
            wsConnection.on("error", (error: Error) => { orb.socketError(connection, error) })
            wsConnection.on("close", (code: number, desc: string) => { orb.socketClosed(connection) })
            wsConnection.on("message", (message: Message) => {
                switch (message.type) {
                    case "binary":
                        const b = message.binaryData
                        orb.socketRcvd(connection, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
                        break
                    case "utf8":
                        console.log(message.utf8Data)
                        break
                }
            })
            orb.addConnection(connection)
        })
        // httpServer.once("error", (error: Error) => reject(error))
        this.serverSocket.listen(port, () => {
            // console.log(`server is listening on port ${port}`)
            // resolve(wss)
        })
    }
    
    async close() {
        if (this.serverSocket === undefined)
            throw Error(`internal error: close() without server socket`)
        this.serverSocket.close()
        this.serverSocket = undefined
    }
}

export class WsConnection extends Connection {
    private wsConnection: WebSocketConnection

    constructor(wsConnection: WebSocketConnection, orb: ORB) {
        super(orb)
        this.wsConnection = wsConnection
    }

    get localAddress(): string {
        return this.wsConnection.socket.localAddress!
    }
    get localPort(): number {
        return this.wsConnection.socket.localPort!
    }
    get remoteAddress(): string {
        return this.wsConnection.socket.remoteAddress!
    }
    get remotePort(): number {
        return this.wsConnection.socket.remotePort!
    }

    close() {
        this.wsConnection.close()
    }
    send(buffer: ArrayBuffer): void {
        this.wsConnection.sendBytes(Buffer.from(buffer))
    }
}
