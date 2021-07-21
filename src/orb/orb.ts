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

export interface valueTypeInformation {
    attributes: Array<string>
    name?: string
    construct?: Function
}

export class ORB implements EventTarget {
    debug: number		// values > 0 enable debug output
    name: string

    socket?: any		// socket with the client/server

    stubsByName: Map<string, any>
    stubsById: Map<number, Stub>

    servants: Array<Skeleton|undefined>
    unusedServantIds: Array<number>
    
    accesibleServants: Set<Skeleton>
    
    static valueTypeByName = new Map<string, valueTypeInformation>()
    static valueTypeByPrototype = new Map<any, valueTypeInformation>()

    initialReferences: Map<string, any>

    reqid: number		// counter to assign request id's to send messages // FIXME: handle overflow

    listeners: Map<string, Set<EventListenerOrEventListenerObject>>

    constructor(orb?: ORB) {
        if (orb === undefined) {
            this.debug = 0
            this.servants = new Array<Skeleton|undefined>()
            this.servants.push(undefined) // reserve id 0
            this.unusedServantIds = new Array<number>()
            this.stubsByName = new Map<string, any>()
            this.initialReferences = new Map<string, any>()
            this.name = ""
        } else {
            this.debug = orb.debug
            this.servants = orb.servants
            this.unusedServantIds = orb.unusedServantIds
            this.stubsByName = orb.stubsByName
            this.initialReferences = orb.initialReferences
            this.name = "spawned from '"+orb.name+"'"
        }
        this.stubsById = new Map<number, Stub>()
        this.accesibleServants = new Set<Skeleton>()
        this.reqid = 0
        this.listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
    }
    
    // EventTarget methods
    
    addEventListener(type: string,
                     listener: EventListenerOrEventListenerObject | null,
                     options?: boolean | AddEventListenerOptions): void
    {
        if (type !== "close")
            throw Error("ORB.addEventListener: type must be 'close'")
        if (listener === null)
            return
        let set = this.listeners.get(type)
        if (set === undefined) {
            set = new Set<EventListenerOrEventListenerObject>()
            this.listeners.set(type, set)
        }
        set.add(listener)
    }

