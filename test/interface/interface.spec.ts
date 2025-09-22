import * as stub from "../generated/interface_stub"
import { Interface_impl, Peer_impl, PeerSub_impl } from "./interface_impl"

import { ORB } from "corba.js"
import { mockConnection } from "../util"

import { expect } from "chai"

describe("interface", function () {
    it("send'n receive", async function () {
        const serverORB = new ORB()
        const serverImpl = new Interface_impl(serverORB)
        serverORB.bind("Backend", serverImpl)
        serverORB.registerStubClass(stub.Peer)

        const clientORB = new ORB()
        clientORB.registerStubClass(stub.Interface)

        mockConnection(serverORB, clientORB)

        const object = await clientORB.stringToObject("corbaname::server:0#Backend")
        const serverStub = stub.Interface.narrow(object)

        expect(await serverStub.callBoolean(true)).to.equal(true)
        expect(await serverStub.callOctet(42)).to.equal(42)

        expect(await serverStub.callUShort(65535)).to.equal(65535)
        expect(await serverStub.callUnsignedLong(4294967295)).to.equal(4294967295)
        expect(await serverStub.callUnsignedLongLong(18446744073709551615n)).to.equal(18446744073709551615n)

        expect(await serverStub.callShort(-32768)).to.equal(-32768)
        expect(await serverStub.callLong(-2147483648)).to.equal(-2147483648)
        expect(await serverStub.callLongLong(-9223372036854775807n)).to.equal(-9223372036854775807n)

        expect(await serverStub.callFloat(3.402820018375656e38)).to.equal(3.402820018375656e38)
        expect(await serverStub.callDouble(4.94066e-324)).to.equal(4.94066e-324)

        expect(await serverStub.callString("hello")).to.equal("hello")

        const enc = new TextEncoder()
        expect(await serverStub.callBlob(enc.encode("hello"))).to.deep.equal(enc.encode("hello"))

        const floatArray = new Float32Array([3.1415, 2.7182])
        expect(await serverStub.callSeqFloat(floatArray)).to.deep.equal(floatArray)

        const doubleArray = new Float64Array([3.1415, 2.7182])
        expect(await serverStub.callSeqDouble(doubleArray)).to.deep.equal(doubleArray)

        expect(await serverStub.callSeqString(["alice", "bob"])).to.deep.equal(["alice", "bob"])

        expect(serverImpl.peer).to.be.undefined

        const frontend = new Peer_impl(clientORB)
        await serverStub.setPeer(frontend)
        expect(serverImpl.peer).to.be.not.undefined

        const frontendReturned = await serverStub.getPeer()
        expect(frontendReturned).is.equal(frontend)

        expect(await serverStub.callPeer("hello")).to.equal("hello to the world.")

        await serverStub.setPeer(undefined as any)
        expect(serverImpl.peer).to.be.undefined
    })
    it("inheritance", async function () {
        const serverORB = new ORB()
        const serverImpl = new Interface_impl(serverORB)
        serverORB.bind("Backend", serverImpl)
        serverORB.registerStubClass(stub.Peer)
        serverORB.registerStubClass(stub.PeerSub)

        const clientORB = new ORB()
        clientORB.registerStubClass(stub.Interface)

        mockConnection(serverORB, clientORB)
        const object = await clientORB.stringToObject("corbaname::server:0#Backend")
        const serverStub = stub.Interface.narrow(object)

        // instantiate PeerSub and set it in the server
        const frontend = new PeerSub_impl(clientORB)
        await serverStub.setPeer(frontend)

        // server as the PeerSub stub
        const peerStub = await serverImpl.getPeer()
        expect(peerStub).to.be.instanceOf(stub.PeerSub)
        const peerSubStub = peerStub as stub.PeerSub

        // call the method that should be inherited from Peer
        expect(await peerSubStub.callString("hello")).to.equal("hello world")

        // call the method that is added in PeerSub
        await peerSubStub.name("zick")
        expect(await peerSubStub.name()).to.equal("zick")
    })
})
