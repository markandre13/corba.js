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

import { Protocol } from "./protocol"
import { Connection } from "./connection"
import { GIOPDecoder, GIOPEncoder, MessageType, LocateStatusType, ReplyStatus, ObjectReference, EstablishContext, AuthenticationStatus, GSSUPInitialContextToken, RequestData } from "./giop"
import { IOR } from "./ior"
import { Uint8Map } from "./uint8map"
import { CorbaName, UrlParser } from "./url"

export class Exception extends Error {
}

export class UserException extends Exception {
}

export enum CompletionStatus {
    YES,
    NO,
    MAYBE
}

export abstract class SystemException extends Exception {
    minor: number
    completed: CompletionStatus
    constructor(minor: number, completed: CompletionStatus) {
        super()
        this.minor = minor
        this.completed = completed
    }
    abstract get major(): string
}

export class MARSHAL extends SystemException {
    constructor(minor: number, completed: CompletionStatus) {
        super(minor, completed)
        let explanationList: { [index: number]: string } = {
            // OMG
            0x4f4d0001: "Unable to locate value factory.",
            0x4f4d0002: "ServerRequest::set_result called before ServerRequest::ctx when the operation IDL contains a context clause.",
            0x4f4d0003: "NVList passed to ServerRequest::arguments does not describe all parameters passed by client.",
            0x4f4d0004: "Attempt to marshal local object.",
            0x4f4d0005: "wchar or wstring data erroneously sent by client over GIOP 1.0 connection.",
            0x4f4d0006: "wchar or wstring data erroneously returned by server over GIOP 1.0 connection.",
            0x4f4d0007: "Unsupported RMI/IDL custom value type stream format.",
            // OmniORB
            0x4154000a: "Pass end of message",
            0x41540012: "Sequence is too long",
            0x41540015: "Index out of range",
            0x41540016: "Received an invalid zero length string",
            0x41540034: "Invalid IOR",
            0x4154004f: "Invalid ContextList",
            0x4154005a: "Invalid Indirection",
            0x4154005b: "Invalid TypeCodeKind",
            0x4154005d: "Message too long",
            0x41540070: "Invalid value tag"
        }
        const description = this.minor in explanationList ? `, ${explanationList[this.minor]}` : ""
        this.message = `MARSHAL(minor=0x${this.minor.toString(16)}, completed=${CompletionStatus[this.completed]}${description})`
    }
    get major(): string {
        return "IDL:omg.org/CORBA/MARSHAL:1.0"
    }
}

export class NO_PERMISSION extends SystemException {
    constructor(minor: number, completed: CompletionStatus) {
        super(minor, completed)
    }
    override toString() {
        return `NO_PERMISSION(minor=0x${this.minor.toString(16)}, completed=${CompletionStatus[this.completed]})`
    }
    get major(): string {
        return "IDL:omg.org/CORBA/NO_PERMISSION:1.0"
    }
}

export class BAD_PARAM extends SystemException {
    constructor(minor: number, completed: CompletionStatus) {
        super(minor, completed)
        let explanationList: { [index: number]: string } = {
            // OMG
            // OmniORB
            0x4154001d: "Invalid initial size"
        }
        const description = this.minor in explanationList ? `, ${explanationList[this.minor]}` : ""
        this.message = `BAD_PARAM(minor=0x${this.minor.toString(16)}, completed=${CompletionStatus[this.completed]}${description})`
    }
    get major(): string {
        return "IDL:omg.org/CORBA/BAD_PARAM:1.0"
    }
}

export class BAD_OPERATION extends SystemException {
    constructor(minor: number, completed: CompletionStatus) {
        super(minor, completed)
    }
    override toString() {
        return `BAD_OPERATION(minor=0x${this.minor.toString(16)}, completed=${CompletionStatus[this.completed]})`
    }
    get major(): string {
        return "IDL:omg.org/CORBA/BAD_OPERATION:1.0"
    }
}

export class OBJECT_NOT_EXIST extends SystemException {
    constructor(minor: number, completed: CompletionStatus) {
        super(minor, completed)
    }
    override toString() {
        return `OBJECT_NOT_EXIST(minor=0x${this.minor.toString(16)}, completed=${CompletionStatus[this.completed]})`
    }
    get major(): string {
        return "IDL:omg.org/CORBA/OBJECT_NOT_EXIST:1.0"
    }
}

