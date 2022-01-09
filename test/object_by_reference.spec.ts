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
import * as iface from "./generated/object_by_reference"
import * as skel from "./generated/object_by_reference_skel"
import * as stub from "./generated/object_by_reference_stub"
import { mockConnection } from "./util"

describe("object by reference", function() {
    it("return value and argument", async function() {
        let serverORB = new ORB()
//serverORB.debug = 1
        serverORB.bind("Server", new Server_impl(serverORB))
        serverORB.registerStubClass(stub.Listener)
            
        let clientORB = new ORB()
//clientORB.debug = 1
        clientORB.registerStubClass(stub.Server)
        clientORB.registerStubClass(stub.Session)
            
        mockConnection(serverORB, clientORB)
           
        let object = stub.Server.narrow(await clientORB.stringToObject("corbaname::mock:0#Server"))
        let serverObject = stub.Server.narrow(object)
        
        let session = await serverObject.getSession()
        
        await session.addListener(new Listener_impl(clientORB))
        
        expect(Session_impl.listener).not.to.equal(undefined)
        
        await Session_impl.listener!.callback()
        
        expect(Listener_impl.calledBack).to.equal(true)
    })
})

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