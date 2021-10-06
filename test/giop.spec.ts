import * as fs from "fs"
import { ORB, IOR } from "corba.js"
import { connect } from "corba.js/net/socket"
import * as stub from "./generated/giop_stub"
import * as value from "./generated/giop_value"
import { expect } from "chai"

const fake = false

// FIXME: this test does not work when MICO runs in debug mode; something is racy

// WHAT'S NEXT:
// things to test with a real CORBA instance are basically for the validation of the GIOP
// send/receive arguments passed to method and result returned from method
// send/receive struct (as argument and return value. how do they differ from valuetypes in regard to GIOP?)
// send/receive sequence (as argument and return value)
// send/receive object reference (as argument and return value)
// send/receive value types with duplicated repositoryId as well as duplicated objects (aka multiple references to the same object)
// module, versioning
// cover all of the above with a recorded fake, server and client side
// to keep the IDL for this test small, we'll implement server and client on MICO side

describe("CDR/GIOP", () => {

    let ior!: IOR
    let orb!: ORB
    let server!: stub.GIOPTest

    before(async function () {
        if (!fake) {
            const data = fs.readFileSync("IOR.txt").toString().trim()
            ior = new IOR(data)
        }
        orb = new ORB()
        ORB.registerValueType("Point", Point) // switch this to orb and use the full repository id so that we can use versioning later
        orb.registerStubClass(stub.GIOPTest)
        
        const data = fs.readFileSync("IOR.txt").toString().trim()

        // this is how this would originally look like:
        //   const obj = orb.stringToObject(data)
        //   const server = Server::narrow(obj)
        // but since corba.js is not a full CORBA implementation, we'll do it like this:
        await connect(orb, ior.host!, ior.port!)
        const obj = orb.iorToObject(ior)
        server = stub.GIOPTest.narrow(obj)
    })

    it("oneway method", async function () {
        server.onewayMethod()
        // await sleep(100)
        expect(await server.peek()).to.equal("onewayMethod")
        // await sleep(100)
    })

    // [ ] keep the mico file locally but build and run them remotely
    // [ ] add a watch mode to the idl compiler to ease testing

    // one test for each argument type (short, ushort, ... string, sequence, valuetype)
    // we send two values to verify the padding
    describe("send values", function () {

        it("bool", async function () {
            await server.sendBool(false, true)
            expect(await server.peek()).to.equal("sendBool(false,true)")
        })

        it("char", async function () {
            await server.sendChar(-128, 127)
            expect(await server.peek()).to.equal("sendChar(-128,127)")
        })

        it("octet", async function () {
            await server.sendOctet(0, 255)
            expect(await server.peek()).to.equal("sendOctet(0,255)")
        })

        it("short", async function () {
            await server.sendShort(-80, 80)
            expect(await server.peek()).to.equal("sendShort(-80,80)")
        })

        it("unsigned short", async function () {
            await server.sendUShort(0, 256)
            expect(await server.peek()).to.equal("sendUShort(0,256)")
        })

        it("long", async function () {
            await server.sendLong(-80, 80)
            expect(await server.peek()).to.equal("sendLong(-80,80)")
        })

        it("unsigned long", async function () {
            await server.sendULong(0, 256)
            expect(await server.peek()).to.equal("sendULong(0,256)")
        })

        it("long long", async function () {
            await server.sendLongLong(-80n, 80n)
            expect(await server.peek()).to.equal("sendLongLong(-80,80)")
        })

        it("unsigned long long", async function () {
            await server.sendULongLong(0n, 256n)
            expect(await server.peek()).to.equal("sendULongLong(0,256)")
        })

        it("float", async function () {
            await server.sendFloat(-80, 80)
            expect(await server.peek()).to.equal("sendFloat(-80,80)")
        })

        it("double", async function () {
            await server.sendDouble(-80, 80)
            expect(await server.peek()).to.equal("sendDouble(-80,80)")
        })

        it("string", async function () {
            await server.sendString("hello", "you")
            expect(await server.peek()).to.equal("sendString(hello,you)")
        })

        it("sequence", async function () {
            await server.sendSequence(["hello", "you"], [1138, 1984, 2001])
            expect(await server.peek()).to.equal("sendSequence([hello,you,],[1138,1984,2001,])")
        })

        it("value", async function () {
            await server.sendValuePoint(new Point({x: 20, y: 30}))
            expect(await server.peek()).to.equal("sendValuePoint(Point(20,30))")
        })

        it("value (duplicate repository ID)", async function () {
            await server.sendValuePoints(new Point({x: 20, y: 30}), new Point({x: 40, y: 50}))
            expect(await server.peek()).to.equal("sendValuePoints(Point(20,30),Point(40,50))")
        })

        it.only("value (duplicate object)", async function () {
            const p = new Point({x: 20, y: 30})
            await server.sendValuePoints(p,p)
            // expect(await server.peek()).to.equal("sendValuePoints(Point(20,30),Point(20,30)) // same object")
        })

        // array
    })

    // any
    // array

    // one test for the order of arguments

    // one test for each return type (short, ushort, ... string, sequence, valuetype)

    // value type in and out
    // struct in and out
    // union ?

    // duplicate repository id
    // duplicate value type

    // send object reference
    // get object reference
})

class Point implements value.Point
{
    x!: number
    y!: number
    
    constructor(init: Partial<Point>) {
        value.initPoint(this, init)
    }
    toString(): string {
        return "Point: x="+this.x+", y="+this.y
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}