export class TRANSIENT extends SystemException {
    constructor(minor: number, completed: CompletionStatus) {
        super(minor, completed)
        let explanationList: { [index: number]: string } = {
            // OMG
            // OmniORB
            0x41540002: "Connect Failed"
        }
        const description = this.minor in explanationList ? `, ${explanationList[this.minor]}` : ""
        this.message = `TRANSIENT(minor=0x${this.minor.toString(16)}, completed=${CompletionStatus[this.completed]}${description})`
    }
    get major(): string {
        return "IDL:omg.org/CORBA/TRANSIENT:1.0"
    }
}

export class OBJECT_ADAPTER extends SystemException {
    constructor(minor: number, completed: CompletionStatus) {
        super(minor, completed)
        let descriptionList: { [index: number]: string } = {
            // OMG
            0x4f4d0001: "POA Unknown adapter",
            0x4f4d0002: "No servant",
            0x4f4d0003: "No default servant",
            0x4f4d0004: "No servant manager",
            0x4f4d0005: "Wrong incarnate policy",
            // OmniORB
            0x4154000f: "BiDir not allowed",
            0x41540021: "BOA not initialized",
            0x41540035: "POA not initialized",
            0x4154003f: "Servant already active",
            0x41540061: "Incompatible servant",
        }
        const description = this.minor in descriptionList ? `, ${descriptionList[this.minor]}` : ""
        // TODO: the message isn't really human readable
        // TODO: should we include which peer threw the error?
        this.message = `OBJECT_ADAPTER(minor=0x${this.minor.toString(16)}, completed=${CompletionStatus[this.completed]}${description})`
    }
    get major(): string {
        return "IDL:omg.org/CORBA/OBJECT_ADAPTER:1.0"
    }
}

export interface ValueTypeInformation {
    attributes: Array<string>
    encode: (encoder: GIOPEncoder, obj: any) => void
    name?: string
    construct?: Function
}

export class PromiseHandler {
    constructor(decode: (decoder: GIOPDecoder) => void, reject: (reason?: any) => void) {
        this.decode = decode
        this.reject = reject
    }
    decode: (decoder: GIOPDecoder) => void
    reject: (reason?: any) => void
}

type IncomingAuthenticator = (connection: Connection, context: EstablishContext) => AuthenticationStatus
type OutgoingAuthenticator = (connection: Connection) => GSSUPInitialContextToken | undefined

// TODO: to have only one ORB instance, split ORB into ORB, Connection (requestIds & ACL) and CrudeObjectAdapter (stubs, servants, valuetypes)
export class ORB implements EventTarget {

    private static nameServiceKey = new Uint8Array(new TextEncoder().encode("NameService"))
    static valueTypeByName = new Map<string, ValueTypeInformation>()
    static valueTypeByPrototype = new Map<any, ValueTypeInformation>()

    debug = 0		// values > 0 enable debug output
    name = ""       // orb name to ease debugging

    stubsByName = new Map<string, any>()

    servants = new Uint8Map<Skeleton>()
    servantIdCounter: bigint = 0n

    accesibleServants = new Set<Skeleton>()
    namingService: NamingContextExtImpl

    initialReferences: Map<string, Skeleton> = new Map()
    listeners: Map<string, Set<EventListenerOrEventListenerObject>> = new Map()

    constructor() {
        this.namingService = new NamingContextExtImpl(this)
        this.initialReferences.set("NameService", this.namingService)
        this.servants.set(ORB.nameServiceKey, this.namingService)
    }

    //
    // Network Protocol and Connection
    //

    private protocols: Protocol[] = []
    private connections: Connection[] = []

    addProtocol(protocol: Protocol) {
        this.protocols.push(protocol)
    }

    addConnection(connection: Connection) {
        this.connections.push(connection)
    }

    removeConnection(connection: Connection) {
        for (let i = 0; i < this.connections.length; ++i) {
            if (connection === this.connections[i]) {
                this.connections.splice(i, 1)
                break
            }
        }
    }

    logConnection() {
        this.connections.forEach(c => console.log(`CONNECTION ${c.localAddress}:${c.localPort}->${c.remoteAddress}:${c.remotePort}`))
    }

