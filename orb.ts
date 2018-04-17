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
    debug: number
    socket?: ws

    id: number			// counter to assign id's to locally created objects
    obj: Map<number, Stub>	// maps ids to objects

    cls: Map<string, any>	// maps class names to constructor functions from which objects can be created

    reqid: number		// counter to assign request id's to send messages
    
    constructor() {
        this.debug = 1
        this.id = 0
        this.reqid = 0
        this.obj = new Map<number, Stub>()
        this.cls = new Map<string, any>()
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
        if (this.debug>0) {
            console.log("ORB.send("+JSON.stringify(data)+")")
        }
        let reqid = ++this.reqid
        data.reqid = reqid

        return new Promise<any>( (resolve, reject) => {
            if (!this.socket)
                throw Error("fuck")
            this.socket.onmessage = function(message) {
                if (this.debug>0) {
                    console.log("ORB.send(...) received "+message)
                }
                let msg = JSON.parse(message.data)
                if (msg.glue !== "1.0")
                    throw Error("expected glue version 1.0 but got "+msg.glue)
                if (reqid == msg.reqid)
                    resolve(msg)
            }
            this.socket.onerror = function(err) {
                reject(err)
            }
            this.socket.send(JSON.stringify(data))
        })
    }

    async create(stub: Stub, name: string): Promise<void> {
        if (this.debug>0) {
            console.log("ORB.create(<stub>, '"+name+"'")
        }
        let data = {
            "glue": "1.0",
            "new": name,
        }

        let msg = await this.send(data)
        if (msg.created === undefined) {
            console.log("ORB.create() received", msg)
            throw Error("ORB.create(): message did not contain 'created'")
        }
        stub.id = msg.id
        this.obj.set(msg.id, stub)
    }

    async call(id: number, method: string, params: any) {
        let msg = await this.send({
            "glue": "1.0",
            "method": method,
            "params": params,
            "id": id
        })
        return msg.result
    }

    ///
    /// Server
    ///

    register(name: string, cls: any) {
        this.cls.set(name, cls)
    }

    async listen(host: string, port: number): Promise<void> {
        return new Promise<void>( (resolve, reject) => {
            const wss = new ws.Server({host: host,port: port}, function() {
                resolve()
            })
            wss.on("error", (error) => {
                switch(error.code) {
                    case "EADDRINUSE":
                        reject(new Error("another server is already running at "+error.address+":"+error.port))
                        break
                    default:
                        reject(error)
                }
            })
            wss.on("connection", (client) => {
                let orb = new ORB()
                orb.cls = this.cls
                orb.socket = client
                orb.accept()
            })
        })
    }
    
    accept() {
        this.socket.on("message", (message, flags) => {
            if (this.debug>0) {
                console.log("ORB.accept(): got message "+message)
            }
            let msg = JSON.parse(message)
            if (msg.glue !== "1.0") {
                throw Error("expected glue version 1.0 but got "+msg.glue)
            }
            if (msg.new !== undefined) {
                let id = ++this.id
                
                let cons = this.cls.get(msg.new)
                if (cons===undefined)
                    throw Error("peer requested instantiation of unknown class '"+msg.new+"'")
                
                let obj = Object.create(cons.prototype)
                obj.constructor(this)

                obj.id = id
                this.obj.set(id, obj)

                let answer = {
                    "glue": "1.0",
                    "created": msg.new,
                    "id": id,
                    "reqid": msg.reqid
                }
                let text = JSON.stringify(answer)
                if (this.debug>0) {
                    console.log("ORB.accept(): sending new reply "+text)
                }
                this.socket.send(text)
            }
            if (msg.method !== undefined) {
                let stub = this.obj.get(msg.id)
                if (stub===undefined)
                    throw Error("ORB.accept(): client required method '"+msg.method+"' on server for unknown object "+msg.id)
                if (stub[msg.method]===undefined)
                    throw Error("ORB.accept(): client required unknown method '"+msg.method+"' on server for known object "+msg.id)
                let result = stub[msg.method](msg.params[0], msg.params[1], msg.params[2], msg.params[3], msg.params[4], msg.params[5])
                if (result !== undefined) {
                    let answer = {
                        "glue": "1.0",
                        "result": result,
                        "reqid": msg.reqid
                    }
                    let text = JSON.stringify(answer)
                    if (this.debug>0) {
                        console.log("ORB.accept(): sending call reply "+text)
                    }
                    this.socket.send(text)
                }
            }
        })
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
/*
        this.client = new Client(orb)
        this.client.create()
        this.client.question()
*/
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
    }

    async create() { // FIXME: when we create the object id on the client, we could get rid of this method
        await this.orb.create(this, "Server")
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
    }
    
    async create() { // FIXME: when we create the object id on the client, we could get rid of this method
        await this.orb.create(this, "Client")
    }

    question(): void {
        this.orb.call(this.id, "question", [])
    }
}

abstract class Client_skel extends Skeleton
{
    constructor(orb: ORB) {
        super(orb)
    }
    
    abstract question(): void
}

class Client_impl extends Client_skel
{
    constructor(orb: ORB) {
        super(orb)
    }
    
    question(): void {
        console.log("Client_impl.question()")
    }
}


if (process.argv.length!==3) {
    console.log("please provide one argument: --server | --client")
    process.exit(1)
}

async function server() {
    let orb = new ORB()
    orb.register("Server", Server_impl)
    await orb.listen("0.0.0.0", 8000)
    console.log("orb is listening")
}

async function client() {
    let orb = new ORB()
    orb.register("Client", Client_impl)
    await orb.connect("127.0.0.1", 8000)
    console.log("orb is connected")

    let server = new Server(orb)
    await server.create()

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
