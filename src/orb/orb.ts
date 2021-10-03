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

import { GIOPDecoder, GIOPEncoder, MessageType } from "./giop"
import { IOR } from "./ior"

export interface ValueTypeInformation {
    attributes: Array<string>
    encode: (encoder: GIOPEncoder, obj: any) => void
    name?: string
    construct?: Function
}

interface SocketUser {
    socketSend: (buffer: ArrayBuffer) => void
    socketRcvd(buffer: ArrayBuffer): void
    socketError(error: Error): void
    socketClose(): void
}

export class PromiseHandler {
    constructor(decode: (decoder: GIOPDecoder) => void, reject: (reason?: any) => void) {
        this.decode = decode
        this.reject = reject
    }
    decode: (decoder: GIOPDecoder) => void
    reject: (reason?: any) => void
}

export class ORB implements EventTarget, SocketUser {
    debug: number		// values > 0 enable debug output
    name: string        // orb name to ease debugging

    // socket?: any		// socket with the client/server

    stubsByName: Map<string, any>
    stubsById: Map<string, Stub>

    servants: Array<CORBAObject | undefined>
    unusedServantIds: Array<number>

    accesibleServants: Set<Skeleton>

    static valueTypeByName = new Map<string, ValueTypeInformation>()
    static valueTypeByPrototype = new Map<any, ValueTypeInformation>()

    initialReferences: Map<string, Skeleton>

    reqid: number // counter to assign request id's to send messages // FIXME: handle overflow

    listeners: Map<string, Set<EventListenerOrEventListenerObject>>

    constructor(orb?: ORB) {
        if (orb === undefined) {
            this.debug = 0
            this.servants = []
            this.servants.push(undefined) // reserve id 0
            this.unusedServantIds = []
            this.stubsByName = new Map<string, any>()
            this.initialReferences = new Map<string, any>()
            this.name = ""
        } else {
            this.debug = orb.debug
            this.servants = orb.servants
            this.unusedServantIds = orb.unusedServantIds
            this.stubsByName = orb.stubsByName
            this.initialReferences = orb.initialReferences
            this.name = "spawned from '" + orb.name + "'"
        }
        this.stubsById = new Map()
        this.accesibleServants = new Set<Skeleton>()
        this.reqid = 0
        this.listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
    }

    //
    // Network OUT
    //
    socketSend!: (buffer: ArrayBuffer) => void
    map = new Map<number, PromiseHandler>()

    onewayCall(objectId: string, method: string, encode: (encoder: GIOPEncoder) => void): void {
        this.callCore(++this.reqid, false, objectId, method, encode)
    }

