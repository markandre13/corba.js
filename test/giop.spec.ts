import * as fs from "fs"

import { ORB, IOR, GIOPDecoder, MessageType, LocateStatusType, ReplyStatus, GIOPEncoder } from "corba.js"
import { connect, listen } from "corba.js/net/socket"
import * as api from "./generated/giop"
import * as skel from "./generated/giop_skel"
import * as stub from "./generated/giop_stub"
import * as value from "./generated/giop_value"
import { expect } from "chai"
import { Fake } from "./fake"

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

describe("CDR/GIOP", () => {

    let ior!: IOR
    let orb!: ORB
    let server!: api.GIOPTest
    let myserver!: api.GIOPTest

    let fake!: Fake

    beforeEach(function () {
        fake.reset()
    })

    // FIXME: to make the tests independent of each other when using the fake, create a new ORB for each test so that the request counter is reset
    before(async function () {
        // return
        orb = new ORB()
        // TODO: switch this to orb and use the full repository id so that we can use versioning later
        ORB.registerValueType("Point", Point)
        ORB.registerValueType("NamedPoint", NamedPoint)
        orb.registerStubClass(stub.GIOPTest)
        orb.registerStubClass(stub.GIOPSmall)

        const data = fs.readFileSync("test/giop/IOR.txt").toString().trim()

        // this is how this would originally look like:
        //   const obj = orb.stringToObject(data)
        //   const server = Server::narrow(obj)
        // but since corba.js is not a full CORBA implementation, we'll do it like this:
        ior = new IOR(data)
        fake = new Fake()

        if (true) {
            // RECORD
            const serverSocket = listen(orb, "0.0.0.0", 8080)
            const clientSocket = await connect(orb, ior.host!, ior.port!)
            console.log("connected")
            fake.record(orb, clientSocket)
        } else {
            // REPLAY
            orb.localAddress = "192.168.1.10"
            orb.localPort = 52846
            fake.replay(orb)
        }

        const obj = orb.iorToObject(ior)
        server = stub.GIOPTest.narrow(obj)

        myserver = new GIOPTest_impl(orb)
    })

    it("oneway method", async function () {
        fake.expect(this.test!.fullTitle())
        server.onewayMethod()
        expect(await server.peek()).to.equal("onewayMethod")
    })

    // one test for each argument type (short, ushort, ... string, sequence, valuetype)
    // we send two values to verify the padding
    // TODO: let the methods also return a value and call this section 'outgoing calls' and remove the 'CDR' from this test suite

    // these cover the encoder
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
            await server.sendShort(-32768, 32767)
            expect(await server.peek()).to.equal("sendShort(-32768,32767)")
        })

        it("unsigned short", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendUShort(0, 65535)
            expect(await server.peek()).to.equal("sendUShort(0,65535)")
        })

        it("long", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendLong(-2147483648, 2147483647)
            expect(await server.peek()).to.equal("sendLong(-2147483648,2147483647)")
        })

        it("unsigned long", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendULong(0, 4294967295)
            expect(await server.peek()).to.equal("sendULong(0,4294967295)")
        })

        it("long long", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendLongLong(-9223372036854775808n, 9223372036854775807n)
            expect(await server.peek()).to.equal("sendLongLong(-9223372036854775808,9223372036854775807)")
        })

        it("unsigned long long", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendULongLong(0n, 18446744073709551615n)
            expect(await server.peek()).to.equal("sendULongLong(0,18446744073709551615)")
        })

        it("float", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendFloat(1.17549e-38, 3.40282e+38)
            expect(await server.peek()).to.equal("sendFloat(1.17549e-38,3.40282e+38)")
        })

        it("double", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendDouble(4.94066e-324, 1.79769e+308)
            expect(await server.peek()).to.equal("sendDouble(4.94066e-324,1.79769e+308)")
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

        // send a local object to the peer and check if he was able to call us
        it("send local object", async function () {
            fake.expect(this.test!.fullTitle())
            const small = new GIOPSmall(orb)
            await server.sendObject(small, "foo")
            expect(small.msg).to.equal("foo")
        })

        // get a remote object from the peer and check if we were able to call him
        it("get remote object", async function () {
            // this does not work with the real orb because the host and port may be wrong
            fake.expect(this.test!.fullTitle())
            const obj = await server.getObject()
            const small = stub.GIOPSmall.narrow(obj)
            small.call("GIOPSmall.call()")
            expect(await server.peek()).to.equal("GIOPSmall.call()")
        })

        it("send local object and get it back")
        // send it, get it back, call it, check if it was executed locally

        it("get remote object and send it back")
        // get it, send it back, let peer call itself, check if it was executed run the peer

        // array
        // union
        // anytype

        // any
    })

    // these cover the decoder
    describe("receive values", function () {

        it("bool", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_BOOL)
            expect(await myserver.peek()).to.equal("sendBool(false,true)")
        })

        it("char", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_CHAR)
            expect(await myserver.peek()).to.equal("sendChar(0,255)")
        })

        it("octet", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_OCTET)
            expect(await myserver.peek()).to.equal("sendOctet(0,255)")
        })

        it("short", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_SHORT)
            expect(await myserver.peek()).to.equal("sendShort(-32768,32767)")
        })

        it("ushort", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_USHORT)
            expect(await myserver.peek()).to.equal("sendUShort(0,65535)")
        })

        it("long", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_LONG)
            expect(await myserver.peek()).to.equal("sendLong(-2147483648,2147483647)")
        })

        it("ulong", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_ULONG)
            expect(await myserver.peek()).to.equal("sendULong(0,4294967295)")
        })

        it("longlong", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_LONGLONG)
            expect(await myserver.peek()).to.equal("sendLongLong(-9223372036854775808,9223372036854775807)")
        })

        it("ulonglong", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_ULONGLONG)
            expect(await myserver.peek()).to.equal("sendULongLong(0,18446744073709551615)")
        })

        it("float", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_FLOAT)
            expect(await myserver.peek()).to.equal("sendFloat(1.1754900067970481e-38,3.402820018375656e+38)")
        })

        it("double", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_DOUBLE)
            expect(await myserver.peek()).to.equal("sendDouble(5e-324,1.79769e+308)")
        })

        it("string", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_STRING)
            expect(await myserver.peek()).to.equal("sendString(hello,you)")
        })

        it("sequence", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_SEQUENCE)
            expect(await myserver.peek()).to.equal("sendSequence([hello,you,],[1138,1984,2001,])")
        })

        it("value", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_VALUE)
            expect(await myserver.peek()).to.equal("sendValuePoint(Point(20,30))")
        })

        it("subclassed value", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_SUBCLASSED_VALUE)
            expect(await myserver.peek()).to.equal(`sendValuePoint(NamedPoint(40,50,"foo"))`)
        })
    })

    // one test for each return type (short, ushort, ... string, sequence, valuetype)

    // value type in and out
    // struct in and out
    // union ?

    // send object reference
    // get object reference

    describe("GIOP", function () {
        describe("GIOPDecoder", function () {
            describe("Decode OmniORB, IIOP 1.2", function () {
                it("OmniORB, IIOP 1.2, LocateRequest", function () {
                    const data = parseOmniDump(`
                        4749 4f50 0102 0103 2000 0000 0200 0000 GIOP.... .......
                        0000 0000 1400 0000 ff62 6964 6972 fe97 .........bidir..
                        c46b 6101 000f 5700 0000 0000           .ka...W.....`)
                    const decoder = new GIOPDecoder(data.buffer)

                    const type = decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(type)
                    expect(decoder.type).to.equal(MessageType.LOCATE_REQUEST)
                    expect(decoder.majorVersion).to.equal(1)
                    expect(decoder.minorVersion).to.equal(2)
                    expect(decoder.length + 12).to.equal(data.length)

                    const locateRequest = decoder.scanLocateRequest()
                    expect(locateRequest.requestId).to.equal(2)
                    expect(locateRequest.objectKey).to.eql(data.subarray(24, 24 + 20))
                })

                it("OmniORB, IIOP 1.2, LocateReply", function () {
                    const data = parseOmniDump(`
                        4749 4f50 0102 0104 0800 0000 0200 0000 GIOP............
                        0100 0000                               ....`)
                    const decoder = new GIOPDecoder(data.buffer)

                    const type = decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(type)
                    expect(decoder.type).to.equal(MessageType.LOCATE_REPLY)
                    expect(decoder.majorVersion).to.equal(1)
                    expect(decoder.minorVersion).to.equal(2)
                    expect(decoder.length + 12).to.equal(data.length)

                    const locateReply = decoder.scanLocateReply()
                    expect(locateReply.requestId).to.equal(2)
                    expect(locateReply.status).to.equal(LocateStatusType.OBJECT_HERE)
                })

                it("OmniORB, IIOP 1.2, Request", function () {
                    const data = parseOmniDump(`
                        4749 4f50 0102 0100 e000 0000 0400 0000 GIOP............
                        0300 0000 0000 0000 1400 0000 ff62 6964 .............bid
                        6972 fe97 c46b 6101 000f 5700 0000 0000 ir...ka...W.....
                        0b00 0000 7365 6e64 4f62 6a65 6374 0000 ....sendObject..
                        0100 0000 0100 0000 0c00 0000 0100 0000 ................
                        0100 0100 0901 0100 1200 0000 4944 4c3a ............IDL:
                        4749 4f50 536d 616c 6c3a 312e 3000 0000 GIOPSmall:1.0...
                        0100 0000 0000 0000 6800 0000 0101 0200 ........h.......
                        0e00 0000 3139 322e 3136 382e 312e 3130 ....192.168.1.10
                        3500 bbcf 1400 0000 ff62 6964 6972 fea8 5........bidir..
                        c46b 6101 000f 7500 0000 0000 0200 0000 .ka...u.........
                        0000 0000 0800 0000 0100 0000 0054 5441 .............TTA
                        0100 0000 1c00 0000 0100 0000 0100 0100 ................
                        0100 0000 0100 0105 0901 0100 0100 0000 ................
                        0901 0100 0400 0000 666f 6f00           ........foo.`)
                    const decoder = new GIOPDecoder(data.buffer)

                    const type = decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(type)
                    expect(decoder.type).to.equal(MessageType.REQUEST)
                    expect(decoder.majorVersion).to.equal(1)
                    expect(decoder.minorVersion).to.equal(2)
                    expect(decoder.length + 12).to.equal(data.length)

                    const request = decoder.scanRequestHeader()
                    expect(request.responseExpected).to.be.true
                    expect(request.requestId).to.equal(4)
                    expect(request.objectKey).to.eql(data.subarray(28, 28 + 20))
                    expect(request.method).to.equal("sendObject")

                    // FIXME: check where the body is placed as GIOP 1.2 starts
                    // aligning it to 8
                })

                it("OmniORB, IIOP 1.2, Reply", function () {
                    const data = parseOmniDump(`
                        4749 4f50 0102 0101 0c00 0000 0400 0000 GIOP............
                        0000 0000 0000 0000                     ........`)
                    const decoder = new GIOPDecoder(data.buffer)

                    const type = decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(type)
                    expect(decoder.type).to.equal(MessageType.REPLY)
                    expect(decoder.majorVersion).to.equal(1)
                    expect(decoder.minorVersion).to.equal(2)
                    expect(decoder.length + 12).to.equal(data.length)

                    const reply = decoder.scanReplyHeader()
                    expect(reply.requestId).to.equal(4)
                    expect(reply.replyStatus).to.equal(ReplyStatus.NO_EXCEPTION)
                })

                // CloseMessage
            })
        })

        describe("GIOPEncoder", function () {
            describe("IIOP 1.2", function () {
                it("Request", function () {
                    const encoder = new GIOPEncoder()
                    encoder.majorVersion = 1
                    encoder.minorVersion = 2

                    encoder.encodeRequest(new Uint8Array([1, 2, 3, 4]), "myMethod", 4, true)
                    encoder.setGIOPHeader(MessageType.REQUEST)
                    const length = encoder.offset

                    const decoder = new GIOPDecoder(encoder.buffer.slice(0, length))
                    const type = decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(type)
                    expect(decoder.type).to.equal(MessageType.REQUEST)
                    expect(decoder.majorVersion).to.equal(1)
                    expect(decoder.minorVersion).to.equal(2)
                    expect(decoder.length + 12).to.equal(length)

                    const request = decoder.scanRequestHeader()
                    expect(request.requestId).to.equal(4)
                    expect(request.objectKey).to.eql(new Uint8Array([1, 2, 3, 4]))
                    expect(request.method).to.equal("myMethod")
                    expect(request.responseExpected).to.be.true
                })

                it("Reply", function () {
                    const encoder = new GIOPEncoder()
                    encoder.majorVersion = 1
                    encoder.minorVersion = 2
                    encoder.skipReplyHeader()
                    // result
                    const length = encoder.offset
                    encoder.setGIOPHeader(MessageType.REPLY)
                    encoder.setReplyHeader(4, ReplyStatus.NO_EXCEPTION)

                    const decoder = new GIOPDecoder(encoder.buffer.slice(0, length))
                    const type = decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(type)
                    expect(decoder.type).to.equal(MessageType.REPLY)
                    expect(decoder.majorVersion).to.equal(1)
                    expect(decoder.minorVersion).to.equal(2)
                    expect(decoder.length + 12).to.equal(length)

                    const reply = decoder.scanReplyHeader()
                    expect(reply.requestId).to.equal(4)
                    expect(reply.replyStatus).to.equal(ReplyStatus.NO_EXCEPTION)
                })

                // LocateRequest
                // LocateReply
            })
        })
    })
})

