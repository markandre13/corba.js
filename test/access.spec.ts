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

import * as server from "../src/orb/orb-nodejs"
import * as client from "../src/orb/orb"
import * as iface from "./access"
import * as skel from "./access_skel"
import * as stub from "./access_stub"
import { mockConnection } from "./util"

class Server_impl extends skel.Server {
    name: string
    wasCalled: boolean
    listener: Map<string, iface.Listener>

    constructor(orb: server.ORB, name: string) {
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

    constructor(orb: server.ORB, name: string) {
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

describe("access", async function() {

    it("bind", async function() {

        // setup server
        let serverORB = new server.ORB()

        let serverA = new Server_impl(serverORB, "A")
        let serverB = new Server_impl(serverORB, "B")

        serverORB.bind("ServerA", serverA)

        // setup client A
        let clientA = new client.ORB()
        clientA.registerStubClass(stub.Server)
        let connectionA = mockConnection(serverORB, clientA)

        let objectA = await clientA.resolve("ServerA")
        let serverStub = stub.Server.narrow(objectA)

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
    
    it("object send to server", async function() {

        // setup server
        let serverORB = new server.ORB()

        let serverImpl = new Server_impl(serverORB, "S")

        serverORB.bind("Server", serverImpl)
        serverORB.registerStubClass(stub.Listener)

        // setup client A
        let clientA = new client.ORB()
        clientA.registerStubClass(stub.Server)
        let connectionA = mockConnection(serverORB, clientA)
        let serverStub = stub.Server.narrow(await clientA.resolve("Server"))
        let objectA = new Listener_impl(clientA, "A")
        let objectB = new Listener_impl(clientA, "B")
//connectionA.debug = 1
//clientA.debug = 1
        await serverStub.set(objectA)
        
        expect(serverImpl.listener.get("A")).not.to.equal(undefined)
        let objectAStub = serverImpl.listener.get("A") as stub.Listener
        
        // make a legal call to the client
        objectA.wasCalled = false
        await objectAStub!.call()
        expect(objectA.wasCalled).to.equal(true);

        // make an illegal call to the client
        (objectAStub as any).id = (objectB as any).id

        objectA.wasCalled = false
        objectB.wasCalled = false
        let error = undefined
        try {
            await objectAStub!.call()
        }
        catch(caughtError) {
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

    it("object received from server", async function() {

        // setup server
        let serverORB = new server.ORB()

        let serverImpl = new Server_impl(serverORB, "S")
        let objectA = new Listener_impl(serverORB, "A")
        let objectB = new Listener_impl(serverORB, "B")
        serverImpl.set(objectA)
        serverImpl.set(objectB)

        serverORB.bind("Server", serverImpl)

        // setup client A
        let clientA = new client.ORB()
        clientA.registerStubClass(stub.Server)
        clientA.registerStubClass(stub.Listener)
        let connectionA = mockConnection(serverORB, clientA)
        let serverStub = stub.Server.narrow(await clientA.resolve("Server"))

        let objectAStub = (await serverStub.get("A") as any) as skel.Listener

        // make a legal call to the server
        objectA.wasCalled = false
        await objectAStub!.call()
        expect(objectA.wasCalled).to.equal(true);
        
        // make an illegal call to the client
        (objectAStub as any).id = (objectB as any).id

        objectA.wasCalled = false
        objectB.wasCalled = false
        let error = undefined
        try {
            await objectAStub!.call()
        }
        catch(caughtError) {
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
