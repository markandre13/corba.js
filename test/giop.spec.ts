import * as fs from "fs"

import { ORB, IOR } from "corba.js"
import { connect } from "corba.js/net/socket"
import * as stub from "./generated/giop_stub"
import * as value from "./generated/giop_value"
import { expect } from "chai"

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
    let fake!: Fake

    before(async function () {
        orb = new ORB()
        ORB.registerValueType("Point", Point) // switch this to orb and use the full repository id so that we can use versioning later
        orb.registerStubClass(stub.GIOPTest)
        
        const data = fs.readFileSync("IOR.txt").toString().trim()

        // this is how this would originally look like:
        //   const obj = orb.stringToObject(data)
        //   const server = Server::narrow(obj)
        // but since corba.js is not a full CORBA implementation, we'll do it like this:
        ior = new IOR(data)
        await connect(orb, ior.host!, ior.port!)

        fake = new Fake(orb)
        // fake.enableRecordMode()
        
        const obj = orb.iorToObject(ior)
        server = stub.GIOPTest.narrow(obj)
    })

    it("oneway method", async function () {
        server.onewayMethod()
        // await sleep(100)
        expect(await server.peek()).to.equal("onewayMethod")
        // await sleep(100)
    })

    // [X] keep the mico file locally but build and run them remotely
    // [ ] implement a versatile network fake for corba.js
    //   [ ] use a variant of connect which records and prints a hexdump, then use the dump to set an expectation
    //   [ ] use the dump to test the server side
    //   [ ] wrap it all into one nice package
    // [ ] implement the server side (this also means the client side in C++)
    // [ ] implement any (just for fun, for this we also need the client side in C++ to see how it's done)
    // [ ] implement array
    // [ ] implement exceptions
    // [ ] find out where the race condition comes from in the tests, because of the await there shouldn't be one
    // [ ] add a watch mode to the idl compiler to ease testing

    // one test for each argument type (short, ushort, ... string, sequence, valuetype)
    // we send two values to verify the padding
    describe("send values", function () {

        it.only("bool", async function () {
            
            // when the fake is in
            //   record mode, this will store the data send
            //   expect mode, this will compare the recorded data to the one being send
            fake.expect(this.test!.fullTitle())
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

        it("value (duplicate object)", async function () {
            const p = new Point({x: 20, y: 30})
            await server.sendValuePoints(p,p)
            expect(await server.peek()).to.equal("sendValuePoints(Point(20,30),Point(20,30)) // same object")
        })

        // array

        // any
    })

    // one test for each return type (short, ushort, ... string, sequence, valuetype)

    // value type in and out
    // struct in and out
    // union ?

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

// https://martinfowler.com/bliki/SelfInitializingFake.html
class Fake {
    testName?: string
    recordMode = false
    fd!: number
    buffer!: string[]
    active = false

    constructor(orb: ORB) {
        this.insert(orb)
    }

    enableRecordMode() {
        this.recordMode = true
    }

    async expect(name: string) {
        this.active = true
        this.testName = `test/giop/${name.replace(/\W/g, "-")}.dump`
        if (this.recordMode) {
            this.fd = fs.openSync(this.testName, "w+")
        } else {
            this.buffer = fs.readFileSync(this.testName!).toString("ascii").split(/\r?\n/);
        }
        console.log(`EXPECT ${name} (${this.testName})`)
    }

    protected insert(orb: ORB) {
        const send = orb.socketSend
        orb.socketSend = (buffer: ArrayBuffer) => {
            const view = new Uint8Array(buffer)
            if (this.active) {
                this.active = false
                if (this.recordMode) {
                    // record as hexdump, prefix by IN/OUT to indicate the direction
                    // we'll need a unit test for the fake
                    // fs.writeFileSync(this.testName!, view)
                    fs.writeSync(this.fd, "OUT\n")
                    fs.writeSync(this.fd, this.toHexdump(view))
                } else {
                    let line = this.buffer.shift()
                    if (line !== "OUT") {
                        throw Error(`Expected OUT but got '${line}'`)
                    }
                    const x: number[] = []
                    while(true) {
                        line = this.buffer.shift()
                        if (line === undefined)
                            break
                        if (line.length < 4) {
                            this.buffer.unshift(line)
                            break
                        }
                        for(let i=0; i<16; ++i) {
                            const offset = 5 + i * 3
                            const byte = parseInt(line.substring(offset, offset+2), 16)
                            if (Number.isNaN(byte))
                                break
                            x.push(byte)
                        }
                    }
                    const data = Buffer.from(x)
                    if (data.compare(view) !== 0) {
                        console.log(`DIFFERENT`)
                    } else {
                        console.log(`SAME`)
                    }
                }
            }
            send(buffer)
        }
    }

    toHexdump(bytes: Uint8Array, addr = 0, length = bytes.byteLength) {
        let result = ""
        while (addr < length) {
            let line = addr.toString(16).padStart(4, "0")
            for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j)
                line += " " + bytes[j].toString(16).padStart(2, "0")
            line = line.padEnd(4 + 16 * 3 + 1, " ")
            for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j) {
                const b = bytes[j]
                if (b >= 32 && b  < 127)
                    line += String.fromCharCode(b)
                else
                    line += "."
            }
            addr += 16
            result += line + "\n"
        }
        return result
    }
    
}