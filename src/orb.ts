/*
 *  glue.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
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

import * as ws from "ws"
const WebSocket = ws


export class ORB {
    debug: number		// values > 0 enable debug output

    socket?: ws			// socket with the client/server

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
                if (msg.glue !== "1.0")
                    throw Error("expected glue version 1.0 but got "+msg.glue)
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
            "glue": "1.0",
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
            "glue": "1.0",
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
            const wss = new ws.Server({host: host,port: port}, function() {
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
    
    accept(socket: ws) {
        this.socket = socket
        this.socket.onmessage = (message) => {
            if (this.debug>0) {
                console.log("ORB.accept(): got message ", message.data)
            }
            let msg = JSON.parse(String(message.data))
            if (msg.glue !== "1.0") {
                throw Error("expected glue version 1.0 but got "+msg.glue)
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
                "glue": "1.0",
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

//=================================== DEMO ===================================

class Origin
{
    x: number
    y: number
    
    constructor(x?: number, y?: number) {
        this.x = x ? x : 0
        this.y = y ? y : 0
    }
    print(): void {
        console.log("Origin.print(): x="+this.x+", y="+this.y)
    }
}

class Size {
    width: number
    height: number
    constructor(width?: number, height?: number) {
        this.width = width ? width : 0
        this.height = height ? height : 0
    }
    print(): void {
        console.log("Size.print(): width="+this.width+", height="+this.height)
    }
}

abstract class Figure {
    abstract print(): void
}

class FigureModel {
    data: Array<Figure>
    constructor() {
        this.data = new Array<Figure>()
    }
}

class Rectangle extends Figure {
    origin: Origin
    size: Size
    constructor(x?: number, y?: number, width?: number, height?: number) {
        super()
        this.origin = new Origin(x, y)
        this.size   = new Size(width, height)
    }
    print(): void {
        console.log("Rectangle.print(): ("+this.origin.x+","+this.origin.y+","+this.size.width+","+this.size.height+")")
    }
}

let orb = new ORB()
orb.registerValueType("Origin", Origin)
orb.registerValueType("Size", Size)
orb.registerValueType("Figure", Figure)
orb.registerValueType("Rectangle", Rectangle)
orb.registerValueType("FigureModel", FigureModel)

let model = new FigureModel()
model.data.push(new Rectangle(10, 20, 30, 40))
model.data.push(new Rectangle(50, 60, 70, 80))

abstract class Server_skel extends Skeleton
{
    constructor(orb: ORB) {
        super(orb)
    }
    
    abstract hello(): void
    abstract answer(a: number, b: number): number
}

class Server_impl extends Server_skel
{
    client: Client

    constructor(orb: ORB) {
        super(orb)
        this.client = new Client(orb)
        this.client.question()
        this.client.setFigureModel(model)
    }

    hello(): void {
        console.log("Server_impl.hello()")
    }
    
    answer(a: number, b: number): number {
        console.log("Server_impl.answer()")
        return a*b
    }
}

class Server extends Stub
{
    constructor(orb: ORB) {
        super(orb)
        this.orb.create(this, "Server")
    }

    hello(): void {
        this.orb.call(this.id, "hello", [])
    }

    async answer(a: number, b: number): Promise<number> {
        return await this.orb.call(this.id, "answer", [a, b])
    }
}

class Client extends Stub
{
    constructor(orb: ORB) {
        super(orb)
        this.orb.create(this, "Client")
    }
    
    question(): void {
        this.orb.call(this.id, "question", [])
    }
    
    setFigureModel(figuremodel: FigureModel): void {
        this.orb.call(this.id, "setFigureModel", [figuremodel])
    }
}

abstract class Client_skel extends Skeleton
{
    constructor(orb: ORB) {
        super(orb)
    }
    
    abstract question(): void
    abstract setFigureModel(figuremodel: FigureModel): void
}

class Client_impl extends Client_skel
{
    constructor(orb: ORB) {
        super(orb)
    }
    
    question(): void {
        console.log("Client_impl.question()")
    }
    
    setFigureModel(figuremodel: FigureModel): void {
        console.log("Client_impl.setFigureModel()")
        console.log(figuremodel)

        figuremodel.data[0].print()
        let r = figuremodel.data[0] as Rectangle
        r.origin.print()
        r.size.print()
        
    }
}

if (process.argv.length!==3) {
    console.log("please provide one argument: --server | --client")
    process.exit(1)
}

async function server() {
    orb.register("Server", Server_impl)
    await orb.listen("0.0.0.0", 8000)
    console.log("orb is listening")
}

async function client() {
    orb.register("Client", Client_impl)
    await orb.connect("127.0.0.1", 8000)
    console.log("orb is connected")

    let server = new Server(orb)
    server.hello()
    server.answer(2, 9)
    let n = await server.answer(7, 6)
    console.log("the answer is "+n)
}

if (process.argv[2]==="--server") {
    server()
} else
if (process.argv[2]==="--client") {
    client()
} else {
    console.log("please provide one argument: --server | --client")
    process.exit(1)
}
