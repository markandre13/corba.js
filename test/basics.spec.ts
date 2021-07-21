/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2021 Mark-André Hopf <mhopf@mark13.org>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

 import { expect } from "chai"

import { ORB } from "../src/orb/orb-nodejs"
import * as value from "./basics_value"
import * as valuetype from "./basics_valuetype"
import * as skel from "./basics_skel"
import * as stub from "./basics_stub"
import { mockConnection } from "./util"

class Origin implements value.Origin
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

class Size implements value.Size {
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

abstract class Figure implements value.Figure {
    id: number = 0
    abstract toString(): string
}

class FigureModel {
    data: Array<Figure>
    constructor() {
        this.data = new Array<Figure>()
    }
}

class Rectangle extends Figure implements valuetype.Rectangle {
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

class Server_impl extends skel.Server {
    static instance?: Server_impl
    static methodAWasCalled = false
    static methodBWasCalled = false

    client?: stub.Client

    constructor(orb: ORB) {
        super(orb)
//console.log("Server_impl.constructor()")
        Server_impl.instance = this
    }
    
    async setClient(client: stub.Client) {
        this.client = client
    }

    async methodA() {
//console.log("Server_impl.methodA()")
        expect(this.orb.name).to.equal("acceptedORB")
        Server_impl.methodAWasCalled = true
    }
    
    async methodB() {
//console.log("Server_impl.methodB()")
        expect(this.orb.name).to.equal("acceptedORB")
        Server_impl.methodBWasCalled = true
        await this.client!.methodC()
        return 0
    }
    
    async answer(a: number, b: number) {
//console.log("Server_impl.answer()")
        return a*b
    }
}

class Client_impl extends skel.Client {
    static instance?: Client_impl
    static methodCWasCalled = false
    static figureModelReceivedFromServer?: FigureModel

    constructor(orb: ORB) {
        super(orb)
//console.log("Client_impl.constructor()")
        Client_impl.instance = this
    }
    
    async methodC() {
//console.log("Client_impl.methodC()")
        Client_impl.methodCWasCalled = true
        return 0
    }
    
    async setFigureModel(figuremodel: FigureModel) {
//console.log("Client_impl.setFigureModel()")
        Client_impl.figureModelReceivedFromServer = figuremodel
    }
}

describe("corba.js", function() {
    it("a basic test", async function() {

        let serverORB = new ORB()
        serverORB.name = "serverORB"
//serverORB.debug = 1
        let clientORB = new ORB()
        clientORB.name = "clientORB"
//clientORB.debug = 1

        serverORB.bind("Server", new Server_impl(serverORB))
        
        serverORB.registerStubClass(stub.Client)
        clientORB.registerStubClass(stub.Server)
        
        ORB.registerValueType("Origin", Origin)
        ORB.registerValueType("Size", Size)
        ORB.registerValueType("Figure", Figure)
        ORB.registerValueType("Rectangle", Rectangle)
        ORB.registerValueType("FigureModel", FigureModel)

        mockConnection(serverORB, clientORB).name = "acceptedORB"

        let server = stub.Server.narrow(await clientORB.resolve("Server"))
        await server.setClient(new Client_impl(clientORB))

        // method call
        expect(Server_impl.methodAWasCalled).to.equal(false)
        await server.methodA()
        expect(Server_impl.methodAWasCalled).to.equal(true)

        // method call which calls us back
        expect(Server_impl.methodBWasCalled).to.equal(false)
        expect(Client_impl.methodCWasCalled).to.equal(false)
        await server.methodB()

        expect(Server_impl.methodBWasCalled).to.equal(true)
        expect(Client_impl.methodCWasCalled).to.equal(true)

        // client calls answer() on server
        let answer = await server.answer(6, 7)
        expect(answer).to.equal(42)

        // server sends FigureModel to client
        expect(Client_impl.figureModelReceivedFromServer).to.equal(undefined)

        let model = new FigureModel()
        model.data.push(new Rectangle(10, 20, 30, 40))
        model.data.push(new Rectangle(50, 60, 70, 80))
        await Server_impl.instance!.client!.setFigureModel(model)

        expect(Client_impl.figureModelReceivedFromServer!.data[0]).to.be.an.instanceof(Rectangle)
        expect(Client_impl.figureModelReceivedFromServer!.data[0].toString()).to.equal("Rectangle: (10,20,30,40)")
        let rectangle = Client_impl.figureModelReceivedFromServer!.data[0] as Rectangle
        expect(rectangle.origin).to.be.an.instanceof(Origin)
        expect(rectangle.origin.toString()).to.equal("Origin: x=10, y=20")
        expect(rectangle.size).to.be.an.instanceof(Size)
        expect(rectangle.size.toString()).to.equal("Size: width=30, height=40")
    })
})
