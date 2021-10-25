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
import { GIOPDecoder, GIOPEncoder, MessageType, LocateStatusType, ReplyStatus } from "./giop"
import { IOR } from "./ior"
import { Uint8Map } from "./uint8map"

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

// TODO: to have only one ORB instance, split ORB into ORB, Connection (requestIds & ACL) and CrudeObjectAdapter (stubs, servants, valuetypes)
export class ORB implements EventTarget {
    // special object ID "ORB"
    private static orbId = new Uint8Array([0x4F, 0x52, 0x42])

    debug: number		// values > 0 enable debug output
    name: string        // orb name to ease debugging

    stubsByName: Map<string, any>
    // stubsById: Uint8Map<Stub>

    servants: Uint8Map<Skeleton>
    servantIdCounter: bigint = 0n

    accesibleServants: Set<Skeleton>

    static valueTypeByName = new Map<string, ValueTypeInformation>()
    static valueTypeByPrototype = new Map<any, ValueTypeInformation>()

    initialReferences: Map<string, Skeleton>

    listeners: Map<string, Set<EventListenerOrEventListenerObject>>

    constructor() {
        this.debug = 0
        this.stubsByName = new Map()
        this.servants = new Uint8Map()
        this.initialReferences = new Map()
        this.name = ""
        // this.stubsById = new Uint8Map()
        this.accesibleServants = new Set<Skeleton>()
        this.listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
    }

    // note that objects can be reachable via various connections!
    private protocols: Protocol[] = []
    private connections: Connection[] = []

    addProtocol(protocol: Protocol) {
        this.protocols.push(protocol)
    }
    addConnection(connection: Connection) {
        this.connections.push(connection)
    }
    async getConnection(host: string, port: number) {
        for (let i = 0; i < this.connections.length; ++i) {
            const c = this.connections[i]
            if (c.remoteAddress == host && c.remotePort == port)
                return c
        }
        for (let i = 0; i < this.protocols.length; ++i) {
            const p = this.protocols[i]
            const c = await p.connect(this, host, port)
            this.connections.push(c)
            return c
        }
        throw Error(`failed to allocate connection to ${host}:${port}`)
    }

    // TODO: we want this to report an error ASAP?
    async stringToObject(iorString: string) {
        return this.iorToObject(new IOR(iorString))
    }

