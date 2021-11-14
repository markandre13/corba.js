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

import { expect } from "chai"

import { ORB } from "corba.js"
import { TlsProtocol } from "corba.js/net/tls"
import { readFileSync} from "fs"

import * as iface from "../generated/access"
import * as skel from "../generated/access_skel"
import * as stub from "../generated/access_stub"

// import { Connection } from "corba.js/orb/connection"
// import * as iface from "./generated/access"
// import * as skel from "./generated/access_skel"
// import * as stub from "./generated/access_stub"
// import { mockConnection } from "./util"

describe("net", async function () {
    describe("tls", function () {
        it.only("server and client", async function () {
            const serverORB = new ORB()
            const serverImpl = new Server_impl(serverORB, "S")
            serverORB.bind("Server", serverImpl)

            const tls = new TlsProtocol({
                passphrase: "alice",
                key: readFileSync('test/x509/intermediate/private/server.key.pem'),
                cert: readFileSync('test/x509/intermediate/certs/server.cert.pem'),
                ca: [ 
                    readFileSync('test/x509/intermediate/certs/ca-chain.cert.pem'),
                ]
            })
            serverORB.addProtocol(tls)
            await tls.listen(serverORB, "localhost", 2809)

            const clientORB = new ORB()
            clientORB.registerStubClass(stub.Server)
            clientORB.addProtocol(new TlsProtocol())

            const server = stub.Server.narrow(await clientORB.stringToObject("corbaname::localhost:2809#Server"))
            await server.call()
            expect(serverImpl.wasCalled).to.be.true

            // const servant = new SASDemo_impl(orb)
            // orb.bind("Server", servant)
        })
    })
})

class Server_impl extends skel.Server {
    name: string
    wasCalled: boolean
    listener: Map<string, iface.Listener>

    constructor(orb: ORB, name: string) {
        super(orb)
        this.name = name
        this.wasCalled = false
        this.listener = new Map<string, iface.Listener>()
    }

    async call() {
        this.wasCalled = true
        return 0
    }

    async set(listener: skel.Listener) {
        let name = await listener.getName()
        this.listener.set(name, listener)
        return 0
    }

    async get(name: string) {
        return this.listener.get(name) as skel.Listener
    }
}

class Listener_impl extends skel.Listener {
    name: string
    wasCalled: boolean

    constructor(orb: ORB, name: string) {
        super(orb)
        this.name = name
        this.wasCalled = false
    }

    async getName() {
        return this.name
    }

    async call() {
        // this.name = name
        this.wasCalled = true
        return 0
    }
}
