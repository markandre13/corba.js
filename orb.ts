import * as ws from "ws"
const WebSocket = ws

function connect(url: string): Promise<WebSocket> {
    return new Promise<WebSocket>(function(resolve, reject) {
        var server = new WebSocket(url)
        server.onopen = function() {
            console.log("promise: open")
            resolve(server)
        }
        server.onmessage = function(message) {
            console.log("promise: message")
            resolve(message)
        }
        server.onerror = function(err) {
            reject(err)
        }
    })
}

class ORB {
    client?: ws
    id: number
    reqid: number
    
    obj: Map<number, Stub>
    
    constructor() {
        this.id = 0
        this.reqid = 0
        this.obj = new Map<number, Stub>()
    }
    
    async connect(host: string, port: number): Promise<void> {
        this.client = await connect("ws://"+host+":"+port)
        console.log("_connect has returned")
    }
    
    async send(data: any): Promise<any> {
        let reqid = ++this.reqid
        data.reqid = reqid
        console.log("ORB.send(", data, ")")

        return new Promise<any>( (resolve, reject) => {
            if (!this.client)
                throw Error("fuck")
            this.client.onmessage = function(message) {
                let msg = JSON.parse(message.data)
                if (msg.glue !== "1.0")
                    throw Error("expected glue version 1.0 but got "+msg.glue)
                if (reqid == msg.reqid)
                    resolve(msg)
            }
            this.client.onerror = function(err) {
                reject(err)
            }
            this.client.send(JSON.stringify(data))
        })
    }

    async create(stub: Stub, name: string): Promise<void> {
        console.log("ORB.create(<Stub>, '"+name+"') ==> enter")

        let data = {
            "glue": "1.0",
            "new": "Server",
        }

        // let msg = await send(this.client, data)
        let msg = await this.send(data)
        if (msg.created === undefined) {
            throw Error("ORB.create(): message did not contain 'created'")
        }
        stub.id = msg.id
        this.obj.set(msg.id, stub)
        console.log("stored stub for id "+msg.id)
        console.log("ORB.create(<Stub>, '"+name+"') ==> leave")
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

    listen(host: string, port: number): void {
        const wss = new ws.Server({host: host,port: port}, function() {
            console.log("server ready")
        })
        wss.on("error", function(error) {
            switch(error.code) {
                case "EADDRINUSE":
                    console.log("error: another server is already running at "+error.address+":"+error.port)
                    break
                default:
                    console.log("error", error)
            }
        })
        wss.on('connection', function(client) {
            console.log("got client")
            let orb = new ORB()
            orb.accept(client)
        })
    }
    
    accept(client: ws.WebSocket) {
        let orb = this
        client.on('open', function() {
            console.log("open")
        })
        client.on('message', function(message, flags) {
            let msg = JSON.parse(message)
            console.log("server got message", msg)
            for(let x of msg)
                console.log(x)
            
            if (msg.glue !== "1.0") {
                throw Error("expected glue version 1.0 but got "+msg.glue)
            }
            if (msg.new !== undefined) {
                console.log("create new object of type '"+msg.new+"'")
                ++orb.id
                let obj = new Server_impl(orb)
                orb.obj.set(orb.id, obj)
                let answer = {
                    "glue": "1.0",
                    "created": msg.new,
                    "id": orb.id,
                    "reqid": msg.reqid
                }
                console.log("created new object, send reply ", answer)
                client.send(JSON.stringify(answer))
            }
            if (msg.method !== undefined) {
                console.log("server: call '"+msg.method+"' on server for object ", msg.id)
                let stub = orb.obj.get(msg.id)
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
                    client.send(JSON.stringify(answer))
                }
            }
        })
    }
}

class Skeleton
{
    orb: ORB
    id: number

    constructor(orb: ORB) {
        this.orb = orb
        this.id = orb.id
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
    constructor(orb: ORB) {
        super(orb)
    }
    
    hello(): void {
        console.log("Server_impl.hello()")
    }
    
    answer(a: number, b: number): number {
        console.log("Server_impl.answer()")
        return a*b
    }
}

class Stub
{
    orb: ORB
    id: number
    
    constructor(orb: ORB) {
        this.orb = orb
        this.id = 0
    }
}

class Server extends Stub
{
    constructor(orb: ORB) {
        super(orb)
    }

    async create() {
        await this.orb.create(this, "Server")
    }

    hello(): void {
        console.log("Server stub: hello()")
        this.orb.send({
            "glue": "1.0",
            "method": "hello",
            "params": [],
            "id": this.id
        })
    }

    async answer(a: number, b: number): Promise<number> {
        console.log("Server stub: answer()")
        return await this.orb.call(this.id, "answer", [a, b])
    }

}

if (process.argv.length!==3) {
    console.log("please provide one argument: --server | --client")
    process.exit(1)
}

async function client() {
    let orb = new ORB()
    await orb.connect("127.0.0.1", 8000)
    console.log("orb connected")
console.log("----------------- create server -------------------")
    let server = new Server(orb)
    await server.create()
console.log("----------------- invoke hello --------------------")
    server.hello()
console.log("----------------- invoke answer --------------------")
    server.answer(2, 9)
    let n = await server.answer(7, 6)
    console.log("the answer is "+n)
}

if (process.argv[2]==="--server") {
    let orb = new ORB()
    orb.listen("0.0.0.0", 8000)
    new Server_impl(orb)		// register new Server class
} else
if (process.argv[2]==="--client") {
    try {
        client()
    }
    catch(error) {
        console.log("error: "+error.message)
        console.log(error.stack)
    }
} else {
    console.log("please provide one argument: --server | --client")
    process.exit(1)
}
