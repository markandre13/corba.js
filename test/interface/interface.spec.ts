import * as stub from "../generated/interface_stub"
import { Interface_impl } from "./interface_impl"

import { ORB } from "corba.js"
import { mockConnection } from "../util"

import { expect } from "chai"

describe("interface", function() {
    it("send'n receive", async function() {
        const serverORB = new ORB()
        serverORB.bind("Backend", new Interface_impl(serverORB))

        const clientORB = new ORB()
        clientORB.registerStubClass(stub.Interface)

        mockConnection(serverORB, clientORB)

        const object = await clientORB.stringToObject("corbaname::mock:0#Backend")
        const backend = stub.Interface.narrow(object)

        expect(await backend.callBoolean(true)).to.equal(true)
        expect(await backend.callOctet(42)).to.equal(42)

        expect(await backend.callUShort(65535)).to.equal(65535);
        expect(await backend.callUnsignedLong(4294967295)).to.equal(4294967295);
        expect(await backend.callUnsignedLongLong(18446744073709551615n)).to.equal(18446744073709551615n);

        expect(await backend.callShort(-32768)).to.equal(-32768);
        expect(await backend.callLong(-2147483648)).to.equal(-2147483648);
        expect(await backend.callLongLong(-9223372036854775807n)).to.equal(-9223372036854775807n);

        expect(await backend.callFloat(3.402820018375656e+38)).to.equal(3.402820018375656e+38);
        expect(await backend.callDouble(4.94066e-324)).to.equal(4.94066e-324);

        expect(await backend.callString("hello")).to.equal("hello");
    })
})
