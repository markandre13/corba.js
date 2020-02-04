import * as chai from "chai"
import * as chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised)
const expect = chai.expect

import { ORB } from "../src/orb/orb-nodejs"
import * as _interface from "./idl_module"
import * as value from "./idl_module_value"
import * as valueimpl from "./idl_module_valueimpl"
import * as valuetype from "./idl_module_valuetype"
import * as skel from "./idl_module_skel"
import * as stub from "./idl_module_stub"
import { mockConnection } from "./util"

// o In TypeScript, just as in ECMAScript 2015, any file containing a top-level import or export is considered a module.
// o Conversely, a file without any top-level import or export declarations is treated as a script whose contents are available in the global scope (and therefore to modules as well).

// RED FLAGS:
// o A file whose only top-level declaration is export namespace Foo { ... } (remove Foo and move everything ‘up’ a level)
// o Multiple files that have the same export namespace Foo { at top-level (these won't merge into one)

let text = ""

// interface X1
class X1_impl extends skel.X1 {
    constructor(orb: ORB) {
        super(orb)
    }   
    // oneway void f();
    async f() {
        text = "X1"
    }
}

// native N1
class N1 {
}

// valutetype V1
class V1 extends valueimpl.V1 {
    constructor(value?: Partial<V1>) {
        super(value)
    }
    // N1 f(in N1 a);
    f(a: N1): N1 {
        throw Error("")
    }
}

namespace M1 {

    class N2 {}

    export class V2 extends valueimpl.M1.V2 {
        constructor(value?: Partial<V2>) {
            super(value)
        }
        f(a: N1): N1 {
            return a
        }
        h(a: N2): N2 {
            throw Error("not implemented")
        }
    }

    export namespace M2 {
        export class V3 extends valueimpl.M1.M2.V3 {
            constructor(value?: Partial<V3>) {
                super(value)
            }
            f(a: N1): N1 {
                throw Error("not implemented")
            }
            h(a: M1.V2): M1.V2 {
                throw Error("not implemented")
            }
        }

        export class M1M2X2_impl extends skel.M1.M2.M1M2X2 {
            constructor(orb: ORB) {
                super(orb)
            }
            async m(x1: _interface.X1): Promise<void> {
                text = "M1M2X2::m()"
                // await x1.f()
            }
            async f(a: V1): Promise<V1> {
                text = "M1M2X2"
                a.a = a.a + 19
                return a
            }
            async h(a: M1.V2): Promise<M1.V2> {
                throw Error()
            }
        }
    }

    export class M1X3_impl extends skel.M1.M1X3 {
        constructor(orb: ORB) {
            super(orb)
        }  
        async f(a: V1): Promise<V1> {
            text = "M1X3"
            a.a = a.a + 8
            return a
        }
        async h(a: M2.V3): Promise<M2.V3> {
            throw Error()
        }
        // FIXME: In the Skeleton file it does not prefix the types with _interface
        async i(a: skel.M1.M2.M1M2X2): Promise<skel.M1.M2.M1M2X2> {
            throw Error()
        }
    }

}

