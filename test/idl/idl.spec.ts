import { expect } from "chai"
import { Type, InterfaceDecl, Operation, TypedefDecl, ValueTypeDecl, StateMember, ScopedName, StructDecl, EnumDecl, ExceptionDecl } from "corba.js/idl/idl-node"
import { Lexer } from "corba.js/idl/idl-lexer"
import { specification } from "corba.js/idl/idl-parser"
import { typeIDLtoGIOPTS } from "corba.js/idl/ts/typeIDLtoGIOPTS"
import { typeIDLtoTS } from "corba.js/idl/ts/typeIDLtoTS"
import { defaultValueIDLtoTS } from "corba.js/idl/util"

describe("IDL Parser", () => {
    it("SYN_SPECIFICATION", function () {
        const tree = parse(``)
        expect(tree).to.not.be.undefined
        expect(tree?.type).to.equal(Type.SYN_SPECIFICATION)
        expect(tree?.definitions).to.be.empty
    })

    it("SYN_INTERFACE", function () {
        const tree = parse(`interface X {};`)
        const anInterface = tree!.definitions[0] as InterfaceDecl
        expect(anInterface.type).to.equal(Type.SYN_INTERFACE)
        expect(anInterface.name).to.equal("X")
        expect(anInterface.modifier).to.be.undefined
        expect(anInterface.base).to.be.undefined
        expect(anInterface.body).to.be.empty
    })

    it("SYN_OPERATION_DECLARATION", function () {
        const tree = parse(`interface X {
            oneway short f(in short a);
        };`)
        const anInterface = tree!.definitions[0] as InterfaceDecl
        expect(anInterface.body).to.be.lengthOf(1)

        const operation = anInterface.body[0] as Operation
        expect(operation.type).to.equal(Type.SYN_OPERATION_DECLARATION)
        expect(operation.oneway).to.be.true
        expect(operation.returnType.type).to.equal(Type.TKN_SHORT)
        expect(operation.name).to.equal("f")
        expect(operation.params).to.be.lengthOf(1)
        expect(operation.raises).to.be.empty
        const arg = operation.params[0]
        expect(arg.type).to.equal(Type.SYN_PARAMETER_DECLARATION)
        expect(arg.attribute).to.equal(Type.TKN_IN)
        expect(arg.typeSpec.type).to.equal(Type.TKN_SHORT)
        expect(arg.name).to.equal("a")
    })

    it("raises with several exceptions", function () {
        const tree = parse(`
            exception E {};
            exception F {};
            interface X {
                void f() raises (E, F);
            };`)
        const operation = (tree!.definitions[2] as InterfaceDecl).body[0] as Operation
        expect(operation.raises.map(name => name.name)).to.deep.equal(["E", "F"])
    })

    it("documentation comments", function () {
        const tree = parse(`
            /** Adds two numbers.
             *  @param a first
             */
            interface X {
                /// the answer
                long f();
                //! bang style
                long g();
            };`)
        const anInterface = tree!.definitions[0] as InterfaceDecl
        expect(anInterface.doc).to.deep.equal(["Adds two numbers.", "@param a first"])
        expect((anInterface.body[0] as Operation).doc).to.deep.equal(["the answer"])
        expect((anInterface.body[1] as Operation).doc).to.deep.equal(["bang style"])
    })

    it("documentation comments of types and parameters", function () {
        const tree = parse(`
            /// A point.
            struct P { long a; };
            /// Colors.
            enum Color { red, green };
            /// Something went wrong.
            exception E {};
            interface X {
                long add(/// the first summand
                    in long a);
            };`)
        expect((tree!.definitions[0] as StructDecl).doc).to.deep.equal(["A point."])
        expect((tree!.definitions[1] as EnumDecl).doc).to.deep.equal(["Colors."])
        expect((tree!.definitions[2] as ExceptionDecl).doc).to.deep.equal(["Something went wrong."])
        const operation = (tree!.definitions[3] as InterfaceDecl).body[0] as Operation
        expect(operation.params[0].doc).to.deep.equal(["the first summand"])
    })

    it("documentation comments of struct members and enumerators", function () {
        const tree = parse(`
            struct P {
                /// horizontal position
                long x;
                long y;
            };
            enum Color {
                /// the first one
                red,
                green
            };`)
        const struct = tree!.definitions[0] as StructDecl
        expect(struct.members[0].doc).to.deep.equal(["horizontal position"])
        expect(struct.members[1].doc).to.be.undefined
        const enumDecl = tree!.definitions[1] as EnumDecl
        expect(enumDecl.enumerators[0].doc).to.deep.equal(["the first one"])
        expect(enumDecl.enumerators[1].doc).to.be.undefined
    })

    it("typedef name inside a module", function () {
        const tree = parse(`
            module M {
                typedef short T;
                interface I {};
            };
            interface X {
                M::T f();
            };`)
        const operation = (tree!.definitions[1] as InterfaceDecl).body[0] as Operation
        expect((operation.returnType as ScopedName).target.type).to.equal(Type.TKN_SHORT)
    })

    it("TKN_TYPEDEF", function () {
        const tree = parse(`
            typedef short T, U;
            interface X {
                oneway T f(in U a);
            };
        `)
        const td = tree?.definitions[0] as TypedefDecl
        expect(td.type).to.equal(Type.TKN_TYPEDEF)
        expect(td.typeSpec.type).to.equal(Type.TKN_SHORT)
        expect(td.names).to.deep.equal(["T", "U"])

        // the names refer to the aliased type, not to the typedef
        const anInterface = tree!.definitions[1] as InterfaceDecl
        const operation = anInterface.body[0] as Operation
        const returnType = operation.returnType as ScopedName
        expect(returnType.type).to.equal(Type.SYN_SCOPED_NAME)
        expect(returnType.name).to.equal("T")
        expect(returnType.target).to.deep.equal({ type: Type.TKN_SHORT })
        expect(operation.params[0].typeSpec).to.include({ type: Type.SYN_SCOPED_NAME, name: "U" })
    })

    it("TKN_VALUETYPE", function () {
        const tree = parse(`
            valuetype Point {
              public double x, y;
              public short s;
            };
            interface X {
                oneway Point f(in Point a);
            };
        `)
        const vt = tree!.definitions[0] as ValueTypeDecl
        const member0 = vt.elements[0] as StateMember
        const member1 = vt.elements[1] as StateMember

        expect(vt.type).to.equal(Type.TKN_VALUETYPE)
        expect(vt.name).to.equal("Point")
        expect(vt.base).to.be.empty

        expect(member0.type).to.equal(Type.SYN_STATE_MEMBER)
        expect(member0.visibility).to.equal(Type.TKN_PUBLIC)
        expect(member0.typeSpec.type).to.equal(Type.TKN_DOUBLE)
        expect(member0.names).to.deep.equal(["x", "y"])

        expect(member1.type).to.equal(Type.SYN_STATE_MEMBER)
        expect(member1.visibility).to.equal(Type.TKN_PUBLIC)
        expect(member1.typeSpec.type).to.equal(Type.TKN_SHORT)
        expect(member1.names).to.deep.equal(["s"])
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
            const str = typeIDLtoGIOPTS({ type: Type.TKN_SHORT })
            expect(str).to.equal("decoder.short()")
        })

        it("encode short", function () {
            const str = typeIDLtoGIOPTS({ type: Type.TKN_SHORT }, "a")
            expect(str).to.equal("encoder.short(a)")
        })

        it("decode qualified interface name", function () {
            const tree = parse(`
                module M {
                    struct S { long a; };
                    interface I {};
                };
                interface X {
                    M::I f();
                };`)
            const operation = (tree!.definitions[1] as InterfaceDecl).body[0] as Operation
            expect(typeIDLtoGIOPTS(operation.returnType)).to.equal("decoder.object()")
        })

        it("decode sequence<short>", function () {
            const n0 = { type: Type.TKN_SEQUENCE, elementType: { type: Type.TKN_SHORT } } as const
            const str = typeIDLtoGIOPTS(n0)
            expect(str).to.equal("decoder.sequence(() => decoder.short())")
        })

        it("encode sequence<short>", function () {
            const n0 = { type: Type.TKN_SEQUENCE, elementType: { type: Type.TKN_SHORT } } as const
            const str = typeIDLtoGIOPTS(n0, "a")
            expect(str).to.equal("encoder.sequence(a, (item) => encoder.short(item))")
        })

        it("encode sequence<sequence<short>>", function () {
            const n1 = { type: Type.TKN_SEQUENCE, elementType: { type: Type.TKN_SHORT } } as const
            const n0 = { type: Type.TKN_SEQUENCE, elementType: n1 } as const
            const str = typeIDLtoGIOPTS(n0, "a")
            expect(str).to.equal("encoder.sequence(a, (item) => encoder.sequence(item, (item) => encoder.short(item)))")
        })

        it("decode typedef short", function () {
            const n0: ScopedName = { type: Type.SYN_SCOPED_NAME, name: "T", path: [], scope: undefined, target: { type: Type.TKN_SHORT } }
            const str = typeIDLtoGIOPTS(n0)
            expect(str).to.equal("decoder.short()")
        })

        it("encode typedef short", function () {
            const n0: ScopedName = { type: Type.SYN_SCOPED_NAME, name: "T", path: [], scope: undefined, target: { type: Type.TKN_SHORT } }
            const str = typeIDLtoGIOPTS(n0, "a")
            expect(str).to.equal("encoder.short(a)")
        })

        it("encode valuetype", function () {
            const tree = parse(`
            typedef short T, U;
            interface X {
                oneway T f(in U a);
            };
        `)
            const td = tree?.definitions[0] as TypedefDecl
            expect(td.type).to.equal(Type.TKN_TYPEDEF)
            expect(td.typeSpec.type).to.equal(Type.TKN_SHORT)
            expect(td.names).to.deep.equal(["T", "U"])
        })

        xit("TKN_VALUETYPE", function () {
            const tree = parse(`
                valuetype Point {
                public double x, y;
                public short s;
                };
                interface X {
                    oneway Point f(in Point a);
                };
            `)
            // tree?.printTree()
            const vt = tree!.definitions[0] as ValueTypeDecl
            const str = typeIDLtoGIOPTS(vt)
            // console.log(str)
        })
    })
})

describe("typeIDLtoTS()", function () {
    it("qualified struct name", function () {
        const tree = parse(`
            module M {
                struct S { long a; };
            };
            interface X {
                M::S f();
            };`)
        const operation = (tree!.definitions[1] as InterfaceDecl).body[0] as Operation
        expect(typeIDLtoTS(operation.returnType)).to.equal("_interface.M.S")
    })

    it("typedef of a base type inside a module", function () {
        const tree = parse(`
            module M {
                typedef short T;
            };
            interface X {
                M::T f();
            };`)
        const operation = (tree!.definitions[1] as InterfaceDecl).body[0] as Operation
        expect(typeIDLtoTS(operation.returnType)).to.equal("number")
        expect(defaultValueIDLtoTS(operation.returnType)).to.equal("0")
    })
})

function parse(data: string) {
    const lexer = new Lexer(data)
    try {
        const syntaxTree = specification(lexer)
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
