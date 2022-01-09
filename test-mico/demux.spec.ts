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

// NEXT STEPS
// [ ] demux.spec.ts contains a prototype for a stub implementation (ServerStub)
//     => let the IDL compiler generate it (write the code directly into the X_stub.ts)
// [ ] orb.ts socketRcvd() contains a hardcoded part to call ServerImpl
//     => let the IDL compiler generate it (here we need a data structure/object the orb can lookup)
//     write it into X_skel.ts, maybe as static data directly into the skeleton class
// [ ] orb.ts constains lots of json related code to be thrown away

// *.ts            interface
// *_value.ts      this was the place where we had the

import { use, expect } from "chai"
import chaiAsPromised from "chai-as-promised"
use(chaiAsPromised)

import { ORB } from "corba.js"

import * as _interface from "./demux"
import * as skel from "./demux_skel"
import * as stub from "./demux_stub"
import { listen, connect } from "../src/net/websocket"

// npm run test:demux:run
// rm -f lib/idl/idl.cjs ; npm run build:idl:build && ./bin/corba-idl --ts-all test-mico/demux.idl && cat test-mico/demux_stub.ts

class Server_impl extends skel.Server {
    onewayCall(a: number) {
        console.log(`Server_impl.onewayCall(${a})`)
    }
    async twowayCall(a: number) {
        console.log(`Server_impl.twowayCall(${a})`)
        return a + 5
    }
}

describe("multiplexer/demultiplexer", function () {
    xit("call ORB using GIOP", async function () {
        const serverORB = new ORB()
        serverORB.bind("Server", new Server_impl(serverORB))
        const serverWS = await listen(serverORB, 8080)

        const clientORB = new ORB()
        clientORB.registerStubClass(stub.Server)
        const clientWS = await connect(clientORB, "ws://localhost:8080/")

        const serverStub = stub.Server.narrow(await clientORB.resolve("Server"))
        serverStub.onewayCall(17)
        const x = await serverStub.twowayCall(42)
        console.log(`twowayCall(42) -> ${x}`)
        expect(x).equals(47)

        clientWS.close()
        serverWS.shutDown()
    })
})
