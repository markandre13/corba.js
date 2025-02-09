/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2021, 2024 Mark-André Hopf <mhopf@mark13.org>
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

import { ORB, GIOPDecoder, MessageType } from "corba.js"
import * as _interface from "./generated/basics"
import * as value from "./generated/basics_value"
import * as skel from "./generated/basics_skel"
import * as stub from "./generated/basics_stub"
import { mockConnection, parseHexDump } from "./util"

describe("corba.js", function () {
    it("corba.cc generated 'NameService'.resolve_str('BackEnd')", function () {
        const data = parseHexDump(
            `0000 47 49 4f 50 01 02 01 00 48 00 00 00 00 00 00 00 GIOP....H.......
            0010 03 00 00 00 00 00 00 00 0b 00 00 00 4e 61 6d 65 ............Name
            0020 53 65 72 76 69 63 65 00 0c 00 00 00 72 65 73 6f Service.....reso
            0030 6c 76 65 5f 73 74 72 00 00 00 00 00 00 00 00 00 lve_str.........
            0040 08 00 00 00 42 61 63 6b 65 6e 64 00             ....Backend.`
        )
        const decoder = new GIOPDecoder(data.buffer)
        const type = decoder.scanGIOPHeader()
        expect(type).to.equal(MessageType.REQUEST)
        const request = decoder.scanRequestHeader()
        expect(request.objectKey).eqls(new TextEncoder().encode("NameService"))
        expect(request.method).to.equal("resolve_str")
        // console.log(`offset = 0x${decoder.offset.toString(16)}`)
        const arg0 = decoder.string()
        expect(arg0).to.equal("Backend")
    })

    it("good generated 'NameService'.resolve_str('BackEnd')", function () {
        const data = parseHexDump(
            `0000 47 49 4f 50 01 02 01 00 64 00 00 00 00 00 00 00 GIOP....d.......
            0010 03 00 00 00 00 00 00 00 0b 00 00 00 4e 61 6d 65 ............Name
            0020 53 65 72 76 69 63 65 00 0c 00 00 00 72 65 73 6f Service.....reso
            0030 6c 76 65 5f 73 74 72 00 01 00 00 00 05 00 00 00 lve_str.........
            0040 1c 00 00 00 01 00 00 00 01 00 00 00 0d 00 00 00 ................
            0050 31 39 32 2e 31 36 38 2e 31 2e 31 30 00 00 14 c3 192.168.1.10....
            0060 0c 00 00 00 54 65 73 74 53 65 72 76 69 63 65 00 ....TestService.`
        )
        const decoder = new GIOPDecoder(data.buffer)
        const type = decoder.scanGIOPHeader()
        expect(type).to.equal(MessageType.REQUEST)
        const request = decoder.scanRequestHeader()
        expect(request.objectKey).eqls(new TextEncoder().encode("NameService"))
        expect(request.method).to.equal("resolve_str")
        const arg0 = decoder.string()
        expect(arg0).to.equal("TestService")
    })

    it("a basic test", async function() {

        let serverORB = new ORB()
        serverORB.name = "serverORB"
        serverORB.debug = 1
        let clientORB = new ORB()
        clientORB.name = "clientORB"
        clientORB.debug = 1

        const serverImpl = new Server_impl(serverORB)
        serverORB.bind("Server", serverImpl)

        serverORB.registerStubClass(stub.Client)
        clientORB.registerStubClass(stub.Server)

        ORB.registerValueType("Origin", Origin)
        ORB.registerValueType("Size", Size)
        ORB.registerValueType("Figure", Figure)
        ORB.registerValueType("Rectangle", Rectangle)
        ORB.registerValueType("FigureModel", FigureModel)

        mockConnection(serverORB, clientORB)

        console.log(`# CLIENT: RESOLVE SERVER`)
        let serverStub = stub.Server.narrow(await clientORB.stringToObject("corbaname::mock:0#Server"))
        expect(serverStub).instanceOf(stub.Server)
       
        console.log("# CLIENT -> SERVER: GET/SET ATTRIBUTE")
        expect(await serverStub.id()).to.equal("IT'S ME")

        expect(await serverStub.message()).to.equal("hello")
        await serverStub.message("world")
        expect(await serverStub.message()).to.equal("hello world")

        console.log("# CLIENT -> SERVER: SET CLIENT")
        const clientImpl = new Client_impl(clientORB)
        expect(await serverStub.getClients()).to.have.lengthOf(0)
        await serverStub.setClient(clientImpl)
        expect(serverImpl.client).instanceOf(stub.Client)
        expect(await serverStub.getClients()).to.have.lengthOf(1)

        console.log(`# CLIENT -> SERVER: CALL METHOD`)
        expect(serverImpl.methodAWasCalled).to.equal(false)
        await serverStub.methodA()
        expect(serverImpl.methodAWasCalled).to.equal(true)

        console.log(`# CLIENT -> SERVER -> CLIENT: CALL METHOD WHICH CALLS US BACK`)
        expect(serverImpl.methodBWasCalled).to.equal(false)
        expect(clientImpl.methodCWasCalled).to.equal(false)
        await serverStub.methodB()
        expect(serverImpl.methodBWasCalled).to.equal(true)
        expect(clientImpl.methodCWasCalled).to.equal(true)

        console.log("# CLIENT -> SERVER: CALL METHOD WITH ARGUMENTS AND RETURN RESULT")
        let answer = await serverImpl.answer(6, 7)
        expect(answer).to.equal(42)

        console.log("# SERVER -> CLIENT: SEND VALUETYPE")
        expect(clientImpl.figureModelReceivedFromServer).to.equal(undefined)

        let model = new FigureModel()
        model.data.push(new Rectangle({origin: {x: 10, y: 20}, size: { width: 30, height: 40}}))
        model.data.push(new Rectangle({origin: {x: 50, y: 60}, size: { width: 70, height: 80}}))

        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
        await serverImpl.client!.setFigureModel(model)
        console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<")

        expect(clientImpl.figureModelReceivedFromServer).not.undefined
        expect(clientImpl.figureModelReceivedFromServer!.data).length(2)
        expect(clientImpl.figureModelReceivedFromServer!.data[0]).to.be.an.instanceof(Rectangle)
        expect(clientImpl.figureModelReceivedFromServer!.data[0].toString()).to.equal("Rectangle(10,20,30,40)")
        let rectangle = clientImpl.figureModelReceivedFromServer!.data[0] as Rectangle
        expect(rectangle.origin).to.be.an.instanceof(Origin)
        expect(rectangle.origin.toString()).to.equal("Origin({x:10,y:20})")
        expect(rectangle.size).to.be.an.instanceof(Size)
        expect(rectangle.size.toString()).to.equal("Size({width:30,height:40})")

        expect(await serverStub.twistColor({r: 1, g: 2, b: 3, a: 4})).to.deep.equal({r: 4, g: 3, b: 2, a: 1})

        const attributesIn: _interface.Attribute[] = [
            {type: _interface.AttributeType.STROKE_RGBA, strokeRGBA: {r: 1, g: 2, b: 3, a: 4}},
            {type: _interface.AttributeType.FILL_RGBA, fillRGBA: {r: 5, g: 6, b: 7, a: 8}},
            {type: _interface.AttributeType.STROKE_WIDTH, strokeWidth: 2.71},
        ]
        await serverStub.setAttributes(attributesIn)
        expect(attributesIn).to.deep.equal(serverImpl.attributes)
    })
})

