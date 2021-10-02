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

import { CORBAObject, ORB, IOR, Stub, Skeleton, ValueTypeInformation } from "corba.js"

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

    orb?: ORB
    constructor(orb?: ORB) {
        this.orb = orb
    }

    align(alignment: number) {
        const inversePadding = this.offset % alignment
        if (inversePadding !== 0)
            this.offset += alignment - inversePadding
    }
}

export class GIOPEncoder extends GIOPBase {
    buffer = new ArrayBuffer(0xFFFF); // FIXME: write code to extend on demand, fragment really large messages?
    data = new DataView(this.buffer);
    bytes = new Uint8Array(this.buffer);

    protected static textEncoder = new TextEncoder();
    static littleEndian?: boolean

    protected repositoryIds = new Map<string, number>()
    protected objectPosition = new Map<Object, number>()

    constructor(orb?: ORB) {
        super(orb)
        // use this system's endianes
        if (GIOPEncoder.littleEndian === undefined) {
            const buffer = new ArrayBuffer(2)
            new Int16Array(buffer)[0] = 0x1234
            GIOPEncoder.littleEndian = new DataView(buffer).getUint8(0) === 0x34
        }
    }

    get buf() {
        return this.buffer
    }

    skipGIOPHeader() {
        this.offset = 10
    }

    // this is the last method to be called as it also set's the GIOP messsages size
    // from the already encoded data
    setGIOPHeader(type: MessageType) {
        this.data.setUint32(0, 0x47494f50) // magic "GIOP"

        this.data.setUint8(4, GIOPEncoder.MAJOR_VERSION)
        this.data.setUint8(5, GIOPEncoder.MINOR_VERSION)
        this.data.setUint8(6, GIOPEncoder.littleEndian ? GIOPEncoder.ENDIAN_LITTLE : GIOPEncoder.ENDIAN_BIG)
        this.data.setUint8(7, type)

        // message size
        this.data.setUint32(8, this.offset - 12, GIOPEncoder.littleEndian)
    }

    encodeRequest(objectKey: string, method: string, requestId = 1, responseExpected: boolean) {
        this.skipGIOPHeader()
        this.ulong(0) // serviceContextListLength
        this.ulong(requestId)
        this.byte(responseExpected ? 1 : 0)
        this.blob(objectKey!)
        this.string(method)
        this.ulong(0) // Requesting Principal length
    }

    encodeReply(requestId: number, replyStatus: number = GIOPDecoder.NO_EXCEPTION) {
        this.skipGIOPHeader()
        this.ulong(0) // serviceContextListLength
        this.ulong(requestId)
        this.ulong(replyStatus)
    }

    setReplyHeader(requestId: number, replyStatus: number = GIOPDecoder.NO_EXCEPTION) {
        this.skipGIOPHeader()
        this.encodeReply(requestId, replyStatus)
    }

    skipReplyHeader() {
        this.offset = 24
    }

    repositoryId(name: string) {
        // * "IDL:" indicates that the type was defined in an IDL file
        // * ":1.0" is the types version. 1.0 is used per default
        // * in the IDL, #pragma version (CORBA 3.4 Part 1, 14.7.5.3 The Version Pragma) can be used to specify other versions
        //   * TBD: describe how to use versioning
        // * in the IDL, #pragma prefix can be used to add a prefix to the name.
        // * See also: CORBA Part 2, 9.3.4.1 Partial Type Information and Versioning
        const id = `IDL:${name}:1.0`

        const position = this.repositoryIds.get(id)
        if (position === undefined) {
            console.log(`repositoryID '${id}' at 0x${this.offset.toString(16)}`)
            this.repositoryIds.set(id, this.offset)
            this.ulong(0x7fffff02) // single repositoryId
            this.string(id)
        } else {
            // 9.3.4.3
            const indirection = position - this.offset - 2
            console.log(`repositoryID '${id}' at 0x${this.offset.toString(16)} to reuse repositoryID at 0x${position.toString(16)}`)
            this.ulong(0x7fffff02) // single repositoryId
            this.ulong(0xffffffff) // sure? how the heck to we distinguish indirections to object and repositoryId?
            this.long(indirection)
        }
    }

