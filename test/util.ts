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

import { Connection } from "corba.js/orb/connection"
import { Protocol } from "corba.js/orb/protocol"

export function mockConnection(server: ORB, client: ORB): ORB {

    const proto = new MockProtocol()

    server.name = "server"
    server.addProtocol(proto)
    const serverConn = new MockConnection(server, proto, 0, 1)
    proto.connections.push(serverConn)
    server.addConnection(serverConn)

    client.name = "client"
    client.addProtocol(proto)
    const clientConn = new MockConnection(client, proto, 1, 0)
    proto.connections.push(clientConn)
    client.addConnection(clientConn)

    return server
}

class MockProtocol implements Protocol {
    connections: MockConnection[] = []
    async connect(orb: ORB, hostname: string, port: number): Promise<Connection> {
        throw Error(`Unexpected call to MockProtocol.connect(${orb.name}, ${hostname}, ${port}): all connections should be initialized already`)
    }
}

class MockConnection extends Connection {
    _localPort: number
    _remotePort: number

    protocol: MockProtocol

    constructor(orb: ORB, protocol: MockProtocol, localPort: number, remotePort: number) {
        super(orb)
        this._localPort = localPort
        this._remotePort = remotePort
        this.protocol = protocol
    }

    get localAddress(): string {
        return "mock"
    }
    get localPort(): number {
        return this._localPort
    }
    get remoteAddress(): string {
        return "mock"
    }
    get remotePort(): number {
        return this._remotePort
    }

    close(): void {}
    send(buffer: ArrayBuffer): void {
        // console.log(`MockConnection.send(): orb=${this.orb.name} port ${this._localPort} to ${this._remotePort}`)
        const peer = this.protocol.connections[this._remotePort]
        peer.orb.socketRcvd(peer, buffer)
    }
}
