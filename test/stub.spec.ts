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
import * as skel from "./generated/stub_skel"
import * as stub from "./generated/stub_stub"
import { mockConnection } from "./util"

describe("stub", function() {
    it("the client won't create another object on the server when receiving an object reference", async function() {

        let serverORB = new ORB()
//serverORB.debug = 1
        let clientORB = new ORB()
//clientORB.debug = 1

        serverORB.bind("Server", new Server_impl(serverORB))
        clientORB.registerStubClass(stub.Server)
        clientORB.registerStubClass(stub.Data)

        mockConnection(serverORB, clientORB)

        // client creates server stub which lets server create it's client stub
        let server = stub.Server.narrow(await clientORB.stringToObject("corbaname::mock:0#Server"))
        let data = await server.getData()
        data.hello()
        expect(Data_impl.numberOfInstances).to.equal(1)
    })
    
    it("passing the same implementation twice will create only one stub", async function() {
        let serverORB = new ORB()
//serverORB.debug = 1
        let clientORB = new ORB()
//clientORB.debug = 1

        serverORB.bind("Server", new Server_impl(serverORB))
        clientORB.registerStubClass(stub.Server)
        serverORB.registerStubClass(stub.Data)

        mockConnection(serverORB, clientORB)

        // client creates server stub which lets server create it's client stub
        let server = stub.Server.narrow(await clientORB.stringToObject("corbaname::mock:0#Server"))

        let data = new Data_impl(clientORB)
        Server_impl.dataCounter = 0
        Server_impl.data.clear()
        server.setData(data)
        server.setData(data)
        
        expect(Server_impl.dataCounter).to.equal(2)
        expect(Server_impl.data.size).to.equal(1)
    })

    it("releasing a stub will relase the ORBs internal stub entry", async function() {
        let serverORB = new ORB()
//serverORB.debug = 1
        let clientORB = new ORB()
//clientORB.debug = 1

        serverORB.bind("Server", new Server_impl(serverORB))
        clientORB.registerStubClass(stub.Server)
        serverORB.registerStubClass(stub.Data)

        mockConnection(serverORB, clientORB)

        // client creates server stub which lets server create it's client stub
        let server = stub.Server.narrow(await clientORB.stringToObject("corbaname::mock:0#Server"))

        let data = new Data_impl(clientORB)
        // expect(serverORB.stubsById.size).to.equal(0)
        Server_impl.dataCounter = 0
        Server_impl.data.clear()
        server.setData(data)
        server.setData(data)
        // expect(serverORB.stubsById.size).to.equal(1)
        
        expect(Server_impl.dataCounter).to.equal(2)
        expect(Server_impl.data.size).to.equal(1)
        
        for(let stub of Server_impl.data)
            stub.release()
        // expect(serverORB.stubsById.size).to.equal(0)
    })
})

class Data_impl extends skel.Data {
    static numberOfInstances = 0

    constructor(orb: ORB) {
        super(orb)
//console.log("Data_impl.constructor(): id="+this.id)
        ++Data_impl.numberOfInstances
    }
    
    async hello() {
//console.log("Data_impl.hello()")
    }
}

class Server_impl extends skel.Server {
    static data = new Set<stub.Data>()
    static dataCounter = 0

    constructor(orb: ORB) {
        super(orb)
//console.log("Server_impl.constructor(): id="+this.id)
    }

    async getData() {
//console.log("Server_impl.getData()")
        let data = new Data_impl(this.orb)
//console.log("Server_impl.getData(): created Data_impl() with id "+data.id)
        return data
    }
    
    async setData(data: stub.Data) {
        ++Server_impl.dataCounter
        Server_impl.data.add(data)
        return 0
    }
}