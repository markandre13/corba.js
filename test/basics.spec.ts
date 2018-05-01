import { expect } from "chai"

import { ORB } from "../src/orb/orb-nodejs"
import { Server_skel, Client_skel } from "./basics_skel"
import { Server, Client } from "./basics_stub"
import { mockConnection } from "./util"

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
//console.log("Server_impl.constructor()")
        this.client = new Client(orb)
        Server_impl.instance = this
    }

    async hello() {
//console.log("Server_impl.hello()")
        Server_impl.helloWasCalled = true
        await this.client.question()
    }
    
    async answer(a: number, b: number) {
//console.log("Server_impl.answer()")
        return a*b
    }
}

class Client_impl extends Client_skel {
    static instance?: Client_impl
    static questionWasCalled = false
    static figureModelReceivedFromServer?: FigureModel

    constructor(orb: ORB) {
        super(orb)
//console.log("Client_impl.constructor()")
        Client_impl.instance = this
    }
    
    async question() {
//console.log("Client_impl.question()")
        Client_impl.questionWasCalled = true
    }
    
    async setFigureModel(figuremodel: FigureModel) {
//console.log("Client_impl.setFigureModel()")
        Client_impl.figureModelReceivedFromServer = figuremodel
    }
}

describe("corba.js", function() {
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

        mockConnection(serverORB, clientORB)

        // client creates server stub which lets server create it's client stub
        expect(Server_impl.instance).to.be.undefined
        let server = new Server(clientORB)

        // client calls hello() on server, which calls question() on client
        expect(Server_impl.helloWasCalled).to.equal(false)
        expect(Client_impl.questionWasCalled).to.equal(false)
        await server.hello()
        expect(Server_impl.helloWasCalled).to.equal(true)

        expect(Server_impl.instance).not.to.be.undefined		// FIXME: delayed
        expect(Server_impl.instance!.client).to.not.be.undefined	// FIXME: delayed

        // client calls answer() on server
        let answer = await server.answer(6, 7)
        expect(Client_impl.questionWasCalled).to.equal(true)		// FIXME_ delayed
        expect(answer).to.equal(42)

        // server sends FigureModel to client
        expect(Client_impl.figureModelReceivedFromServer).to.equal(undefined)

        let model = new FigureModel()
        model.data.push(new Rectangle(10, 20, 30, 40))
        model.data.push(new Rectangle(50, 60, 70, 80))
        await Server_impl.instance!.client.setFigureModel(model)

        expect(Client_impl.figureModelReceivedFromServer!.data[0].toString()).to.equal("Rectangle: (10,20,30,40)")
        let rectangle = Client_impl.figureModelReceivedFromServer!.data[0] as Rectangle
        expect(rectangle.origin.toString()).to.equal("Origin: x=10, y=20")
        expect(rectangle.size.toString()).to.equal("Size: width=30, height=40")
    })
})