    removeEventListener(type: string,
                        listener?: EventListenerOrEventListenerObject | null,
                        options?: EventListenerOptions | boolean): void
    {
        if (type !== "close")
            throw Error("ORB.removeEventListener: type must be 'close'")
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
        for(let handler of set) {
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
    registerServant(servant: Skeleton): number {
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
        if (!this.stubsById.has(stub.id))
            throw Error("ORB.releaseStub(): the stub with id "+stub.id+" is unknown to this ORB")
        this.stubsById.delete(stub.id)
    }

    static registerValueType(name: string, valuetypeConstructor: Function): void {
        let information = ORB.valueTypeByName.get(name)
        if (information === undefined) {
            throw Error(`ORB.registerValueType: valuetype '${name}' not defined in IDL`)
        }
        if (information.construct !== undefined) {
            throw Error(`ORB.registerValueType: valuetype '${name}' is already registered`)
        }
        information.name      = name
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

    //
    // initial references
    //
    bind(id: string, obj: any) {
        if (this.initialReferences.get(id)!==undefined)
            throw Error("ORB.bind(): the id '"+id+"' is already bound to an object")
        this.initialReferences.set(id, obj)
    }
    
    async list(): Promise<Array<string>> {
        let result = new Array<string>()

        for(let [id, obj] of this.initialReferences) {
            result.push(id)
        }
        
        if (this.socket === undefined)
            return result

        let data = {
            "corba": "1.0",
            "list": null
        }
        let remoteInitialReferences = await this.send(data)
        for(let id of remoteInitialReferences.result) {
            result.push(id)
        }
        
        return result
    }

    async resolve(id: string): Promise<Stub> {
        let data = {
            "corba": "1.0",
            "resolve": id
        }
        let remoteInitialReference = await this.send(data)
        if (remoteInitialReference.result === undefined) {
            throw Error("ORB.resolve('"+id+"'): protocol error, no result value")
        }
        let object = this.deserialize(remoteInitialReference.result)
        if (object === null) {
            throw Error("ORB.resolve('"+id+"'): failed to resolve reference")
        }
        return object
    }
    
    //
    // valuetype
    //

    serialize(object: any): string {
        if (object === null || typeof object !== "object") {
            return JSON.stringify(object)
        }
 
        if (object instanceof Stub) {
            throw Error("ORB.serialize(): Stub")
        }
        if (object instanceof Skeleton) {
            return `{"#R":"${(object.constructor as any)._idlClassName()}","#V":${object.id}}`
        }       

        if (object instanceof Array) {
            let data = ""
            for(let x of object) {
                if (data.length!==0)
                    data += ","
                data += this.serialize(x)
            }
            return "["+data+"]"
        }

        let data = ""
        let prototype = Object.getPrototypeOf(object)
        let valueTypeInformation: valueTypeInformation | undefined
        while(prototype !== null) {
            valueTypeInformation = ORB.valueTypeByPrototype.get(prototype)
            if (valueTypeInformation !== undefined)
                break
            prototype = Object.getPrototypeOf(prototype)
        }
        if (valueTypeInformation === undefined) {
            console.log(object)
            throw Error("ORB: can not serialize object of unregistered valuetype")
        }
        for(let attribute of valueTypeInformation.attributes) {
            if (object[attribute] !== undefined) {
                if (data.length!==0)
                    data += ","
                data += '"'+attribute+'":'+this.serialize(object[attribute])
            }
        }
        return `{"#T":"${valueTypeInformation.name!}","#V":{${data}}}`
    }

    deserialize(text: string): any {
        if (text === undefined || text === null)
            return null
        try {
            return this._deserialize(JSON.parse(text))
        }
        catch(error) {
            console.log(text)
            throw error
        }
    }

    _deserialize(data: any): any {
        if (data === null)
            return null

        if (typeof data !== "object")
            return data
        
        if (data instanceof Array) {
            for(let i in data) {
                data[i] = this._deserialize(data[i])
            }
            return data
        }
        
        let type = data["#T"]
        let reference = data["#R"]
        let value = data["#V"]
        if (reference !== undefined && value !== undefined) {
            let object = this.stubsById.get(value)
            if (object !== undefined)
                return object
            let aStubClass = this.stubsByName.get(reference)
            if (aStubClass === undefined) {
                throw Error(`ORB: can not deserialize object of unregistered stub '${reference}'`)
            }
            object = new aStubClass(this, value)
            this.stubsById.set(value, object!)
            return object
        }

        if (type === undefined || value === undefined) {
            throw Error("ORB: no type/value information in serialized data")
        }
        let valueTypeInformation = ORB.valueTypeByName.get(type)
        if (valueTypeInformation === undefined)
            throw Error(`ORB: can not deserialize object of unregistered valuetype '${type}'`)
        let object = new (valueTypeInformation.construct as any)()
        for(let [innerAttribute, innerValue] of Object.entries(value)) {
            object[innerAttribute] = this._deserialize(innerValue)
        }
        return object
    }
    
    //
    // Client
    //

    async connect(url: string): Promise<void> {
        if (this.debug>0)
            console.log("ORB.connect('"+url+")")
        let orb = this
        return new Promise<void>( (resolve, reject) => {
            orb.socket = new WebSocket(url)
            orb.socket.onopen = function() {
                resolve()
            }
            orb.socket.onerror = function(err: any) {
                reject(err)
            }
            orb.socket.onclose = (event: Event) => {
                this.dispatchEvent(event)
                this.release()
            }
        })
    }
    
    send(data: any, oneway: boolean = false): Promise<any> {
        let reqid = ++this.reqid
        data.reqid = reqid
        if (this.debug>0) {
            console.log("ORB.send("+JSON.stringify(data)+")")
        }

        return new Promise<any>( (resolve, reject) => {
            if (this.socket === undefined)
                throw Error("ORB.send(): no socket")
            this.socket.onmessage = (message: any) => {
                if (this.debug>0) {
                    console.log("ORB.send(...) received "+message.data)
                }
                let msg = JSON.parse(String(message.data))
                if (msg.corba !== "1.0")
                    reject(Error("expected corba version 1.0 but got "+msg.corba))
                if (msg.method !== undefined) {
                    try {
                        this.handleMethod(msg)
                    }
                    catch(error) {
                        if (error instanceof Error)
                            console.log(error.message)
                        else
                            console.log(error)
                        throw error
                    }
                } else
                if (msg.list !== undefined) {
                    this.handleListInitialReferences(msg)
                } else
                if (msg.resolve !== undefined) {
                    this.handleResolveInitialReferences(msg)
                } else
                if (reqid == msg.reqid) {
                    resolve(msg)
                }
            }
            this.socket.onerror = function(err: any) {
                reject(err)
            }
            this.socket.send(JSON.stringify(data))
            if (oneway) {
                resolve(undefined)
            }
        })
    }

    async call(stub: Stub, oneway: boolean, method: string, params: Array<any>): Promise<any> {
        // throw Error("FAILURE")
        if (this.debug>0) {
            console.log("ORB.call(...) method "+method)
        }
        for(let i in params) {
            if (params[i] instanceof Skeleton) {
                this.aclAdd(params[i])
            }
            if (params[i] instanceof Stub) {
                throw Error("ORB.call(): not implemented: method '"+method+"' received stub as argument")
            }
            try {
                params[i] = this.serialize(params[i])
            }
            catch(error) {
                console.log(error)
                throw error
            }
        }

        let msg = await this.send({ // FIXME: we should'n wait here for oneway function but this looks like we do...
            "corba": "1.0",
            "method": method,
            "params": params,
            "id": stub.id
        }, oneway)

        if (!oneway)
            return this.deserialize(msg.result)
    }
    
    release() {
        this.aclDeleteAll()
    }
    
    aclAdd(servant: Skeleton) {
        servant.acl.add(this)
        this.accesibleServants.add(servant)
    }
    
    aclDeleteAll() {
        for(let servant of this.accesibleServants)
            servant.acl.delete(this)
        this.accesibleServants.clear()
    }

    handleMethod(msg: any) {
        if (this.debug>0)
            console.log("ORB.handleMethod(", msg, ")")
        if (msg.id >= this.servants.length) {
            throw Error("ORB.handleMethod(): client required method '"+msg.method+"' on server for unknown servant id "+msg.id)
        }
        let servant = this.servants[msg.id] as any
        if (servant === undefined) {
            throw Error("ORB.handleMethod(): client required method '"+msg.method+"' on server for unknown servant id "+msg.id)
        }
        if (!servant.acl.has(this)) {
            throw Error("ORB.handleMethod(): client required method '"+msg.method+"' on server but has no rights to access servant with id "+msg.id)
        }
        if (servant[msg.method]===undefined) {
            throw Error("ORB.handleMethod(): client required unknown method '"+msg.method+"' on server for servant with id "+msg.id)
        }
        for(let i in msg.params) {
            msg.params[i] = this.deserialize(msg.params[i])
        }

        servant.orb = this // set orb to client connection orb
        let result = servant[msg.method].apply(servant, msg.params) as any
    
        if (this.debug>0)
            console.log("ORB.handleMethod(): got result ", result)
                
        result
            .then( (result: any) => {
                if (result === undefined)
                    return
                    
                if (result instanceof Skeleton) {
                    this.aclAdd(result)
                    
                    result.orb = this // replace listener orb with client connection orb
                }
                if (result instanceof Stub) {
                    throw Error("ORB.handleMethod(): method '"+msg.method+"' returned stub")
                }
                
                let answer = {
                    "corba": "1.0",
                    "result": this.serialize(result),
                    "reqid": msg.reqid
                }
                let text = JSON.stringify(answer)
                if (this.debug>0) {
                    console.log("ORB.handleMethod(): sending call reply "+text)
                }
                this.socket!.send(text)
            })
            .catch( (error: any) => {
                // FIXME: also print the class name
                console.log("ORB.handleMethod(): the method '"+msg.method+"' threw an error: ", error)
            })
    }
    
    handleListInitialReferences(msg: any) {
        let result = new Array<string>()
        for(let [id, obj] of this.initialReferences) {
            result.push(id)
        }
        
        let answer = {
           "corba": "1.0",
           "result": result,
           "reqid": msg.reqid
        }
        let text = JSON.stringify(answer)
        if (this.debug>0) {
            console.log("ORB.handleListInitialReferences(): sending call reply "+text)
        }

        this.socket!.send(text)
    }
    
    handleResolveInitialReferences(msg: any) {
        let object = this.initialReferences.get(msg.resolve)
        if (object === undefined) {
            console.log("ORB.handleResolveInitialReferences(): failed to resolve '"+msg.resolve+"'")
            object = null
        } else {
            this.aclAdd(object)
        }
        
        let answer = {
            "corba": "1.0",
            "result": this.serialize(object),
            "reqid": msg.reqid
        }

        let text = JSON.stringify(answer)
        if (this.debug>0) {
            console.log("ORB.handleResolveInitialReferences(): sending call reply "+text)
        }

        this.socket!.send(text)
    }

    async listen(host: string, port: number): Promise<void> {
        throw Error("pure virtual function ORB.listen() being called in browser ORB")
    }
    
    accept() {
        throw Error("pure virtual function ORB.accept() being called in browser ORB")
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