    async iorToObject(ior: IOR) {
        // check if ior.hostname, ior.port is us
        // if yes, return the servant (aka. implementation of skeleton)

        // check if ior.hostname, ior.port is a known remote peer
        // if no, initiate a connection

        // check if ior.objectKey is known in connection
        // if yes, return stub
        // if no, create and return stub

        // stubs are per connection because different objectKeys to different peers may overlap
        const connection = await this.getConnection(ior.host, ior.port)
        // this.protocols[0].connect(this, ior.host, ior.port)
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

    // iorToObject(ior: IOR): Stub {
    //     let object = this.stubsById.get(ior.objectKey)
    //     if (object !== undefined) {
    //         return object
    //     }

    //     const shortName = ior.oid.substring(4, ior.oid.length - 4)
    //     let aStubClass = this.stubsByName.get(shortName)
    //     if (aStubClass === undefined) {
    //         throw Error(`ORB: can not deserialize object of unregistered stub '${ior.oid}' (${shortName})'`)
    //     }
    //     object = new aStubClass(this, ior.objectKey)
    //     this.stubsById.set(ior.objectKey, object!)
    //     return object!
    // }

    //
    // Network OUT
    //
    // socketConnect!: (hostname: string, port: number) => Promise<void>
    // socketSend!: (buffer: ArrayBuffer) => void
    // socketClose!: () => void
    // map = new Map<number, PromiseHandler>()

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
                stub.connection.map.set(
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
        // console.log(`client: send request ${requestId}`)
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
                const data = decoder.scanRequestHeader()
                // FIXME: make this if expression a method
                if (data.objectKey.length === ORB.orbId.length
                    && data.objectKey.at(0) === ORB.orbId.at(0)
                    && data.objectKey.at(1) === ORB.orbId.at(1)
                    && data.objectKey.at(2) === ORB.orbId.at(2)
                ) {
                    if (data.method === "resolve") {
                        // FIXME: make the 'resolve' a method
                        const reference = decoder.string()
                        // console.log(`ORB: received ORB.resolve("${reference}")`)
                        const encoder = new GIOPEncoder(connection)
                        let object = this.initialReferences.get(reference)
                        if (object === undefined) {
                            // console.log(`ORB.handleResolveInitialReferences(): failed to resolve '${reference}`)
                            encoder.encodeReply(data.requestId, ReplyStatus.SYSTEM_EXCEPTION)
                        } else {
                            this.aclAdd(object)
                            encoder.encodeReply(data.requestId, ReplyStatus.NO_EXCEPTION)
                            encoder.reference(object)
                        }
                        encoder.setGIOPHeader(MessageType.REPLY)
                        connection.send(encoder.buffer.slice(0, encoder.offset))
                    }
                    return
                }

                const servant = this.servants.get(data.objectKey)
                if (servant === undefined) {
                    throw Error(`ORB.handleMethod(): client required method '${data.method}' on server for unknown object key ${data.objectKey}`)
                }
                if (!servant.acl.has(this)) {
                    throw Error(`ORB.handleMethod(): client required method '${data.method}' on server but has no rights to access servant with object key ${data.objectKey}`)
                }
                const method = (servant as any)[`_orb_${data.method}`]
                if (method === undefined) {
                    throw Error(`ORB.handleMethod(): client required unknown method '${data.method}' on server for servant with object key ${data.objectKey}`)
                }

                const encoder = new GIOPEncoder(connection)
                encoder.skipReplyHeader()
                method.call(servant, decoder, encoder)
                    .then(() => {
                        if (data.responseExpected) {
                            const length = encoder.offset
                            encoder.setGIOPHeader(MessageType.REPLY)
                            encoder.setReplyHeader(data.requestId, ReplyStatus.NO_EXCEPTION)
                            connection.send(encoder.buffer.slice(0, length))
                        }
                    })
                    .catch((error: Error) => {
                        console.log(error)
                        if (data.responseExpected) {
                            const length = encoder.offset
                            encoder.setGIOPHeader(MessageType.REPLY)
                            encoder.setReplyHeader(data.requestId, ReplyStatus.USER_EXCEPTION)
                            connection.send(encoder.buffer.slice(0, length))
                        }
                    })
            } break
            case MessageType.REPLY: {
                const data = decoder.scanReplyHeader()
                // console.log(`client: got reply for request ${data.requestId}`)
                const handler = connection.map.get(data.requestId)
                if (handler === undefined) {
                    console.log(`Unexpected reply to request ${data.requestId}`)
                    return
                }
                connection.map.delete(data.requestId)
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
    }

    socketClosed(connection: Connection): void {
        this.dispatchEvent(new Event("closed"))
        this.release()
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
        if (information.construct !== undefined) {
            throw Error(`ORB.registerValueType: valuetype '${name}' is already registered`)
        }
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
    // sequcence<ObjectId> list_initial_services();
    // Object resolve_initial_references ( in ObjectId identifier) raises (InvalidName);

    //
    // initial references
    //
    bind(id: string, obj: Skeleton): void {
        if (this.initialReferences.get(id) !== undefined)
            throw Error(`ORB.bind(): the id '${id}' is already bound to an object`)
        this.initialReferences.set(id, obj)
    }

    async list(): Promise<Array<string>> {
        throw Error("not implemented yet")
    }

    async resolve(id: string): Promise<Stub> {
        throw Error("not implemented")
        // const ref = await this.twowayCall(ORB.orbId, "resolve", (encoder) => encoder.string(id), (decoder) => decoder.reference())

        // // if we already have a stub, return that one
        // // if (oid.host === this.peerHost && oid.port === this.peerPort) {
        // let object = this.stubsById.get(ref.objectKey)
        // if (object !== undefined) {
        //     return object
        // }

        // // new reference, create a new stub
        // const shortName = ref.oid.substring(4, ref.oid.length - 4)
        // let aStubClass = this.stubsByName.get(shortName)
        // if (aStubClass === undefined) {
        //     throw Error(`ORB: can not deserialize object of unregistered stub '${ref.oid} (${shortName})'`)
        // }
        // object = new aStubClass(this, ref.objectKey)
        // this.stubsById.set(ref.objectKey, object!)

        // return object!
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
