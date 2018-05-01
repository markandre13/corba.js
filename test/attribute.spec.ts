import { expect } from "chai"

import * as server from "../src/orb/orb-nodejs"
import * as client from "../src/orb/orb"
import { Stub, Skeleton } from "../src/orb/orb"
import { Servant_skel } from "./attribute_skel"
import { Servant } from "./attribute_stub"
import { mockConnection } from "./util"

/*
class Servant_impl extends Servant_skel {
    constructor(orb: server.ORB) {
        super(orb)
    }
}
*/
xdescribe("attribute", function() {
    it("get value", function() {
/*
        let serverORB = new server.ORB()
        serverORB.register_initial_reference("Servant", new Servant_impl(serverORB))
            
        let clientORB = new client.ORB()
        clientORB.registerStub("Servant", Servant)
            
        mockConnection(serverORB, clientORB)
           
        let object = await clientORB.resolve_initial_references("Servant")
        let servant = Servant.narrow(object)
        expect(result).to.be.an.instanceof(Servant)
*/
    })
})
