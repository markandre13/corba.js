/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2021 Mark-André Hopf <mhopf@mark13.org>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { expect } from "chai"
import * as net from "net"

// 9.4 GIOP Message Formats
enum MessageType {
    REQUEST = 0,
    REPLY = 1,
    CANCEL_REQUEST = 2,
    LOCATE_REQUEST = 3,
    LOCATE_REPLY = 4,
    CLOSE_CONNECTION = 5,
    MESSAGE_ERROR = 6,
    FRAGMENT = 7
}

class GIOPBase {
    offset = 0

    static MAJOR_VERSION = 1
    static MINOR_VERSION = 0

    static ENDIAN_BIG = 0
    static ENDIAN_LITTLE = 1

    static FLOAT64_MAX = 1.7976931348623157e+308
    static FLOAT64_MIN = 2.2250738585072014e-308
    static TWO_TO_20 = 1048576
    static TWO_TO_32 = 4294967296
    static TWO_TO_52 = 4503599627370496

    align(alignment: number) {
        const inversePadding = this.offset % alignment
        if (inversePadding !== 0)
            this.offset += alignment - inversePadding
    }
}

class GIOPEncoder extends GIOPBase {
    buffer = new ArrayBuffer(0x16 * 10) // write code to extend on demand, fragment really large messages?
    data = new DataView(this.buffer)
    bytes = new Uint8Array(this.buffer)
    
    protected static textEncoder = new TextEncoder()

    static littleEndian?: boolean

    constructor() {
        super()
        // use the systems endianes
        if (GIOPEncoder.littleEndian === undefined) {
            const buffer = new ArrayBuffer(2)
            new Int16Array(buffer)[0] = 0x1234
            GIOPEncoder.littleEndian = new DataView(buffer).getUint8(0) === 0x34
            // GIOPEncoder.littleEndian = false
        }
    }

    get buf() {
        return this.buffer
    }

    skipGIOPHeader() {
        this.offset = 10
    }

    setGIOPHeader(type: MessageType) {
        this.data.setUint32(0, 0x47494f50)
        
        this.data.setUint8(4, GIOPEncoder.MAJOR_VERSION)
        this.data.setUint8(5, GIOPEncoder.MINOR_VERSION)
        this.data.setUint8(6, GIOPEncoder.littleEndian ? GIOPEncoder.ENDIAN_LITTLE : GIOPEncoder.ENDIAN_BIG)
        this.data.setUint8(7, type)

        this.data.setUint32(8, this.offset - 12, GIOPEncoder.littleEndian)
    }
  
    type(name: string) {
        this.dword(0x7fffff02)
        const repositoryId = `IDL:${name}:1.0`
        this.string(repositoryId)
    }

    blob(value: string) {
        this.dword(value.length)
        const rawString = GIOPEncoder.textEncoder.encode(value)
        this.bytes.set(rawString, this.offset)
        this.offset += value.length
    }

    string(value: string) {
        this.dword(value.length+1)
        this.bytes.set(GIOPEncoder.textEncoder.encode(value), this.offset)
        this.offset += value.length
        this.bytes[this.offset] = 0
        this.offset++
    }

    byte(value: number) {
        this.data.setUint8(this.offset, value)
        this.offset += 1
    }

