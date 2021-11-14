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

import { AuthenticationStatus, EstablishContext, GSSUPInitialContextToken, ORB } from "corba.js"
import { TlsConnection, TlsProtocol } from "corba.js/net/tls"
import { Connection } from "corba.js/orb/connection"
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
        it("TLS without client authentication", async function () {
            const serverORB = new ORB()

            const serverImpl = new Server_impl(serverORB)
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
            await tls.listen(serverORB, "localhost", 2810)

            const clientORB = new ORB()
            clientORB.registerStubClass(stub.Server)
            clientORB.addProtocol(new TlsProtocol())

            const server = stub.Server.narrow(await clientORB.stringToObject("corbaname::localhost:2810#Server"))
            await server.call()
            expect(serverImpl.wasCalled).to.be.true
        })

        // TLS with TLS client authentication

        // 
        it("TLS with CSIv2 GSSUP client authentication", async function () {
            const initialContext = new GSSUPInitialContextToken("mark", "topsecret", "")
            let sendInitialContext: GSSUPInitialContextToken | undefined
            let rcvdInitialContext: GSSUPInitialContextToken | undefined

            const clientORB = new ORB()
            clientORB.registerStubClass(stub.Server)
            clientORB.addProtocol(new TlsProtocol())

            clientORB.setOutgoingAuthenticator( (connection: Connection) => {
                if (connection instanceof TlsConnection) {
                    if (connection.peerCertificate.subject.CN === "localhost") {
                        sendInitialContext = initialContext
                        return sendInitialContext
                    }
                    return undefined
                }
            })

            const serverORB = new ORB()
            const serverImpl = new Server_impl(serverORB)
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

            serverORB.setIncomingAuthenticator( (connection: Connection, context: EstablishContext) => {
                if (context.authentication instanceof GSSUPInitialContextToken) {
                    if (context.authentication.user === "mark" &&
                       context.authentication.password === "topsecret" &&
                       context.authentication.target_name === "")
                    {
                        rcvdInitialContext = context.authentication
                        return AuthenticationStatus.SUCCESS;
                    }
                }
                return AuthenticationStatus.ERROR_UNSPECIFIED
            })
            await tls.listen(serverORB, "localhost", 2809)

            const server = stub.Server.narrow(await clientORB.stringToObject("corbaname::localhost:2809#Server"))
            expect(sendInitialContext).to.deep.equal(initialContext)
            expect(rcvdInitialContext).to.deep.equal(initialContext)

            await server.call()
            expect(serverImpl.wasCalled).to.be.true
        })

        // check failures

    })
})

class Server_impl extends skel.Server {
    wasCalled: boolean

    constructor(orb: ORB) {
        super(orb)
        this.wasCalled = false
    }

    async call() {
        this.wasCalled = true
        return 0
    }

    async set(listener: skel.Listener): Promise<number> {
        throw Error()
    }

    async get(name: string): Promise<skel.Listener> {
        throw Error()
    }
}

