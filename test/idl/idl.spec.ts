import { expect } from "chai"
import { Node, Type } from "corba.js/idl/idl-node"
import { Lexer } from "corba.js/idl/idl-lexer"
import { specification } from "corba.js/idl/idl-parser"
import { typeIDLtoGIOP } from "corba.js/idl/util"

describe("IDL Parser", () => {
    it("SYN_SPECIFICATION", function () {
        const tree = parse(``)
        expect(tree).to.not.be.undefined
        expect(tree?.type).to.equal(Type.SYN_SPECIFICATION)
        expect(tree?.child).to.be.empty
    })

    it("SYN_INTERFACE", function () {
        const tree = parse(`interface X {};`)
        const anInterface = tree!.child[0]!
        const header = anInterface.child[0]!
        const body = anInterface.child[1]!
        expect(anInterface.type).to.equal(Type.SYN_INTERFACE)
        expect(header.type).to.equal(Type.SYN_INTERFACE_HEADER)
        expect(header.child[1]!.type).to.equal(Type.TKN_IDENTIFIER)
        expect(header.child[1]!.text).to.equal("X")
        expect(body.type).to.equal(Type.SYN_INTERFACE_BODY)
    })

    it("SYN_OPERATION_DECLARATION", function () {
        const tree = parse(`interface X {
            oneway short f(in short a);
        };`)
        const anInterface = tree!.child[0]!
        const body = anInterface.child[1]!
        expect(body.child).to.be.lengthOf(1)

        const operation = body.child[0]!
        expect(operation.type).to.equal(Type.SYN_OPERATION_DECLARATION)
        expect(operation.child[0]?.type).to.equal(Type.TKN_ONEWAY)
        expect(operation.child[1]?.type).to.equal(Type.TKN_SHORT)
        expect(operation.child[2]!.type).to.equal(Type.TKN_IDENTIFIER)
        expect(operation.child[2]!.text).to.equal("f")
        expect(operation.child[3]?.type).to.equal(Type.SYN_PARAMETER_DECLARATIONS)
        expect(operation.child[3]?.child).to.be.lengthOf(1)
        const arg = operation.child[3]?.child[0]!
        expect(arg.type).to.equal(Type.SYN_PARAMETER_DECLARATION)
        expect(arg.child[0]?.type).to.equal(Type.TKN_IN)
        expect(arg.child[1]?.type).to.equal(Type.TKN_SHORT)
        expect(arg.child[2]?.type).to.equal(Type.TKN_IDENTIFIER)
        expect(arg.child[2]?.text).to.equal("a")
    })

    it("TKN_TYPEDEF", function () {
        const tree = parse(`
            typedef short T, U;
            interface X {
                oneway T f(in U a);
            };
        `)
        const td = tree?.child[0]!
        const type = td.child[0]!
        const decls = td.child[1]!
        expect(td.type).to.equal(Type.TKN_TYPEDEF)
        expect(type.type).to.equal(Type.TKN_SHORT)
        expect(decls.type).to.equal(Type.SYN_DECLARATORS)
        expect(decls.child).to.be.lengthOf(2)
        expect(decls.child[0]?.type).to.equal(Type.TKN_IDENTIFIER)
        expect(decls.child[0]?.text).to.equal("T")
        expect(decls.child[1]?.type).to.equal(Type.TKN_IDENTIFIER)
        expect(decls.child[1]?.text).to.equal("U")
    })

    // struct
    // valuetype
    // native
    // native *_ptr

    // typeIDLtoGIOP
    // we could also try to eval the string

    describe("typeIDLtoGIOP()", function () {
        // NOTE: here 'short' represents all other elementary types. if the other elementary
        // types are wrong, we'll catch them in the GIOP encoding/decoding tests
        it("decode short", function () {
            const str = typeIDLtoGIOP(new Node(Type.TKN_SHORT))
            expect(str).to.equal("decoder.short()")
        })

        it("encode short", function () {
            const str = typeIDLtoGIOP(new Node(Type.TKN_SHORT), "a")
            expect(str).to.equal("encoder.short(a)")
        })

        it("decode sequence<short>", function () {
            const n0 = new Node(Type.TKN_SEQUENCE)
            n0.append(new Node(Type.TKN_SHORT))
            const str = typeIDLtoGIOP(n0)
            expect(str).to.equal("decoder.sequence(() => decoder.short())")
        })

        it("encode sequence<short>", function () {
            const n0 = new Node(Type.TKN_SEQUENCE)
            n0.append(new Node(Type.TKN_SHORT))
            const str = typeIDLtoGIOP(n0, "a")
            expect(str).to.equal("encoder.sequence(a, (item) => encoder.short(item))")
        })

        it("encode sequence<sequence<short>>", function () {
            const n0 = new Node(Type.TKN_SEQUENCE)
            const n1 = new Node(Type.TKN_SEQUENCE)
            n0.append(n1)
            n1.append(new Node(Type.TKN_SHORT))
            const str = typeIDLtoGIOP(n0, "a")
            expect(str).to.equal("encoder.sequence(a, (item) => encoder.sequence(item, (item) => encoder.short(item)))")
        })

        it("decode typedef short", function () {
            const n0 = new Node(Type.TKN_IDENTIFIER)
            n0.append(new Node(Type.TKN_SHORT))
            const str = typeIDLtoGIOP(n0)
            expect(str).to.equal("decoder.short()")
        })

        it("encode typedef short", function () {
            const n0 = new Node(Type.TKN_IDENTIFIER)
            n0.append(new Node(Type.TKN_SHORT))
            const str = typeIDLtoGIOP(n0, "a")
            expect(str).to.equal("encoder.short(a)")
        })
    })
})

function parse(data: string) {
    const lexer = new Lexer(data)
    try {
        const syntaxTree = specification(lexer)
        // syntaxTree?.printTree()
        return syntaxTree
    }
    catch (e) {
        if (e instanceof Error) {
            console.log(`${e.message} at line ${lexer.line}, column ${lexer.column}`)
            console.log(e.stack)
        }
        throw e
    }
}
