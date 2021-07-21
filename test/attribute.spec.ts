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

/*
import * as server from "../src/orb/orb-nodejs"
import * as client from "../src/orb/orb"
import { Stub, Skeleton } from "../src/orb/orb"
import { Servant_skel } from "./attribute_skel"
import { Servant } from "./attribute_stub"
import { mockConnection } from "./util"

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
        serverORB.bind("Servant", new Servant_impl(serverORB))
            
        let clientORB = new client.ORB()
        clientORB.registerStubClass(Servant)
            
        mockConnection(serverORB, clientORB)
           
        let object = await clientORB.resolve("Servant")
        let servant = Servant.narrow(object)
        expect(result).to.be.an.instanceof(Servant)
*/
    })
})