// convert the dump to Uint8Array one get's from OmniORB's -ORBtraceLevel 40
function parseOmniDump(data: string): Uint8Array {
    const rows = data.trim().split(/\r?\n/)
    let vec: number[] = []
    for (let i = 0; i < rows.length; ++i) {
        const row = rows[i].trim()
        for (let j = 0; j < 8; ++j) {
            let n: number
            let idx = j * 5
            n = parseInt(row.substring(idx, idx + 2), 16)
            if (isNaN(n))
                break
            vec.push(n)
            n = parseInt(row.substring(idx + 2, idx + 5), 16)
            if (isNaN(n))
                break
            vec.push(n)
        }
    }
    return new Uint8Array(vec)
}

class GIOPTest_impl extends skel.GIOPTest {
    msg = ""

    constructor(orb: ORB) {
        super(orb)
    }

    override async peek() {
        return this.msg
    }
    override async call(callback: api.GIOPTest, method: api.CallbackType) {
        switch (method) {
            case api.CallbackType.CB_BOOL:
                callback.sendBool(false, true)
                break
            case api.CallbackType.CB_OCTET:
                callback.sendOctet(0, 255)
                break
        }
    }
    override async onewayMethod() {
        this.msg = `onewayMethod()`
    }
    override async sendBool(v0: boolean, v1: boolean) {
        this.msg = `sendBool(${v0},${v1})`
    }
    override async sendChar(v0: number, v1: number) {
        this.msg = `sendChar(${v0},${v1})`
    }
    override async sendOctet(v0: number, v1: number) {
        this.msg = `sendOctet(${v0},${v1})`
    }
    override async sendShort(v0: number, v1: number) {
        this.msg = `sendShort(${v0},${v1})`
    }
    override async sendUShort(v0: number, v1: number) {
        this.msg = `sendUShort(${v0},${v1})`
    }
    override async sendLong(v0: number, v1: number) {
        this.msg = `sendLong(${v0},${v1})`
    }
    override async sendULong(v0: number, v1: number) {
        this.msg = `sendULong(${v0},${v1})`
    }
    override async sendLongLong(v0: bigint, v1: bigint) {
        this.msg = `sendLongLong(${v0},${v1})`
    }
    override async sendULongLong(v0: bigint, v1: bigint) {
        this.msg = `sendULongLong(${v0},${v1})`
    }
    override async sendFloat(v0: number, v1: number) {
        this.msg = `sendFloat(${v0},${v1})`
    }
    override async sendDouble(v0: number, v1: number) {
        this.msg = `sendDouble(${v0},${v1})`
    }
    override async sendString(v0: string, v1: string) {
        this.msg = `sendString(${v0},${v1})`
    }
    override async sendSequence(v0: Array<string>, v1: Array<number>) {
        this.msg = `sendSequence([`
        v0.forEach( v => this.msg += `${v},`)
        this.msg += `],[`
        v1.forEach( v => this.msg += `${v},`)
        this.msg += `])`
    }
    override async sendValuePoint(v0: Point) {
        this.msg = `sendValuePoint(${v0})`
    }
    override async sendValuePoints(v0: Point, v1: Point) { }
    override async sendObject(obj: GIOPSmall, msg: string) { }
    override async getObject(): Promise<GIOPSmall> {
        return new GIOPSmall(this.orb)
    }
}

class GIOPSmall extends skel.GIOPSmall {
    msg = ""

    constructor(orb: ORB) {
        super(orb)
    }

    override async call(msg: string) {
        this.msg = msg
    }
}

class Point extends Object implements value.Point {
    x!: number
    y!: number

    constructor(init: Partial<Point>) {
        super()
        value.initPoint(this, init)
    }
    override toString(): string {
        return `Point(${this.x},${this.y})`
    }
}

class NamedPoint extends Point implements value.NamedPoint  {
    name!: string

    constructor(init: Partial<NamedPoint>) {
        super(init)
        value.initNamedPoint(this, init)
    }
    override toString(): string {
        return `NamedPoint(${this.x},${this.y},"${this.name}")`
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

function hexdump(bytes: Uint8Array, addr = 0, length = bytes.byteLength) {
    while (addr < length) {
        let line = addr.toString(16).padStart(4, "0")
        for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j)
            line += " " + bytes[j].toString(16).padStart(2, "0")
        line = line.padEnd(4 + 16 * 3 + 1, " ")
        for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j) {
            const b = bytes[j]
            if (b >= 32 && b < 127)
                line += String.fromCharCode(b)
            else
                line += "."
        }
        addr += 16
        console.log(line)
    }
}