describe("corba.js", function() {
    it("module", async function() {

        let serverORB = new ORB()
        serverORB.name = "serverORB"
// serverORB.debug = 1
        let clientORB = new ORB()
        clientORB.name = "clientORB"
// clientORB.debug = 1

        let x1_impl = new X1_impl(serverORB)
        serverORB.bind("X1", x1_impl)
        serverORB.bind("M1X3", new M1.M1X3_impl(serverORB))
        serverORB.bind("M1M2X2", new M1.M2.M1M2X2_impl(serverORB))
        
        clientORB.registerStubClass(stub.X1)
        clientORB.registerStubClass(stub.M1.M1X3)
        clientORB.registerStubClass(stub.M1.M2.M1M2X2)

        // wait, couldn't we get the name from the class? or at least check the name when registering?
        ORB.registerValueType("V1", V1)
        ORB.registerValueType("M1.V2", M1.V2)
        ORB.registerValueType("M1.M2.V3", M1.M2.V3)

        mockConnection(serverORB, clientORB).name = "acceptedORB"

        let x1 = stub.X1.narrow(await clientORB.resolve("X1"))
        let m1x3 = stub.M1.M1X3.narrow(await clientORB.resolve("M1X3"))
        let m1m2x2 = stub.M1.M2.M1M2X2.narrow(await clientORB.resolve("M1M2X2"))

        await x1.f()
        expect(text).is.equal("X1")

        // START OF TEST IF INTERNAL ERRORS ARE PROPAGATED
        await expect(m1m2x2.m(x1)).to.be.rejectedWith(Error, "ORB.call(): not implemented: method 'm' received stub as argument", "missing internal error")

        await expect(m1m2x2.m(x1_impl)).to.be.rejectedWith(Error, "ORB: can not deserialize object of unregistered stub 'X1'")
        serverORB.registerStubClass(stub.X1)
        await expect(m1m2x2.m(x1_impl)).not.to.be.rejected
        // END OF TEST IF INTERNAL ERRORS ARE PROPAGATED

        let r3 = await m1x3.f(new V1({a:9}))
        expect(r3.a).is.equal(17)
        expect(text).is.equal("M1X3")

        let r2 = await m1m2x2.f(new V1({a:9}))
        expect(r2.a).is.equal(28)
        expect(text).is.equal("M1M2X2")

        let v1_orig = new V1({a: 3.1415})
        let v1_json = clientORB.serialize(v1_orig)
        let v1_copy = clientORB.deserialize(v1_json)
        expect(v1_orig).to.deep.equal(v1_copy)
        expect(v1_json).to.equal('{"#T":"V1","#V":{"a":3.1415}}')

        let v2_orig = new M1.V2({a: 2.7182})
        let v2_json = clientORB.serialize(v2_orig)
        let v2_copy = clientORB.deserialize(v2_json)
        expect(v2_orig).to.deep.equal(v2_copy)
        expect(v2_json).to.equal('{"#T":"M1.V2","#V":{"a":2.7182}}')
        
        let v3_orig = new M1.M2.V3({a: 1.4142})
        let v3_json = clientORB.serialize(v3_orig)
        let v3_copy = clientORB.deserialize(v3_json)
        expect(v3_orig).to.deep.equal(v3_copy)
        expect(v3_json).to.equal('{"#T":"M1.M2.V3","#V":{"a":1.4142}}')

//         let server = stub.Server.narrow(await clientORB.resolve("Server"))
//         await server.setClient(new Client_impl(clientORB))

//         // method call
//         expect(Server_impl.methodAWasCalled).to.equal(false)
//         await server.methodA()
//         expect(Server_impl.methodAWasCalled).to.equal(true)

//         // method call which calls us back
//         expect(Server_impl.methodBWasCalled).to.equal(false)
//         expect(Client_impl.methodCWasCalled).to.equal(false)
//         await server.methodB()

//         expect(Server_impl.methodBWasCalled).to.equal(true)
//         expect(Client_impl.methodCWasCalled).to.equal(true)

//         // client calls answer() on server
//         let answer = await server.answer(6, 7)
//         expect(answer).to.equal(42)

//         // server sends FigureModel to client
//         expect(Client_impl.figureModelReceivedFromServer).to.equal(undefined)

//         let model = new FigureModel()
//         model.data.push(new Rectangle(10, 20, 30, 40))
//         model.data.push(new Rectangle(50, 60, 70, 80))
//         await Server_impl.instance!.client!.setFigureModel(model)

//         expect(Client_impl.figureModelReceivedFromServer!.data[0]).to.be.an.instanceof(Rectangle)
//         expect(Client_impl.figureModelReceivedFromServer!.data[0].toString()).to.equal("Rectangle: (10,20,30,40)")
//         let rectangle = Client_impl.figureModelReceivedFromServer!.data[0] as Rectangle
//         expect(rectangle.origin).to.be.an.instanceof(Origin)
//         expect(rectangle.origin.toString()).to.equal("Origin: x=10, y=20")
//         expect(rectangle.size).to.be.an.instanceof(Size)
//         expect(rectangle.size.toString()).to.equal("Size: width=30, height=40")
    })
})
