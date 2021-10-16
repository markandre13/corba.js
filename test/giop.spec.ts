import * as fs from "fs"

import { ORB, IOR, GIOPDecoder, MessageType } from "corba.js"
import { connect, listen } from "corba.js/net/socket"
import * as skel from "./generated/giop_skel"
import * as stub from "./generated/giop_stub"
import * as value from "./generated/giop_value"
import { expect } from "chai"
import { Fake } from "./fake"

// FIXME: this test does not work when MICO runs in debug mode; something is racy

// WHAT'S NEXT:
// things to test with a real CORBA instance are basically for the validation of the GIOP
// send/receive arguments passed to method and result returned from method
// send/receive struct (as argument and return value. how do they differ from valuetypes in regard to GIOP?)
// send/receive sequence (as argument and return value)
// send/receive object reference (as argument and return value)
// send/receive value types with duplicated repositoryId as well as duplicated objects (aka multiple references to the same object)
// module, versioning
// cover all of the above with a recorded fake, server and client side
// to keep the IDL for this test small, we'll implement server and client on MICO side

// CLIENT GIOP LOCATE REQUEST
// 47 49 4f 50 01 00 01 03 16 00 00 00 02 00 00 00 GIOP............
// ^           ^     ^  ^  ^  ^
// |           |     |  |  |  requestId
// |           |     |  |  size
// |           |     |  message type: locate request(3)
// |           |     byte order
// |           GIOP version 1.0
// GIOP magic number
// 0e 00 00 00 fe 9a c2 65 61 00 00 11 4f 00 0 000 .......ea...O...
// ^
// object key
// 00 00                                           ..

// SERVER REPLY
// 47 49 4f 50 01 00 01 04 08 00 00 00 02 00 00 00 GIOP............
// ^           ^     ^  ^  ^  ^
// |           |     |  |  |  requestId
// |           |     |  |  size
// |           |     |  message type: locate reply(4)
// |           |     byte order
// |           GIOP version 1.0
// GIOP magic number

// 01 00 00 00                               ....
// locate status: OBJECT_HERE(1)

// CLIENT TWO MESSAGES IN ONE PACKET

// Object ID does not exist
// 0000 47 49 4f 50 01 00 01 00 28 00 00 00 00 00 00 00 GIOP....(.......
// 0010 01 00 00 00 00 00 00 00 00 00 00 00 0d 00 00 00 ................
// 0020 6f 6e 65 77 61 79 4d 65 74 68 6f 64 00 00 00 00 onewayMethod....
// 0030 00 00 00 00                                     ....

// Object ID correct
// 0000 47 49 4f 50 01 00 01 03 16 00 00 00 02 00 00 00 GIOP............
// 0010 0e 00 00 00 fe 17 35 67 61 00 00 04 39 00 00 00 ......5ga...9...
// 0020 00 00                                    ..
// omniORB: (4) 2021-10-13 20:36:34.584065: Handling a GIOP LOCATE_REQUEST.
// omniORB: (4) 2021-10-13 20:36:34.584085: sendChunk: to giop:tcp:[::ffff:192.168.1.105]:34656 20 bytes
// omniORB: (4) 2021-10-13 20:36:34.584095: 
// 4749 4f50 0100 0104 0800 0000 0200 0000 GIOP............
// 0100 0000                               ....
// onewayMethod
// omniORB: (4) 2021-10-13 20:36:34.584373: inputMessage: from giop:tcp:[::ffff:192.168.1.105]:34656 68 bytes
// omniORB: (4) 2021-10-13 20:36:34.584411: 
// 0000 47 49 4f 50 01 00 01 00 38 00 00 00 00 00 00 00 GIOP....8.......
//      ^           ^     ^  ^  ^           ^
//      |           |     |  |  |           serviceContextListLength
//      |           |     |  |  size
//      |           |     |  message type: request(0)
//      |           |     byte order
//      |           GIOP version 1.0
//      GIOP magic number
// 0010 04 00 00 00 00 17 35 67 0e 00 00 00 fe 17 35 67 ......5g......5g
//      ^           ^           ^           ^
//      |           |           |           object key
//      |           |           length object key
//      |           expected response: request(0)
//      request id
// 0020 61 00 00 04 39 00 00 00 00 00 68 65 0d 00 00 00 a...9.....he....
//                                       ^
// 0030 6f 6e 65 77 61 79 4d 65 74 68 6f 64 00 20 36 37 onewayMethod. 67
// 0040 00 00 00 00                               ....

