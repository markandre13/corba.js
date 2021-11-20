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
import { GIOPDecoder, GIOPEncoder, MessageType, LocateStatusType, ReplyStatus, ObjectReference, EstablishContext, AuthenticationStatus, GSSUPInitialContextToken } from "./giop"
import { IOR } from "./ior"
import { Uint8Map } from "./uint8map"
import { CorbaName, UrlParser } from "./url"

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

    initialReferences: Map<string, Skeleton> = new Map()
    listeners: Map<string, Set<EventListenerOrEventListenerObject>> = new Map()

    constructor() {
        const nameService = new NamingContextExtImpl(this)
        this.initialReferences.set("NameService", nameService)
        this.servants.set(ORB.nameServiceKey, nameService)
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
        this.connections.forEach( c => console.log(`CONNECTION ${c.localAddress}:${c.localPort}->${c.remoteAddress}:${c.remotePort}`))
    }

    async shutdown() {
        for(let i=0; i<this.protocols.length; ++i) {
            await this.protocols[i].close()
        }
        for(let i=0; i<this.connections.length; ++i) {
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
            oldConnection.stubsById.forEach( (stub, key) => {
                stub.connection = newConnection
                newConnection.stubsById.set(key, stub)
            })
            oldConnection.stubsById.clear()
        }
        // console.log(`CONNECTIONS AFTER REPLACE`)
        // this.logConnection()
    }

    async getConnection(host: string, port: number) {
        // console.log(`ORB ${this.name}: getConnection("${host}", ${port})`)
        for (let i = 0; i < this.connections.length; ++i) {
            const c = this.connections[i]
            // console.log(`  check ${c.remoteAddress}:${c.remotePort}`)
            if (c.remoteAddress == host && c.remotePort == port) {
                return c
            }
        }
        for (let i = 0; i < this.protocols.length; ++i) {
            const p = this.protocols[i]
            const c = await p.connect(this, host, port)
            return c
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
                console.log(stub)
                throw e
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
        // console.log(`ORB ${this.name}: send request method:${method}, requestId:${requestId}, responseExpected:${responseExpected}`)
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
                // console.log(`ORB ${this.name} got request`)
                // console.log(request)
                if (servant === undefined) {
                    throw Error(`ORB.handleMethod(): client required method '${request.method}' on server for unknown object key ${request.objectKey}`)
                }
                // FIXME: disabled security check (doesn't work anyway after introducing multiple connections per ORB)
                // if (!servant.acl.has(this)) {
                //     throw Error(`ORB.handleMethod(): client required method '${data.method}' on server but has no rights to access servant with object key ${data.objectKey}`)
                // }
                if (request.method == '_is_a') {
                    const repositoryId = decoder.string()
                    // console.log(Object.getPrototypeOf(servant))
                    console.log(`_is_a("${repositoryId}")`)

                    const encoder = new GIOPEncoder(connection)
                    encoder.skipReplyHeader()
                    // "IDL:omg.org/CosNaming/NamingContextExt:1.0"
                    encoder.bool(true)
                    const length = encoder.offset
                    encoder.setGIOPHeader(MessageType.REPLY)
                    encoder.setReplyHeader(request.requestId, ReplyStatus.NO_EXCEPTION)
                    connection.send(encoder.buffer.slice(0, length))
                    return
                }

                const method = (servant as any)[`_orb_${request.method}`]
                if (method === undefined) {
                    throw Error(`ORB.handleMethod(): client required unknown method '${request.method}' on server for servant with object key ${request.objectKey}`)
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
                        console.log(error)
                        if (request.responseExpected) {
                            const length = encoder.offset
                            encoder.setGIOPHeader(MessageType.REPLY)
                            encoder.setReplyHeader(request.requestId, ReplyStatus.USER_EXCEPTION)
                            connection.send(encoder.buffer.slice(0, length))
                        }
                    })
            } break
            case MessageType.REPLY: {
                const data = decoder.scanReplyHeader()
                const handler = connection.pendingReplies.get(data.requestId)
                if (handler === undefined) {
                    console.log(`Unexpected reply to request ${data.requestId}`)
                    return
                }
                connection.pendingReplies.delete(data.requestId)
                switch (data.replyStatus) {
                    case ReplyStatus.NO_EXCEPTION:
                        handler.decode(decoder)
                        break
                    case ReplyStatus.USER_EXCEPTION:
                        handler.reject(new Error(`User Exception`))
                        break
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
    // JSON
    //

    serialize(object: any): string {
        throw Error("obsolete")
    }

    deserialize(text: string): any {
        throw Error("obsolete")
    }

    _deserialize(data: any): any {
        throw Error("obsolete")
    }


    incomingAuthenticator?: IncomingAuthenticator
    setIncomingAuthenticator( authenticator: IncomingAuthenticator) {
        this.incomingAuthenticator = authenticator
    }

    outgoingAuthenticator?: OutgoingAuthenticator
    setOutgoingAuthenticator( authenticator: OutgoingAuthenticator) {
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