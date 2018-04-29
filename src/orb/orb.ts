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

export class ORB {
    debug: number		// values > 0 enable debug output

    socket?: any		// socket with the client/server

    id: number			// counter to assign id's to locally created objects
    obj: Map<number, Stub>	// maps ids to objects

    classes: Map<string, any>	// maps class names to constructor functions from which objects can be created
    stubsByName: Map<string, any> // FIXME: name not final

    reqid: number		// counter to assign request id's to send messages
    
    valueTypeByName: Map<string, any>
    valueTypeByPrototype: Map<any, string>

    constructor(orb?: ORB) {
        if (orb === undefined) {
            this.debug = 0
            this.classes = new Map<string, any>()
            this.stubsByName = new Map<string, any>()
            this.valueTypeByName = new Map<string, any>()
            this.valueTypeByPrototype = new Map<any, string>()
        } else {
            this.debug = orb.debug
            this.classes = orb.classes
            this.stubsByName = orb.stubsByName
            this.valueTypeByName = orb.valueTypeByName
            this.valueTypeByPrototype = orb.valueTypeByPrototype
        }
        this.id = 0
        this.reqid = 0
        this.obj = new Map<number, Stub>()
    }

    register(name: string, aClass: any) {
        this.classes.set(name, aClass)
    }
    
    registerStub(name: string, aStubClass: any) { // FIXME: method name not final
        this.stubsByName.set(name, aStubClass)
    }
    
    //
    // valuetype
    //

    registerValueType(name: string, valuetype: any): void {
        this.valueTypeByName.set(name, valuetype)
        this.valueTypeByPrototype.set(valuetype.prototype, name)
    }

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
                throw Error("ORB: can not deserialize object of unregistered stub "+type)
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
            if (!this.socket)
                throw Error("fuck")
            this.socket.onmessage = (message: any) => {
                if (this.debug>0) {
                    console.log("ORB.send(...) received "+message.data)
                }
                let msg = JSON.parse(String(message.data))
                if (msg.corba !== "1.0")
                    reject(Error("expected corba version 1.0 but got "+msg.corba))
                if (msg.new !== undefined) {
                    this.handleNew(msg)
                } else
                if (msg.method !== undefined) {
                    this.handleMethod(msg)
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

    create(stub: Stub, name: string) {
        if (this.debug>0) {
            console.log("ORB.create(<stub>, '"+name+"')")
        }
        
        let id = ++this.id
        
        let data = {
            "corba": "1.0",
            "new": name,
            "id": id
        }

        stub.id = id
        this.obj.set(id, stub)
        this.send(data)
    }

    async call(id: number, method: string, params: Array<any>) {
        for(let i in params) {
            params[i] = this.serialize(params[i])
        }

        let msg = await this.send({
            "corba": "1.0",
            "method": method,
            "params": params,
            "id": id
        })
        return this.deserialize(msg.result)
    }

    handleNew(msg: any) {
        let template = this.classes.get(msg.new)
        if (template===undefined)
            throw Error("peer requested instantiation of unknown class '"+msg.new+"'")

        let obj = new template(this)

        obj.id = msg.id
        this.obj.set(msg.id, obj)

        if (this.debug>0) {
            console.log("ORB.handleNew(): created new object of class '"+msg.new+"' with id "+msg.id)
        }
    }
    
    handleMethod(msg: any) {
        let stub = this.obj.get(msg.id) as any
        if (stub===undefined)
            throw Error("ORB.handleMethod(): client required method '"+msg.method+"' on server for unknown object "+msg.id)
        if (stub[msg.method]===undefined)
            throw Error("ORB.handleMethod(): client required unknown method '"+msg.method+"' on server for known object "+msg.id)
        for(let i in msg.params) {
            msg.params[i] = this.deserialize(msg.params[i])
        }
        let result = stub[msg.method].apply(stub, msg.params) as any
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
        this.id = 0
    }
    
    // what we need to transmit to the client to create a stub
    _this(): Object_ref {
        throw Error("pure virtual method Skeleton._this() called")
    }
}

export class Stub {
    orb: ORB
    id: number
    
    constructor(orb: ORB, name: string, id?: number) {
        this.orb = orb
        if (id===undefined) {
            this.id = 0
            this.orb.create(this, name)
        } else {
            this.id = id
        }
    }
}