    twowayCall<T>(objectId: string, method: string,
        encode: (encoder: GIOPEncoder) => void,
        decode: (decoder: GIOPDecoder) => T
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const requestId = ++this.reqid
            this.map.set(
                requestId,
                new PromiseHandler(
                    (decoder: GIOPDecoder) => resolve(decode(decoder)),
                    reject)
            )
            this.callCore(requestId, true, objectId, method, encode)
        })
    }

    protected callCore(
        requestId: number,
        responseExpected: boolean,
        objectId: string,
        method: string,
        encode: (encoder: GIOPEncoder) => void) {
        // console.log(`client: send request ${requestId}`)
        const encoder = new GIOPEncoder(this)
        encoder.encodeRequest(objectId, method, requestId, responseExpected)
        encode(encoder)
        encoder.setGIOPHeader(MessageType.REQUEST)
        this.socketSend(encoder.buffer.slice(0, encoder.offset))
    }

    //
    // Network IN
    //
    socketRcvd(buffer: ArrayBuffer): void {
        const decoder = new GIOPDecoder(buffer, this)
        const type = decoder.scanGIOPHeader()
        switch (type) {
            case MessageType.REQUEST: {
                const data = decoder.scanRequestHeader()
                if (data.objectKey === "ORB") {
                    if (data.method === "resolve") {
                        const reference = decoder.string()
                        // console.log(`ORB: received ORB.resolve("${reference}")`)
                        const encoder = new GIOPEncoder(this)
                        let object = this.initialReferences.get(reference)
                        if (object === undefined) {
                            // console.log(`ORB.handleResolveInitialReferences(): failed to resolve '${reference}`)
                            encoder.encodeReply(data.requestId, GIOPDecoder.SYSTEM_EXCEPTION)
                        } else {
                            this.aclAdd(object)
                            encoder.encodeReply(data.requestId, GIOPDecoder.NO_EXCEPTION)
                            encoder.reference(object)
                        }
                        encoder.setGIOPHeader(MessageType.REPLY)
                        this.socketSend(encoder.buffer.slice(0, encoder.offset))
                    }
                    return
                }

                const id = parseInt(data.objectKey)
                if (id >= this.servants.length) {
                    throw Error(`ORB.handleMethod(): client required method '${data.method}' on server for unknown servant id ${id}`)
                }
                let servant = this.servants[id] as any
                if (servant === undefined) {
                    throw Error(`ORB.handleMethod(): client required method '${data.method}' on server for unknown servant id " + msg.id`)
                }
                if (!servant.acl.has(this)) {
                    throw Error(`ORB.handleMethod(): client required method '${data.method}' on server but has no rights to access servant with id ${id}`)
                }
                if (servant[data.method] === undefined) {
                    throw Error(`ORB.handleMethod(): client required unknown method '${data.method}' on server for servant with id ${id}`)
                }

                const encoder = new GIOPEncoder(this)
                encoder.skipReplyHeader();
                (servant as any)[`_orb_${data.method}`].call(servant, decoder, encoder)
                .then( () => {
                    if (data.responseExpected) {
                        const length = encoder.offset
                        encoder.setGIOPHeader(MessageType.REPLY)
                        encoder.setReplyHeader(data.requestId, GIOPDecoder.NO_EXCEPTION)
                        this.socketSend(encoder.buffer.slice(0, length))
                    }    
                })
                .catch((error: Error) => {
                    console.log(error)
                    if (data.responseExpected) {
                        const length = encoder.offset
                        encoder.setGIOPHeader(MessageType.REPLY)
                        encoder.setReplyHeader(data.requestId, GIOPDecoder.USER_EXCEPTION)
                        this.socketSend(encoder.buffer.slice(0, length))
                    }
                })
            } break
            case MessageType.REPLY: {
                const data = decoder.scanReplyHeader()
                // console.log(`client: got reply for request ${data.requestId}`)
                const handler = this.map.get(data.requestId)
                if (handler === undefined) {
                    console.log(`Unexpected reply to request ${data.requestId}`)
                    return
                }
                this.map.delete(data.requestId)
                switch (data.replyStatus) {
                    case GIOPDecoder.NO_EXCEPTION:
                        handler.decode(decoder)
                        break
                    case GIOPDecoder.USER_EXCEPTION:
                        handler.reject(new Error(`User Exception`))
                        break
                }
            } break
        }
    }

    socketError(error: Error): void { }
    socketClose(): void { 
        this.dispatchEvent(new Event("close"))
        this.release()
    }

    //
    // EventTarget methods 
    //
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

    set onclose(listener: EventListenerOrEventListenerObject | null) {
        this.listeners.delete("close")
        this.addEventListener("close", listener)
    }

    // called by the Skeleton
    registerServant(servant: CORBAObject): number {
        let id = this.unusedServantIds.pop()
        if (id !== undefined) {
            this.servants[id] = servant
        } else {
            id = this.servants.length
            this.servants.push(servant)
        }
        return id
    }

    unregisterServant(servant: Skeleton) {
        this.servants[servant.id] = undefined
        this.unusedServantIds.push(servant.id)
        servant.id = -1
    }

    registerStubClass(aStubClass: any) {
        this.stubsByName.set(aStubClass._idlClassName(), aStubClass)
    }

    releaseStub(stub: Stub): void {
        if (!this.stubsById.has(`${stub.id}`))
            throw Error("ORB.releaseStub(): the stub with id " + stub.id + " is unknown to this ORB")
        this.stubsById.delete(`${stub.id}`)
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
            throw Error("ORB.bind(): the id '" + id + "' is already bound to an object")
        this.initialReferences.set(id, obj)
    }

    async list(): Promise<Array<string>> {
        throw Error("not implemented yet")
    }

    async resolve(id: string): Promise<Stub> {
        const ref = await this.twowayCall("ORB", "resolve", (encoder) => encoder.string(id), (decoder) => decoder.reference())

        // if we already have a stub, return that one
        // if (oid.host === this.peerHost && oid.port === this.peerPort) {
        let object = this.stubsById.get(ref.objectKey)
        if (object !== undefined) {
            return object
        }

        // new reference, create a new stub
        const shortName = ref.oid.substring(4, ref.oid.length - 4)
        let aStubClass = this.stubsByName.get(shortName)
        if (aStubClass === undefined) {
            throw Error(`ORB: can not deserialize object of unregistered stub '${ref.oid} (${shortName})'`)
        }
        object = new aStubClass(this, ref.objectKey)
        this.stubsById.set(ref.objectKey, object!)

        return object!
    }

    iorToObject(ior: IOR): Stub {
        let object = this.stubsById.get(ior.objectKey)
        if (object !== undefined) {
            return object
        }

        const shortName = ior.oid.substring(4, ior.oid.length - 4)
        let aStubClass = this.stubsByName.get(shortName)
        if (aStubClass === undefined) {
            throw Error(`ORB: can not deserialize object of unregistered stub '${ior.oid} (${shortName})'`)
        }
        object = new aStubClass(this, ior.objectKey)
        this.stubsById.set(ior.objectKey, object!)
        return object!
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
    id: number
    constructor(orb: ORB, id: number) {
        this.orb = orb
        this.id = id
    }
}

export abstract class Skeleton extends CORBAObject {
    acl: Set<ORB>

    constructor(orb: ORB) {
        super(orb, 0)
        this.id = orb.registerServant(this)
        this.acl = new Set<ORB>()
    }

    release(): void {
    }
}

export abstract class Stub extends CORBAObject {
    constructor(orb: ORB, remoteID: number) {
        super(orb, remoteID)
    }

    release(): void {
        this.orb.releaseStub(this)
    }
}
