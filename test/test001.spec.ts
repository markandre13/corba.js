import { expect } from "chai"

import { ORB } from "glue.js"
import { Server_skel, Client_skel } from "./test001_skel"
import { Server, Client } from "./test001_stub"

describe("glue.js", function() {
    it("test001", function() {

        console.log("test is running")
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
    
    async answer(a: number, b: number): Promise<number> {
        console.log("Server_impl.answer()")
        return a*b
    }
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

/*
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
*/
    })
})