class Origin implements value.Origin {
    x!: number
    y!: number

    constructor(init?: Partial<Origin> | GIOPDecoder) {
        value.initOrigin(this, init)
    }
    toString(): string {
        return `Origin({x:${this.x},y:${this.y}})`
    }
}

class Size implements value.Size {
    width!: number
    height!: number
    constructor(init?: Partial<Size> | GIOPDecoder) {
        value.initSize(this, init)
    }
    toString(): string {
        return `Size({width:${this.width},height:${this.height}})`
    }
}

abstract class Figure implements value.Figure {
    id!: number
    constructor(init?: Partial<Rectangle> | GIOPDecoder) {
        value.initFigure(this, init)
    }
    abstract toString(): string
}

class FigureModel implements value.FigureModel {
    data!: Array<Figure>
    constructor(init?: Partial<FigureModel> | GIOPDecoder) {
        value.initFigureModel(this, init)
    }
}

class Rectangle extends Figure implements value.Rectangle {
    origin!: Origin
    size!: Size
    constructor(init?: Partial<Rectangle> | GIOPDecoder) {
        super(init) // FIXME: i once forgot to pass on the init and the decoder gave useless errors
        value.initRectangle(this, init)
    }
    toString(): string {
        return `Rectangle(${this.origin.x},${this.origin.y},${this.size.width},${this.size.height})`
    }
}

class Server_impl extends skel.Server {
    methodAWasCalled = false
    methodBWasCalled = false
    _message = "hello"

    client?: stub.Client
    attributes?: _interface.Attribute[]

    constructor(orb: ORB) {
        super(orb)
        console.log("Server_impl.constructor()")
    }

    async id(): Promise<string> { return "IT'S ME" }

    async message(value: string): Promise<void>
    async message(): Promise<string>
    async message(value?: string): Promise<void | string> {
        if (value === undefined) {
            return this._message
        } else {
            this._message = `${this._message} ${value}`
        }
    }

    override async setClient(client: stub.Client) {
        this.client = client
    }

    override async getClients(): Promise<Array<_interface.Server>> {
        return this.client === undefined ? [] : [this]
    }

    override async methodA() {
        console.log("Server_impl.methodA()")
        // expect(this.orb.name).to.equal("acceptedORB")
        this.methodAWasCalled = true
    }

    override async methodB() {
        console.log("Server_impl.methodB()")
        // expect(this.orb.name).to.equal("acceptedORB")
        this.methodBWasCalled = true
        await this.client!.methodC()
        return 0
    }

    override async answer(a: number, b: number) {
        console.log("Server_impl.answer()")
        return a * b
    }

    override async twistColor(color: _interface.RGBA) {
        console.log(`Server_impl.setColor(${color.r},${color.g},${color.b},${color.a})`)
        return { r: color.a, g: color.b, b: color.g, a: color.r }
    }

    override async setAttributes(attributes: _interface.Attribute[]) {
        this.attributes = attributes
    }
}

class Client_impl extends skel.Client {
    instance?: Client_impl
    methodCWasCalled = false
    figureModelReceivedFromServer?: FigureModel

    constructor(orb: ORB) {
        super(orb)
        console.log("Client_impl.constructor()")
    }

    override async methodC() {
        console.log("Client_impl.methodC()")
        this.methodCWasCalled = true
        return 0
    }

    override async setFigureModel(figuremodel: FigureModel) {
        console.log("Client_impl.setFigureModel()")
        // console.log(figuremodel)
        this.figureModelReceivedFromServer = figuremodel
    }
}
