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

import { Uint8Map } from "./uint8map"
import { ORB, Stub, PromiseHandler } from "./orb"

// For each connection established by the Protocol, it will register a Connection with the ORB.
export abstract class Connection {
    constructor(orb: ORB) {
        this.orb = orb
    }
    orb: ORB

    // request id's are per connection
    requestId: number = 0

    // bi-directional service context needs only to be send once
    didSendBiDirIIOP: boolean = false

    // stubs may contain OID received via this connection
    // TODO: WeakMap? refcount tests
    stubsById = new Uint8Map<Stub>()

    // replies to be send back over this connection
    // number: RequestId
    // WeakMap? refcount tests
    pendingReplies = new Map<number, PromiseHandler>()

    // CSIv2 context tokens received by the client
    // BigInt: ContextId
    initialContextTokens = new Map<BigInt, InitialContextToken>()

    abstract get localAddress(): string
    abstract get localPort(): number
    abstract get remoteAddress(): string
    abstract get remotePort(): number

    /**
     * if the connection is not connected, connect it to the remote peer
     */
    abstract connect(): Promise<void>
    abstract close(): void
    abstract send(buffer: ArrayBuffer): void
}

class InitialContextToken {
    username: string
    password: string
    target_name: string
    constructor(username: string, password: string, realm: string) {
        this.username = username
        this.password = password
        this.target_name = realm
    }
}
