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

// 9.4 GIOP Message Formats
export enum MessageType {
    REQUEST = 0,
    REPLY = 1,
    CANCEL_REQUEST = 2,
    LOCATE_REQUEST = 3,
    LOCATE_REPLY = 4,
    CLOSE_CONNECTION = 5,
    MESSAGE_ERROR = 6,
    FRAGMENT = 7
}

export class GIOPBase {
    offset = 0;

    static MAJOR_VERSION = 1;
    static MINOR_VERSION = 0;

    static ENDIAN_BIG = 0;
    static ENDIAN_LITTLE = 1;

    static FLOAT64_MAX = 1.7976931348623157e+308;
    static FLOAT64_MIN = 2.2250738585072014e-308;
    static TWO_TO_20 = 1048576;
    static TWO_TO_32 = 4294967296;
    static TWO_TO_52 = 4503599627370496;

    align(alignment: number) {
        const inversePadding = this.offset % alignment
        if (inversePadding !== 0)
            this.offset += alignment - inversePadding
    }
}

export class GIOPEncoder extends GIOPBase {
    buffer = new ArrayBuffer(0x16 * 10); // write code to extend on demand, fragment really large messages?
    data = new DataView(this.buffer);
    bytes = new Uint8Array(this.buffer);

    protected static textEncoder = new TextEncoder();

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

    encodeRequest(objectKey: string, method: string) {
        this.skipGIOPHeader()
        this.dword(0) // serviceContextListLength
        const requestId = 1
        this.dword(requestId)
        const responseExpected = MessageType.REPLY
        this.byte(responseExpected)
        this.blob(objectKey!)
        this.string(method)
        this.dword(0) // Requesting Principal length
        this.setGIOPHeader(MessageType.REQUEST)
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
        this.dword(value.length + 1)
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
        }
        else if (isNaN(value)) {
            hi = 0x7fffffff
            lo = 0xffffffff
        }
        else if (value > GIOPEncoder.FLOAT64_MAX) {
            hi = ((sign << 31) | (0x7FF00000)) >>> 0
            lo = 0
        }
        else if (value < GIOPEncoder.FLOAT64_MIN) {
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
                    exp++
                    x = x / 2
                }
            } else {
                while (x < 1 && exp > minDoubleExponent) {
                    x = x * 2
                    exp--
                }
            }
            let mant = value * Math.pow(2, -exp)

            var mantHigh = (mant * GIOPEncoder.TWO_TO_20) & 0xFFFFF
            var mantLow = (mant * GIOPEncoder.TWO_TO_52) >>> 0

            hi = ((sign << 31) | ((exp + 1023) << 20) | mantHigh) >>> 0
            lo = mantLow
        }
        // ENDIAN!!!
        this.dword(lo)
        this.dword(hi)
    }
}

export class GIOPDecoder extends GIOPBase {
    buffer: ArrayBuffer
    data: DataView
    bytes: Uint8Array

    littleEndian = true;

    protected static textDecoder = new TextDecoder();

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
        this.offset += 4

        const giopMajorVersion = this.byte()
        const giopMinorVersion = this.byte()
        if (giopMajorVersion !== GIOPBase.MAJOR_VERSION && giopMinorVersion !== GIOPBase.MINOR_VERSION) {
            throw Error(`Unsupported GIOP ${giopMajorVersion}.${giopMinorVersion}. Currently only IIOP ${GIOPBase.MAJOR_VERSION}.${GIOPBase.MINOR_VERSION} is implemented.`)
        }

        const byteOrder = this.byte()
        this.littleEndian = byteOrder === GIOPBase.ENDIAN_LITTLE

        const type = this.byte()
        if (type !== expectType) {
            throw Error(`Expected GIOP message type ${expectType} but got ${type}`)
        }

        const length = this.dword()
        if (this.buffer.byteLength !== length + 12) {
            throw Error(`GIOP message is ${length + 12} bytes but buffer only contains ${this.buffer.byteLength}.`)
        }
    }

    scanReplyHeader() {
        const serviceContextListLength = this.dword()
        if (serviceContextListLength !== 0)
            throw Error(`serviceContextList is not supported`)
        const requestId = this.dword()
        const replyStatus = this.dword()
        if (replyStatus !== 0)
            throw Error(`replyState !0 is not supported`)
        // dword serviceContextListLength should be 0
        // dword requestId should be the 1 from the previous request
        // dword replyStatus, 0 means no exception
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