    async shutdown() {
        for (let i = 0; i < this.protocols.length; ++i) {
            await this.protocols[i].close()
        }
        for (let i = 0; i < this.connections.length; ++i) {
            await this.connections[i].close()
        }
        this.connections.length = 0
    }

    // TEST SUPPORT, AS OF NOW THIS WORKS ONLY FOR OUTGOING CONNECTIONS
    async replaceAllConnections() {
        // console.log(`CONNECTIONS BEFORE REPLACE`)
        // this.logConnection()
        const list = this.connections.map(x => x)
        for (let i = 0; i < list.length; ++i) {
            const oldConnection = list[i]
            this.removeConnection(oldConnection)
            const newConnection = await this.getConnection(oldConnection.remoteAddress, oldConnection.remotePort)
            oldConnection.close()
            // console.log(`REPLACE ${oldConnection.localAddress}:${oldConnection.localPort}->${oldConnection.remoteAddress}:${oldConnection.remotePort}`)
            // console.log(`   WITH ${newConnection.localAddress}:${newConnection.localPort}->${newConnection.remoteAddress}:${newConnection.remotePort}`)
            oldConnection.stubsById.forEach((stub, key) => {
                stub.connection = newConnection
                newConnection.stubsById.set(key, stub)
            })
            oldConnection.stubsById.clear()
        }
        // console.log(`CONNECTIONS AFTER REPLACE`)
        // this.logConnection()
    }

    async getConnection(host: string, port: number) {

        if (host = "::1") {
            host = "localhost"
        }

        for (const c of this.connections) {
            if (c.remoteAddress == host && c.remotePort == port) {
                return c
            }
        }
        for (const p of this.protocols) {
            if (this.debug) {
                if (this.connections.length === 0) {
                    console.log(`ORB: Creating new connection to ${host}:${port} as no others exist`)
                } else {
                    console.log(`ORB: Creating new connection to ${host}:${port}, as none found to`)
                }
                for (const c of this.connections) {
                    console.log(`ORB:  active connection ${c.remoteAddress}:${c.remotePort}`)
                }
            }
            return await p.connect(this, host, port)
        }
        throw Error(`failed to allocate connection to ${host}:${port}`)
    }

    // TODO: we want this to report an error ASAP?
    // TODO: all of this is a hack
    async stringToObject(iorString: string) {
        const parser = new UrlParser(iorString)
        const iorOrLocation = parser.parse()
        if (iorOrLocation instanceof IOR) {
            return this.iorToObject(new IOR(iorString))
        }
        if (iorOrLocation instanceof CorbaName) {
            // FIXME: handle array's length
            const a = iorOrLocation.addr[0]
            switch (a.proto) {
                case "iiop":
                    // get remote NameService (FIXME: what if it's us?)
                    const nameConnection = await this.getConnection(a.host, a.port)
                    const objectKey = new TextEncoder().encode(iorOrLocation.objectKey)
                    let rootNamingContext = nameConnection.stubsById.get(objectKey) as NamingContextExtStub
                    if (rootNamingContext === undefined) {
                        rootNamingContext = new NamingContextExtStub(this, objectKey, nameConnection)
                        nameConnection.stubsById.set(objectKey, rootNamingContext!)
                    }

                    // get object from remote NameServiceExt
                    const reference = await rootNamingContext.resolve_str(iorOrLocation.name)

                    // create stub for remote object
                    const objectConnection = await this.getConnection(reference.host, reference.port)
                    let object = objectConnection.stubsById.get(reference.objectKey)
                    if (object !== undefined)
                        return object
                    const shortName = reference.oid.substring(4, reference.oid.length - 4)
                    let aStubClass = objectConnection.orb.stubsByName.get(shortName)
                    if (aStubClass === undefined) {
                        throw Error(`ORB: no stub registered for OID '${reference.oid} (${shortName})'`)
                    }
                    object = new aStubClass(objectConnection.orb, reference.objectKey, objectConnection)
                    objectConnection.stubsById.set(reference.objectKey, object!)
                    return object

                default:
                    throw Error("yikes")
            }

        }
        throw Error("yikes")
    }

