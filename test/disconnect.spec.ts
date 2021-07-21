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
import * as iface from "./disconnect"
import * as skel from "./disconnect_skel"
import * as stub from "./disconnect_stub"
import { mockConnection } from "./util"

class Server_impl extends skel.Server {
    async getSession(): Promise<skel.Session> {
        return new Session_impl(this.orb) // FIXME: this.orb is not guaranteed to point to the client connection? could the ORB be set later?
    }
}

class Session_impl extends skel.Session implements EventListenerObject {
    static listeners = new Set<iface.Listener>()
    listener?: iface.Listener

    handleEvent(event: Event) {
        if (event.type === "close") {
            if (this.listener) {
                Session_impl.listeners.delete(this.listener)
                this.listener = undefined
            }
        }
    }

    async addListener(listener: iface.Listener) {
        if (Session_impl.listeners.has(listener))
            return
        Session_impl.listeners.add(listener)
        
        this.listener = listener
        this.orb.addEventListener("close", this)
    }
    
    async removeListener(listener: iface.Listener) {

        expect(this.listener).to.equal(listener)

        if (!Session_impl.listeners.has(listener))
            return
        Session_impl.listeners.delete(listener)

        this.orb.removeEventListener("close", this)
        this.listener = undefined
    }
    
    async call() {
        for(let listener of Session_impl.listeners) {
            listener.callback()
        }
    }
}

class Listener_impl extends skel.Listener {
    calledBack: boolean
    
    constructor(orb: server.ORB) {
        super(orb)
        this.calledBack = false
    }

    async callback() {
        this.calledBack = true
    }
}

describe("disconnect", function() {
    it("connect and disconnect two clients to the server", async function() {

        // setup server
        let serverORB = new server.ORB()
//serverORB.debug = 1
        serverORB.bind("Server", new Server_impl(serverORB))
        serverORB.registerStubClass(stub.Listener)
        
        // setup client A
        let clientA = new client.ORB()
//clientA.debug = 1
        clientA.registerStubClass(stub.Server)
        clientA.registerStubClass(stub.Session)
        let connectionA = mockConnection(serverORB, clientA)
        
        let objectA = await clientA.resolve("Server")
        let serverObjectA = stub.Server.narrow(objectA)
        
        let sessionA = await serverObjectA.getSession()
        
        let listenerA = new Listener_impl(clientA)
        await sessionA.addListener(listenerA)

        // call
        listenerA.calledBack = false
        await sessionA.call()
        expect(listenerA.calledBack).to.equal(true)
        
        // setup client B
        let clientB = new client.ORB()
//clientB.debug = 1
        clientB.registerStubClass(stub.Server)
        clientB.registerStubClass(stub.Session)
        let connectionB = mockConnection(serverORB, clientB)
        
        let objectB = await clientB.resolve("Server")
        let serverObjectB = stub.Server.narrow(objectB)
        
        let sessionB = await serverObjectB.getSession()
        
        let listenerB = new Listener_impl(clientB)
        await sessionB.addListener(listenerB)

        // call
        listenerA.calledBack = false
        listenerB.calledBack = false
        await sessionB.call()
        expect(listenerA.calledBack).to.equal(true)
        expect(listenerB.calledBack).to.equal(true)

        // close A
        connectionA.dispatchEvent(new Event("close"))

        // call
        listenerA.calledBack = false
        listenerB.calledBack = false
        await sessionB.call()
        expect(listenerA.calledBack).to.equal(false)
        expect(listenerB.calledBack).to.equal(true)
        
        // close B
        connectionB.dispatchEvent(new Event("close"))
        
        // call
        listenerA.calledBack = false
        listenerB.calledBack = false
        await sessionB.call()
        expect(listenerA.calledBack).to.equal(false)
        expect(listenerB.calledBack).to.equal(false)
    })
})
