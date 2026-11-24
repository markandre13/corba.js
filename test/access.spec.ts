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

import { Server_stub, Listener_stub } from "./generated/access_stub"
import { Listener_skel, Server_skel, org as org_skel } from "./generated/access_skel"
import { expect } from "chai"

import { ORB } from "corba.js"
import { TcpProtocol } from "corba.js/net/tcp"
import * as iface from "./generated/access"
import { mockConnection } from "./util"

describe("access", async function () {

    describe("authentication", function () {
        // disabled: manual interop check. It listens on port 8080 for a JacORB client
        // and asserts nothing. The SAS/CSIv2 status is in CORBA.md
        xit("JacORB SAS", async function () {
            const orb = new ORB()

            // AUTHORIZATION
            // * The ACL restricts access to objects added to the NameService
            // * Before sending or returning an object, the app can check the attributes
            //   to decide whether to send or not to send the object to the peer.
            //   At this point the peer is guaranteed to be successfully authenticated.
            // * In case the object reference is send to the peer, it is added to the ACL.

            // AUTHENTICATION CLIENT SIDE
            // restrict sending credentials only to trusted/listed hosts (?)

            // authorizationToken // list
            // identityToken // one
            // authenticationToken // one
            // orb.addCredentials("remotehost", new GSSUPInitialContextToken("user", "password", "")) 

            // what when a connection goes down, is re-established and the ACL?
            // what about life time and garbage collection?
            // orb <-> object adapter <-> session with acl <-> connection
            // ...
            // safe the acl? indicate that the object needs to be fetched again?
            // oh oh... things are getting messy...
            // start thinking from the application perspective. how'd you do that without corba.js?
            // persist object and object keys... things are getting even messier...
            // => concentrate on workflow 1st, corba.js 2nd

            const tcp = new TcpProtocol()
            orb.addProtocol(tcp)
            tcp.listen(orb, "0.0.0.0", 8080)

            const servant = new SASDemo_impl(orb)
            orb.bind("Server", servant)
        })
    })

    describe("authorization", function () {

        // disabled: needs SecurityCurrent and an authenticator on the server,
        // which are not implemented (see "Not implemented" in CORBA.md)
        xit("bind", async function () {

            // setup server
            let serverORB = new ORB()

            let serverA = new Server_impl(serverORB, "A")
            let serverB = new Server_impl(serverORB, "B")

            serverORB.bind("ServerA", serverA)

            // setup client A
            let clientA = new ORB()
            clientA.registerStubClass(Server_stub)

            // // server side
            // const securityServerA = SecurityCurrent.narrow(serverA.resolveInitialReferences("SecurityCurrent"))
            // securityServerA.setAuthenticator(new class extends Authenticator {
            //     override authenticate(initialContextToken: InitialContextToken) {
            //         return AuthenticationStatus.SUCCESS
            //     }
            //     override assertIdentity(identityToken: IdentityToken): boolean {
            //         return true
            //     }
            // }())
            // const poa = POA.narrow(serverA.resolve_initial_references("RootPOA"))
            // // set poa policy to IdAssignmentPolicyValue.USER_ID

            // // client side
            // const securityClientA = SecurityCurrent.narrow(clientA.resolveInitialReferences("SecurityCurrent"))
            // const securityContext = securityClientA.newContext()
            // securityContext.setInitialContextToken(securityClientA.createInitialContextToken("user", "password", "192.168.1.1"))
            // securityClientA.setORBContext(securityContext)

            mockConnection(serverORB, clientA)

            let objectA = await clientA.resolve("ServerA")
            let serverStub = Server_stub.narrow(objectA)

            // object published with bind can be accessed
            serverA.wasCalled = false
            serverB.wasCalled = false
            serverStub.call()
            expect(serverA.wasCalled).to.equal(true)
            expect(serverB.wasCalled).to.equal(false);

            (serverStub as any).id = (serverB as any).id

            // object not published with bind can not be accessed
            serverA.wasCalled = false
            serverB.wasCalled = false
            serverStub.call()
            expect(serverA.wasCalled).to.equal(false)
            expect(serverB.wasCalled).to.equal(false)

            serverORB.bind("ServerB", serverB)

            // object not resolved with resolve can not be accessed
            serverA.wasCalled = false
            serverB.wasCalled = false
            serverStub.call()
            expect(serverA.wasCalled).to.equal(false)
            expect(serverB.wasCalled).to.equal(false)

            // check the validity of the tweaked serverStub.id
            await clientA.resolve("ServerB")

            serverA.wasCalled = false
            serverB.wasCalled = false
            serverStub.call()
            expect(serverA.wasCalled).to.equal(false)
            expect(serverB.wasCalled).to.equal(true)
        })

        // disabled: needs access control (ACL) for objects, which is not implemented
        // (see "Not implemented" in CORBA.md)
        xit("object send to server", async function () {

            // setup server
            let serverORB = new ORB()

            let serverImpl = new Server_impl(serverORB, "S")

            serverORB.bind("Server", serverImpl)
            serverORB.registerStubClass(Listener_stub)

            // setup client A
            let clientA = new ORB()
            clientA.registerStubClass(Server_stub)
            let connectionA = mockConnection(serverORB, clientA)
            let serverStub = Server_stub.narrow(await clientA.resolve("Server"))
            let objectA = new Listener_impl(clientA, "A")
            let objectB = new Listener_impl(clientA, "B")
            //connectionA.debug = 1
            //clientA.debug = 1
            await serverStub.set(objectA)

            expect(serverImpl.listener.get("A")).not.to.equal(undefined)
            let objectAStub = serverImpl.listener.get("A") as Listener_stub

            // make a legal call to the client
            objectA.wasCalled = false
            await objectAStub!.call()
            expect(objectA.wasCalled).to.equal(true);

            // make an illegal call to the client
            (objectAStub as any).id = (objectB as any).id

            objectA.wasCalled = false
            objectB.wasCalled = false
            let error: any = undefined
            try {
                await objectAStub!.call()
            }
            catch (caughtError) {
                error = caughtError
            }
            expect(error).to.be.an.instanceof(Error)
            expect(error.message).to.equal("ORB.handleMethod(): client required method 'call' on server but has no rights to access servant with id 2")
            expect(objectA.wasCalled).to.equal(false)
            expect(objectB.wasCalled).to.equal(false)

            // make the tweaked stub legal
            await serverStub.set(objectB)

            // make a legal call to the client
            objectA.wasCalled = false
            objectB.wasCalled = false
            await objectAStub!.call()
            expect(objectA.wasCalled).to.equal(false)
            expect(objectB.wasCalled).to.equal(true)
        })

        // disabled: needs access control (ACL) for objects, which is not implemented
        // (see "Not implemented" in CORBA.md)
        xit("object received from server", async function () {

            // setup server
            let serverORB = new ORB()

            let serverImpl = new Server_impl(serverORB, "S")
            let objectA = new Listener_impl(serverORB, "A")
            let objectB = new Listener_impl(serverORB, "B")
            serverImpl.set(objectA)
            serverImpl.set(objectB)

            serverORB.bind("Server", serverImpl)

            // setup client A
            let clientA = new ORB()
            clientA.registerStubClass(Server_stub)
            clientA.registerStubClass(Listener_stub)
            let connectionA = mockConnection(serverORB, clientA)
            let serverStub = Server_stub.narrow(await clientA.resolve("Server"))

            let objectAStub = (await serverStub.get("A") as any) as Listener_skel

            // make a legal call to the server
            objectA.wasCalled = false
            await objectAStub!.call()
            expect(objectA.wasCalled).to.equal(true);

            // make an illegal call to the client
            (objectAStub as any).id = (objectB as any).id

            objectA.wasCalled = false
            objectB.wasCalled = false
            let error: any = undefined
            try {
                await objectAStub!.call()
            }
            catch (caughtError) {
                error = caughtError
            }
            expect(objectA.wasCalled).to.equal(false)
            expect(objectB.wasCalled).to.equal(false)

            expect(error).to.be.an.instanceof(Error)
            expect(error.message).to.equal("ORB.handleMethod(): client required method 'call' on server but has no rights to access servant with id 3")

            // make the tweaked stub legal
            let objectBStub = await serverStub.get("B")

            // make a legal call to the server
            objectA.wasCalled = false
            objectB.wasCalled = false
            await objectAStub!.call()
            expect(objectA.wasCalled).to.equal(false)
            expect(objectB.wasCalled).to.equal(true)
        })
    })
})

class SASDemo_impl extends org_skel.jacorb.demo.sas.SASDemo_skel {
    async printSAS() {
        console.log("===============> printSAS")
    }
    async shutdown() {
        console.log("===============> shutdown")
    }
}

class Server_impl extends Server_skel {
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
        // this.name = "XXX"
        this.wasCalled = true
        return 0
    }

    async set(listener: Listener_skel) {
        let name = await listener.getName()
        this.listener.set(name, listener)
        return 0
    }

    async get(name: string) {
        return this.listener.get(name) as Listener_skel
    }
}

class Listener_impl extends Listener_skel {
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