    async iorToObject(ior: IOR) {
        const connection = await this.getConnection(ior.host, ior.port)
        let object = connection.stubsById.get(ior.objectKey)
        if (object !== undefined) {
            return object as CORBAObject
        }

        const shortName = ior.oid.substring(4, ior.oid.length - 4)
        let aStubClass = this.stubsByName.get(shortName)
        if (aStubClass === undefined) {
            throw Error(`ORB: can not deserialize object of unregistered stub '${ior.oid}' (${shortName})'`)
        }
        object = new aStubClass(this, ior.objectKey, connection)
        connection.stubsById.set(ior.objectKey, object!)
        return object! as CORBAObject
    }

    //
    // Network OUT
    //

    onewayCall(
        stub: Stub,
        method: string,
        encode: (encoder: GIOPEncoder) => void): void {
        const requestId = stub.connection.requestId
        stub.connection.requestId += 2
        this.callCore(stub.connection, requestId, false, stub.id, method, encode)
    }

    twowayCall<T>(
        stub: Stub,
        method: string,
        encode: (encoder: GIOPEncoder) => void,
        decode: (decoder: GIOPDecoder) => T
    ): Promise<T> {
        const requestId = stub.connection.requestId
        stub.connection.requestId += 2
        return new Promise<T>((resolve, reject) => {
            try {
                stub.connection.pendingReplies.set(
                    requestId,
                    new PromiseHandler(
                        (decoder: GIOPDecoder) => resolve(decode(decoder)),
                        reject)
                )
                this.callCore(stub.connection, requestId, true, stub.id, method, encode)
            } catch (e) {
                reject(e)
                // console.log(stub)
                // throw e
            }
        })
    }

    protected callCore(
        connection: Connection,
        requestId: number,
        responseExpected: boolean,
        objectId: Uint8Array,
        method: string,
        encode: (encoder: GIOPEncoder) => void) {
        if (this.debug) {
            console.log(`ORB ${this.name}: send request method:${method}, requestId:${requestId}, responseExpected:${responseExpected} to ${connection.remoteAddress}:${connection.remotePort}`)
        }
        const encoder = new GIOPEncoder(connection)
        encoder.encodeRequest(objectId, method, requestId, responseExpected)
        encode(encoder)
        encoder.setGIOPHeader(MessageType.REQUEST)
        connection.send(encoder.buffer.slice(0, encoder.offset))
    }

    //
    // Network IN
    //

