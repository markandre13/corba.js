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

import { use, expect } from "chai"
import * as chaiAsPromised from "chai-as-promised"
use(chaiAsPromised.default)

import * as http from "http"
import { 
    server as WebSocketServer,
    client as WebSocketClient,
    request as WebSocketRequest,
    connection as WebSocketConnection,
    Message
} from "websocket"
import * as ws from "websocket"

import { Stub, GIOPEncoder, GIOPDecoder, MessageType, ORB, PromiseHandler } from "corba.js"

import * as _interface from "./demux"
import * as skel from "./demux_skel"

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

function listen(orb: ORB, port: number): Promise<WebSocketServer> {
    return new Promise<WebSocketServer>((resolve, reject) => {
        const httpServer = http.createServer()
        const wss = new (ws as any).default.server({httpServer, autoAcceptConnections: true}) as WebSocketServer
        wss.on("request", (request: WebSocketRequest) => {
            request.accept()
        })
        wss.on("connect", (connection: WebSocketConnection) => {
            const clientORB = new ORB(orb)
            clientORB.socketSend = (buffer: ArrayBuffer) => { connection.sendBytes(Buffer.from(buffer)) }
            connection.on("error", (error: Error) => { clientORB.socketError(error) })
            connection.on("close", (code: number, desc: string) => { clientORB.socketClose() })
            connection.on("message", (message: Message) => {
                switch(message.type) {
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
        httpServer.once("error", (error: Error) => reject(error) )
        httpServer.listen(port, () => {
            console.log(`server is listening on port ${port}`)
            resolve(wss)
        })
    })
}

// connect ORB to WebSocket server
function connect(orb: ORB, url: string): Promise<WebSocketConnection> {
    return new Promise<WebSocketConnection>((resolve, reject) => {
        const client = new (ws as any).default.client() as WebSocketClient
        client.once("connect", (connection: WebSocketConnection) => {
            orb.socketSend = (buffer: ArrayBuffer) => connection.sendBytes(Buffer.from(buffer))
            connection.on("error", (error: Error) => orb.socketError(error))
            connection.on("close", (code: number, desc: string) => orb.socketClose())
            connection.on("message", (m: Message) => {
                switch(m.type) {
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

// npm run test:demux:run
// rm -f lib/idl/idl.cjs ; npm run build:idl:build && ./bin/corba-idl --ts-all test-mico/demux.idl && cat test-mico/demux_stub.ts

export class ServerStub extends Stub implements _interface.Server {
    static _idlClassName(): string {
        return "Server"
    }

    static narrow(object: any): ServerStub {
        if (object instanceof ServerStub)
            return object as ServerStub
        throw Error("ServerStub.narrow() failed")
    }

    onewayCall(a: number): void {
        this.orb.onewayCall(`${this.id}`, "onewayCall", (encoder) => encoder.ushort(a))
    }
    twowayCall(a: number): Promise<number> {
        return this.orb.twowayCall(`${this.id}`, "twowayCall",
            (encoder) => encoder.ushort(a),
            (decoder) => decoder.ushort())
    }
}

class Server_impl extends skel.Server {
    onewayCall(a: number) {
        console.log(`Server_impl.onewayCall(${a})`)
    }
    async twowayCall(a: number) {
        console.log(`Server_impl.twowayCall(${a})`)
        return a + 5
    }
}

describe("multiplexer/demultiplexer", function () {
    it("call ORB using GIOP", async function () {
        const serverORB = new ORB()
        serverORB.bind("Server", new Server_impl(serverORB))
        const serverWS = await listen(serverORB, 8080)

        const clientORB = new ORB()
        clientORB.registerStubClass(ServerStub)
        const clientWS = await connect(clientORB, "ws://localhost:8080/")

        const serverStub = ServerStub.narrow(await clientORB.resolve("Server"))
        serverStub.onewayCall(17)
        const x = await serverStub.twowayCall(42)
        console.log(`twowayCall(42) -> ${x}`)
        expect(x).equals(47)

        clientWS.close()
        serverWS.shutDown()
     })
})
