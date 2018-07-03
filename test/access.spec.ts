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
        this.name = name
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
        this.name = name
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
        clientA.registerStub("Server", stub.Server)
        let connectionA = mockConnection(serverORB, clientA)

        let objectA = await clientA.resolve("ServerA")
        let serverStub = stub.Server.narrow(objectA)

        // object published with bind can be accessed
        serverA.wasCalled = false
        serverB.wasCalled = false
        serverStub.call()
        expect(serverA.wasCalled).to.equal(true)
        expect(serverB.wasCalled).to.equal(false)

        serverStub.id = serverB.id

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
        serverORB.registerStub("Listener", stub.Listener)

        // setup client A
        let clientA = new client.ORB()
        clientA.registerStub("Server", stub.Server)
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
        expect(objectA.wasCalled).to.equal(true)

        // make an illegal call to the client
        objectAStub!.id = objectB.id

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
        clientA.registerStub("Server", stub.Server)
        clientA.registerStub("Listener", stub.Listener)
        let connectionA = mockConnection(serverORB, clientA)
        let serverStub = stub.Server.narrow(await clientA.resolve("Server"))

        let objectAStub = await serverStub.get("A")

        // make a legal call to the server
        objectA.wasCalled = false
        await objectAStub!.call()
        expect(objectA.wasCalled).to.equal(true)
        
        // make an illegal call to the client
        objectAStub.id = objectB.id

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