    socketRcvd(connection: Connection, buffer: ArrayBuffer): void {
        // TODO: split this method up
        // FIXME: buffer may contain multiple or incomplete messages
        const decoder = new GIOPDecoder(buffer, connection)
        const type = decoder.scanGIOPHeader()

        switch (type) {
            case MessageType.LOCATE_REQUEST: {
                const data = decoder.scanLocateRequest()
                const servant = this.servants.get(data.objectKey)
                const encoder = new GIOPEncoder(connection)
                encoder.encodeLocateReply(
                    data.requestId,
                    servant !== undefined ?
                        LocateStatusType.OBJECT_HERE :
                        LocateStatusType.UNKNOWN_OBJECT
                )
                encoder.setGIOPHeader(MessageType.LOCATE_REPLY)
                connection.send(encoder.buffer.slice(0, encoder.offset))
            } break
            case MessageType.REQUEST: {
                const request = decoder.scanRequestHeader()

                const servant = this.servants.get(request.objectKey)
                if (servant === undefined) {
                    if (request.responseExpected) {
                        const encoder = new GIOPEncoder(connection)
                        encoder.skipReplyHeader()
                        encoder.string("IDL:omg.org/CORBA/OBJECT_NOT_EXIST:1.0")
                        encoder.ulong(0x4f4d0001) // Attempt to pass an unactivated (unregistered) value as an object reference.
                        encoder.ulong(CompletionStatus.NO) // completionStatus
                        const length = encoder.offset
                        encoder.setGIOPHeader(MessageType.REPLY)
                        encoder.setReplyHeader(request.requestId, ReplyStatus.SYSTEM_EXCEPTION)
                        connection.send(encoder.buffer.slice(0, length))
                    }
                    return
                }

                for (let i = 0; i < request.serviceContext.length; ++i) {
                    const e = request.serviceContext[i]
                    if (e instanceof EstablishContext) {
                        if (this.incomingAuthenticator && servant !== this.namingService) {
                            if (this.incomingAuthenticator(connection, e) !== AuthenticationStatus.SUCCESS) {
                                if (request.responseExpected) {
                                    // FIXME: https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks
                                    // * add random delay... even on success
                                    // Many failed logins from the same IP address
                                    // Logins with multiple usernames from the same IP address
                                    // Logins for a single account coming from many different IP addresses

                                    const encoder = new GIOPEncoder(connection)
                                    encoder.skipReplyHeader()
                                    encoder.string("IDL:omg.org/CORBA/NO_PERMISSION:1.0")
                                    encoder.ulong(0) // minorCodeValue
                                    encoder.ulong(CompletionStatus.NO) // completionStatus
                                    const length = encoder.offset
                                    encoder.setGIOPHeader(MessageType.REPLY)
                                    encoder.setReplyHeader(request.requestId, ReplyStatus.SYSTEM_EXCEPTION)
                                    connection.send(encoder.buffer.slice(0, length))
                                }
                                return
                            }
                        }
                    }
                }

                // FIXME: disabled security check (doesn't work anyway after introducing multiple connections per ORB)
                // if (!servant.acl.has(this)) {
                //     throw Error(`ORB.handleMethod(): client required method '${data.method}' on server but has no rights to access servant with object key ${data.objectKey}`)
                // }

                if (request.method == '_is_a') {
                    const repositoryId = decoder.string()

                    const encoder = new GIOPEncoder(connection)
                    encoder.skipReplyHeader()
                    encoder.bool(`IDL:${(servant as any).constructor._idlClassName()}:1.0` === repositoryId)
                    const length = encoder.offset
                    encoder.setGIOPHeader(MessageType.REPLY)
                    encoder.setReplyHeader(request.requestId, ReplyStatus.NO_EXCEPTION)
                    connection.send(encoder.buffer.slice(0, length))
                    return
                }

                const method = (servant as any)[`_orb_${request.method}`]
                if (method === undefined) {
                    if (request.responseExpected) {
                        const encoder = new GIOPEncoder(connection)
                        encoder.skipReplyHeader()
                        encoder.string("IDL:omg.org/CORBA/BAD_OPERATION:1.0")
                        encoder.ulong(0x4f4d0002) // Operation or attribute not known to target object
                        encoder.ulong(CompletionStatus.NO)
                        const length = encoder.offset
                        encoder.setGIOPHeader(MessageType.REPLY)
                        encoder.setReplyHeader(request.requestId, ReplyStatus.SYSTEM_EXCEPTION)
                        connection.send(encoder.buffer.slice(0, length))
                    }
                    return
                }

                const encoder = new GIOPEncoder(connection)
                encoder.skipReplyHeader()
                method.call(servant, decoder, encoder)
                    .then(() => {
                        if (request.responseExpected) {
                            const length = encoder.offset
                            encoder.setGIOPHeader(MessageType.REPLY)
                            encoder.setReplyHeader(request.requestId, ReplyStatus.NO_EXCEPTION)
                            connection.send(encoder.buffer.slice(0, length))
                        }
                    })
                    .catch((error: Error) => {
                        if (request.responseExpected) {
                            if (error instanceof SystemException) {
                                encoder.skipReplyHeader()
                                encoder.string(error.major)
                                encoder.ulong(error.minor)
                                encoder.ulong(error.completed)
                                const length = encoder.offset
                                encoder.setGIOPHeader(MessageType.REPLY)
                                encoder.setReplyHeader(request.requestId, ReplyStatus.SYSTEM_EXCEPTION)
                                connection.send(encoder.buffer.slice(0, length))
                            } else {
                                // const length = encoder.offset
                                // encoder.setGIOPHeader(MessageType.REPLY)
                                // encoder.setReplyHeader(request.requestId, ReplyStatus.USER_EXCEPTION)
                                // connection.send(encoder.buffer.slice(0, length))

                                // this is a hack for now...
                                encoder.skipReplyHeader()
                                encoder.string("IDL:mark13.org/CORBA/GENERIC:1.0")
                                encoder.ulong(0)
                                encoder.ulong(0)
                                encoder.string(`${`IDL:${(servant as any).constructor._idlClassName()}:1.0`}:${request.method}(): ${error.message}`)
                                const length = encoder.offset
                                encoder.setGIOPHeader(MessageType.REPLY)
                                encoder.setReplyHeader(request.requestId, ReplyStatus.SYSTEM_EXCEPTION)
                                connection.send(encoder.buffer.slice(0, length))
                            }
                        } else {
                            console.log(`ORB: ignoring servant exception because method does not expect response`)
                            console.log(error)
                        }
                    })
            } break

            case MessageType.REPLY: {
                const data = decoder.scanReplyHeader()
                const handler = connection.pendingReplies.get(data.requestId)
                if (handler === undefined) {
                    console.log(`corba.js: Unexpected reply to requestId ${data.requestId} from ${connection.remoteAddress}:${connection.remotePort}`)
                    console.log(connection.pendingReplies)
                    return
                }
                try {
                    connection.pendingReplies.delete(data.requestId)
                    switch (data.replyStatus) {
                        case ReplyStatus.NO_EXCEPTION:
                            handler.decode(decoder)
                            break
                        case ReplyStatus.USER_EXCEPTION:
                            throw new Error(`User Exception for requestId ${data.requestId}`)
                        case ReplyStatus.SYSTEM_EXCEPTION:
                            // 0.4.3.2 ReplyBody: SystemExceptionReplyBody
                            const exceptionId = decoder.string()
                            const minorCodeValue = decoder.ulong()
                            const completionStatus = decoder.ulong() as CompletionStatus

                            // VMCID
                            let vendorList: { [index: number]: string } = {
                                0x41540: "OmniORB",
                                0x47430: "GNU Classpath",
                                0x49424: "IBM",
                                0x49540: "IONA",
                                0x4A430: "JacORB",
                                0x4D313: "corba.js", // not registered
                                0x4F4D0: "OMG",
                                0x53550: "SUN",
                                0x54410: "TAO",
                                0x56420: "Borland (VisiBroker)",
                                0xA11C0: "Adiron"
                            }
                            const vendorId = (minorCodeValue & 0xFFFFF000) >> 12
                            const vendor = vendorId in vendorList ? ` ${vendorList[vendorId]}` : ""

                            // A.5 Exception Codes
                            let explanation = ""

                            // CORBA 3.4, Part 2, A.5 Exception Codes
                            switch (exceptionId) {
                                case "IDL:omg.org/CORBA/MARSHAL:1.0":
                                    throw new MARSHAL(minorCodeValue, completionStatus)
                                case "IDL:omg.org/CORBA/TRANSIENT:1.0":
                                    throw new TRANSIENT(minorCodeValue, completionStatus)
                                case "IDL:omg.org/CORBA/BAD_PARAM:1.0":
                                    throw new BAD_PARAM(minorCodeValue, completionStatus)
                                case "IDL:omg.org/CORBA/BAD_OPERATION:1.0":
                                    throw new BAD_OPERATION(minorCodeValue, completionStatus)
                                case "IDL:omg.org/CORBA/OBJECT_NOT_EXIST:1.0":
                                    throw new OBJECT_NOT_EXIST(minorCodeValue, completionStatus)
                                case "IDL:omg.org/CORBA/OBJECT_ADAPTER:1.0":
                                    throw new OBJECT_ADAPTER(minorCodeValue, completionStatus)
                                case "IDL:omg.org/CORBA/NO_PERMISSION:1.0":
                                    throw new NO_PERMISSION(minorCodeValue, completionStatus)
                                case "IDL:mark13.org/CORBA/GENERIC:1.0":
                                    throw new Error(`Remote CORBA exception on ${connection.remoteAddress}:${connection.remotePort}: ${decoder.string()}`)
                            }
                            throw new Error(`CORBA System Exception ${exceptionId} from ${connection.remoteAddress}:${connection.remotePort}:${vendor}${explanation} (0x${minorCodeValue.toString(16)}), operation completed: ${CompletionStatus[completionStatus]}`)
                        default:
                            throw new Error(`ReplyStatusType ${data.replyStatus} is not supported`)
                    }
                }
                catch (e) {
                    // console.log(`caught error: ${e}`)
                    // FIXME: this works with tcp and tls but not the websocket library
                    handler.reject(e)
                }    
            } break
            default: {
                // NOTE: OmniORB closes idle connections after 30s
                throw Error(`Received ${MessageType[type]} which is not implemented in corba.js`)
            }
        }
    }

