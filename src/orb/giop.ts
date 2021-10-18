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

    majorVersion = 1
    minorVersion = 2

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

    public static textEncoder = new TextEncoder();
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

        this.data.setUint8(4, this.majorVersion)
        this.data.setUint8(5, this.minorVersion)
        this.data.setUint8(6, GIOPEncoder.littleEndian ? GIOPEncoder.ENDIAN_LITTLE : GIOPEncoder.ENDIAN_BIG)
        this.data.setUint8(7, type)

        // message size
        this.data.setUint32(8, this.offset - 12, GIOPEncoder.littleEndian)
    }

    // additonal operation names b
    // _get_<attribute>
    // _set_<attribute>
    // _interface
    // _is_a
    // _non_existent (additionally _not_existent when using GIOP <= 1.1)
    // _domain_managers
    // _component
    // _repository_id

    encodeRequest(objectKey: Uint8Array, operation: string, requestId = 1, responseExpected: boolean) {
        this.skipGIOPHeader()

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            this.serviceContext()
        }
        this.ulong(requestId)
        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            this.octet(responseExpected ? 1 : 0)
        } else {
            this.octet(responseExpected ? 3 : 0)
        }

        this.offset += 3

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            this.blob(objectKey!)
        } else {
            this.ushort(AddressingDisposition.KeyAddr)
            this.blob(objectKey!)
        }
        
        this.string(operation)
        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            this.ulong(0) // Requesting Principal length
        } else {
            this.serviceContext()
            this.align(8)
        }
    }

    encodeReply(requestId: number, replyStatus: number = ReplyStatus.NO_EXCEPTION) {
        this.skipGIOPHeader()
        // fixme: create and use version methods like isVersionLessThan(1,2) or isVersionVersionGreaterEqual(1,2)
        if (this.majorVersion == 1 && this.minorVersion < 2) {
            this.serviceContext()
        }
        this.ulong(requestId)
        this.ulong(replyStatus)
        if (this.majorVersion == 1 && this.minorVersion >= 2) {
            this.serviceContext()
        }
    }

    // 0100 0000 0500 0000 2400 0000 0101 0000 ........$.......
    // 0d00 0000 3139 322e 3136 382e 312e 3130 ....192.168.1.10
    // 0000 50c9 0800 0000 0100 0000 0000 0000 ..P.............
    // 0400 0000 666f 6f00                     ....foo.`)
    serviceContext() {
        this.ulong(0)
        return

        // this.align(4)
        // console.log(`0x${this.offset.toString(16)}: SERVICE CONTEXT`)
        // 
        // console.log(`0x${this.offset.toString(16)}: entries: 1`)
        this.ulong(1) // emit one service context // 1
        
        // console.log(`0x${this.offset.toString(16)}: BI_DIR_IIOP 5`)
        this.ulong(ServiceId.BI_DIR_IIOP) // 2
        // console.log(`0x${this.offset.toString(16)}: reserve size`)
        this.reserveSize() // 3

        // console.log(`0x${this.offset.toString(16)}: one address`)
        this.ulong(1) // one address // 4
        // console.log(`0x${this.offset.toString(16)}: hostname`)
        this.string(this.orb?.localAddress!) // 5
        // console.log(`0x${this.offset.toString(16)}: port`)
        this.ushort(this.orb?.localPort!) // 6
        // console.log(`0x${this.offset.toString(16)}: done`)

        this.fillinSize()
    }

    sizeStack: number[] = []

    // FIXME: find better names and use them everywhere
    reserveSize() {
        this.align(4)
        this.offset += 4
        this.sizeStack.push(this.offset)
    }

    fillinSize() {
        const currrentOffset = this.offset
        const savedOffset = this.sizeStack.pop()
        if (savedOffset === undefined)
            throw Error(`internal error: fillinSize() misses reserveSize()`)
        this.offset = savedOffset - 4
        const size = currrentOffset - savedOffset
        console.log(`0x${this.offset.toString(16)}: insert size 0x${size.toString(16)}`)
        this.ulong(size)
        this.offset = currrentOffset
        console.log(`0x${this.offset.toString(16)}: END OF SERVICE CONTEXT`)
    }

    // FIXME: rename into ...?
    setReplyHeader(requestId: number, replyStatus: number = ReplyStatus.NO_EXCEPTION) {
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
            // console.log(`GIOPDecoder.repositoryId(): at 0x${this.offset.toString(16)} writing repository ID '${id}' at 0x${this.offset.toString(16)}`)
            this.repositoryIds.set(id, this.offset)
            this.ulong(0x7fffff02) // single repositoryId
            // console.log(`=====> place string '${id}' at 0x${this.offset.toString(16)}`)
            this.string(id)
        } else {
            // 9.3.4.3
            const indirection = position - this.offset - 2
            // console.log(`GIOPDecoder.repositoryId(): at 0x${this.offset.toString(16)} writing indirect repository ID '${id}' indirection ${indirection} pointing to 0x${position.toString(16)}`)
            this.ulong(0x7fffff02) // single repositoryId
            this.ulong(0xffffffff) // sure? how the heck to we distinguish indirections to object and repositoryId?
            this.long(indirection - 2)
        }
    }

    // IOR
    reference(object: CORBAObject) {
        // console.log(`GIOPEncoder.object(...) ${this.orb!.localAddress}:${this.orb!.localPort}`)
        const className = (object.constructor as any)._idlClassName()
        this.string(`IDL:${className}:1.0`)

        this.ulong(1) // profileCount

        this.ulong(IOR.TAG.IOR.INTERNET_IOP)
        this.reserveSize()

        this.octet(1) // IIOP major
        this.octet(1) // IIOP minor

        // FIXME: the object should know where it is located, at least, if it's a stub, skeleton is local
        this.string(this.orb!.localAddress!)
        this.short(this.orb!.localPort!)
        this.blob(object.id)

        // IIOP >= 1.1: components
        this.ulong(0) // component count = 0

        this.fillinSize()
    }

    object(object: Object) {
        // console.log(`GIOPEncoder.object(...) ${this.orb!.localAddress}:${this.orb!.localPort}`)
        if (object instanceof Stub) {
            throw Error("ORB: can not serialize Stub yet")
        }

        if (object instanceof Skeleton) {
            if (this.orb === undefined) {
                throw Error("GIOPEncoder has no ORB defined. Can not add object to ACL.")
            }
            this.orb.aclAdd(object)
            // console.log("GIOPEncoder.object(...) -> .reference(...)")
            this.reference(object)
            return
            // return `{"#R":"${(object.constructor as any)._idlClassName()}","#V":${object.id}}`
        }

        const position = this.objectPosition.get(object)
        if (position !== undefined) {
            let indirection = position - this.offset - 2
            // console.log(`GIOPEncoder.object(): at 0x${this.offset.toString(16)} write object indirection ${indirection} pointing to 0x${position.toString(16)}`)
            this.ulong(0xffffffff)
            indirection -= 2
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

    blob(value: Uint8Array) {
        this.ulong(value.length)
        this.bytes.set(value, this.offset)
        this.offset += value.length
    }

    string(value: string) {
        this.ulong(value.length + 1)
        this.bytes.set(GIOPEncoder.textEncoder.encode(value), this.offset)
        this.offset += value.length
        this.bytes[this.offset] = 0
        this.offset++
    }

    sequence<T>(array: T[], encodeItem: (a: T) => void) {
        // console.log(`GIOPEncoder.sequence(): ENCODE SEQUENCE WITH ${array.length} ENTRIES AT 0x${this.offset.toString(16)}`)
        this.ulong(array.length)
        array.forEach((value, index) => {
            // console.log(`GIOPEncoder.sequence(): ENCODE ITEM ${index} AT 0x${this.offset.toString(16)}`)
            encodeItem(value)
        })
        // console.log(`GIOPEncoder.sequence(): ENCODED SEQUENCE WITH ${array.length} ENTRIES`)
    }

    bool(value: boolean) {
        this.data.setUint8(this.offset, value ? 1 : 0)
        this.offset += 1
    }

    char(value: number) {
        this.data.setUint8(this.offset, value)
        this.offset += 1
    }

    octet(value: number) {
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
}

class RequestData {
    requestId!: number
    responseExpected!: boolean
    objectKey!: Uint8Array
    method!: string
}

class ReplyData {
    requestId!: number
    replyStatus!: ReplyStatus
}

class LocateRequest {
    requestId!: number
    objectKey!: Uint8Array
}

export enum LocateStatusType {
    UNKNOWN_OBJECT = 0,
    OBJECT_HERE = 1,
    OBJECT_FORWARD = 2,
    // GIOP >= 1.2
    OBJECT_FORWARD_PERM = 3,
    LOC_SYSTEM_EXCEPTION = 4,
    LOC_NEEDS_ADDRESSING_MODE = 5
}

class LocateReply {
    requestId!: number
    status!: LocateStatusType
}

class ObjectReference {
    oid!: string
    host!: string
    port!: number
    objectKey!: Uint8Array
    toString(): string {
        return `ObjectReference(oid=${this.oid}, host=${this.host}, port=${this.port}, objectKey=${this.objectKey}')`
    }
}

export enum AddressingDisposition {
    KeyAddr = 0,
    ProfileAddr = 1,
    ReferenceAddr = 2
}

export enum ReplyStatus {
    NO_EXCEPTION = 0,
    USER_EXCEPTION = 1,
    SYSTEM_EXCEPTION = 2,
    LOCATION_FORWARD = 3,
    // since GIOP 1.2
    LOCATION_FORWARD_PERM = 4,
    NEEDS_ADDRESSING_MODE = 5
}

export enum ServiceId {
    TransactionService = 0,
    CodeSets = 1,
    ChainBypassCheck = 2,
    ChainBypassInfo = 3,
    LogicalThreadId = 4,
    BI_DIR_IIOP = 5,
    SendingContextRunTime = 6,
    INVOCATION_POLICIES = 7,
    FORWARDED_IDENTITY = 8,
    UnknownExceptionInfo = 9,
    RTCorbaPriority = 10,
    RTCorbaPriorityRange = 11,
    FT_GROUP_VERSION = 12,
    FT_REQUEST = 13,
    ExceptionDetailMessage = 14,
    SecurityAttributeService = 15,
    ActivityService = 16,
    RMICustomMaxStreamFormat = 17,
    ACCESS_SESSION_ID = 18,
    SERVICE_SESSION_ID = 19,
    FIREWALL_PATH = 20,
    FIREWALL_PATH_RESP = 21
}

export class GIOPDecoder extends GIOPBase {
    buffer: ArrayBuffer
    data: DataView
    bytes: Uint8Array

    type!: MessageType
    length!: number
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

        this.majorVersion = this.octet()
        this.minorVersion = this.octet()
        // if (giopMajorVersion !== GIOPBase.MAJOR_VERSION && giopMinorVersion !== GIOPBase.MINOR_VERSION) {
        //     throw Error(`Unsupported GIOP ${giopMajorVersion}.${giopMinorVersion}. Currently only IIOP ${GIOPBase.MAJOR_VERSION}.${GIOPBase.MINOR_VERSION} is implemented.`)
        // }

        this.endian()
        this.type = this.octet()
        this.length = this.ulong()
        // if (this.buffer.byteLength !== length + 12) {
        //     throw Error(`GIOP message is ${length + 12} bytes but buffer contains ${this.buffer.byteLength}.`)
        // }
        return this.type
    }

    scanLocateRequest() {
        const data = new LocateRequest()
        data.requestId = this.ulong()
        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            data.objectKey = this.blob()
        } else {
            const addressingDisposition = this.ushort()
            switch (addressingDisposition) {
                case AddressingDisposition.KeyAddr:
                    data.objectKey = this.blob()
                    break
                case AddressingDisposition.ProfileAddr:
                case AddressingDisposition.ReferenceAddr:
                    throw Error(`Unsupported AddressingDisposition(${AddressingDisposition[addressingDisposition]})`)
                default:
                    throw Error(`Unknown AddressingDisposition(${addressingDisposition})`)
            }
        }
        return data
    }

    scanLocateReply() {
        const data = new LocateReply()
        data.requestId = this.ulong()
        data.status = this.ulong()
        return data
    }

    scanRequestHeader(): RequestData {
        const data = new RequestData()

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            this.serviceContext()
        }
        data.requestId = this.ulong()
        const responseFlags = this.octet()
        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            data.responseExpected = responseFlags != 0
        } else {
            // console.log(`responseFlags=${responseFlags}`)
            switch(responseFlags) {
                case 0: // SyncScope.NONE, WITH_TRANSPORT
                    data.responseExpected = false
                    break
                case 1: // WITH_SERVER
                    break
                case 2:
                    break
                case 3: // WITH_TARGET
                    data.responseExpected = true
                    break
            }
        }
        this.offset += 3 // RequestReserved

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            data.objectKey = this.blob()
        } else {
            // FIXME: duplicated code
            const addressingDisposition = this.ushort()
            switch (addressingDisposition) {
                case AddressingDisposition.KeyAddr:
                    data.objectKey = this.blob()
                    break
                case AddressingDisposition.ProfileAddr:
                case AddressingDisposition.ReferenceAddr:
                    throw Error(`Unsupported AddressingDisposition(${AddressingDisposition[addressingDisposition]})`)
                default:
                    throw Error(`Unknown AddressingDisposition(${addressingDisposition})`)
            }
        }

        // FIXME: rename 'method' into 'operation' as it's named in the CORBA standard
        data.method = this.string()

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            const requestingPrincipalLength = this.ulong()
            // FIXME: this.offset += requestingPrincipalLength???
        } else {
            this.serviceContext()
            this.align(8)
        }

        // console.log(`requestId=${data.requestId}, responseExpected=${data.responseExpected}, objectKey=${data.objectKey}, method=${data.method}, requestingPrincipalLength=${requestingPrincipalLength}`)
        return data
    }

    scanReplyHeader(): ReplyData {
        const data = new ReplyData()

        if (this.majorVersion == 1 && this.minorVersion <= 1) {
            this.serviceContext()
        }
        data.requestId = this.ulong()
        data.replyStatus = this.ulong()
        if (this.majorVersion == 1 && this.minorVersion >= 2) {
            this.serviceContext()
        }
        
        switch (data.replyStatus) {
            case ReplyStatus.NO_EXCEPTION:
                break
            case ReplyStatus.USER_EXCEPTION:
                throw Error(`CORBA User Exception`)
            case ReplyStatus.SYSTEM_EXCEPTION:
                // 0.4.3.2 ReplyBody: SystemExceptionReplyBody
                const exceptionId = this.string()
                const minorCodeValue = this.ulong()
                const completionStatus = this.ulong()
                const vendorId = (minorCodeValue & 0xFFFFF000) >> 12
                const minorCode = minorCodeValue & 0x00000FFF
                // FIXME: make org.omg.CORBA.CompletionStatus an enum
                
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
                let vendorList: { [index: number]: string} = {
                    0x4f4d0: "OMG",
                    0x41540: "OmniORB"
                }
                const vendor = vendorId in vendorList ? ` ${vendorList[vendorId]}` : ""

                // CORBA 3.4, Part 2, A.5 Exception Codes
                switch (exceptionId) {
                    case "IDL:omg.org/CORBA/MARSHAL:1.0": {
                        let explanationList: { [index: number]: string } = {
                            // OMG
                            0x4f4d0001: "Unable to locate value factory.",
                            0x4f4d0002: "ServerRequest::set_result called before ServerRequest::ctx when the operation IDL contains a context clause.",
                            0x4f4d0003: "NVList passed to ServerRequest::arguments does not describe all parameters passed by client.",
                            0x4f4d0004: "Attempt to marshal local object.",
                            0x4f4d0005: "wchar or wstring data erroneosly sent by client over GIOP 1.0 connection",
                            0x4f4d0006: "wchar or wstring data erroneously returned by server over GIOP 1.0 connection.",
                            0x4f4d0007: "Unsupported RMI/IDL custom value type stream format.",
                            // OmniORB
                            0x4154000a: "Pass end of message",
                            0x41540012: "Sequence is too long",
                            0x41540034: "Invalid IOR",
                            0x4154004f: "Invalid ContextList",
                            0x4154005a: "Invalid Indirection",
                            0x4154005b: "Invalid TypeCodeKind",
                            0x4154005d: "Message too long"
                        }
                        const explanation = minorCodeValue in explanationList ? ` ${explanationList[minorCodeValue]}` : ""
                        throw Error(`Received CORBA System Exception ${exceptionId} 0x${minorCodeValue.toString(16)}${vendor}${explanation}, operation completed: ${completionStatusName}`)
                    }
                    case "IDL:omg.org/CORBA/TRANSIENT:1.0": {
                        let explanationList: { [index: number]: string } = {
                            // OMG
                            // OmniORB
                            0x41540002: "Connect Failed"
                        }
                        const explanation = minorCodeValue in explanationList ? ` ${explanationList[minorCodeValue]}` : ""
                        throw Error(`Received CORBA System Exception ${exceptionId} 0x${minorCodeValue.toString(16)}${vendor}${explanation}, operation completed: ${completionStatusName}`)
                    }
                    case "IDL:omg.org/CORBA/BAD_PARAM:1.0": {
                        let explanationList: { [index: number]: string } = {
                            // OMG
                            // OmniORB
                            0x4154001d: "Invalid initial size"
                        }
                        const explanation = minorCodeValue in explanationList ? ` ${explanationList[minorCodeValue]}` : ""
                        throw Error(`Received CORBA System Exception ${exceptionId} 0x${minorCodeValue.toString(16)}${vendor}${explanation}, operation completed: ${completionStatusName}`)
                    }
                    default: {
                        throw Error(`Received CORBA System Exception ${exceptionId}: 0x${minorCodeValue.toString(16)}${vendor}, operation completed: ${completionStatusName}`)
                    }
                }
                break
            default:
                throw Error(`ReplyStatusType ${data.replyStatus} is not supported`)
        }
        return data
    }

    serviceContext() {
        const serviceContextListLength = this.ulong()
        // console.log(`serviceContextListLength = ${serviceContextListLength}`)
        for(let i=0; i<serviceContextListLength; ++i) {
            const serviceId = this.ulong()
            const contextLength = this.ulong()
            console.log(`serviceContext[${i}].id = ${ServiceId[serviceId]}, length=${contextLength}`)
            const nextOffset = this.offset + contextLength
            switch(serviceId) {
                case ServiceId.BI_DIR_IIOP:
                    let n = this.ulong()
                    for(let i=0; i<n; ++i) {
                        const host = this.string()
                        const port = this.ushort()
                        console.log(`  BiDirIIOP listenPoint[${i}] = ${host}:${port}`)
                    }
                    break
            }
            this.offset = nextOffset
        }
    }

    reference(length: number | undefined = undefined): ObjectReference {
        const data = new ObjectReference()

        // struct IOR, field: string type_id ???
        data.oid = this.string(length)
        console.log(`IOR: oid: '${data.oid}'`)

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
                    const iiopMajorVersion = this.octet()
                    const iiopMinorVersion = this.octet()
                    // if (iiopMajorVersion !== 1 || iiopMinorVersion > 1) {
                    //     throw Error(`Unsupported IIOP ${iiopMajorVersion}.${iiopMinorVersion}. Currently only IIOP ${GIOPBase.MAJOR_VERSION}.${GIOPBase.MINOR_VERSION} is implemented.`)
                    // }
                    data.host = this.string()
                    data.port = this.ushort()
                    data.objectKey = this.blob()
                    console.log(`IOR: IIOP(version: ${iiopMajorVersion}.${iiopMinorVersion}, host: ${data.host}:${data.port}, objectKey: ${data.objectKey})`)
                    // FIXME: use utility function to compare version!!! better use hex: version >= 0x0101
                    if (iiopMajorVersion === 1 && iiopMinorVersion !== 0) {
                        // TaggedComponentSeq
                        const n = this.ulong()
                        console.log(`IOR: ${n} components`)
                        for(i=0; i<n; ++i) {
                            const id = this.ulong()
                            const length = this.ulong()
                            const nextOffset = this.offset + length
                            switch(id) {
                                case 0: // TAG_ORB_TYPE
                                    const typeCount = this.ulong()
                                    for(let j=0; j<typeCount; ++j) {
                                        const orbType = this.ulong()
                                        let name
                                        switch(orbType) {
                                            case 0x41545400:
                                                name = "OmniORB"
                                                break
                                            default:
                                                name = `0x${orbType.toString(16)}`
                                        }
                                        console.log(`IOR: component[${i}] = ORB_TYPE ${name}`)
                                    }
                                    break
                                case 1: // TAG_CODE_SETS 
                                    // Corba 3.4, Part 2, 7.10.2.4 CodeSet Component of IOR Multi-Component Profile
                                    console.log(`IOR: component[${i}] = CODE_SETS`)
                                    break
                                case 2: // TAG_POLICIES
                                    console.log(`IOR: component[${i}] = POLICIES`)
                                    break
                                default:
                                    console.log(`IOR: component[${i}] = ${id} (0x${id.toString(16)})`)
                            }
                            this.offset = nextOffset
                        }
                    }
                } break
                default:
                    console.log(`IOR: Unhandled profile type=${profileId} (0x${profileId.toString(16)})`)
            }
            this.offset = profileStart + profileLength
        }
        return data
    }

    // TODO: rather 'value' than 'object' as this is for valuetypes?
    object(): any {
        // console.log(`GIOPDecoder.object() at 0x${this.offset.toString(16)}`)
        // const objectOffset = this.offset + 6

        const code = this.ulong()
        const objectOffset = this.offset - 4

        switch (code) {
            case 0x7fffff02: {
                let repositoryId
                const len = this.ulong()
                if (len !== 0xffffffff) {
                    repositoryId = this.string(len)
                    console.log(`GIOPDecoder.object(): at 0x${(objectOffset).toString(16)} got repository ID '${repositoryId}'`)
                } else {
                    const indirection = this.long()
                    const savedOffset = this.offset
                    this.offset = this.offset + indirection - 4 - 6
                    console.log(`GIOPDecoder.object(): at 0x${(objectOffset).toString(16)} got indirect repository ID ${indirection} pointing to 0x${this.offset.toString(16)}`)
                    this.offset += 4 // skip marker
                    this.offset += 2
                    console.log(`=====> fetch string at 0x${this.offset.toString(16)}`)
                    repositoryId = this.string()
                    console.log(`==> repositoryId is '${repositoryId}'`)
                    this.offset = savedOffset
                }
                // console.log(`repositoryID '${name}' at 0x${memo.toString(16)}`)
                if (repositoryId.length < 8 || repositoryId.substring(0, 4) !== "IDL:" || repositoryId.substring(repositoryId.length - 4) !== ":1.0")
                    throw Error(`Unsupported CORBA GIOP Repository ID '${repositoryId}'`)
                const shortName = repositoryId.substring(4, repositoryId.length - 4)

                let valueTypeInformation = ORB.valueTypeByName.get(shortName)
                if (valueTypeInformation === undefined)
                    throw Error(`Unregistered Repository ID '${repositoryId}' (${shortName})`)

                const obj = new (valueTypeInformation.construct as any)(this)
                this.objects.set(objectOffset + 2, obj)
                return obj
            }
            case 0xffffffff: {
                let indirection = this.long()
                indirection += 2
                const position = this.offset + indirection
                console.log(`GIOPDecoder.object(): at 0x${objectOffset.toString(16)} got indirect object ${indirection} pointing to 0x${position.toString(16)}`)
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
                    const shortName = reference.oid.substring(4, reference.oid.length - 4)
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

    endian() {
        const byteOrder = this.octet()
        this.littleEndian = byteOrder === GIOPBase.ENDIAN_LITTLE
    }

    blob(length?: number) {
        if (length === undefined)
            length = this.ulong()
        const value = this.bytes.subarray(this.offset, this.offset + length)
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
        for (let i = 0; i < length; ++i) {
            array[i] = decodeItem()
        }
        return array
    }

    bool() {
        const value = this.data.getUint8(this.offset) !== 0
        ++this.offset
        return value
    }

    char() {
        const value = this.data.getUint8(this.offset)
        ++this.offset
        return value
    }

    octet() {
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
}