    reference(object: CORBAObject) {
        const className = (object.constructor as any)._idlClassName()
        this.string(`IDL:${className}:1.0`)

        this.ulong(1) // profileCount
        
        this.ulong(IOR.TAG.IOR.INTERNET_IOP)
        const offsetSize = this.offset
        this.ulong(0) // profileLength
        const offsetDataStart = this.offset

        this.byte(GIOPBase.MAJOR_VERSION)
        this.byte(GIOPBase.MINOR_VERSION)

        // FIXME
        this.string("localhost")
        this.short(8080)
        this.blob(`${object.id}`)

        const offsetDataEnd = this.offset
        this.offset = offsetSize
        this.ulong(offsetDataEnd - offsetDataStart)
        this.offset = offsetDataEnd
    }

    object(object: Object) {
        if (object instanceof Stub) {
            throw Error("ORB: can not serialize Stub yet")
        }
        if (object instanceof Skeleton) {
            if (this.orb === undefined) {
                throw Error("GIOPEncoder has no ORB defined. Can not add object to ACL.")
            }
            this.orb.aclAdd(object)

            this.reference(object)
            return
            // return `{"#R":"${(object.constructor as any)._idlClassName()}","#V":${object.id}}`
        }      

        const position = this.objectPosition.get(object)
        if (position !== undefined) {
            const indirection = position - this.offset - 2
            this.ulong(0xffffffff)
            this.long(indirection)
            return
        }

        let prototype = Object.getPrototypeOf(object)

        let valueTypeInformation: ValueTypeInformation | undefined
        while (prototype !== null) {
            valueTypeInformation = ORB.valueTypeByPrototype.get(prototype)
            if (valueTypeInformation !== undefined)
                break
            prototype = Object.getPrototypeOf(prototype)
        }

        if (valueTypeInformation === undefined) {
            console.log(object)
            throw Error(`ORB: can not serialize object of unregistered valuetype ${object.constructor.name}`)
        }
        this.objectPosition.set(object, this.offset)
        valueTypeInformation.encode(this, object)
      
    }

    blob(value: string) {
        this.ulong(value.length)
        const rawString = GIOPEncoder.textEncoder.encode(value)
        this.bytes.set(rawString, this.offset)
        this.offset += value.length
    }

    string(value: string) {
        this.ulong(value.length + 1)
        this.bytes.set(GIOPEncoder.textEncoder.encode(value), this.offset)
        this.offset += value.length
        this.bytes[this.offset] = 0
        this.offset++
    }

    sequence<T>(array: T[], encodeItem: (a:T) => void) {
        this.ulong(array.length)
        array.forEach(encodeItem)
    }

    byte(value: number) {
        this.data.setUint8(this.offset, value)
        this.offset += 1
    }

