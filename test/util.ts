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

export function mockConnection(server: ORB, client: ORB, verbose = false): ORB {

    const proto = new MockProtocol()

    server.name = "server"
    server.addProtocol(proto)
    const serverConn = new MockConnection(server, proto, 0, 1, verbose)
    proto.connections.push(serverConn)
    server.addConnection(serverConn)

    client.name = "client"
    client.addProtocol(proto)
    const clientConn = new MockConnection(client, proto, 1, 0, verbose)
    proto.connections.push(clientConn)
    client.addConnection(clientConn)

    return server
}

class MockProtocol implements Protocol {
    connections: MockConnection[] = []
    async connect(orb: ORB, hostname: string, port: number): Promise<Connection> {
        throw Error(`Unexpected call to MockProtocol.connect(${orb.name}, ${hostname}, ${port}): all connections should be initialized already`)
    }
    async close() {
    }
}

class MockConnection extends Connection {
    _localPort: number
    _remotePort: number
    protocol: MockProtocol
    verbose: boolean

    constructor(orb: ORB, protocol: MockProtocol, localPort: number, remotePort: number, verbose: boolean) {
        super(orb)
        this._localPort = localPort
        this._remotePort = remotePort
        this.protocol = protocol
        this.verbose = verbose
    }

    override get localAddress(): string {
        return "mock"
    }
    override get localPort(): number {
        return this._localPort
    }
    override get remoteAddress(): string {
        return "mock"
    }
    override get remotePort(): number {
        return this._remotePort
    }

    override async connect() {}
    override close() {}
    override send(buffer: ArrayBuffer): void {
        if (this.verbose) {
            console.log(`MockConnection.send(): orb=${this.orb.name} port ${this._localPort} to ${this._remotePort}`)
            hexdump(new Uint8Array(buffer))
        }
        const peer = this.protocol.connections[this._remotePort]
        peer.orb.socketRcvd(peer, buffer)
    }
}

export function hexdump(bytes: Uint8Array, addr = 0, length = bytes.byteLength) {
    while (addr < length) {
        let line = addr.toString(16).padStart(4, "0")
        for (let i = 0, j = addr; i < 16 && j < length; ++i, ++j)
            line += " " + bytes[j].toString(16).padStart(2, "0")
        line = line.padEnd(4 + 16 * 3 + 1, " ")
        for (let i = 0, j = addr; i < 16 && j < length; ++i, ++j) {
            const b = bytes[j]
            if (b >= 32 && b < 127)
                line += String.fromCharCode(b)
            else
                line += "."
        }
        addr += 16
        console.log(line)
    }
}

// convert the dump generated by hexdump()
export function parseHexDump(data: string): Uint8Array {
    const rows = data.trim().split(/\r?\n/)
    let vec: number[] = []
    for (let i = 0; i < rows.length; ++i) {
        const row = rows[i].trim()
        for (let j = 0; j < 16; ++j) {
            let n: number
            let idx = j * 3 + 5
            n = parseInt(row.substring(idx, idx + 2), 16)
            if (isNaN(n))
                break
            vec.push(n)
        }
    }
    return new Uint8Array(vec)
}

// parse the dump to Uint8Array one get's from OmniORB's -ORBtraceLevel 40
export function parseOmniDump(data: string): Uint8Array {
    const rows = data.trim().split(/\r?\n/)
    let vec: number[] = []
    for (let i = 0; i < rows.length; ++i) {
        const row = rows[i].trim()
        for (let j = 0; j < 8; ++j) {
            let n: number
            let idx = j * 5
            n = parseInt(row.substring(idx, idx + 2), 16)
            if (isNaN(n))
                break
            vec.push(n)
            n = parseInt(row.substring(idx + 2, idx + 5), 16)
            if (isNaN(n))
                break
            vec.push(n)
        }
    }
    return new Uint8Array(vec)
}
