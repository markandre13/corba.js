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
import { connect, createServer, Server, TLSSocket } from "tls"
import { Connection } from "../orb/connection"
import { Protocol } from "../orb/protocol"

const InitialInitiatorRequestIdBiDirectionalIIOP = 0
const InitialResponderRequestIdBiDirectionalIIOP = 1

export class SslProtocol implements Protocol {
    serverSocket?: Server
    // called by the ORB
    async connect(orb: ORB, hostname: string, port: number) {
        return new Promise<Connection>( (resolve, reject) => {
            const socket = connect(port, hostname)
            socket.setNoDelay()
            socket.once("error", (error: Error) => reject(error))
            socket.connect(port, hostname, () => {
                const connection = new TcpConnection(socket, orb)
                connection.requestId = InitialInitiatorRequestIdBiDirectionalIIOP
                // clear error handler?
                socket.on("error", (error: Error) => orb.socketError(connection, error))
                socket.on("close", (hadError: boolean) => orb.socketClosed(connection))
                socket.on("data", (data: Buffer) => orb.socketRcvd(connection, data.buffer))
                orb.addConnection(connection)
                resolve(connection)
            })
        })
    }

    // create a server socket
    listen(orb: ORB, hostname: string, port: number): void {
        this.serverSocket = createServer({}, (socket: TLSSocket) => {
            console.log(`accepted connection from ${socket.remoteAddress}:${socket.remotePort}`)
            const connection = new TcpConnection(socket, orb)
            connection.requestId = InitialResponderRequestIdBiDirectionalIIOP
            socket.setNoDelay()
            socket.on("error", (error: Error) => orb.socketError(connection, error))
            socket.on("close", (hadError: boolean) => orb.socketClosed(connection))
            socket.on("data", (data: Buffer) => orb.socketRcvd(connection, data.buffer))
            orb.addConnection(connection)
        })
        this.serverSocket.listen(port, hostname)
    }
    
    close(): void {
        if (this.serverSocket === undefined)
            throw Error(`internal error: close() without server socket`)
        this.serverSocket.close()
        this.serverSocket = undefined
    }
}

class TcpConnection extends Connection {
    private socket: TLSSocket

    constructor(socket: TLSSocket, orb: ORB) {
        super(orb)
        this.socket = socket
    }

    get localAddress(): string {
        return this.socket.localAddress!
    }
    get localPort(): number {
        return this.socket.localPort!
    }
    get remoteAddress(): string {
        return this.socket.remoteAddress!
    }
    get remotePort(): number {
        return this.socket.remotePort!
    }

    close() {
        this.socket.destroy()
    }
    send(buffer: ArrayBuffer): void {
        this.socket.write(new Uint8Array(buffer))
    }
}