describe("CDR/GIOP", () => {

    let ior!: IOR
    let orb!: ORB
    let server!: stub.GIOPTest
    let fake!: Fake

    beforeEach(function () {
        // fake.reset()
    })

    // FIXME: to make the tests independent of each other when using the fake, create a new ORB for each test so that the request counter is reset
    before(async function () {
        return
        orb = new ORB()
        ORB.registerValueType("Point", Point) // switch this to orb and use the full repository id so that we can use versioning later
        orb.registerStubClass(stub.GIOPTest)

        const data = fs.readFileSync("test/giop/IOR.txt").toString().trim()

        // this is how this would originally look like:
        //   const obj = orb.stringToObject(data)
        //   const server = Server::narrow(obj)
        // but since corba.js is not a full CORBA implementation, we'll do it like this:
        ior = new IOR(data)
        console.log("connecting  to")
        console.log(`ior.objectKey.length = ${ior.objectKey.length}`)
        console.log(ior.host)
        console.log(ior.port)
        console.log(ior.oid)
        // console.log(ior.objectKey)
        let hex = ""
        for (let i = 0; i < ior.objectKey.length; ++i) {
            hex += ior.objectKey.at(i)!.toString(16) + " "
        }
        console.log(`io.objectKey=${hex}`)
        fake = new Fake()

        // RECORD
        const serverSocket = listen(orb, "0.0.0.0", 8080)
        const clientSocket = await connect(orb, ior.host!, ior.port!)
        console.log("connected")

        // fake.record(orb, clientSocket)

        // REPLAY
        // fake.replay(orb)

        const obj = orb.iorToObject(ior)
        server = stub.GIOPTest.narrow(obj)
        hex = ""
        for (let i = 0; i < server.id.length; ++i) {
            hex += server.id.at(i)!.toString(16) + " "
        }
        console.log(`server.id=${hex}`)
    })

    it("oneway method", async function () {
        fake.expect(this.test!.fullTitle())
        server.onewayMethod()
        expect(await server.peek()).to.equal("onewayMethod")
    })

    // [X] keep the mico file locally but build and run them remotely
    // [X] implement a versatile network fake for corba.js
    //   [X] use a variant of connect which records and prints a hexdump, then use the dump to set an expectation
    //   [X] use the dump to test the server side
    //   [ ] wrap it all into one nice package
    // [ ] implement the server side (this also means the client side in C++)
    // [ ] implement any (just for fun, for this we also need the client side in C++ to see how it's done)
    // [ ] implement array
    // [ ] implement exceptions
    // [ ] find out where the race condition comes from in the tests, because of the await there shouldn't be one
    // [ ] add a watch mode to the idl compiler to ease testing

    // one test for each argument type (short, ushort, ... string, sequence, valuetype)
    // we send two values to verify the padding
    describe("send values", function () {

        it("bool", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendBool(false, true)
            expect(await server.peek()).to.equal("sendBool(false,true)")
        })

        // Corba 3.3, Part 1, 7.11.1.3 Char Type
        // IDL defines a char data type that is an 8-bit quantity that (1) encodes a single-byte character
        // from any byte-oriented code set, or (2) when used in an array, encodes a multi-byte character
        // from a multi-byte code set.
        // In other words, an implementation is free to use any code set internally for encoding character data,
        // though conversion to another form may be required for transmission.
        it("char", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendChar(0, 255)
            expect(await server.peek()).to.equal("sendChar(0,255)")
        })

        it("octet", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendOctet(0, 255)
            expect(await server.peek()).to.equal("sendOctet(0,255)")
        })

        it("short", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendShort(-80, 80)
            expect(await server.peek()).to.equal("sendShort(-80,80)")
        })

        it("unsigned short", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendUShort(0, 256)
            expect(await server.peek()).to.equal("sendUShort(0,256)")
        })

        it("long", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendLong(-80, 80)
            expect(await server.peek()).to.equal("sendLong(-80,80)")
        })

        it("unsigned long", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendULong(0, 256)
            expect(await server.peek()).to.equal("sendULong(0,256)")
        })

        it("long long", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendLongLong(-80n, 80n)
            expect(await server.peek()).to.equal("sendLongLong(-80,80)")
        })

        it("unsigned long long", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendULongLong(0n, 256n)
            expect(await server.peek()).to.equal("sendULongLong(0,256)")
        })

        it("float", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendFloat(-80, 80)
            expect(await server.peek()).to.equal("sendFloat(-80,80)")
        })

        it("double", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendDouble(-80, 80)
            expect(await server.peek()).to.equal("sendDouble(-80,80)")
        })

        it("string", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendString("hello", "you")
            expect(await server.peek()).to.equal("sendString(hello,you)")
        })

        it("sequence", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendSequence(["hello", "you"], [1138, 1984, 2001])
            expect(await server.peek()).to.equal("sendSequence([hello,you,],[1138,1984,2001,])")
        })

        it("value", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendValuePoint(new Point({ x: 20, y: 30 }))
            expect(await server.peek()).to.equal("sendValuePoint(Point(20,30))")
        })

        it("value (duplicate repository ID)", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendValuePoints(new Point({ x: 20, y: 30 }), new Point({ x: 40, y: 50 }))
            expect(await server.peek()).to.equal("sendValuePoints(Point(20,30),Point(40,50))")
        })

        it("value (duplicate object)", async function () {
            fake.expect(this.test!.fullTitle())
            const p = new Point({ x: 20, y: 30 })
            await server.sendValuePoints(p, p)
            expect(await server.peek()).to.equal("sendValuePoints(Point(20,30),Point(20,30)) // same object")
        })

        // // send a local object to the peer and check if he was able to call us
        // it("local object", async function() {
        //     // FIXME: this doesn't work yet because i assumed GIOP was bi-directional by design
        //     // BiDirectional was added in CORBA 2.4, but MICO implements CORBA 2.3, there's only an unused definition for the BiDirectional policy
        //     // OmniORB implements CORBA 2.6 along with BiDirectional GIOP
        //     // Orbit
        //     // GIOP is specified as one directional, for for BiDirectional are requestIds: client/initiator: even, server/receipient: odd requestIds

        //     fake.expect(this.test!.fullTitle())
        //     const small = new GIOPSmall(orb)
        //     await server.sendObject(small, "foo")
        //     expect(small.msg).to.equal("foo")
        // })

        // get a remote object from the peer and check if we were able to call him
        // it("remote object", async function() {
        //     // this does not work with the real orb because the host and port may be wrong
        //     fake.expect(this.test!.fullTitle())
        //     const obj = server.getObject()
        //     const small = stub.GIOPSmall.narrow(obj)
        //     small.call("GIOPSmall.call()")
        //     expect(await server.peek()).to.equal("GIOPSmall.call()")
        // })

        // send a remove object to the peer and check if he was able to call himself?

        // array

        // any
    })

    // one test for each return type (short, ushort, ... string, sequence, valuetype)

    // value type in and out
    // struct in and out
    // union ?

    // send object reference
    // get object reference

    describe("GIOP", function () {
        it.only("OmniORB, IIOP 1.2, LocateRequest", function () {
            const data = new Uint8Array([
                0x47, 0x49, 0x4f, 0x50, 0x01, 0x02, 0x01, 0x03, 0x20, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, // GIOP.... .......
                0x00, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0xff, 0x62, 0x69, 0x64, 0x69, 0x72, 0xfe, 0xec, // .........bidir..
                0xc3, 0x6a, 0x61, 0x01, 0x00, 0x0d, 0x6c, 0x00, 0x00, 0x00, 0x00, 0x00,                         // .ja...l.....
            ])
            const decoder = new GIOPDecoder(data.buffer)
            const messageType = decoder.scanGIOPHeader()
            console.log(MessageType[messageType])
        })
    })
})

class Point implements value.Point {
    x!: number
    y!: number

    constructor(init: Partial<Point>) {
        value.initPoint(this, init)
    }
    toString(): string {
        return "Point: x=" + this.x + ", y=" + this.y
    }
}

// class GIOPSmall extends skel.GIOPSmall {
//     msg = ""

//     constructor(orb: ORB) {
//         super(orb)
//         console.log("Client_impl.constructor()")
//     }

//     override async call(msg: string) {
//         this.msg = msg
//     }
// }

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}
