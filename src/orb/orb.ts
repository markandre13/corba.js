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

export class ORB {
    debug: number		// values > 0 enable debug output

    socket?: any		// socket with the client/server

    implementationByName: Map<string, any>
    stubsByName: Map<string, any>

    servantsById: Map<number, Skeleton>
    servantsIdCounter: number
    noNewServants: boolean
    
    valueTypeByName: Map<string, any>
    valueTypeByPrototype: Map<any, string>

    initialReferences: Map<string, any>

    reqid: number		// counter to assign request id's to send messages // FIXME: handle overflow

    constructor(orb?: ORB) {
        if (orb === undefined) {
            this.debug = 0
            this.implementationByName = new Map<string, any>()
            this.stubsByName = new Map<string, any>()
            this.valueTypeByName = new Map<string, any>()
            this.valueTypeByPrototype = new Map<any, string>()
            this.servantsIdCounter = 0
            this.servantsById = new Map<number, Skeleton>()
            this.initialReferences = new Map<string, any>()
        } else {
            this.debug = orb.debug
            this.implementationByName = orb.implementationByName
            this.stubsByName = orb.stubsByName
            this.valueTypeByName = orb.valueTypeByName
            this.valueTypeByPrototype = orb.valueTypeByPrototype
            this.servantsIdCounter = orb.servantsIdCounter
            this.servantsById = orb.servantsById
            this.initialReferences = orb.initialReferences
            orb.noNewServants = true
        }
        this.noNewServants = false
        this.reqid = 0
    }

    register(name: string, aClass: any) {
        this.implementationByName.set(name, aClass)
    }
    
    registerServant(servant: Skeleton): number {
        if (this.noNewServants) // this restriction could be removed by using a class wide servantsIdCounter
            throw Error("ORB: registerServant() can not register new servants (because the ORB has copies)")
        let id = ++this.servantsIdCounter
        this.servantsById.set(id, servant)
        return id
    }
    
    registerStub(name: string, aStubClass: any) {
        this.stubsByName.set(name, aStubClass)
    }

    registerValueType(name: string, valuetype: any): void {
        this.valueTypeByName.set(name, valuetype)
        this.valueTypeByPrototype.set(valuetype.prototype, name)
    }

    //
    // initial references
    //
    register_initial_reference(id: string, obj: any) {
        if (this.initialReferences.has(id)) {
            throw Error("ORB.register_initial_reference(): an initial reference with the id '"+id+"' has already been registered.")
        }
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
        
        if (object instanceof Object_ref) {
            return `{"#R":"${object.name}","#V":${object.id}}`
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
        let name = this.valueTypeByPrototype.get(prototype)
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
        let aClass = this.valueTypeByName.get(type)
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
        for(let i in params) {
            params[i] = this.serialize(params[i])
        }
        if (stub.id === ASYNCHROUNOUSLY_CREATE_REMOTE_OBJECT_TO_GET_ID) {
            let data = {
                "corba": "1.0",
                "create": stub._CORBAClass!
            }
            let result = await this.send(data)
            stub.id = result.result
        }
        let msg = await this.send({ // FIXME: we should'n wait here for oneway function but this looks like we do...
            "corba": "1.0",
            "method": method,
            "params": params,
            "id": stub.id
        })
        return this.deserialize(msg.result)
    }

    handleCreate(msg: any) {
        let template = this.implementationByName.get(msg.create)
        if (template===undefined)
            throw Error("peer requested instantiation of unknown class '"+msg.create+"'")

        let obj = new template(this)

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
        if (this.debug>0)
            console.log("ORB.handleMethod(", msg, ")")
        let servant = this.servantsById.get(msg.id) as any
        if (servant === undefined) {
            throw Error("ORB.handleMethod(): client required method '"+msg.method+"' on server for unknown servant id "+msg.id)
        }
        if (servant[msg.method]===undefined)
            throw Error("ORB.handleMethod(): client required unknown method '"+msg.method+"' on server for known object "+msg.id)
        for(let i in msg.params) {
            msg.params[i] = this.deserialize(msg.params[i])
        }
        let result = servant[msg.method].apply(servant, msg.params) as any
        result.then( (result: any) => {
            if (result === undefined)
                return
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
        let initialReference = this.initialReferences.get(msg.resolve_initial_references)
        
        let result = undefined
        if (initialReference !== undefined)
            result = initialReference._this()
    
        let answer = {
            "corba": "1.0",
            "result": this.serialize(result),
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

export class Object_ref {
    name: string
    id: number
    constructor(name: string, id: number) {
        this.name = name
        this.id = id
    }
}

export class Skeleton {
    orb: ORB
    id: number

    constructor(orb: ORB) {
        this.orb = orb
        this.id = orb.registerServant(this)
    }
    
    _this(): Object_ref {
        throw Error("pure virtual method Skeleton._this() called")
    }
}

export class Stub {
    orb: ORB
    id: number
    _CORBAClass: string
    
    constructor(orb: ORB, name: string, id?: number) {
        this.orb = orb
        this._CORBAClass = name
        if (id === undefined) {
            this.id = ASYNCHROUNOUSLY_CREATE_REMOTE_OBJECT_TO_GET_ID
        } else {
            this.id = id
        }
    }
}