    socketError(connection: Connection, error: Error): void {
        // FIXME: no error handling implemented yet
        throw error
    }

    socketClosed(connection: Connection): void {
        this.dispatchEvent(new Event("closed"))
        this.release() // FIXME: too much
        this.removeConnection(connection)
    }

    //
    // EventTarget methods 
    //

    // FIXME: on() & once() are much nicer event APIs :)
    addEventListener(type: "close",
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions): void {
        if (listener === null)
            return
        let set = this.listeners.get(type)
        if (set === undefined) {
            set = new Set<EventListenerOrEventListenerObject>()
            this.listeners.set(type, set)
        }
        set.add(listener)
    }

    removeEventListener(type: "close",
        listener?: EventListenerOrEventListenerObject | null,
        options?: EventListenerOptions | boolean): void {
        if (listener === null || listener === undefined)
            return
        let set = this.listeners.get(type)
        if (set === undefined)
            return
        set.delete(listener)
    }

    dispatchEvent(event: Event): boolean {
        let set = this.listeners.get(event.type)
        if (set === undefined)
            return true
        for (let handler of set) {
            if (typeof handler === "function")
                handler(event)
            else
                handler.handleEvent(event)
        }
        return true
    }

    // FIXME: on("close", () => ...)
    set onclose(listener: EventListenerOrEventListenerObject | null) {
        this.listeners.delete("close")
        this.addEventListener("close", listener)
    }

