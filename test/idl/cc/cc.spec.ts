import { expect } from "chai"
import { Lexer } from "corba.js/idl/idl-lexer"
import { specification } from "corba.js/idl/idl-parser"
import { writeCCInterfaceDefinitions } from "corba.js/idl/cc/write-interface"
import MemoryStream from "memorystream"

describe("CC IDL", () => {
    describe("interface", () => {
        // this test defines our desired basic idl to c++ mappings.
        // all further tests then can work by actually compiling and using generated c++ code.
        describe("bool", () => {
            it("in", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        void call(in boolean value);
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<void> call(bool value) = 0;")
            })
            it("out", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        boolean call();
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<bool> call() = 0;")
            })
        })
        describe("unsigned octet", () => {
            it("in", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        void call(in octet value);
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<void> call(uint8_t value) = 0;")
            })
            it("out", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        octet call();
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<uint8_t> call() = 0;")
            })
        })
        describe("unsigned short", () => {
            it("in", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        void call(in unsigned short value);
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<void> call(uint16_t value) = 0;")
            })
            it("out", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        unsigned short call();
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<uint16_t> call() = 0;")
            })
        })
        describe("unsigned long", () => {
            it("in", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        void call(in unsigned long value);
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<void> call(uint32_t value) = 0;")
            })
            it("out", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        unsigned long call();
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<uint32_t> call() = 0;")
            })
        })
        describe("unsigned long long", () => {
            it("in", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        void call(in unsigned long long value);
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<void> call(uint64_t value) = 0;")
            })
            it("out", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        unsigned long long call();
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<uint64_t> call() = 0;")
            })
        })
        describe("string", () => {
            it("in", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        void call(in string value);
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<void> call(const std::string_view & value) = 0;")
            })
            it("out", async () => {
                const data = await compileInterface(`
                    interface Backend {
                        string call();
                    };
                `)
                expect(data).to.contain("virtual CORBA::async<std::string> call() = 0;")
            })
        })
    })
})

describe("CC IDL qualified names", () => {
    it("struct inside a module", async () => {
        const data = await compileInterface(`
            module M {
                struct S { long a; };
            };
            interface Backend {
                M::S call(in M::S value);
            };
        `)
        expect(data).to.contain("virtual CORBA::async<M::S> call(const M::S& value) = 0;")
    })
    it("interface inside a module", async () => {
        const data = await compileInterface(`
            module M {
                interface I {};
            };
            interface Backend {
                M::I call();
            };
        `)
        expect(data).to.contain("virtual CORBA::async<std::shared_ptr<M::I>> call() = 0;")
    })
})

describe("CC IDL documentation", () => {
    it("struct", async () => {
        const data = await compileInterface(`
            /// A point.
            struct P { long a; };
        `)
        expect(data).to.contain("/**\n * A point.\n */\nstruct P {")
    })
    it("parameter", async () => {
        const data = await compileInterface(`
            interface Backend {
                /// Calls the backend.
                void call(/// the input
                    in long value);
            };
        `)
        expect(data).to.contain("    /**\n     * Calls the backend.\n     *\n     * @param value the input\n     */\n    virtual CORBA::async<void> call(int32_t value) = 0;")
    })
    it("operation", async () => {
        const data = await compileInterface(`
            interface Backend {
                /// Calls the backend.
                void call();
            };
        `)
        expect(data).to.contain("    /**\n     * Calls the backend.\n     */\n    virtual CORBA::async<void> call() = 0;")
    })
})

describe("CC IDL typedef", () => {
    it("typedef of a predefined type", async () => {
        const data = await compileInterface(`
            typedef short T;
            interface Backend {
                void call(in T value);
            };
        `)
        expect(data).to.contain("virtual CORBA::async<void> call(int16_t value) = 0;")
    })
    it("typedef of a predefined type inside a module", async () => {
        const data = await compileInterface(`
            module M {
                typedef short T;
            };
            interface Backend {
                void call(in M::T value);
            };
        `)
        expect(data).to.contain("virtual CORBA::async<void> call(int16_t value) = 0;")
    })
})

function compileInterface(idl: string): Promise<string> {
    const tree = parse(idl)
    var out = new MemoryStream()
    writeCCInterfaceDefinitions(out, tree!)
    out.end()
    return streamToString(out)
}

function parse(data: string) {
    const lexer = new Lexer(data)
    try {
        const syntaxTree = specification(lexer)
        return syntaxTree
    } catch (e) {
        if (e instanceof Error) {
            console.log(`${e.message} at line ${lexer.line}, column ${lexer.column}`)
            console.log(e.stack)
        }
        throw e
    }
}

// https://stackoverflow.com/questions/10623798/how-do-i-read-the-contents-of-a-node-js-stream-into-a-string-variable
function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = []
    return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
        stream.on("error", (err) => reject(err))
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    })
}
