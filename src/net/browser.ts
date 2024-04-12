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

import { ORB } from "../orb/orb"
import { Connection } from "../orb/connection"
import { Protocol } from "../orb/protocol"

export class WsProtocol implements Protocol {
    id = crypto.randomUUID()

    // called by the ORB
    async connect(orb: ORB, host: string, port: number) {
        return new Promise<Connection>((resolve, reject) => {
            const socket = new WebSocket(`ws://${host}:${port}`)
            socket.binaryType = "arraybuffer"
            const connection = new WsConnection(orb, socket, host, port, this.id)
            orb.addConnection(connection)
            socket.onopen = () => {
                socket.onmessage = async (msg: MessageEvent) => {
                    if (msg.data instanceof Blob) {
                        orb.socketRcvd(connection, await msg.data.arrayBuffer())
                    } else {
                        orb.socketRcvd(connection, msg.data)
                    }
                }
                socket.onerror = (event: Event) => {
                    orb.socketError(connection, 
                        new Error(`WebSocket connection error with ${socket.url}`)
                    )
                }
                socket.onclose = (event: CloseEvent) => orb.socketClosed(connection)   
                resolve(connection)
            }
            socket.onerror = (event: Event) => {
                reject(new Error(`Failed to connect to ${socket.url}`))
            }
        })
    }
    async close() { }
}

class WsConnection extends Connection {
    private socket: WebSocket
    private host: string
    private port: number
    private id: string

    constructor(orb: ORB, socket: WebSocket, host: string, port: number, id: string) {
        super(orb)
        this.socket = socket
        this.host = host
        this.port = port
        this.id = id
    }

    get localAddress(): string {
        return this.id
    }
    get localPort(): number {
        return 1234
    }
    get remoteAddress(): string {
        return this.host
    }
    get remotePort(): number {
        return this.port
    }

    close() {
        this.socket.close()
    }
    send(buffer: ArrayBuffer): void {
        this.socket.send(buffer)
    }
}