    short(value: number) {
        this.align(2)
        this.data.setInt16(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 2
    }

    ushort(value: number) {
        this.align(2)
        this.data.setUint16(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 2
    }

    long(value: number) {
        this.align(4)
        this.data.setInt32(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 4
    }

    ulong(value: number) {
        this.align(4)
        this.data.setUint32(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 4
    }

    longlong(value: bigint) {
        this.align(8)
        this.data.setBigInt64(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 8
    }

    ulonglong(value: bigint) {
        this.align(8)
        this.data.setBigUint64(this.offset, value, GIOPEncoder.littleEndian)
        this.offset += 8
    }

    float(value: number) {
        this.align(4)
        this.data.setFloat32(this.offset, value, GIOPEncoder.littleEndian)
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
        this.ulong(lo)
        this.ulong(hi)
    }
}

class RequestData {
    requestId!: number
    responseExpected!: boolean
    objectKey!: string
    method!: string
}

class ReplyData {
    requestId!: number
    replyStatus!: number
}

class ObjectReference {
    oid!: string
    host!: string
    port!: number
    objectKey!: string
    toString(): string {
        return `ObjectReference(oid=${this.oid}, host=${this.host}, port=${this.port}, objectKey=${this.objectKey}')`
    }
}

export class GIOPDecoder extends GIOPBase {
    buffer: ArrayBuffer
    data: DataView
    bytes: Uint8Array

    littleEndian = true

    // FIXME: make protected
    public objects = new Map<number, Object>()

    protected static textDecoder = new TextDecoder()

    constructor(buffer: ArrayBuffer, orb?: ORB) {
        super(orb)
        this.buffer = buffer
        this.data = new DataView(buffer)
        this.bytes = new Uint8Array(buffer)
    }

    scanGIOPHeader(): MessageType {
        const magic = this.data.getUint32(0)
        if (magic !== 0x47494f50) {
            throw Error(`Missing GIOP Header Magic Number (got 0x${magic.toString(16)}, expected 0x47494f50`)
        }
        this.offset += 4

        const giopMajorVersion = this.byte()
        const giopMinorVersion = this.byte()
        if (giopMajorVersion !== GIOPBase.MAJOR_VERSION && giopMinorVersion !== GIOPBase.MINOR_VERSION) {
            throw Error(`Unsupported GIOP ${giopMajorVersion}.${giopMinorVersion}. Currently only IIOP ${GIOPBase.MAJOR_VERSION}.${GIOPBase.MINOR_VERSION} is implemented.`)
        }

        this.endian()
        const type = this.byte()
        const length = this.ulong()
        if (this.buffer.byteLength !== length + 12) {
            throw Error(`GIOP message is ${length + 12} bytes but buffer contains ${this.buffer.byteLength}.`)
        }

        return type
    }

    // ReplyStatusType
    static NO_EXCEPTION = 0
    static USER_EXCEPTION = 1
    static SYSTEM_EXCEPTION = 2
    static LOCATION_FORWARD = 3
    // since GIOP 1.2
    static LOCATION_FORWARD_PERM = 4
    static NEEDS_ADDRESSING_MODE = 5

    scanRequestHeader(): RequestData {
        const serviceContextListLength = this.ulong()
        if (serviceContextListLength !== 0)
            throw Error(`serviceContextList is not supported`)

        const data = new RequestData()
        data.requestId = this.ulong()
        data.responseExpected = this.byte() != 0
        data.objectKey = this.blob()
        data.method = this.string()
        const requestingPrincipalLength = this.ulong()

        // console.log(`requestId=${data.requestId}, responseExpected=${data.responseExpected}, objectKey=${data.objectKey}, method=${data.method}, requestingPrincipalLength=${requestingPrincipalLength}`)
        return data
    }

    scanReplyHeader(): ReplyData {
        const serviceContextListLength = this.ulong()
        if (serviceContextListLength !== 0)
            throw Error(`serviceContextList is not supported`)

        const data = new ReplyData()

        data.requestId = this.ulong()
        data.replyStatus = this.ulong()
        switch (data.replyStatus) {
            case GIOPDecoder.NO_EXCEPTION:
                break
            case GIOPDecoder.USER_EXCEPTION:
                break
            case GIOPDecoder.SYSTEM_EXCEPTION:
                // 0.4.3.2 ReplyBody: SystemExceptionReplyBody
                const exceptionId = this.string()
                const minorCodeValue = this.ulong()
                // const vendorMinorCodeSetId = minorCodeValue & 0xFFF00000
                const minorCode = minorCodeValue & 0x000FFFFF
                // org.omg.CORBA.CompletionStatus
                const completionStatus = this.ulong()
                let completionStatusName
                switch (completionStatus) {
                    case 0:
                        completionStatusName = "yes"
                        break
                    case 1:
                        completionStatusName = "no"
                        break
                    case 2:
                        completionStatusName = "maybe"
                        break
                    default:
                        completionStatusName = `${completionStatus}`
                }
                // A.5 Exception Codes
                switch (exceptionId) {
                    case "IDL:omg.org/CORBA/MARSHAL:1.0": {
                        let minorCodeExplanation: { [index: number]: string } = {
                            1: "Unable to locate value factory.",
                            2: "ServerRequest::set_result called before ServerRequest::ctx when the operation IDL contains a context clause.",
                            3: "NVList passed to ServerRequest::arguments does not describe all parameters passed by client.",
                            4: "Attempt to marshal local object.",
                            5: "wchar or wstring data erroneosly sent by client over GIOP 1.0 connection",
                            6: "wchar or wstring data erroneously returned by server over GIOP 1.0 connection.",
                            7: "Unsupported RMI/IDL custom value type stream format.",
                        }
                        const explanation = minorCode in minorCodeExplanation ? ` (${minorCodeExplanation[minorCode]})` : ""
                        throw Error(`Received CORBA System Exception ${exceptionId} (encoding/decoding failed): minor code ${minorCode}${explanation}, operation completed: ${completionStatusName}`)
                    }
                    default: {
                        throw Error(`Received CORBA System Exception ${exceptionId}: minor code ${minorCode}, operation completed: ${completionStatusName}`)
                    }
                }
                break
            default:
                throw Error(`ReplyStatusType ${data.replyStatus} is not supported`)
        }
        return data
    }

    reference(length: number | undefined = undefined): ObjectReference {
        const data = new ObjectReference()

        // struct IOR, field: string type_id ???
        data.oid = this.string(length)

        // struct IOR, field: TaggedProfileSeq profiles ???
        const profileCount = this.ulong()
        // console.log(`oid: '${oid}', tag count=${tagCount}`)
        for (let i = 0; i < profileCount; ++i) {
            const profileId = this.ulong()
            const profileLength = this.ulong()
            const profileStart = this.offset

            switch (profileId) {
                // CORBA 3.3 Part 2: 9.7.2 IIOP IOR Profiles
                case IOR.TAG.IOR.INTERNET_IOP: {
                    // console.log(`Internet IOP Component, length=${profileLength}`)
                    const iiopMajorVersion = this.byte()
                    const iiopMinorVersion = this.byte()
                    if (iiopMajorVersion !== GIOPBase.MAJOR_VERSION &&
                        iiopMinorVersion !== GIOPBase.MINOR_VERSION) {
                        throw Error(`Unsupported IIOP ${iiopMajorVersion}.${iiopMinorVersion}. Currently only IIOP ${GIOPBase.MAJOR_VERSION}.${GIOPBase.MINOR_VERSION} is implemented.`)
                    }
                    data.host = this.string()
                    data.port = this.short()
                    data.objectKey = this.blob()

                    // IIOP 1.1 and above
                    // TaggedComponentSeq

                    // console.log(`IIOP ${iiopMajorVersion}.${iiopMinorVersion} ${this.host}:${this.port} ${this.objectKey}`)
                } break

                default:
                    // console.log(`Unhandled tag type=${profileId}`)
            }
            this.offset = profileStart + profileLength
        }
        return data
    }

    // TODO: rather 'value' than 'object' as this is for valuetypes?
    object(): any {
        // throw Error(`GIOPDecoder.object() is not implemented yet`)

        // console.log(`decode() at 0x${this.offset.toString(16)}`)
        const objectOffset = this.offset + 6

        const code = this.ulong()
        switch (code) {
            case 0x7fffff02: {
                const memo = this.offset
                let name
                const len = this.ulong()
                if (len !== 0xffffffff) {
                    name = this.string(len)
                } else {
                    const indirection = this.long()
                    const savedOffset = this.offset
                    this.offset = this.offset + indirection - 4
                    console.log(`indirect repository ID should be at 0x${this.offset.toString(16)}`)
                    name = this.string()
                    this.offset = savedOffset
                }
                // console.log(`repositoryID '${name}' at 0x${memo.toString(16)}`)
                if (name.length < 8 || name.substring(0, 4) !== "IDL:" || name.substring(name.length - 4) !== ":1.0")
                    throw Error(`Unsupported CORBA GIOP Repository ID '${name}'`)
                const shortName = name.substring(4, name.length - 4)

                let valueTypeInformation = ORB.valueTypeByName.get(shortName)
                if (valueTypeInformation === undefined)
                    throw Error(`Unregistered Repository ID '${name}' (${shortName})`)
                    // throw Error(`ORB: can not deserialize object of unregistered valuetype '${shortName}'`)
        // let object = new (valueTypeInformation.construct as any)()
        // for(let [innerAttribute, innerValue] of Object.entries(value)) {
        //     object[innerAttribute] = this._deserialize(innerValue)
        // }
        // return object

                // const c = this.valueTypes.get(shortName)
                // if (c === undefined) {
                //     throw Error(`Unregistered Repository ID '${name}' (${shortName})`)
                // }
                const obj = new (valueTypeInformation.construct as any)(this)
                this.objects.set(objectOffset, obj)
                return obj
            }
            case 0xffffffff: {
                const indirection = this.long()
                const position = this.offset + indirection
                // console.log(`Need to find previously generated object at 0x${position.toString(16)}`)
                const obj = this.objects.get(position)
                if (obj === undefined) {
                    throw Error("IDL:omg.org/CORBA/MARSHAL:1.0")
                }
                return obj
            }
            default:
                // TODO: this looks like a hack... plus: can't the IDL compiler not already use reference instead of object?
                if (code < 0x7fffff00) {
                    if (this.orb === undefined)
                        throw Error("GIOPDecoder has no ORB defined. Can not resolve resolve reference to stub object.")
                    const reference = this.reference(code)

                    // TODO: this belongs elsewhere
                    let object = this.orb.stubsById.get(reference.objectKey)
                    if (object !== undefined)
                        return object
                    const shortName = reference.oid.substring(4,reference.oid.length-4)
                    let aStubClass = this.orb.stubsByName.get(shortName)
                    if (aStubClass === undefined) {
                        throw Error(`ORB: no stub registered for OID '${reference.oid} (${shortName})'`)
                    }
                    object = new aStubClass(this.orb, reference.objectKey)
                    this.orb.stubsById.set(reference.objectKey, object!)
                    return object
                } else {
                    throw Error(`GIOPDecoder: Unsupported value with CORBA tag 0x${code.toString(16)}`)
                }
        }
    }

    // protected valueTypes = new Map<string, Function>()

    // registerValueType(valuetypeConstructor: Function, spec: string) {
    //     this.valueTypes.set(spec, valuetypeConstructor)
    // }

    endian() {
        const byteOrder = this.byte()
        this.littleEndian = byteOrder === GIOPBase.ENDIAN_LITTLE
    }

    blob(length?: number) {
        if (length === undefined)
            length = this.ulong()
        const rawString = this.bytes.subarray(this.offset, this.offset + length)
        const value = GIOPDecoder.textDecoder.decode(rawString)
        this.offset += length
        return value
    }

    string(length?: number) {
        if (length === undefined)
            length = this.ulong()
        const rawString = this.bytes.subarray(this.offset, this.offset + length - 1)
        const value = GIOPDecoder.textDecoder.decode(rawString)
        this.offset += length
        return value
    }

    sequence<T>(decodeItem: () => T): T[] {
        const length = this.ulong()
        const array = new Array(length)
        for(let i=0; i<length; ++i) {
            array[i] = decodeItem()
        }
        return array
    }

    // char, octet
    byte() {
        const value = this.data.getUint8(this.offset)
        ++this.offset
        return value
    }

    short() {
        this.align(2)
        const value = this.data.getInt16(this.offset, this.littleEndian)
        this.offset += 2
        return value
    }

    ushort() {
        this.align(2)
        const value = this.data.getUint16(this.offset, this.littleEndian)
        this.offset += 2
        return value
    }

    long() {
        this.align(4)
        const value = this.data.getInt32(this.offset, this.littleEndian)
        this.offset += 4
        return value
    }

    ulong() {
        this.align(4)
        const value = this.data.getUint32(this.offset, this.littleEndian)
        this.offset += 4
        return value
    }

    longlong() {
        this.align(8)
        const value = this.data.getBigInt64(this.offset, this.littleEndian)
        this.offset += 8
        return value
    }

    ulonglong() {
        this.align(8)
        const value = this.data.getBigUint64(this.offset, this.littleEndian)
        this.offset += 8
        return value
    }

    float() {
        this.align(4)
        const value = this.data.getFloat32(this.offset, this.littleEndian)
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
        const lo = this.ulong()
        const hi = this.ulong()

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

