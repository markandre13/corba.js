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

import * as WebSocket from "ws"

export class ORB {
    debug: number		// values > 0 enable debug output

    socket?: WebSocket		// socket with the client/server

    id: number			// counter to assign id's to locally created objects
    obj: Map<number, Stub>	// maps ids to objects

    classes: Map<string, any>	// maps class names to constructor functions from which objects can be created

    reqid: number		// counter to assign request id's to send messages
    
    valueTypeByName: Map<string, any>
    valueTypeByPrototype: Map<any, string>

    constructor(orb?: ORB) {
        if (orb === undefined) {
            this.debug = 0
            this.classes = new Map<string, any>()
            this.valueTypeByName = new Map<string, any>()
            this.valueTypeByPrototype = new Map<any, string>()
        } else {
            this.debug = orb.debug
            this.classes = orb.classes
            this.valueTypeByName = orb.valueTypeByName
            this.valueTypeByPrototype = orb.valueTypeByPrototype
        }
        this.id = 0
        this.reqid = 0
        this.obj = new Map<number, Stub>()
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
        let value = data["#V"]
        if (type === undefined || value === undefined) {
            throw Error("ORB: no type/value information in serialized data")
        }
        let aClass = this.valueTypeByName.get(type)
        if (aClass === undefined)
            throw Error("ORB: can not deserialize object of unregistered class "+type)
        let object = Object.create(aClass.prototype)
        for(let [innerAttribute, innerValue] of Object.entries(value)) {
            object[innerAttribute] = this._deserialize(innerValue)
        }
        return object
    }
    
    //
    // Client
    //

    async connect(host: string, port: number): Promise<void> {
        if (this.debug>0)
            console.log("ORB.connect('"+host+"', "+port+")")
        let orb = this
        return new Promise<void>( (resolve, reject) => {
            orb.socket = new WebSocket("ws://"+host+":"+port)
            orb.socket.onopen = function() {
                resolve()
            }
            orb.socket.onerror = function(err) {
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
            this.socket.onmessage = (message) => {
                if (this.debug>0) {
                    console.log("ORB.send(...) received "+message.data)
                }
                let msg = JSON.parse(String(message.data))
                if (msg.corba !== "1.0")
                    throw Error("expected corba version 1.0 but got "+msg.corba)
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
            this.socket.onerror = function(err) {
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
        for(let i in params)
            params[i] = this.serialize(params[i])
        let msg = await this.send({
            "corba": "1.0",
            "method": method,
            "params": params,
            "id": id
        })
        return this.deserialize(msg.result)
    }

    ///
    /// Server
    ///

    register(name: string, aClass: any) {
        this.classes.set(name, aClass)
    }
    
    async listen(host: string, port: number): Promise<void> {
        return new Promise<void>( (resolve, reject) => {
            const wss = new WebSocket.Server({host: host,port: port}, function() {
                resolve()
            })
            wss.on("error", (error: any) => {
                switch(error.code) {
                    case "EADDRINUSE":
                        reject(new Error("another server is already running at "+error.address+":"+error.port))
                        break
                    default:
                        reject(error)
                }
            })
            wss.on("connection", (socket) => {
                let orb = new ORB(this)
                orb.accept(socket)
            })
        })
    }
    
    accept(socket: WebSocket) {
        this.socket = socket
        this.socket.onmessage = (message) => {
            if (this.debug>0) {
                console.log("ORB.accept(): got message ", message.data)
            }
            let msg = JSON.parse(String(message.data))
            if (msg.corba !== "1.0") {
                throw Error("expected corba version 1.0 but got "+msg.corba)
            }
            if (msg.new !== undefined) {
                this.handleNew(msg)
            } else
            if (msg.method !== undefined) {
                this.handleMethod(msg)
            }
        }
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
        let result = stub[msg.method].apply(stub, msg.params)
        if (result !== undefined) {
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
        }
    }
}

export class Skeleton
{
    orb: ORB
    id: number

    constructor(orb: ORB) {
        this.orb = orb
        this.id = 0
    }
}

export class Stub
{
    orb: ORB
    id: number
    
    constructor(orb: ORB) {
        this.orb = orb
        this.id = 0
    }
}
