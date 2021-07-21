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

import { Skeleton, Stub } from "../src/orb/orb"
import * as server from "../src/orb/orb-nodejs"
import * as client from "../src/orb/orb"
import * as skel from "./initialreferences_skel"
import * as stub from "./initialreferences_stub"
import { mockConnection } from "./util"

class Server_impl extends skel.Server {
    constructor(orb: server.ORB) {
        super(orb)
    }
}

class Client_impl extends skel.Server {
    constructor(orb: server.ORB) {
        super(orb)
    }
}

describe("initial references", function() {
    describe("bind()", function() {
        xit("will throw an exception on the client orb", function() {
            let clientORB = new client.ORB()
            let server = new Server_impl(clientORB)
            clientORB.bind("Server", server)
        })
        it("registering the same id twice will throw an error", function() {
            let serverORB = new server.ORB()
            let serve = new Server_impl(serverORB)
            serverORB.bind("Server", serve)
            expect(()=>{
                serverORB.bind("Server", serve)
            }).to.throw(Error)
        })
    })
    describe("list()", function() {
        it("returns the registered references on the server orb", async function() {
            let serverORB = new server.ORB()
            let serve = new Server_impl(serverORB)
            serverORB.bind("Server1", serve)
            serverORB.bind("Server2", serve)
            let result = await serverORB.list()
            expect(result.length).to.equal(2)
            expect(result[0]).to.equal("Server1")
            expect(result[1]).to.equal("Server2")
        })
        it("returns the registered references on the client orb", async function() {
            let serverORB = new server.ORB()
            let serve = new Server_impl(serverORB)
            serverORB.bind("Server1", serve)
            serverORB.bind("Server2", serve)
            
            let clientORB = new client.ORB()
            
            mockConnection(serverORB, clientORB)
            
            let result = await clientORB.list()
            expect(result.length).to.equal(2)
            expect(result[0]).to.equal("Server1")
            expect(result[1]).to.equal("Server2")
        })
    })
    describe("resolve()", function() {
        describe("will throw an error if the reference does not exist", function() {
            xit("on the server", async function() {
                let serverORB = new server.ORB()
                let serve = new Server_impl(serverORB)
                serverORB.bind("Server", serve)
            
                let clientORB = new client.ORB()
            
                mockConnection(serverORB, clientORB)
            
                let result = await serverORB.resolve("NoServer")
            })
            it("on the client", async function() {
                let serverORB = new server.ORB()
                let serve = new Server_impl(serverORB)
                serverORB.bind("Server", serve)
            
                let clientORB = new client.ORB()
                clientORB.registerStubClass(stub.Server)
            
                mockConnection(serverORB, clientORB)

                let error = undefined
                try {
                    let result = await clientORB.resolve("NoServer")
                }
                catch(caughtError) {
                    error = caughtError
                }
                expect(error).to.be.an.instanceof(Error)
                expect(error.message).to.equal("ORB.resolve('NoServer'): failed to resolve reference")
            })
        })
        describe("will return the object by that reference", function() {
            xit("as the implementation on the server", async function() {
                let serverORB = new server.ORB()
                let serve = new Server_impl(serverORB)
                serverORB.bind("Server", serve)
            
                let clientORB = new client.ORB()
            
                mockConnection(serverORB, clientORB)
            
                let result = await serverORB.resolve("Server")
                expect(result).to.be.an.instanceof(Skeleton)
            })
            it("as the stub on the client", async function() {
                let serverORB = new server.ORB()
                let serve = new Server_impl(serverORB)
                serverORB.bind("Server", serve)
            
                let clientORB = new client.ORB()
                clientORB.registerStubClass(stub.Server)
            
                mockConnection(serverORB, clientORB)
            
                let result = await clientORB.resolve("Server")
                expect(result).to.be.an.instanceof(stub.Server)
            })
        })
    })
    describe("the stub's narrow() function", function() {
        it("will throw an error object can not be type casted", async function() {
                let serverORB = new server.ORB()
                let serve = new Server_impl(serverORB)
                serverORB.bind("Server", serve)
            
                let clientORB = new client.ORB()
                clientORB.registerStubClass(stub.Server)
            
                mockConnection(serverORB, clientORB)
            
                let result = await clientORB.resolve("Server")
                expect(()=>{
                    stub.Client.narrow(result)
                }).to.throw(Error)
        })
        it("will return the type casted object", async function() {
                let serverORB = new server.ORB()
                let serve = new Server_impl(serverORB)
                serverORB.bind("Server", serve)
            
                let clientORB = new client.ORB()
                clientORB.registerStubClass(stub.Server)
            
                mockConnection(serverORB, clientORB)
            
                let result = await clientORB.resolve("Server")
                let localServer = stub.Server.narrow(result)
                expect(result).to.be.an.instanceof(stub.Server)
        })
    })
})
