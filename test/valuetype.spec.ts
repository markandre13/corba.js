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

import { ORB } from "corba.js"
import * as value from "./generated/valuetype_value"
import * as skel from "./generated/valuetype_skel"
import * as stub from "./generated/valuetype_stub"
import { mockConnection } from "./util"

describe("corba.js", function() {

    before(function(){
        // value._init(orb)
        // this collides with basics.spec.ts
        ORB.registerValueType("VTPoint", VTPoint)
        ORB.registerValueType("testVT.Size", Size)
        ORB.registerValueType("testVT.VTMatrix", VTMatrix)
        ORB.registerValueType("testVT.Figure", Figure)
        ORB.registerValueType("testVT.Rectangle", Rectangle)
        ORB.registerValueType("testVT.FigureModel", FigureModel)
    })

    it("exchange valuetype between orbs", async function() {

        // ORB.valueTypeByName.clear()
        // ORB.valueTypeByPrototype.clear()

        const serverORB = new ORB()
        serverORB.name = "serverORB"
        serverORB.debug = 1
        const clientORB = new ORB()
        clientORB.name = "clientORB"
        clientORB.debug = 1

        serverORB.bind("Server", new Server_impl(serverORB))
        
        serverORB.registerStubClass(stub.testVT.Client)
        clientORB.registerStubClass(stub.testVT.Server)
        
        mockConnection(serverORB, clientORB)

        const server = stub.testVT.Server.narrow(await clientORB.stringToObject("corbaname::mock:0#Server"))
        await server.setClient(new Client_impl(clientORB))

        // server will FigureModel to client
        expect(Client_impl.figureModelReceivedFromServer).to.equal(undefined)

        // figure with matrix === undefined
        const model = new FigureModel()
        const rect0 = new Rectangle({origin: {x: 10, y: 20}, size: {width:30, height:40}})
        expect(rect0.matrix).to.be.undefined
        rect0.id = 777
        model.data.push(rect0)

        // figure with matrix !== undefined
        const rect1 = new Rectangle({origin: {x: 50, y: 60}, size: {width:70, height:80}})
        rect1.id = 1911
        rect1.matrix = new VTMatrix({a:0, b:1, c:2, d:3, e:4, f:5})
        model.data.push(rect1)

        // send figure model through the network
        await Server_impl.instance!.client!.setFigureModel(model)
       
        // check that the figure model was received correctly
        expect(Client_impl.figureModelReceivedFromServer!.data.length).to.equal(2)
        expect(Client_impl.figureModelReceivedFromServer!.data[0]).to.be.an.instanceof(Rectangle)
        const rectangle0 = Client_impl.figureModelReceivedFromServer!.data[0] as Rectangle
        expect(rectangle0.toString()).to.equal("Rectangle: (10,20,30,40)")
        expect(rectangle0.id).to.equal(777)
        expect(rectangle0.matrix).to.be.undefined
        expect(rectangle0.origin).to.be.an.instanceof(VTPoint)
        expect(rectangle0.origin.toString()).to.equal("VTPoint: x=10, y=20")
        expect(rectangle0.size).to.be.an.instanceof(Size)
        expect(rectangle0.size.toString()).to.equal("Size: width=30, height=40")

        expect(Client_impl.figureModelReceivedFromServer!.data[1]).to.be.an.instanceof(Rectangle)
        const rectangle1 = Client_impl.figureModelReceivedFromServer!.data[1] as Rectangle
        expect(rectangle1.toString()).to.equal("Rectangle: (50,60,70,80)")
        expect(rectangle1.id).to.equal(1911)
        expect(rectangle1.matrix).to.deep.equal(new VTMatrix({a:0, b:1, c:2, d:3, e:4, f:5}))
        expect(rectangle1.origin).to.be.an.instanceof(VTPoint)
        expect(rectangle1.origin.toString()).to.equal("VTPoint: x=50, y=60")
        expect(rectangle1.size).to.be.an.instanceof(Size)
        expect(rectangle1.size.toString()).to.equal("Size: width=70, height=80")

        // // one can call serialize/deserialize directly
        // let str = '{"#T":"testVT.Rectangle","#V":{"id":1138,"origin":{"#T":"VTPoint","#V":{"x":10,"y":20}},"size":{"#T":"testVT.Size","#V":{"width":30,"height":40}}}}'
        
        // let r0 = clientORB.deserialize(str)
        // let r1 = new Rectangle({origin: {x: 10, y: 20}, size: {width:30, height:40}})
        // r1.id = 1138
        // expect(r0).to.deep.equal(r1)

        // let r2 = clientORB.serialize(r1)
        // expect(r2).to.equal(str)

        // another try with matrix?
    })

    describe("initialization", ()=>{
        it("create point", ()=>{
            const point = new (ORB.lookupValueType("VTPoint"))({x: 10, y: 20})
            expect(point).to.be.an.instanceof(VTPoint)
            expect(point.x).to.equal(10)
            expect(point.y).to.equal(20)
        })
        it("create size", ()=>{
            const size = new (ORB.lookupValueType("testVT.Size"))()
            expect(size).to.be.an.instanceof(Size)
        })
        it("when no initializer is given _ptr valuetype members are left undefined", ()=>{
            const f = new Rectangle()
            expect(f.origin).to.be.an.instanceof(VTPoint)
            expect(f.size).to.be.an.instanceof(Size)
            expect(f.matrix).to.be.undefined

            // let orb = new ORB()
            // orb.serialize(f)
        })
        it("when not part of the initializer _ptr valuetype members are left undefined", ()=>{
            const f = new Rectangle({})
            expect(f.origin).to.be.an.instanceof(VTPoint)
            expect(f.size).to.be.an.instanceof(Size)
            expect(f.matrix).to.be.undefined

            // let orb = new ORB()
            // orb.serialize(f)
        })
        it("when part of initializer...", ()=>{
            const f = new Rectangle({origin: {x: 10, y: 20}, size: {width:30, height:40}})
            expect(f.origin).to.be.an.instanceof(VTPoint)
            expect(f.origin.x).to.equal(10)
            expect(f.origin.y).to.equal(20)
            expect(f.size).to.be.an.instanceof(Size)
            expect(f.size.width).to.equal(30)
            expect(f.size.height).to.equal(40)
            expect(f.matrix).to.be.undefined

            // let orb = new ORB()
            // orb.serialize(f)
        })
    })

    describe("usability", function() {
        it("throw an exception when only a super class is registered", function() {
            const orb = new ORB()
            const path = new Path({d: "M 0 0"})

            let error: any = undefined
            try {
                orb.serialize(path)
            }
            catch (caughtError) {
                error = caughtError
            }
            expect(error).to.be.an.instanceof(Error)
            expect(error.message).to.equal("ORB: No value type registered for class Path. Best match was class Figure.")
        })
    })
})