    // called by the Skeleton
    registerServant(servant: Skeleton) {
        let id = ++this.servantIdCounter
        const x = new BigUint64Array([id])
        const u = new Uint8Array(x.buffer)
        this.servants.set(u, servant)
        return u
    }

    unregisterServant(servant: Skeleton) {
        this.servants.delete(servant.id)
    }

    registerStubClass(aStubClass: any) {
        this.stubsByName.set(aStubClass._idlClassName(), aStubClass)
    }

    releaseStub(stub: Stub): void {
        // if (!this.stubsById.has(stub.id)) {
        //     throw Error(`ORB.releaseStub(): the stub with id ${stub.id} is unknown to this ORB`)
        // }
        // this.stubsById.delete(stub.id)
    }

    static registerValueType(name: string, valuetypeConstructor: Function): void {
        let information = ORB.valueTypeByName.get(name)
        if (information === undefined) {
            console.log(`registerValueType: number of known types: ${ORB.valueTypeByName.size}`)
            ORB.valueTypeByName.forEach((value, key) => console.log(key))
            throw Error(`ORB.registerValueType: valuetype '${name}' not defined in IDL`)
        }
        // if (information.construct !== undefined) {
        //     throw Error(`ORB.registerValueType: valuetype '${name}' is already registered`)
        // }
        information.name = name
        information.construct = valuetypeConstructor
        ORB.valueTypeByPrototype.set(valuetypeConstructor.prototype, information)
    }

    static lookupValueType(name: string): any {
        let information = ORB.valueTypeByName.get(name)
        if (information === undefined) {
            throw Error(`ORB.lookupValueType: valuetype '${name}' not defined in IDL`)
        }
        if (information.construct === undefined) {
            throw Error(`ORB.lookupValueType: valuetype '${name}' not registered via ORB.registerValueType()`)
        }
        return information.construct
    }

    // CORBA 3.3 Part 1, 8.5.2 Obtaining Initial Object References
    // sequence<ObjectId> list_initial_services();
    // Object resolve_initial_references ( in ObjectId identifier) raises (InvalidName);

    //
    // NameService
    //

    bind(id: string, obj: Skeleton): void {
        const nameService = this.initialReferences.get("NameService")
        if (nameService === undefined)
            throw Error(`No NameService found.`)
        if (nameService instanceof NamingContextExtImpl) {
            nameService.bind(id, obj)
            return
        }
        throw Error(`NameService is not of type IDL:omg.org/CosNaming/NamingContext:1.0`)
    }

    async list(): Promise<Array<string>> {
        throw Error("Obsolete")
    }

