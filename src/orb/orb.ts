/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018 Mark-André Hopf <mhopf@mark13.org>
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

const ASYNCHROUNOUSLY_CREATE_REMOTE_OBJECT_TO_GET_ID = 0

export class ORB implements EventTarget {
    debug: number		// values > 0 enable debug output

    socket?: any		// socket with the client/server

    implementationByName: Map<string, any>
    stubsByName: Map<string, any>

    servants: Array<Skeleton|undefined>
    unusedServantIds: Array<number>
    
    accesibleServants: Set<Skeleton>
    
    static valueTypeByName = new Map<string, any>()
    static valueTypeByPrototype = new Map<any, string>()

    initialReferences: Map<string, any>

    reqid: number		// counter to assign request id's to send messages // FIXME: handle overflow

    listeners: Map<string, Set<EventListenerOrEventListenerObject>>

    constructor(orb?: ORB) {
        if (orb === undefined) {
            this.debug = 0
            this.implementationByName = new Map<string, any>()
            this.servants = new Array<Skeleton|undefined>()
            this.servants.push(undefined) // reserve id 0
            this.unusedServantIds = new Array<number>()
            this.stubsByName = new Map<string, any>()
            this.initialReferences = new Map<string, any>()
        } else {
            this.debug = orb.debug
            this.implementationByName = orb.implementationByName
            this.servants = orb.servants
            this.unusedServantIds = orb.unusedServantIds
            this.stubsByName = orb.stubsByName
            this.initialReferences = orb.initialReferences
        }
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
    
    // implementations registered here can be instantiated by the client
    register(name: string, aClass: any) {
        this.implementationByName.set(name, aClass)
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
    
    registerStub(name: string, aStubClass: any) {
        this.stubsByName.set(name, aStubClass)
    }

    static registerValueType(name: string, valuetype: any): void {
        ORB.valueTypeByName.set(name, valuetype)
        ORB.valueTypeByPrototype.set(valuetype.prototype, name)
    }
    
    static lookupValueType(name: string): any {
        return ORB.valueTypeByName.get(name)
    }

    //
    // initial references
    //
    register_initial_reference(id: string, obj: any) {
        this.initialReferences.set(id, obj)
    }
    
    async list_initial_references(): Promise<Array<string>> {
        let result = new Array<string>()

        for(let [id, obj] of this.initialReferences) {
            result.push(id)
        }
        
        if (this.socket === undefined)
            return result

        let data = {
            "corba": "1.0",
            "list_initial_references": null
        }
        let remoteInitialReferences = await this.send(data)
        for(let id of remoteInitialReferences.result) {
            result.push(id)
        }
        
        return result
    }

    async resolve_initial_references(id: string): Promise<Stub> {
        let data = {
            "corba": "1.0",
            "resolve_initial_references": id
        }
        let remoteInitialReference = await this.send(data)
        if (remoteInitialReference.result === undefined) {
            throw Error("ORB.resolve_initial_references('"+id+"'): failed to resolve reference")
        }
        let object = this.deserialize(remoteInitialReference.result)
        return object
    }
    
    //
    // valuetype
    //

    serialize(object: any): string {
        if (typeof object !== "object") {
            return JSON.stringify(object)
        }
 
        if (object instanceof Stub) {
            throw Error("ORB.serialize(): Stub")
        }
        if (object instanceof Skeleton) {
            return `{"#R":"${object._idlClassName()}","#V":${object.id}}`
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
        let name = ORB.valueTypeByPrototype.get(prototype)
        if (name === undefined)
            throw Error("ORB: can not serialize object of unregistered class "+object.constructor.name)
        for(let [attribute, value] of Object.entries(object)) {
            if (data.length!==0)
                data += ","
            data += '"'+attribute+'":'+this.serialize(value)
        }
        return `{"#T":"${name}","#V":{${data}}}`
    }

    deserialize(text: string): any {
        return this._deserialize(JSON.parse(text))
    }

    _deserialize(data: any): any {
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
            let aStubClass = this.stubsByName.get(reference)
            if (aStubClass === undefined) {
                throw Error("ORB: can not deserialize object of unregistered stub '"+reference+"'")
            }
            let object = new aStubClass(this, value)
            return object
        }

        if (type === undefined || value === undefined) {
            throw Error("ORB: no type/value information in serialized data")
        }
        let aClass = ORB.valueTypeByName.get(type)
        if (aClass === undefined)
            throw Error("ORB: can not deserialize object of unregistered valuetype "+type)
        let object = new aClass()
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
    
    async send(data: any): Promise<any> {
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
                if (msg.create !== undefined) {
                    this.handleCreate(msg)
                } else
                if (msg.method !== undefined) {
                    this.handleMethod(msg)
                } else
                if (msg.list_initial_references !== undefined) {
                    this.handleListInitialReferences(msg)
                } else
                if (msg.resolve_initial_references !== undefined) {
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
        })
    }

    async call(stub: Stub, method: string, params: Array<any>) {
        if (stub.id === ASYNCHROUNOUSLY_CREATE_REMOTE_OBJECT_TO_GET_ID) {
            let data = {
                "corba": "1.0",
                "create": stub._idlClassName()
            }
            let result = await this.send(data)
            stub.id = result.result
        }
        
        for(let i in params) {
            if (params[i] instanceof Skeleton) {
                this.aclAdd(params[i])
            }
            if (params[i] instanceof Stub) {
                throw Error("ORB.call(): methods '"+method+"' received stub as argument")
            }
            params[i] = this.serialize(params[i])
        }
        let msg = await this.send({ // FIXME: we should'n wait here for oneway function but this looks like we do...
            "corba": "1.0",
            "method": method,
            "params": params,
            "id": stub.id
        })
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

    handleCreate(msg: any) {
        let template = this.implementationByName.get(msg.create)
        if (template===undefined)
            throw Error("peer requested instantiation of unknown class '"+msg.create+"'")

        let obj = new template(this)
        this.aclAdd(obj)
        let answer = {
            "corba": "1.0",
            "result": obj.id,
            "reqid": msg.reqid
        }
        let text = JSON.stringify(answer)
        if (this.debug>0) {
            console.log("ORB.handleMethod(): sending call reply "+text)
        }
        this.socket!.send(text)

        if (this.debug>0) {
            console.log("ORB.handleCreate(): created new object of class '"+msg.create+"' with id "+obj.id)
        }
    }
    
    handleMethod(msg: any) {
// FIXME: errors thrown here don't appear on the console
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

        let result = servant[msg.method].apply(servant, msg.params) as any
                
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
                console.log("ORB.handleMethod(): method '"+msg.method+"' threw error: ", error)
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
        let object = this.initialReferences.get(msg.resolve_initial_references)
        this.aclAdd(object)

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

export abstract class Skeleton {
    orb: ORB
    id: number
    acl: Set<ORB>

    constructor(orb: ORB) {
        this.orb = orb
        this.id = orb.registerServant(this)
        this.acl = new Set<ORB>()
    }
    
    abstract _idlClassName(): string
}

export abstract class Stub {
    orb: ORB
    id: number
    
    constructor(orb: ORB, remoteID?: number) {
        this.orb = orb
        if (remoteID === undefined) {
            this.id = ASYNCHROUNOUSLY_CREATE_REMOTE_OBJECT_TO_GET_ID
        } else {
            this.id = remoteID
        }
    }

    abstract _idlClassName(): string    
}
