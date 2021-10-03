import * as fs from "fs"
import { ORB, IOR } from "corba.js"
import { connect } from "corba.js/net/socket"
import * as stub from "./generated/giop_stub"

const fake = false

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

    before(async function() {
        if (!fake) {
            const data = fs.readFileSync("IOR.txt").toString().trim()
            ior = new IOR(data)
        }
        orb = new ORB()
        // orb.registerStubClass(stub.Server)
        const data = fs.readFileSync("IOR.txt").toString().trim()

        // this is how this would originally look like:
        //   const obj = orb.stringToObject(data)
        //   const server = Server::narrow(obj)
        // but since corba.js is not a full CORBA implementation, we'll do it like this:
        await connect(orb, ior.host!, ior.port!)
        const obj = orb.iorToObject(ior)
        server = stub.GIOPTest.narrow(obj)
    })

    it.only("call mico", async function() {
        server.onewayMethod()
    })
})
