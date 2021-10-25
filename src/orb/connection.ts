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
    // request id's a counted per connection
    orb: ORB
    requestId: number = 0
    // bi-directional service context needs only to be send once
    didSendBiDirIIOP: boolean = false
    stubsById = new Uint8Map<Stub>()
    map = new Map<number, PromiseHandler>()

    abstract get localAddress(): string
    abstract get localPort(): number
    abstract get remoteAddress(): string
    abstract get remotePort(): number

    abstract close(): void
    abstract send(buffer: ArrayBuffer): void
}
