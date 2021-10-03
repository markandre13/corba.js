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


import * as fs from "fs"
import { ORB, IOR, GIOPEncoder, GIOPDecoder } from "corba.js"
import { connect } from "corba.js/net/socket"
import * as value from "./mico/test_value"
import * as stub from "./demux_stub"

describe("CDR/GIOP", () => {

    let ior!: IOR

    before(() => {
        const data = fs.readFileSync("IOR.txt").toString().trim()
        ior = new IOR(data)
    })

    it("call mico", async function() {
        const orb = new ORB()
        orb.registerStubClass(stub.Server)
        const data = fs.readFileSync("IOR.txt").toString().trim()

        // this is how this would originally look like:
        //   const obj = orb.stringToObject(data)
        //   const server = Server::narrow(obj)
        // but since corba.js is not a full CORBA implementation, we'll do it like this:
        const ior = new IOR(data)
        await connect(orb, ior.host!, ior.port!)
        const obj = orb.iorToObject(ior)
        const server = stub.Server.narrow(obj)

        await server.onewayCall(7)
        const x = await server.twowayCall(7)
        console.log(x)
    })

    // WHAT'S NEXT:
    // things to test with a real CORBA instance are basically for the validation of the GIOP
    // send/receive arguments passed to method and result returned from method
    // send/receive struct (as argument and return value. how do they differ from valuetypes in regard to GIOP?)
    // send/receive sequence (as argument and return value)
    // send/receive object reference (as argument and return value)
    // send/receive value types with duplicated repositoryId as well as duplicated objects (aka multiple references to the same object)
    // cover all of the above with a recorded fake, server and client side
    // to keep the IDL for this test small, we'll implement server and client on MICO side

//     it("do something binary", () => {
//         const encoder = new GIOPEncoder()

//         const pointOut = new Point({x: 3.1415, y: 2.7182})
//         encoder.object(pointOut)

//         // hexdump(encoder.bytes, 0, encoder.offset)

//         const decoder = new GIOPDecoder(encoder.buf)
//         decoder.registerValueType(Point, "IDL:Point:1.0")
//         const pointIn = decoder.object() as Point

//         expect(pointIn.x).to.equal(3.1415)
//         expect(pointIn.y).to.equal(2.7182)
//     })

//     it("get host, port and objectKey from IOR", () => {
//         // Spec: CORBA 3.3, 7.6.2 Interoperable Object References: IORs
//         const ior = new IOR("IOR:010000000f00000049444c3a5365727665723a312e30000002000000000000002f000000010100000e0000003139322e3136382e312e313035002823130000002f313130312f313632363838383434312f5f30000100000024000000010000000100000001000000140000000100000001000100000000000901010000000000")
//         expect(ior.host).to.equal("192.168.1.105")
//         expect(ior.port).to.equal(9000)
//         expect(ior.objectKey).to.equal("/1101/1626888441/_0")
//     })

//     describe("MICO ORB interaction", () => {

//         it("valuetype Point getPoint()", async () => {
//             const client = new Socket()
//             await client.connect(ior.host!, ior.port!)
//             console.log("connected")

//             const encoder = new GIOPEncoder()
//             encoder.encodeRequest(ior.objectKey!, "getPoint")
//             encoder.setGIOPHeader(MessageType.REQUEST)
//             client.write(encoder.bytes.subarray(0, encoder.offset))
//             console.log(`wrote ${encoder.offset} bytes`)
//             hexdump(encoder.bytes, 0, encoder.offset)

//             const data = await client.read()
//             console.log("received")
//             hexdump(data)

//             const decoder = new GIOPDecoder(data.buffer)
//             decoder.registerValueType(Box, "IDL:space/Box:1.0") // value.spec.Point_1_0
//             decoder.registerValueType(Point, "IDL:Point:1.0")
//             decoder.scanGIOPHeader(MessageType.REPLY)
//             expect(decoder.offset).to.equal(0x0c)

//             decoder.scanReplyHeader()
//             expect(decoder.offset).to.equal(0x18)

//             const pointOut = decoder.object() as Point
//             console.log(pointOut)
//             console.log(`point out = ${pointOut.x}, ${pointOut.y}`)
//             expect(pointOut.x).to.equal(3.1415)
//             expect(pointOut.y).to.equal(2.7182)

//             expect(data.byteLength).to.equal(decoder.offset)

//             client.destroy()
//         })

//         // send 
//         it("void setPoint(valuetype Point)", async () => {
//             const client = new Socket()
//             await client.connect(ior.host!, ior.port!)
//             console.log("connected")

//             const encoder = new GIOPEncoder()
//             encoder.encodeRequest(ior.objectKey!, "setPoint")
//             const point = new Point({x: 3.1415, y: 2.7182})
//             encoder.object(point)
//             encoder.setGIOPHeader(MessageType.REQUEST)
//             client.write(encoder.bytes.subarray(0, encoder.offset))

//             console.log(`wrote ${encoder.offset} bytes`)
//             hexdump(encoder.bytes, 0, encoder.offset)

//             // reply
//             //      47 49 4f 50 01 00 01 01 0c 00 00 00 00 00 00 00  GIOP............
//             //      ^           ^     ^  ^  ^
//             //      |           |     |  |  size
//             //      |           |     |  type 0: request
//             //      |           |     byte order
//             //      |           version 1.0
//             //      GIOP magic number
//             //      02 00 00 00 00 00 00 00                          ........

//             const data = await client.read()
//             console.log("received")
//             hexdump(data)

//             const decoder = new GIOPDecoder(data.buffer)
//             decoder.scanGIOPHeader(MessageType.REPLY)
//             expect(decoder.offset).to.equal(0x0c)

//             decoder.scanReplyHeader()
//             expect(decoder.offset).to.equal(0x18)
//             expect(data.byteLength).to.equal(decoder.offset) // void, no further payload

//             client.destroy()
//         })

//         xit("setBox(p0, p1): encode repositoryID 'IDL:Point:1.0' only once", async () => {
//             const client = new Socket()
//             await client.connect(ior.host!, ior.port!)
//             console.log("connected")

//             // SEND
//             const encoder = new GIOPEncoder()
//             encoder.encodeRequest(ior.objectKey!, "setBox")
//             const p0 = new Point({x: 1.1, y: 2.1})
//             const p1 = new Point({x: 2.1, y: 2.2})
//             const box = new Box({p0, p1}) // this fails
//             encoder.object(box)

//             encoder.setGIOPHeader(MessageType.REQUEST)
//             client.write(encoder.bytes.subarray(0, encoder.offset))
//             expect(encoder.offset).to.equal(0x00a8) // length when the point's repositoryID is reused
            
//             hexdump(encoder.bytes, 0, encoder.offset)

//             // 0000 47 49 4f 50 01 00 01 00 94 00 00 00 00 00 00 00 GIOP............
//             //      ^           ^     ^  ^  ^           ^
//             //      |           |     |  |  |           serviceContextListLength
//             //      |           |     |  |  size
//             //      |           |     |  message type: request(0)
//             //      |           |     byte order
//             //      |           GIOP version 1.0
//             //      GIOP magic number
//             // 0010 01 00 00 00 01 00 00 00 13 00 00 00 2f 31 30 39 ............/109
//             //      ^           ^           ^           ^
//             //      |           |           |           object key
//             //      |           |           length object key
//             //      |           expected response: reply(1)
//             //      request id
//             // 0020 30 2f 31 36 32 37 33 35 39 33 37 37 2f 5f 30 00 0/1627359377/_0.
//             //                                                   ^
//             //                                                   padding
//             // 0030 07 00 00 00 73 65 74 42 6f 78 00 00 00 00 00 00 ....setBox......
//             //      ^           ^                       ^
//             //      |           |                       requesting principal length
//             //      |           method name
//             //      length method name
//             // 0040 02 ff ff 7f 12 00 00 00 49 44 4c 3a 73 70 61 63 ........IDL:spac
//             //      ^           ^           ^
//             //      |           |           repository ID
//             //      |           repository ID length
//             //      value tag for Box
//             // 0050 65 2f 42 6f 78 3a 31 2e 30 00 00 00 02 ff ff 7f e/Box:1.0.......
//             //                                          ^
//             //                                          value tag for Point p0
//             // 0060 0e 00 00 00 49 44 4c 3a 50 6f 69 6e 74 3a 31 2e ....IDL:Point:1.
//             //      ^           ^
//             //      |           repository ID
//             //      repository ID length
//             // 0070 30 00 00 00 00 00 00 00 9a 99 99 99 99 99 f1 3f 0..............?
//             //         ^                    ^
//             //         |                    x
//             //         padding for 8 word double
//             // 0080 cd cc cc cc cc cc 00 40 02 ff ff 7f ff ff ff ff .......@........
//             //      ^                       ^           ^
//             //      |                       |           repository ID is an indirection
//             //      |                       value tag for Point p1
//             //      y
//             // 0090 d0 ff ff ff 00 00 00 00 cd cc cc cc cc cc 00 40 ...............@
//             //      ^           ^           ^
//             //      |           |           x
//             //      |           padding
//             //      indirection
//             // 00a0 9a 99 99 99 99 99 01 40 00 00 00 00 00 00 00 00 .......@........
//             //      ^                       ^
//             //      |                       HU? WHAT'S WITH THE TRAILING 0s?
//             //      y

//             // WAIT FOR ACK
//             const data = await client.read()
//             console.log("received")
//             hexdump(data)

//             const decoder = new GIOPDecoder(data.buffer)
//             decoder.scanGIOPHeader(MessageType.REPLY)
//             expect(decoder.offset).to.equal(0x0c)

//             decoder.scanReplyHeader()
//             expect(decoder.offset).to.equal(0x18)
//             expect(data.byteLength).to.equal(decoder.offset) // void, no further payload

//             client.destroy()

//             // NOW TRY TO DECODE OURSELVES WHAT WE'VE SEND
//             const decoder0 = new GIOPDecoder(encoder.buffer.slice(0, encoder.offset))
//             decoder0.registerValueType(Box, "IDL:space/Box:1.0")
//             decoder0.registerValueType(Point, "IDL:Point:1.0")

//             expect(decoder0.buffer.byteLength).to.equal(encoder.offset)
//             decoder0.scanGIOPHeader(MessageType.REQUEST)

//             decoder0.scanRequestHeader()
//             expect(decoder0.offset).to.equal(0x3e)

//             const box0 = decoder0.object()
//             console.log(box0)
//         })

//         it("setBox(p0, p0): encode point twice", async () => {
//             // value._init()
//             ORB.registerValueType("Point", Point)
//             ORB.registerValueType("space.Box", Box)

//             const encoder = new GIOPEncoder()
//             encoder.encodeRequest(ior.objectKey!, "setBox")
//             const p0 = new Point({x: 1.1, y: 2.1})

//             console.log(`original p0.prototype`)
//             console.log(Point.prototype.isPrototypeOf(p0))
//             console.log((Point as Object).isPrototypeOf(p0))

//             const box = new Box({p0, p1: p0})

//             expect(box.p0 === box.p1).to.be.true

//             encoder.object(box)

//             encoder.setGIOPHeader(MessageType.REQUEST)
//             const client = new Socket()
//             await client.connect(ior.host!, ior.port!)
//             console.log("connected")
//             client.write(encoder.bytes.subarray(0, encoder.offset))
//             hexdump(encoder.bytes, 0, encoder.offset)
//             expect(encoder.offset).to.equal(0x0090) // length when the point's repositoryID is reused

//             // 0000 47 49 4f 50 01 00 01 00 84 00 00 00 00 00 00 00 GIOP............
//             // 0010 01 00 00 00 01 00 00 00 13 00 00 00 2f 31 32 30 ............/120
//             // 0020 35 2f 31 36 32 37 38 32 38 32 35 39 2f 5f 30 00 5/1627828259/_0.
//             // 0030 07 00 00 00 73 65 74 42 6f 78 00 00 00 00 00 00 ....setBox......
//             // 0040 02 ff ff 7f 12 00 00 00 49 44 4c 3a 73 70 61 63 ........IDL:spac
//             // 0050 65 2f 42 6f 78 3a 31 2e 30 00 00 00 02 ff ff 7f e/Box:1.0.......
//             // 0060 0e 00 00 00 49 44 4c 3a 50 6f 69 6e 74 3a 31 2e ....IDL:Point:1.
//             // 0070 30 00 00 00 00 00 00 00 9a 99 99 99 99 99 f1 3f 0..............?
//             // 0080 cd cc cc cc cc cc 00 40 ff ff ff ff d0 ff ff ff .......@........

//             const data = await client.read()
//             console.log("received")
//             hexdump(data)

//             const decoder = new GIOPDecoder(data.buffer)
//             decoder.scanGIOPHeader(MessageType.REPLY)
//             expect(decoder.offset).to.equal(0x0c)

//             decoder.scanReplyHeader()
//             expect(decoder.offset).to.equal(0x18)
//             expect(data.byteLength).to.equal(decoder.offset) // void, no further payload

//             client.destroy()

//             // NOW TRY TO DECODE OURSELVES WHAT WE'VE SEND
//             const decoder0 = new GIOPDecoder(encoder.buffer.slice(0, encoder.offset))
//             decoder0.registerValueType(Box, "IDL:space/Box:1.0") // value.spec.Point_1_0
//             decoder0.registerValueType(Point, "IDL:Point:1.0")

//             expect(decoder0.buffer.byteLength).to.equal(encoder.offset)
//             decoder0.scanGIOPHeader(MessageType.REQUEST)

//             decoder0.scanRequestHeader()
//             expect(decoder0.offset).to.equal(0x3e)

//             const box0 = decoder0.object() as Box
//             console.log(box0)

//             console.log(decoder0.offset.toString(16))

//             expect(box.p0).to.equal(box.p1)
//             expect(decoder0.offset).to.equal(0x90)
//         })

//         it("getBox(): duplicate repositoryId")
//         it("getBox(): duplicate object")
//     })
})