    async resolve(id: string): Promise<Stub> {
        throw Error("Obsolete: Use objectToString(`corbaname::${hostname}#${objectname}`) instead")
    }

    //
    // GIOP: do this with a unit test
    //

    serialize(value: any): ArrayBuffer {
        const encoder = new GIOPEncoder()
        encoder.endian()
        encoder.value(value)
        return encoder.buffer.slice(0, encoder.offset)
    }

    deserialize(buffer: ArrayBuffer): any {
        const decoder = new GIOPDecoder(buffer)
        decoder.endian()
        return decoder.value()
    }

    incomingAuthenticator?: IncomingAuthenticator
    setIncomingAuthenticator(authenticator: IncomingAuthenticator) {
        this.incomingAuthenticator = authenticator
    }

    outgoingAuthenticator?: OutgoingAuthenticator
    setOutgoingAuthenticator(authenticator: OutgoingAuthenticator) {
        this.outgoingAuthenticator = authenticator
    }

    //
    // Access Control List
    ///

    release() {
        this.aclDeleteAll()
    }

    aclAdd(servant: Skeleton) {
        servant.acl.add(this)
        this.accesibleServants.add(servant)
    }

    aclDeleteAll() {
        for (let servant of this.accesibleServants)
            servant.acl.delete(this)
        this.accesibleServants.clear()
    }
}

export abstract class CORBAObject {
    orb: ORB
    id: Uint8Array
    constructor(orb: ORB, id: Uint8Array) {
        this.orb = orb
        this.id = id
    }
}

// a skeleton can be called from multiple connections
// the id is unique within this ORB
export abstract class Skeleton extends CORBAObject {
    acl: Set<ORB>

    constructor(orb: ORB) {
        super(orb, undefined as any)
        this.id = orb.registerServant(this)
        this.acl = new Set<ORB>()
    }

    release(): void {
    }
}

// a stub relates to one connection
// the id is defined by the peer, hence duplicate ids might refer to different objects
export abstract class Stub extends CORBAObject {
    connection: Connection
    constructor(orb: ORB, remoteID: Uint8Array, connection: Connection) {
        super(orb, remoteID)
        this.connection = connection
    }

    release(): void {
        this.orb.releaseStub(this)
    }
}

class NamingContextExtStub extends Stub {
    static _idlClassName(): string {
        return "omg.org/CosNaming/NamingContextExt"
    }

    static narrow(object: any): NamingContextExtStub {
        if (object instanceof NamingContextExtStub)
            return object as NamingContextExtStub
        throw Error("NamingContextExt.narrow() failed")
    }

    // TODO: the argument doesn't match the one in the IDL but for it's good enough
    async resolve_str(name: string): Promise<ObjectReference> {
        return await this.orb.twowayCall(this, "resolve_str", (encoder) => {
            // encoder.ulong(1)
            encoder.string(name)
            // encoder.string("")
        },
            (decoder) => decoder.reference())
    }
}

class NamingContextExtImpl extends Skeleton {
    map = new Map<string, CORBAObject>()

    constructor(orb: ORB) { super(orb) }
    static _idlClassName(): string {
        return "omg.org/CosNaming/NamingContextExt"
    }
    bind(name: string, servant: CORBAObject) {
        if (this.map.has(name))
            throw Error(`name '${name}' is already bound to object`)
        this.map.set(name, servant)
    }

    async resolve(name: string): Promise<CORBAObject> {
        // console.log(`NamingContextImpl.resolve("${name}")`)
        const servant = this.map.get(name)
        if (servant === undefined) {
            throw Error(`orb ${this.orb.name}: name '${name}' is not bound to an object`)
        }
        return servant
    }

    private async _orb_resolve(decoder: GIOPDecoder, encoder: GIOPEncoder) {
        const entries = decoder.ulong()
        const name = decoder.string()
        const key = decoder.string()
        if (entries !== 1 && key.length !== 0) {
            console.log(`warning: resolve got ${entries} (expected 1) and/or key is "${key}" (expected "")`)
        }
        const result = await this.resolve(name)
        encoder.object(result)
    }

    private async _orb_resolve_str(decoder: GIOPDecoder, encoder: GIOPEncoder) {
        const name = decoder.string()
        const result = await this.resolve(name)
        encoder.object(result)
    }
}