class VTPoint implements value.VTPoint
{
    x!: number
    y!: number
    
    constructor(init: Partial<VTPoint>) {
        value.initVTPoint(this, init)
    }
    toString(): string {
        return `VTPoint: x=${this.x}, y=${this.y}`
    }
}

class Size implements value.testVT.Size {
    width!: number
    height!: number
    constructor(init: Partial<Size>) {
        value.testVT.initSize(this, init)
    }
    toString(): string {
        return `Size: width=${this.width}, height=${this.height}`
    }
}

class VTMatrix implements value.testVT.VTMatrix {
    a!: number
    b!: number
    c!: number
    d!: number
    e!: number
    f!: number
    constructor(matrix?: Partial<VTMatrix>) {
        value.testVT.initVTMatrix(this, matrix)
        if (matrix === undefined) {
            this.a = 1.0
            this.d = 1.0
        }
    }
    identity() {
    }
}

abstract class Figure implements value.testVT.Figure {
    id: number = 0
    matrix: VTMatrix | undefined
    
    constructor(init?: Partial<Figure>) {
        value.testVT.initFigure(this, init)
    }

    abstract toString(): string
}

class FigureModel implements value.testVT.FigureModel {
    data!: Array<Figure>
    constructor(init?: Partial<FigureModel>) {
        value.testVT.initFigureModel(this, init)
    }
}

class Rectangle extends Figure implements value.testVT.Rectangle {
    origin!: VTPoint
    size!: Size
    constructor(init?: Partial<Rectangle>) {
        super(init)
        value.testVT.initRectangle(this, init)
    }
    getHandlePosition(i: number): VTPoint | undefined {
        return undefined
    }
    toString(): string {
        return `Rectangle: (${this.origin.x},${this.origin.y},${this.size.width},${this.size.height})`
    }
}

class Path extends Figure implements value.testVT.Path {
    d!: string
    constructor(init?: Partial<Path>) {
        super(init)
        value.testVT.initPath(this, init)
    }
    getHandlePosition(i: number): VTPoint | undefined {
        return undefined
    }
    toString(): string {
        return `Path: (d=${this.d})`
    }
}

class Server_impl extends skel.testVT.Server {
    static instance?: Server_impl
    static methodAWasCalled = false
    static methodBWasCalled = false

    client?: stub.testVT.Client

    constructor(orb: ORB) {
        super(orb)
//console.log("Server_impl.constructor()")
        Server_impl.instance = this
    }
    
    async setClient(client: stub.testVT.Client) {
        this.client = client
    }
}

class Client_impl extends skel.testVT.Client {
    static instance?: Client_impl
    static methodCWasCalled = false
    static figureModelReceivedFromServer?: FigureModel

    constructor(orb: ORB) {
        super(orb)
//console.log("Client_impl.constructor()")
        Client_impl.instance = this
    }
    
    async setFigureModel(figuremodel: FigureModel) {
//console.log("Client_impl.setFigureModel()")
        Client_impl.figureModelReceivedFromServer = figuremodel
    }
}