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

import { Stub, GIOPEncoder, GIOPDecoder, MessageType, ORB } from "corba.js"
import * as _interface from "./demux"

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

// class ServerORB {
//     connection: WebSocketConnection
//     constructor(connection: WebSocketConnection) {
//         this.connection = connection
//         this.message = this.message.bind(this)
//         this.error = this.error.bind(this)
//         this.close = this.close.bind(this)
//     }
//     message(buffer: ArrayBuffer) {
//         const decoder = new GIOPDecoder(buffer)
//         decoder.scanGIOPHeader(MessageType.REQUEST)
//         const request = decoder.scanRequestHeader()

//         if (request.responseExpected) {}

//         if (request.requestId === 2) {
//             const encoder0 = new GIOPEncoder()
//             encoder0.encodeReply(2)
//             encoder0.setGIOPHeader(MessageType.REPLY)
//             this.connection.sendBytes(Buffer.from(encoder0.bytes.subarray(0, encoder0.offset)))

//             const encoder1 = new GIOPEncoder()
//             encoder1.encodeReply(1)
//             encoder1.setGIOPHeader(MessageType.REPLY)
//             this.connection.sendBytes(Buffer.from(encoder1.bytes.subarray(0, encoder1.offset)))
//         }
//         if (request.requestId === 3) {
//             const encoder = new GIOPEncoder()
//             encoder.encodeReply(3, GIOPDecoder.USER_EXCEPTION)
//             encoder.setGIOPHeader(MessageType.REPLY)
//             this.connection.sendBytes(Buffer.from(encoder.bytes.subarray(0, encoder.offset)))
//         }

//         // const encoder = new GIOPEncoder()
//         // encoder.encodeReply(request.requestId)
//         // encoder.setGIOPHeader(MessageType.REPLY)
//         // this.connection.sendBytes(Buffer.from(encoder.bytes.subarray(0, encoder.offset)))
//     }
//     error(error: Error) {
//         console.log(`ORB: error ${error}`)
//     }
//     close(code: number, reason: string) {
//         console.log(`ORB client closed. code ${code}, reason '${reason}'`)
//     }
// }

class PromiseHandler {
    constructor(decode: (decoder: GIOPDecoder) => void, reject: (reason?: any) => void) {
        this.decode = decode
        this.reject = reject
    }
    decode: (decoder: GIOPDecoder) => void
    reject: (reason?: any) => void
}

const map = new Map<number, PromiseHandler>()

function call(client: WebSocketConnection, objectId: string, method: string, requestId: number) {
    console.log(`client: send request ${requestId}`)
    const encoder0 = new GIOPEncoder()
    encoder0.encodeRequest(objectId, method, requestId, true)

    encoder0.setGIOPHeader(MessageType.REQUEST)
    client.sendBytes(Buffer.from(encoder0.bytes.subarray(0, encoder0.offset)))
    return new Promise<void>( (resolve, reject) => map.set(requestId, new PromiseHandler(
        () => resolve(),
        reject)))
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
        const encoder = new GIOPEncoder()
        const requestId = ++this.orb.reqid
        encoder.encodeRequest(`${this.id}`, "onewayCall", requestId, false)

        encoder.ushort(a)

        encoder.setGIOPHeader(MessageType.REQUEST)
        // client.sendBytes(Buffer.from(encoder0.bytes.subarray(0, encoder0.offset)))
    }
    twowayCall(a: number): Promise<number> {
        const encoder = new GIOPEncoder()
        const requestId = ++this.orb.reqid
        encoder.encodeRequest(`${this.id}`, "twowayCall", requestId, true)

        encoder.ushort(a)

        encoder.setGIOPHeader(MessageType.REQUEST)
        // client.sendBytes(Buffer.from(encoder0.bytes.subarray(0, encoder0.offset)))

        return new Promise<number>( (resolve, reject) => map.set(requestId, 
            new PromiseHandler(
                (decoder: GIOPDecoder) => resolve(decoder.ushort()),
                reject)
        ))
    }
}

// https://html.spec.whatwg.org/multipage/web-sockets.html#network
// * the W3C WebSocket supports two types for sending & receiving: Blob & ArrayBuffer
// * Blob is the default, we want ArrayBuffer because we want to look into it

// in giop.spec.ts i'm using socket, but this is a wrapper for net.Socket, which has an
// API that's closer to WebSockets (but uses Uint8Array instead of ArrayBuffer)

// blob               arraybuffer
// immutable          can be changed, eg. with a dataview
// could be on disk   ram

// events: open, message, error, close
// MessageEvent {
//      data: any
// }
// send(data: Blob|ArrayBuffer|ArrayBufferView)
// ORB Network Adapter
// 
// sets ->  ORB.send: (buffer: ArrayBuffer) => void
// calls -> ORB.message(buffer: ArrayBuffer)
// calls -> ORB.error() ????
// calls -> ORB.close

describe("multiplexer/demultiplexer", function () {
    it.only("a", async function() {
        const orb = new ORB()
        const serverStub = new ServerStub(orb, 1)
        serverStub.onewayCall(17)
        const x = await serverStub.twowayCall(42)
        console.log(`twowayCall(42) -> ${x}`)
    })
    it("b", async function () {
        const serverORB = new ORB()
        // register skeleton implementation
        const serverWS = await listen(serverORB, 8080)

        const clientORB = new ORB()
        // register stub
        const clientWS = await connect(clientORB, "ws://localhost:8080/")

        call(clientWS, "DUMMY", "callA", 1)
            .then( () => {
                console.log("got reply for callA")
            })

        call(clientWS, "DUMMY", "callB", 2)
            .then( () => {
                console.log("got reply for callB")
            })

        await expect(call(clientWS, "DUMMY", "callC", 3)).to.be.rejectedWith(Error,
            "User Exception", "b")

        clientWS.close(CloseCode.CLOSE_CUSTOM + 711, "Cologne")
        // serverWS.closeAllConnections()
        serverWS.shutDown()
/*
        const serverORB = new ORB()
        serverORB.name = "serverORB"
        //serverORB.debug = 1
        serverORB.bind("Server", new Server_impl(serverORB))     

        const clientORB = new ORB()
        clientORB.name = "clientORB"
        //clientORB.debug = 1
        clientORB.registerStubClass(stub.Server)
        
        mockConnection(serverORB, clientORB).name = "acceptedORB"

        const server = stub.Server.narrow(await clientORB.resolve("Server"))

        // the idea is that the server has delays and we'll get the reponses in a different order
        // eg. C, A, B
        client.callA().then ...
        client.callB().then ...
        client.callC().then ...
*/

    })

})