    word(value: number) {
        this.align(2)
        this.data.setUint16(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 2
    }

    dword(value: number) {
        this.align(4)
        this.data.setUint32(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 4
    }

    double(value: number) {
        this.align(8)
        this.data.setFloat64(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 8
    }

    // just in case the host doesn't support IEEE 754
    slowDouble(value: number) {
        this.align(8)

        const sign = value < 0 ? 1 : 0
        value = sign ? -value : value

        let hi, lo

        if (value === 0) {
            if ((1 / value) > 0) {
                lo = 0x00000000
                hi = 0x00000000
            } else {
               hi = 0x80000000
               lo = 0x00000000 
            }
        } else
        if (isNaN(value)) {
            hi = 0x7fffffff
            lo = 0xffffffff
        } else
        if (value > GIOPEncoder.FLOAT64_MAX) {
            hi = ((sign << 31) | (0x7FF00000)) >>> 0
            lo = 0
        } else
        if (value < GIOPEncoder.FLOAT64_MIN) {
            const mant = value / Math.pow(2, -1074)
            const mantHigh = (mant / GIOPEncoder.TWO_TO_32)
            hi = ((sign << 31) | mantHigh) >>> 0
            lo = (mant >>> 0)
        } else {
            const maxDoubleExponent = 1023
            const minDoubleExponent = -1022
            let x = value
            let exp = 0
            if (x >= 2) {
              while (x >= 2 && exp < maxDoubleExponent) {
                exp++;
                x = x / 2;
              }
            } else {
              while (x < 1 && exp > minDoubleExponent) {
                x = x * 2;
                exp--;
              }
            }
            let mant = value * Math.pow(2, -exp);
          
            var mantHigh = (mant * GIOPEncoder.TWO_TO_20) & 0xFFFFF;
            var mantLow = (mant * GIOPEncoder.TWO_TO_52) >>> 0;
          
            hi = ((sign << 31) | ((exp + 1023) << 20) | mantHigh) >>> 0
            lo = mantLow
        }
        // ENDIAN!!!
        this.dword(lo)
        this.dword(hi)
    }
}

class GIOPDecoder extends GIOPBase {
    buffer: ArrayBuffer
    data: DataView
    bytes: Uint8Array

    littleEndian = true

    protected static textDecoder = new TextDecoder()

    constructor(buffer: ArrayBuffer) {
        super()
        this.buffer = buffer
        this.data = new DataView(buffer)
        this.bytes = new Uint8Array(this.buffer)
    }

    scanGIOPHeader(expectType: MessageType) {
        const magic = this.data.getUint32(0)
        if (magic !== 0x47494f50) {
            throw Error(`Missing GIOP Header Magic Number`)
        }

        const giopMajorVersion = this.data.getUint8(4)
        const giopMinorVersion = this.data.getUint8(5)
        if (giopMajorVersion !== GIOPBase.MAJOR_VERSION && giopMinorVersion !== GIOPBase.MINOR_VERSION) {
            throw Error(`Unsupported GIOP ${giopMajorVersion}.${giopMinorVersion}. Currently only IIOP ${GIOPBase.MAJOR_VERSION}.${GIOPBase.MINOR_VERSION} is implemented.`)
        }
       
        const byteOrder = this.data.getUint8(6)
        this.littleEndian = byteOrder === GIOPBase.ENDIAN_LITTLE

        const type = this.data.getUint8(7)
        if (type !== expectType) {
            throw Error(`Expected GIOP message type ${expectType} but got ${type}`)
        }

        const length = this.data.getUint32(8, GIOPEncoder.littleEndian)
        if (this.buffer.byteLength !== length + 12) {
            throw Error(`GIOP message is ${length + 12} bytes but buffer only contains ${this.buffer.byteLength}.`)
        }
    }

    decode(): any {
        const code = this.dword()
        if (code === 0x7fffff02) {
            const len = this.dword()
            // if len === 0xffffffff we have an indirection
            let name = this.string(len)
            if (name.length < 8 || name.substr(0, 4) !== "IDL:" || name.substr(name.length - 4) !== ":1.0")
                throw Error(`Unsupported CORBA GIOP Repository ID '${name}'`)

            name = name.substr(4, name.length - 8)
            if (name === "TPoint") {
                const obj = new Point()
                obj.decode(this)
                return obj
            }
            throw Error(`Unregistered CORBA Value Type 'IDL:${name}:1.0'`)
        }
    }

    blob(length?: number) {
        if (length === undefined)
            length = this.dword()
        const rawString = this.bytes.subarray(this.offset, this.offset + length)
        const value = GIOPDecoder.textDecoder.decode(rawString)
        this.offset += length
        return value
    }

    string(length?: number) {
        if (length === undefined)
            length = this.dword()
        const rawString = this.bytes.subarray(this.offset, this.offset + length - 1)
        const value = GIOPDecoder.textDecoder.decode(rawString)
        this.offset += length
        return value
    }

    byte() {
        const value = this.data.getUint8(this.offset)
        ++this.offset
        return value
    }

    word() {
        this.align(2)
        const value = this.data.getUint16(this.offset, this.littleEndian)
        this.offset += 2
        return value
    }

    dword() {
        this.align(4)
        const value = this.data.getUint32(this.offset, this.littleEndian)
        this.offset += 4
        return value
    }

    double() {
        this.align(8)
        const value = this.data.getFloat64(this.offset, this.littleEndian)
        this.offset += 8
        return value
    }

    // just in case the host doesn't support IEEE 754
    slowDouble() {
        this.align(8)
        const lo = this.dword()
        const hi = this.dword()

        const sign = ((hi >> 31) * 2 + 1)
        const exp = (hi >>> 20) & 0x7FF
        const mant = GIOPDecoder.TWO_TO_32 * (hi & 0xFFFFF) + lo

        if (exp == 0x7FF) {
            if (mant) {
                return NaN
            } else {
                return sign * Infinity
            }
        }
        if (exp == 0) {
            return sign * Math.pow(2, -1074) * mant
        }
        return sign * Math.pow(2, exp - 1075) * (mant + GIOPDecoder.TWO_TO_52)
    }
}

// ORB::object_to_string
// ORB::string_to_object

// Example IOR:
//
// 0000 01 00 00 00 0f 00 00 00 49 44 4c 3a 53 65 72 76 ........IDL:Serv
//      ^           ^           ^
//      |           |           OID: IDL:Server:1.0
//      |           len
//      byte order
// 0010 65 72 3a 31 2e 30 00 00 02 00 00 00 00 00 00 00 er:1.0..........
//                              ^           ^
//                              |           tag id: TAG_INTERNET_IOP (9.7.2 IIOP IOR Profiles)
//                              sequence length
// 0020 2b 00 00 00 01 01 00 00 0a 00 00 00 31 32 37 2e +...........127.
//      ^           ^           ^           ^
//      |           |           |           host
//      |           |           len
//      |           iiop version major/minor
//      tag length
// 0030 30 2e 31 2e 31 00 65 9c 13 00 00 00 2f 32 35 35 0.1.1.e...../255
//                        ^     ^           ^
//                        |     |           object key
//                        |     len
//                        port
// 0040 31 2f 31 35 32 34 38 39 35 31 36 38 2f 5f 30 00 1/1524895168/_0.
//
// 0050 01 00 00 00 24 00 00 00 01 00 00 00 01 00 00 00 ....$...........
//      ^           ^           ^           ^
//      |           |           |           component TAG_CODE_SETS ?
//      |           |           seq length?
//      |           tag length
//      tag id: TAG_MULTIPLE_COMPONENTS
// 0060 01 00 00 00 14 00 00 00 01 00 00 00 01 00 01 00 ................
//      ^           ^
//      |           len?
//      native code set?
// 0070 00 00 00 00 09 01 01 00 00 00 00 00             ............

class IOR {

    static TAG_INTERNET_IOP = 0
    static TAG_MULTIPLE_COMPONENTS = 1
    static TAG_SCCP_IOP = 2
    static TAG_UIPMC = 3
    static TAG_MOBILE_TERMINAL_IOP = 4

    host?: string
    port?: number
    objectKey?: string

    constructor(ior: string) {
        if (ior.substr(0, 4) != "IOR:")
            throw Error(`Missing "IOR:" prefix in "${ior}"`)
        if (ior.length & 1)
            throw Error(`IOR has a wrong length.`)

        const buffer = new ArrayBuffer((ior.length - 4) / 2)
        const bytes = new Uint8Array(buffer)
        for (let i = 4, j = 0; i < ior.length; i += 2, ++j) {
            bytes[j] = Number.parseInt(ior.substr(i, 2), 16)
        }

        // hexdump(bytes)

        const decoder = new GIOPDecoder(buffer)

        const byteOrder = decoder.byte()
        decoder.littleEndian = byteOrder === GIOPBase.ENDIAN_LITTLE

        const oid = decoder.string()
        if (oid !== "IDL:Server:1.0") {
            throw Error(`Unsupported OID '${oid}'. Currently only 'IDL:Server:1.0' is implemented.`)
        }

        const tagCount = decoder.dword()
        // console.log(`oid: '${oid}', tag count=${tagCount}`)

        for (let i = 0; i < tagCount; ++i) {
            const tagType = decoder.dword()
            const tagLength = decoder.dword()
            const tagStart = decoder.offset

            switch (tagType) {
                // 9.7.2 IIOP IOR Profiles
                case IOR.TAG_INTERNET_IOP: {
                    const iiopMajorVersion = decoder.byte()
                    const iiopMinorVersion = decoder.byte()
                    if (iiopMajorVersion !== GIOPBase.MAJOR_VERSION &&
                        iiopMinorVersion !== GIOPBase.MINOR_VERSION)
                    {
                        throw Error(`Unsupported IIOP ${iiopMajorVersion}.${iiopMinorVersion}. Currently only IIOP ${GIOPBase.MAJOR_VERSION}.${GIOPBase.MINOR_VERSION} is implemented.`)
                    }
                    this.host = decoder.string()
                    this.port = decoder.word()
                    this.objectKey = decoder.blob()
                    // console.log(`IIOP ${iiopMajorVersion}.${iiopMinorVersion} ${this.host}:${this.port} ${this.objectKey}`)
                } break
                // case IOR.TAG_MULTIPLE_COMPONENTS: {
                //     console.log(`Multiple Components`)
                //     const count = decoder.dword()
                //     console.log(`${count} components`)
                // } break
                // default:
                //     console.log(`Unhandled tag type=${tagType}`)
            }
            // const unread = tagLength - (decoder.offset - tagStart)
            // if (unread > 0)
            //     console.log(`note: ${unread} bytes at end of tag`)

            decoder.offset = tagStart + tagLength
        }
    }
}

class Point {
    x: number
    y: number

    constructor(x?: number , y?: number) {
        this.x = x !== undefined ? x : 0
        this.y = y !== undefined ? y : 0
    }

    // something like these would later be generated by the IDL compiler
    // try to keep initializing objects from JSON as this also served nicely to serialize from/to databases.
    encode(encoder: GIOPEncoder) {
        encoder.type("TPoint")
        encoder.double(this.x)
        encoder.double(this.y)
    }

    decode(decoder: GIOPDecoder) {
        this.x = decoder.double()
        this.y = decoder.double()
    }
}

describe("GIOP", () => {
    it("do something binary", () => {
        const encoder = new GIOPEncoder()
       
        const p = new Point(3.1415, 2.7182)
        p.encode(encoder)

        // encoder.hexdump()

        const decoder = new GIOPDecoder(encoder.buf)
        decoder.offset = 0x18
        const pointOut = decoder.decode() as Point

        console.log(`point out = ${pointOut.x}, ${pointOut.y}`)
        expect(pointOut.x).to.equal(3.1415)
        expect(pointOut.y).to.equal(2.7182)
    })

    it.only("decode IOR", () => {
        // the idea is to test the GIOP encoding/decoding with MICO
        // for this we're going to use a IOR to connect to MICO
        // and hence we need to decode it

        // Spec: CORBA 3.3, 7.6.2 Interoperable Object References: IORs
        const ior = new IOR("IOR:010000000f00000049444c3a5365727665723a312e30000002000000000000002f000000010100000e0000003139322e3136382e312e313035002823130000002f313039322f313632363830313131332f5f30000100000024000000010000000100000001000000140000000100000001000100000000000901010000000000")

        const client = new net.Socket()
        client.connect(ior.port!, ior.host!, function() {
            console.log("connected")

            const encoder = new GIOPEncoder()
            encoder.skipGIOPHeader()

            encoder.dword(0) // serviceContextListLength
            const requestId = 1
            encoder.dword(requestId)
            const responseExpected = MessageType.REPLY
            encoder.byte(responseExpected)
            encoder.blob(ior.objectKey!)
            encoder.string("getPoint")
            encoder.dword(0) // Requesting Principal length
            encoder.setGIOPHeader(MessageType.REQUEST)

            client.write(encoder.bytes.subarray(0, encoder.offset))
            
            console.log(`wrote ${encoder.offset} bytes`)
            hexdump(encoder.bytes, 0, encoder.offset)
        })

        client.on("data", function(data: Buffer) {
            console.log("received")
            hexdump(data)

            const decoder = new GIOPDecoder(data.buffer)
            decoder.scanGIOPHeader(MessageType.REPLY)
            console.log(`mico answered in ${decoder.littleEndian ? "little" : "big"} endian`)

            // scanReplyHeader()
            // offset should now be 16 ????

            // dword serviceContextListLength should be 0
            // dword requestId should be the 1 from the previous request
            // dword replyStatus, 0 means no exception

            // offset should now be 0x18
            decoder.offset = 0x18
            const pointOut = decoder.decode() as Point
            console.log(`point out = ${pointOut.x}, ${pointOut.y}`)
            // expect(pointOut.x).to.equal(3.1415)
            // expect(pointOut.y).to.equal(2.7182)

            client.destroy()
        })

    })
})

function hexdump(bytes: Uint8Array, addr = 0, length = bytes.byteLength) {
    while (addr < length) {
        let line = addr.toString(16).padStart(4, "0")
        for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j)
            line += " " + bytes[j].toString(16).padStart(2, "0")
        line = line.padEnd(4 + 16 * 3 + 1, " ")
        for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j) {
            const b = bytes[j]
            if (b >= 32 && b <= 127)
                line += String.fromCharCode(b)
            else
                line += "."
        }
        addr += 16
        console.log(line)
    }
}
