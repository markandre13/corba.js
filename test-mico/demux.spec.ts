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

import { ORB, IOR, GIOPEncoder, GIOPDecoder, MessageType } from "corba.js"
import * as http from "http"
import { 
    server as WebSocketServer,
    client as WebSocketClient,
    request as WebSocketRequest,
    connection as Connection,
    Message
} from "websocket"
import * as ws from "websocket"

import { use, expect } from "chai"
import * as chai from "chai"
import * as chaiAsPromised from "chai-as-promised"

console.log(use)
console.log(chaiAsPromised)
use(chaiAsPromised.default)

// chai.use(chaiAsPromised as any)

// import { expect } from "chai"

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


function createServer(port: number): Promise<WebSocketServer> {
    return new Promise<WebSocketServer>((resolve, reject) => {
        const httpServer = http.createServer()
        const wss = new (ws as any).default.server({httpServer, autoAcceptConnections: true}) as WebSocketServer
        wss.on("request", (request: WebSocketRequest) => {
            console.log('server: request')
            request.accept()
        })
        wss.on("connect", (connection: Connection) => {
            console.log("server: connection")
            const orb = new ServerORB(connection)
            connection.on("message", (m: Message) => {
                console.log("server: message")
                switch(m.type) {
                    case "binary":
                        const b = m.binaryData
                        const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
                        orb.message(ab)
                        break
                    case "utf8":
                        console.log(m.utf8Data)
                        break
                }
            })
        })
        wss.on("close", (connection: Connection, reason: number, desc: string) => {
            const reasonText = CloseCode[reason] || `${reason}`
            console.log(`server: close ${reasonText} '${desc}'`)
        })
        httpServer.listen(port, () => {
            console.log(`server is listening on port ${port}`)
            resolve(wss)
        })
    })
}

function createClient(url: string): Promise<Connection> {
    return new Promise<Connection>((resolve, reject) => {
        const client = new (ws as any).default.client() as WebSocketClient
        client.once("connect", (conn: Connection) => resolve(conn) )
        client.once("connectFailed", (error: Error) => reject(error))
        client.connect(url)
    })
}

class ServerORB {
    connection: Connection
    constructor(connection: Connection) {
        this.connection = connection
        this.message = this.message.bind(this)
        this.error = this.error.bind(this)
        this.close = this.close.bind(this)
    }
    message(buffer: ArrayBuffer) {
        const decoder = new GIOPDecoder(buffer)
        decoder.scanGIOPHeader(MessageType.REQUEST)
        const request = decoder.scanRequestHeader()

        if (request.responseExpected) {}

        if (request.requestId === 2) {
            const encoder0 = new GIOPEncoder()
            encoder0.encodeReply(2)
            encoder0.setGIOPHeader(MessageType.REPLY)
            this.connection.sendBytes(Buffer.from(encoder0.bytes.subarray(0, encoder0.offset)))

            const encoder1 = new GIOPEncoder()
            encoder1.encodeReply(1)
            encoder1.setGIOPHeader(MessageType.REPLY)
            this.connection.sendBytes(Buffer.from(encoder1.bytes.subarray(0, encoder1.offset)))
        }
        if (request.requestId === 3) {
            const encoder = new GIOPEncoder()
            encoder.encodeReply(3, GIOPDecoder.USER_EXCEPTION)
            encoder.setGIOPHeader(MessageType.REPLY)
            this.connection.sendBytes(Buffer.from(encoder.bytes.subarray(0, encoder.offset)))
        }

        // const encoder = new GIOPEncoder()
        // encoder.encodeReply(request.requestId)
        // encoder.setGIOPHeader(MessageType.REPLY)
        // this.connection.sendBytes(Buffer.from(encoder.bytes.subarray(0, encoder.offset)))
    }
    error(error: Error) {
        console.log(`ORB: error ${error}`)
    }
    close(code: number, reason: string) {
        console.log(`ORB client closed. code ${code}, reason '${reason}'`)
    }
}

class PromiseHandler {
    constructor(resolve: () => void, reject: (reason?: any) => void) {
        this.resolve = resolve
        this.reject = reject
    }
    resolve: () => void
    reject: (reason?: any) => void
}

const map = new Map<number, PromiseHandler>()

function call(client: Connection, objectId: string, method: string, requestId: number) {
    console.log(`client: send request ${requestId}`)
    const encoder0 = new GIOPEncoder()
    encoder0.encodeRequest(objectId, method, requestId, MessageType.REPLY)
    encoder0.setGIOPHeader(MessageType.REQUEST)
    client.sendBytes(Buffer.from(encoder0.bytes.subarray(0, encoder0.offset)))
    return new Promise<void>( (resolve, reject) => map.set(requestId, new PromiseHandler(resolve, reject)))
}

describe("multiplexer/demultiplexer", function () {
    it.only("", async function () {
        const server = await createServer(8080)

        // const client = new WebSocketClient()
        // client.connect('ws://localhost:8080')

        const client = await createClient('ws://localhost:8080/')
        console.log("client: open")

        client.on("message", (m: Message) => {
            console.log("client: message")
            switch(m.type) {
                case "binary":
                    const b = m.binaryData
                    const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
                    const decoder = new GIOPDecoder(ab)
                    decoder.scanGIOPHeader(MessageType.REPLY)
                    const data = decoder.scanReplyHeader()
                    console.log(`client: got reply for request ${data.requestId}`)
                    const handler = map.get(data.requestId)
                    if (handler === undefined) {
                        console.log(`Unexpected reply to request ${data.requestId}`)
                        break
                    }
                    switch(data.replyStatus) {
                        case GIOPDecoder.NO_EXCEPTION:
                            handler.resolve()
                            break
                        case GIOPDecoder.USER_EXCEPTION:
                            handler.reject(new Error(`User Exception`))
                            break
                    }
                    break
                case "utf8":
                    console.log(m.utf8Data)
                    break
            }
        })

        call(client, "DUMMY", "callA", 1)
            .then( () => {
                console.log("got reply for callA")
            })

        call(client, "DUMMY", "callB", 2)
            .then( () => {
                console.log("got reply for callB")
            })

        await expect(call(client, "DUMMY", "callC", 3)).to.be.rejectedWith(Error,
            "User Exception", "b")
        // client.sendUTF("Hello again!")
        client.close(CloseCode.CLOSE_CUSTOM + 711, "Cologne")
        // server.close()
        server.closeAllConnections()
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