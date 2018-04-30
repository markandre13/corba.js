import { expect } from "chai"

import { ORB } from "../src/orb/orb-nodejs"
import { Server_skel, Data_skel } from "./stub_skel"
import { Server, Data } from "./stub_stub"

class Data_impl extends Data_skel {
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

class Server_impl extends Server_skel {
    constructor(orb: ORB) {
        super(orb)
//console.log("Server_impl.constructor(): id="+this.id)
    }

    async getData() {
//console.log("Server_impl.getData()")
        let data = new Data_impl(this.orb)
//console.log("Server_impl.getData(): created Data_impl() with id "+data.id)
        return data._this()
    }
}

describe("corba.js", function() {
    it("the client won't create another object on the server when receiving an object reference", async function() {

        let serverORB = new ORB()
//serverORB.debug = 1
        let clientORB = new ORB()
//clientORB.debug = 1

        serverORB.register("Server", Server_impl)
        serverORB.register("Data", Data_impl)
        clientORB.registerStub("Data", Data)

        // mock network connection between server and client ORB
        serverORB.socket = {
            send: function(data: any) {
                clientORB.socket!.onmessage({data:data} as any)
            }
        } as any
        serverORB.accept()

        clientORB.socket = {
            send: function(data: any) {
                serverORB.socket!.onmessage({data:data} as any)
            }
        } as any

        // client creates server stub which lets server create it's client stub
        let server = new Server(clientORB)
        let data = await server.getData()
        data.hello()
        expect(Data_impl.numberOfInstances).to.equal(1)
    })
})