function hexdump(bytes: Uint8Array, addr = 0, length = bytes.byteLength) {
    while (addr < length) {
        let line = addr.toString(16).padStart(4, "0")
        for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j)
            line += " " + bytes[j].toString(16).padStart(2, "0")
        line = line.padEnd(4 + 16 * 3 + 1, " ")
        for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j) {
            const b = bytes[j]
            if (b >= 32 && b  < 127)
                line += String.fromCharCode(b)
            else
                line += "."
        }
        addr += 16
        console.log(line)
    }
}

export class Point implements value.Point {
    x!: number
    y!: number

    constructor(init?: Partial<Point> | GIOPDecoder) {
        value.initPoint(this, init)
    }

    // something like these would later be generated by the IDL compiler
    // try to keep initializing objects from JSON as this also served nicely to serialize from/to databases.
    encode(encoder: GIOPEncoder) {
        encoder.repositoryId("Point")
        encoder.double(this.x)
        encoder.double(this.y)
    }
}

export class Box implements value.space.Box {
    p0!: Point
    p1!: Point

    constructor(init?: Partial<Box> | GIOPDecoder) {
        value.space.initBox(this, init)
    }

    // something like these would later be generated by the IDL compiler
    // try to keep initializing objects from JSON as this also served nicely to serialize from/to databases.
    encode(encoder: GIOPEncoder) {
        encoder.repositoryId("space/Box")
        encoder.object(this.p0)
        encoder.object(this.p1)
    }
}
