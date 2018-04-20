import { expect } from "chai"

import { ORB } from "glue.js"
import { Server_skel, Client_skel } from "./basics_skel"
import { Server, Client } from "./basics_stub"

class Origin
{
    x: number
    y: number
    
    constructor(x?: number, y?: number) {
        this.x = x ? x : 0
        this.y = y ? y : 0
    }
    toString(): string {
        return "Origin: x="+this.x+", y="+this.y
    }
}

class Size {
    width: number
    height: number
    constructor(width?: number, height?: number) {
        this.width = width ? width : 0
        this.height = height ? height : 0
    }
    toString(): string {
        return "Size: width="+this.width+", height="+this.height
    }
}

abstract class Figure {
    abstract toString(): string
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
    toString(): string {
        return "Rectangle: ("+this.origin.x+","+this.origin.y+","+this.size.width+","+this.size.height+")"
    }
}

class Server_impl extends Server_skel {
    static instance?: Server_impl
    static helloWasCalled = false

    client: Client

    constructor(orb: ORB) {
        super(orb)
        this.client = new Client(orb)
        Server_impl.instance = this
    }

    hello(): void {
        Server_impl.helloWasCalled = true
        this.client.question()
    }
    
    answer(a: number, b: number): number {
        return a*b
    }
}

class Client_impl extends Client_skel {
    static instance?: Client_impl
    static questionWasCalled = false
    static figureModelReceivedFromServer?: FigureModel

    constructor(orb: ORB) {
        super(orb)
        Client_impl.instance = this
    }
    
    question(): void {
        Client_impl.questionWasCalled = true
    }
    
    setFigureModel(figuremodel: FigureModel): void {
        Client_impl.figureModelReceivedFromServer = figuremodel
    }
}

describe("glue.js", function() {
    it("a basic test", async function() {

        let serverORB = new ORB()
        //serverORB.debug = 1
        let clientORB = new ORB()
        //clientORB.debug = 1

        serverORB.register("Server", Server_impl)
        clientORB.register("Client", Client_impl)
        for(let orb of [ serverORB, clientORB ]) {
            orb.registerValueType("Origin", Origin)
            orb.registerValueType("Size", Size)
            orb.registerValueType("Figure", Figure)
            orb.registerValueType("Rectangle", Rectangle)
            orb.registerValueType("FigureModel", FigureModel)
        }

        // mock network connection between server and client ORB
        serverORB.accept({
            send: function(data: any) {
                clientORB.socket!.onmessage({data:data} as any)
            }
        } as any)

        clientORB.socket = {
            send: function(data: any) {
                serverORB.socket!.onmessage({data:data} as any)
            }
        } as any

        // client creates server stub which lets server create it's client stub
        expect(Server_impl.instance).to.be.undefined
        let server = new Server(clientORB)
        expect(Server_impl.instance).to.not.be.undefined
        expect(Server_impl.instance!.client).to.not.be.undefined

        // client calls hello() on server, which calls question() on client
        expect(Server_impl.helloWasCalled).to.equal(false)
        expect(Client_impl.questionWasCalled).to.equal(false)
        server.hello()
        expect(Server_impl.helloWasCalled).to.equal(true)
        expect(Client_impl.questionWasCalled).to.equal(true)

        // client calls answer() on server
        let answer = await server.answer(6, 7)
        expect(answer).to.equal(42)

        // server sends FigureModel to client
        expect(Client_impl.figureModelReceivedFromServer).to.equal(undefined)

        let model = new FigureModel()
        model.data.push(new Rectangle(10, 20, 30, 40))
        model.data.push(new Rectangle(50, 60, 70, 80))
        Server_impl.instance!.client.setFigureModel(model)

        expect(Client_impl.figureModelReceivedFromServer!.data[0].toString()).to.equal("Rectangle: (10,20,30,40)")
        let rectangle = Client_impl.figureModelReceivedFromServer!.data[0] as Rectangle
        expect(rectangle.origin.toString()).to.equal("Origin: x=10, y=20")
        expect(rectangle.size.toString()).to.equal("Size: width=30, height=40")
    })
})
