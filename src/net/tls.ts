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
import { connect, createServer, Server, TlsOptions, TLSSocket } from "tls"
import { Connection } from "../orb/connection"
import { Protocol } from "../orb/protocol"

const InitialInitiatorRequestIdBiDirectionalIIOP = 0
const InitialResponderRequestIdBiDirectionalIIOP = 1

export class TlsProtocol implements Protocol {
    options: TlsOptions
    serverSocket?: Server

    constructor(options: TlsOptions = {}) {
        this.options = options
    }

    // called by the ORB
    async connect(orb: ORB, hostname: string, port: number) {
        
        return new Promise<Connection>( (resolve, reject) => {
            // const socket = connect(port, hostname)
            // console.log(`connected`)
            // socket.setNoDelay()
            // socket.once("error", (error: Error) => reject(error))
            const socket = connect(port, hostname, {}, () => {
                const connection = new TlsConnection(socket, orb)
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
    async listen(orb: ORB, hostname: string, port: number) {
        this.serverSocket = createServer(this.options, (socket: TLSSocket) => {
            const connection = new TlsConnection(socket, orb)
            connection.requestId = InitialResponderRequestIdBiDirectionalIIOP
            // socket.setNoDelay()
            socket.on("error", (error: Error) => orb.socketError(connection, error))
            socket.on("close", (hadError: boolean) => orb.socketClosed(connection))
            socket.on("data", (data: Buffer) => orb.socketRcvd(connection, data.buffer))
            orb.addConnection(connection)
        })
        return new Promise<void>( (resolve, reject) => {
            this.serverSocket!.listen(port, hostname, () => resolve())
        })
    }
    
    close(): void {
        if (this.serverSocket === undefined)
            throw Error(`internal error: close() without server socket`)
        this.serverSocket.close()
        this.serverSocket = undefined
    }
}

export class TlsConnection extends Connection {
    socket: TLSSocket

    constructor(socket: TLSSocket, orb: ORB) {
        super(orb)
        this.socket = socket
    }

    get peerCertificate() {
        return this.socket.getPeerCertificate()
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
