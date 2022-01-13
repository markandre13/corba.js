import { ORB, GIOPDecoder, MessageType, LocateStatusType, ReplyStatus, GIOPEncoder } from "corba.js"
import * as api from "./generated/giop"
import * as skel from "./generated/giop_skel"
import * as stub from "./generated/giop_stub"
import * as value from "./generated/giop_value"
import { expect } from "chai"
import { FakeTcpProtocol } from "./fake"
import { parseHexDump, parseOmniDump } from "./util"

describe("CDR/GIOP", () => {

    let orb!: ORB
    let server!: api.GIOPTest
    let myserver!: api.GIOPTest

    let fake!: FakeTcpProtocol

    // FIXME: to make the tests independent of each other when using the fake, create a new ORB for each test so that the request counter is reset
    before(async function () {
        orb = new ORB()
        fake = new FakeTcpProtocol()
        orb.addProtocol(fake)
        // TODO: switch this to object adapter? have a look at the CORBA spec
        ORB.registerValueType("Point", Point)
        ORB.registerValueType("NamedPoint", NamedPoint)

        ORB.registerValueType("FigureModel", FigureModel)
        ORB.registerValueType("Origin", Origin)
        ORB.registerValueType("Size", Size)
        ORB.registerValueType("Rectangle", Rectangle)

        orb.registerStubClass(stub.GIOPTest)
        orb.registerStubClass(stub.GIOPSmall)

        // const data = fs.readFileSync("test/giop/IOR.txt").toString().trim()
        // const obj = await orb.stringToObject(data)

        // take this from an environment variable which used by npm run:test:omni
        // fake.record()
        fake.replay()
        fake.expect("init")
        const obj = await orb.stringToObject("corbaname::192.168.1.10#TestService")

        server = stub.GIOPTest.narrow(obj)
        myserver = new GIOPTest_impl(orb)
    })

    beforeEach(async function () {
        await fake.reset()
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
            // expect(await server.peek()).to.equal("sendBool(false,true)")
        })

        // Corba 3.3, Part 1, 7.11.1.3 Char Type
        // IDL defines a char data type that is an 8-bit quantity that (1) encodes a single-byte character
        // from any byte-oriented code set, or (2) when used in an array, encodes a multi-byte character
        // from a multi-byte code set.
        // In other words, an implementation is free to use any code set internally for encoding character data,
        // though conversion to another form may be required for transmission.
        it("char", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendChar(String.fromCharCode(0), String.fromCharCode(255))
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

        it("value (subclassed)", async function () {
            fake.expect(this.test!.fullTitle())
            await server.sendValuePoint(new NamedPoint({ x: 20, y: 30, name: "foo" }))
            expect(await server.peek()).to.equal("sendValuePoint(NamedPoint(20,30,\"foo\"))")
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

        // value with sequence
        // value being null
        it("value (with null)", async function () {
            fake.expect(this.test!.fullTitle())
            const m = new FigureModel()
            const r = new Rectangle()
            r.origin = (undefined as any)
            r.size = new Size({ width: 10, height: 20 })
            m.data.push(r)
            await server.setFigureModel(m)
            expect(await server.peek()).to.equal("setFigureModel({data:[Rectangle({origin:null,{width:10,height:20},}),]})")
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

        // when we send the ior for a skeleton implementation and we get the ior back,
        // resolve it to the skeleton implementation instead of a stub
        it("send local object and get it back", async function () {
            fake.expect(this.test!.fullTitle())
            const small0 = new GIOPSmall(orb)
            const small1 = await server.reflectObject(small0)
            expect(small0 === small1).to.be.true
        })
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

        it("value (subclassed)", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_SUBCLASSED_VALUE)
            expect(await myserver.peek()).to.equal(`sendValuePoint(NamedPoint(40,50,"foo"))`)
        })

        it("value (with null)", async function () {
            fake.expect(this.test!.fullTitle())
            await server.call(myserver, api.CallbackType.CB_VALUE_WITH_NULL)
            expect(await myserver.peek()).to.equal("setFigureModel({data:[Rectangle({id:10,origin:null,size:{width:30,height:40}})]})")
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

                it("OmniORB: request: NameService._is_a('NamingContext')", function () {
                    const data = parseOmniDump(`
                        4749 4f50 0100 0100 5800 0000 0000 0000 GIOP....X.......
                        0200 0000 013c 7661 0b00 0000 4e61 6d65 .....<va....Name
                        5365 7276 6963 656e 0600 0000 5f69 735f Servicen...._is_
                        6100 2074 0000 0000 2800 0000 4944 4c3a a. t....(...IDL:
                        6f6d 672e 6f72 672f 436f 734e 616d 696e omg.org/CosNamin
                        672f 4e61 6d69 6e67 436f 6e74 6578 743a g/NamingContext:
                        312e 3000                               1.0.`)
                    const decoder = new GIOPDecoder(data.buffer)

                    decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(MessageType.REQUEST)

                    const request = decoder.scanRequestHeader()
                    expect(request.responseExpected).to.be.true
                    expect(request.objectKey).eqls(new TextEncoder().encode("NameService"))
                    expect(request.method).equals("_is_a")
                    const repId = decoder.string()
                    expect(repId).equals("IDL:omg.org/CosNaming/NamingContext:1.0")

                    // expects boolean
                })

                it("OmniORB: request: NameService.resolve([{id:'TestService',kind:'Object'}])", function () {
                    const data = parseOmniDump(`
                        4749 4f50 0100 0100 4b00 0000 0000 0000 GIOP....K.......
                        0400 0000 013c 7661 0b00 0000 4e61 6d65 .....<va....Name
                        5365 7276 6963 656e 0800 0000 7265 736f Servicen....reso
                        6c76 6500 0000 0000 0100 0000 0c00 0000 lve.............
                        5465 7374 5365 7276 6963 6500 0700 0000 TestService.....
                        4f62 6a65 6374 00                       Object.
                    `)
                    const decoder = new GIOPDecoder(data.buffer)

                    decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(MessageType.REQUEST)

                    const request = decoder.scanRequestHeader()
                    expect(request.responseExpected).to.be.true
                    expect(request.objectKey).eqls(new TextEncoder().encode("NameService"))
                    expect(request.method).equals("resolve")

                    const nameLength = decoder.ulong()
                    const id = decoder.string()
                    const kind = decoder.string()
                    expect(nameLength).to.equal(1)
                    expect(id).to.equal("TestService")
                    expect(kind).to.equal("Object") // IDL:GIOPTest:1.0
                })

                it("OmniORB: reply: NameService.resolve(...)", function () {
                    const data = parseOmniDump(`
                        4749 4f50 0100 0101 9800 0000 0000 0000 GIOP............
                        0400 0000 0000 0000 1100 0000 4944 4c3a ............IDL:
                        4749 4f50 5465 7374 3a31 2e30 0066 6f6c GIOPTest:1.0.fol
                        0100 0000 0000 0000 6800 0000 0101 0200 ........h.......
                        0e00 0000 3139 322e 3136 382e 312e 3130 ....192.168.1.10
                        3500 89b0 1400 0000 ff62 6964 6972 fe1a 5........bidir..
                        3078 6101 0009 4200 0000 0000 0200 0000 0xa...B.........
                        0000 0000 0800 0000 0100 0000 0054 5441 .............TTA
                        0100 0000 1c00 0000 0100 0000 0100 0100 ................
                        0100 0000 0100 0105 0901 0100 0100 0000 ................
                        0901 0100`)
                    const decoder = new GIOPDecoder(data.buffer)

                    decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(MessageType.REPLY)
                    const reply = decoder.scanReplyHeader()
                    const ref = decoder.reference()
                    expect(ref.oid).to.equal("IDL:GIOPTest:1.0")
                    expect(ref.host).to.equal("192.168.1.105")
                    expect(ref.port).to.equal(45193)
                })

                // CloseMessage

                // sending this in basics.spec.ts fails to decode
                // const model = new FigureModel()
                // model.data.push(new Rectangle({origin: {x: 10, y: 20}, size: { width: 30, height: 40}}))
                // model.data.push(new Rectangle({origin: {x: 50, y: 60}, size: { width: 70, height: 80}}))
                // client.setFigureModel(model)
                //
                // 1st step: find out if the encoding is correct
                //           it looks that it is not.
                it("Regression: ", function () {
                    const data = parseHexDump(
                        `0000 47 49 4f 50 01 02 01 00 2c 01 00 00 02 00 00 00 GIOP....,.......
                        0010 00 00 00 00 00 00 00 00 08 00 00 00 02 00 00 00 ................
                        0020 00 00 00 00 0f 00 00 00 73 65 74 46 69 67 75 72 ........setFigur
                        0030 65 4d 6f 64 65 6c 00 00 01 00 00 00 05 00 00 00 eModel..........
                        0040 14 00 00 00 01 00 00 00 01 00 00 00 05 00 00 00 ................
                        0050 6d 6f 63 6b 00 00 00 00 02 ff ff 7f 14 00 00 00 mock............
                        0060 49 44 4c 3a 46 69 67 75 72 65 4d 6f 64 65 6c 3a IDL:FigureModel:
                        0070 31 2e 30 00 02 00 00 00 02 ff ff 7f 12 00 00 00 1.0.............
                        0080 49 44 4c 3a 52 65 63 74 61 6e 67 6c 65 3a 31 2e IDL:Rectangle:1.
                        0090 30 00 00 00 00 00 00 00 02 ff ff 7f 0f 00 00 00 0...............
                        00a0 49 44 4c 3a 4f 72 69 67 69 6e 3a 31 2e 30 00 00 IDL:Origin:1.0..
                        00b0 00 00 00 00 00 00 24 40 00 00 00 00 00 00 34 40 ......$@......4@
                        00c0 02 ff ff 7f 0d 00 00 00 49 44 4c 3a 53 69 7a 65 ........IDL:Size
                        00d0 3a 31 2e 30 00 00 00 00 00 00 00 00 00 00 3e 40 :1.0..........>@
                        00e0 00 00 00 00 00 00 44 40 02 ff ff 7f ff ff ff ff ......D@........
                        00f0 8c ff ff ff 00 00 00 00 02 ff ff 7f ff ff ff ff ................
                        0100 9c ff ff ff 00 00 00 00 00 00 00 00 00 00 49 40 ..............I@
                        0110 00 00 00 00 00 00 4e 40 02 ff ff 7f ff ff ff ff ......N@........
                        0120 a4 ff ff ff 00 00 00 00 00 00 00 00 00 80 51 40 ..............Q@
                        0130 00 00 00 00 00 00 54 40                         ......T@`)
                    const decoder = new GIOPDecoder(data.buffer)

                    decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(MessageType.REQUEST)

                    const request = decoder.scanRequestHeader()
                    expect(request.responseExpected).to.be.false
                    // expect(request.objectKey).eqls(new TextEncoder().encode("NameService"))
                    expect(request.method).equals("setFigureModel")

                    const figureModelType = decoder.ulong()
                    expect(figureModelType).to.equal(0x7fffff02) // should be 0x7fffff00 as the type is the one from the IDL
                    const figureModelRepositoryId = decoder.string()
                    expect(figureModelRepositoryId).to.equal("IDL:FigureModel:1.0")

                    const sequenceLength = decoder.ulong() // sequence's have no type information, they are all the same
                    expect(sequenceLength).to.equal(2)

                    const rectangleType = decoder.ulong()
                    expect(rectangleType).to.equal(0x7fffff02)
                    const rectangle0RepositoryID = decoder.string()
                    expect(rectangle0RepositoryID).to.equal("IDL:Rectangle:1.0")

                    const figureId = decoder.ulong()
                    expect(figureId).to.equal(0)

                    console.log(`offset after 1st figureId = 0x${decoder.offset.toString(16)}`)

                    const originType = decoder.ulong()
                    expect(originType).to.equal(0x7fffff02)
                    const originRepositoryId = decoder.string()
                    expect(originRepositoryId).to.equal("IDL:Origin:1.0")
                    const x = decoder.double()
                    expect(x).to.equal(10)
                    const y = decoder.double()
                    expect(y).to.equal(20)

                    // const x = decoder.string()
                    // console.log(x)
                })

                it("OmniORB's variant of setFigureModel", function () {
                    const data = parseOmniDump(
                        `4749 4f50 0102 0100 ec00 0000 0400 0000 GIOP............
                        0300 0000 0000 0000 1400 0000 ff62 6964 .............bid
                        6972 fe72 a67d 6101 000a fc00 0000 0000 ir.r.}a.........
                        0f00 0000 7365 7446 6967 7572 654d 6f64 ....setFigureMod
                        656c 0000 0100 0000 0100 0000 0c00 0000 el..............
                        0100 0000 0100 0100 0901 0100 0000 0000 ................
                        00ff ff7f 0200 0000 02ff ff7f 1200 0000 ................
                        4944 4c3a 5265 6374 616e 676c 653a 312e IDL:Rectangle:1.
                        3000 0000 0a00 0000 00ff ff7f 0000 0000 0...............
                        0000 0000 0000 2440 0000 0000 0000 3440 ......$@......4@
                        00ff ff7f 0000 0000 0000 0000 0000 3e40 ..............>@
                        0000 0000 0000 4440 02ff ff7f ffff ffff ......D@........
                        acff ffff 0b00 0000 00ff ff7f 0000 0000 ................
                        0000 0000 0000 4940 0000 0000 0000 4e40 ......I@......N@
                        00ff ff7f 0000 0000 0000 0000 0080 5140 ..............Q@
                        0000 0000 0000 5440                     ......T@`)
                    const decoder = new GIOPDecoder(data.buffer)

                    decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(MessageType.REQUEST)

                    const request = decoder.scanRequestHeader()
                    expect(request.responseExpected).to.be.true
                    // expect(request.objectKey).eqls(new TextEncoder().encode("NameService"))
                    expect(request.method).equals("setFigureModel")

                    const figureModelType = decoder.ulong()
                    expect(figureModelType).to.equal(0x7fffff00)

                    const sequenceLength = decoder.ulong()
                    expect(sequenceLength).to.equal(2)

                    const figure0Type = decoder.ulong()
                    expect(figure0Type).to.equal(0x7fffff02)
                    const figure0RepositoryId = decoder.string()
                    expect(figure0RepositoryId).to.equal("IDL:Rectangle:1.0")

                    const figureId = decoder.ulong()
                    expect(figureId).to.equal(10)

                    const origin0Type = decoder.ulong()
                    expect(origin0Type).to.equal(0x7fffff00)

                    const x0 = decoder.double()
                    expect(x0).to.equal(10)
                    const y0 = decoder.double()
                    expect(y0).to.equal(20)

                    const size0Type = decoder.ulong()
                    expect(size0Type).to.equal(0x7fffff00)

                    const w0 = decoder.double()
                    expect(w0).to.equal(30)
                    const h0 = decoder.double()
                    expect(h0).to.equal(40)

                    const figure1Type = decoder.ulong()
                    expect(figure1Type).to.equal(0x7fffff02)

                    const figure1RepositoryId = decoder.ulong()
                    expect(figure1RepositoryId).to.equal(0xffffffff)
                    // console.log(figure1RepositoryId.toString(16))
                })

                it("setFigureModel with a null pointer inside the valuetype", function () {
                    const data = parseOmniDump(
                        `4749 4f50 0102 0100 9400 0000 0400 0000 GIOP............
                        0300 0000 0000 0000 1400 0000 ff62 6964 .............bid
                        6972 fea5 e380 6101 0004 3b00 0000 0000 ir....a...;.....
                        0f00 0000 7365 7446 6967 7572 654d 6f64 ....setFigureMod
                        656c 0000 0100 0000 0100 0000 0c00 0000 el..............
                        0100 0000 0100 0100 0901 0100 0000 0000 ................
                        00ff ff7f 0100 0000 02ff ff7f 1200 0000 ................
                        4944 4c3a 5265 6374 616e 676c 653a 312e IDL:Rectangle:1.
                        3000 0000 0a00 0000 0000 0000 00ff ff7f 0...............
                        0000 0000 0000 3e40 0000 0000 0000 4440 ......>@......D@
                        `)
                    const decoder = new GIOPDecoder(data.buffer)

                    decoder.scanGIOPHeader()
                    expect(decoder.type).to.equal(MessageType.REQUEST)

                    const request = decoder.scanRequestHeader()
                    expect(request.responseExpected).to.be.true
                    // expect(request.objectKey).eqls(new TextEncoder().encode("NameService"))
                    expect(request.method).equals("setFigureModel")

                    const figureModelType = decoder.ulong()
                    expect(figureModelType).to.equal(0x7fffff00)

                    const sequenceLength = decoder.ulong()
                    expect(sequenceLength).to.equal(1)

                    const figure0Type = decoder.ulong()
                    expect(figure0Type).to.equal(0x7fffff02)
                    const figure0RepositoryId = decoder.string()
                    expect(figure0RepositoryId).to.equal("IDL:Rectangle:1.0")

                    const figureId = decoder.ulong()
                    expect(figureId).to.equal(10)

                    const origin0Type = decoder.ulong()
                    expect(origin0Type).to.equal(0) // the null pointer is encoded as 0 :)

                    const size0Type = decoder.ulong()
                    expect(size0Type).to.equal(0x7fffff00)

                    const w0 = decoder.double()
                    expect(w0).to.equal(30)
                    const h0 = decoder.double()
                    expect(h0).to.equal(40)
                })
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

    describe("persistence", function() {
        it("serialize/deserialize", function() {
            
            const r = new Rectangle()
            r.origin = new Point({x: 10, y: 20})
            r.size = new Size({ width: 30, height: 40 })
            const valueIn = new FigureModel()
            valueIn.data.push(r)

            const binary = orb.serialize(valueIn)
            const valueOut = orb.deserialize(binary)

            expect(valueIn).to.deep.equal(valueOut)
        })
    })

    it("string() encoding/decoding", function() {
        const textIn = "Von Äpfeln schön überfreßen."
        const encoder = new GIOPEncoder()
        encoder.string(textIn)
        const decoder = new GIOPDecoder(encoder.buffer)
        const textOut = decoder.string()
        expect(textOut).equals(textIn)
    })

    describe("ASN.1", function () {
        it("JacORB with CSIv2 GSSUP Username+Password Auth", function () {
            const data = parseHexDump(
                `0000 47 49 4f 50 01 00 00 00 00 00 00 d3 00 00 00 03 GIOP............
                0010 00 00 00 0f 00 00 00 52 00 00 00 00 00 00 00 00 .......R........
                0020 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00 00 ................
                0030 01 00 00 00 00 00 00 32 60 30 06 06 67 81 02 01 .......2.0..g...
                0040 01 01 00 00 00 00 00 00 00 05 4a 61 63 6b 6f 00 ..........Jacko.
                0050 00 00 00 00 00 0e 4d 61 73 74 65 72 20 6f 66 20 ......Master of 
                0060 4e 6f 6e 65 00 00 00 00 00 00 00 00 00 00 00 01 None............
                0070 00 00 00 0c 00 00 00 00 05 01 00 01 00 01 01 09 ................
                0080 4a 41 43 01 00 00 00 00 00 00 00 00 01 00 00 00 JAC.............
                0090 00 00 00 0b 4e 61 6d 65 53 65 72 76 69 63 65 00 ....NameService.
                00a0 00 00 00 06 5f 69 73 5f 61 00 00 00 00 00 00 00 ...._is_a.......
                00b0 00 00 00 2b 49 44 4c 3a 6f 6d 67 2e 6f 72 67 2f ...+IDL:omg.org/
                00c0 43 6f 73 4e 61 6d 69 6e 67 2f 4e 61 6d 69 6e 67 CosNaming/Naming
                00d0 43 6f 6e 74 65 78 74 45 78 74 3a 31 2e 30 00    ContextExt:1.0.`)
            const decoder = new GIOPDecoder(data.buffer)
            decoder.scanGIOPHeader()
            decoder.scanRequestHeader()
        })
    })
})

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
    override async sendChar(v0: string, v1: string) {
        this.msg = `sendChar(${v0.charCodeAt(0)},${v1.charCodeAt(0)})`
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
        v0.forEach(v => this.msg += `${v},`)
        this.msg += `],[`
        v1.forEach(v => this.msg += `${v},`)
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
    override async reflectObject(obj: GIOPSmall): Promise<GIOPSmall> {
        return obj
    }
    override async setFigureModel(model: value.FigureModel) {
        this.msg = `setFigureModel({data:[`
        model.data.forEach(e => {
            if (e instanceof Rectangle) {
                this.msg += `Rectangle({id:${e.id},origin:`
                if (e.origin === undefined) {
                    this.msg += `null`
                } else {
                    this.msg += `{x:${e.origin.x},y:${e.origin.y}}`
                }
                this.msg += `,size:`
                if (e.size === undefined) {
                    this.msg += `null`
                } else {
                    this.msg += `{width:${e.size.width},height:${e.size.height}}`
                }

                this.msg += `})`
            } else {
                this.msg += "?"
            }
        })
        this.msg += `]})`
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

class NamedPoint extends Point implements value.NamedPoint {
    name!: string

    constructor(init: Partial<NamedPoint>) {
        super(init)
        value.initNamedPoint(this, init)
    }
    override toString(): string {
        return `NamedPoint(${this.x},${this.y},"${this.name}")`
    }
}

// TODO: see if we can re-activate write-valueimpl.ts to get rid of the boilderplate
// without the earlier disadvantages
class FigureModel implements value.FigureModel {
    data!: Array<value.Figure>
    constructor(init: Partial<FigureModel> | undefined = undefined) {
        value.initFigureModel(this, init)
    }
}

class Origin implements value.Origin {
    x!: number
    y!: number
    constructor(init: Partial<Origin> | undefined = undefined) {
        value.initOrigin(this, init)
    }
}

class Size implements value.Size {
    width!: number
    height!: number
    constructor(init: Partial<Size> | undefined = undefined) {
        value.initSize(this, init)
    }
}

class Figure implements value.Figure {
    id!: number
    constructor(init: Partial<Figure> | undefined = undefined) {
        value.initFigure(this, init)
    }
}

class Rectangle extends Figure implements value.Rectangle {
    origin!: Origin
    size!: Size
    constructor(init: Partial<Rectangle> | undefined = undefined) {
        super(init)
        value.initRectangle(this, init)
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

// function hexdump(bytes: Uint8Array, addr = 0, length = bytes.byteLength) {
//     while (addr < length) {
//         let line = addr.toString(16).padStart(4, "0")
//         for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j)
//             line += " " + bytes[j].toString(16).padStart(2, "0")
//         line = line.padEnd(4 + 16 * 3 + 1, " ")
//         for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j) {
//             const b = bytes[j]
//             if (b >= 32 && b < 127)
//                 line += String.fromCharCode(b)
//             else
//                 line += "."
//         }
//         addr += 16
//         console.log(line)
//     }
// }
