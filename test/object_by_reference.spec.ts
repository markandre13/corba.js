import { expect } from "chai"

import * as server from "../src/orb/orb-nodejs"
import * as client from "../src/orb/orb"
import * as iface from "./object_by_reference"
import * as skel from "./object_by_reference_skel"
import * as stub from "./object_by_reference_stub"
import { mockConnection } from "./util"

class Server_impl extends skel.Server {
    async getSession(): Promise<skel.Session> {
        return new Session_impl(this.orb) // FIXME: this.orb is not guaranteed to point to the client connection? could the ORB be set later?
    }
}

class Session_impl extends skel.Session {
    static listener: iface.Listener | undefined

    async addListener(listener: iface.Listener) {
        Session_impl.listener = listener
    }
}

class Listener_impl extends skel.Listener {
    static calledBack = false

    async callback() {
        Listener_impl.calledBack = true
    }
}

describe("object by reference", function() {
    it("return value and argument", async function() {
        let serverORB = new server.ORB()
//serverORB.debug = 1
        serverORB.register_initial_reference("Server", new Server_impl(serverORB)) // FIXME: orb.bind() instead?
        serverORB.registerStub("Listener", stub.Listener)
            
        let clientORB = new client.ORB()
//clientORB.debug = 1
        clientORB.registerStub("Server", stub.Server) // FIXME: do we still want the name when stubs have a _idlClassName() method?
        clientORB.registerStub("Session", stub.Session)
            
        mockConnection(serverORB, clientORB)
           
        let object = await clientORB.resolve_initial_references("Server") // FIXME: just resolve?
        let serverObject = stub.Server.narrow(object)
        
        let session = await serverObject.getSession()
        
        await session.addListener(new Listener_impl(clientORB))
        
        expect(Session_impl.listener).not.to.equal(undefined)
        
        await Session_impl.listener!.callback()
        
        expect(Listener_impl.calledBack).to.equal(true)
    })
})
