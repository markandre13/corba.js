/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018 Mark-André Hopf <mhopf@mark13.org>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as fs from "fs"
import { Type, Node } from "./idl-node"
import { Lexer } from "./idl-lexer"
import { specification } from "./idl-parser"

type GeneratorDescription = Map<Type, Function>

function typeIDLtoTS(type: Node | undefined): string {
    if (type === undefined)
        throw Error("internal error: parser delivered no type information")
    switch(type!.type) {
        case Type.TKN_IDENTIFIER:
            return type.text!
        case Type.TKN_VOID:
            return "void"
        case Type.TKN_BOOLEAN:
            return "boolean"
        case Type.TKN_STRING:
            return "string"
        case Type.TKN_SHORT:
        case Type.TKN_LONG:
        case Type.SYN_LONGLONG:
        case Type.SYN_UNSIGNED_SHORT:
        case Type.SYN_UNSIGNED_LONG:
        case Type.SYN_UNSIGNED_LONGLONG:
        case Type.TKN_FLOAT:
        case Type.TKN_DOUBLE:
        case Type.SYN_LONG_DOUBLE:
            return "number"
        default:
            throw Error("no mapping from IDL type to TS type for "+type.toString())
    }
}

let generatorTSSkel = new Map<Type, Function>([
    [ Type.SYN_SPECIFICATION, function(this: Generator) {
        this.out.write("declare global {\n")
        for(let definition of this.node.child) {
            if (definition!.type !== Type.SYN_TYPENAME)
                continue
            this.out.write("    interface "+definition!.text+" {}\n")
        }
        this.out.write("}\n\n")
        for(let definition of this.node.child) {
            if (definition!.type === Type.SYN_TYPENAME)
                continue
            this.generate(definition!)
        }
    }],
    [ Type.SYN_VALUE_DCL, function(this: Generator) {
    }],
    [ Type.SYN_INTERFACE, function(this: Generator) {
        let identifier = this.node.child[0]!.child[1]!.text
        this.out.write("export abstract class "+identifier+"_skel extends Skeleton {\n")
        this.out.write("    constructor(orb: ORB) {\n")
        this.out.write("        super(orb)\n")
        this.out.write("    }\n")
        
        for(let op_decl of this.node.child[1]!.child) {
            let attribute = op_decl!.child[0]
            let type = op_decl!.child[1]
            
            let oneway = false
            if (attribute !== undefined && attribute.type === Type.TKN_ONEWAY)
                oneway = true

            if (oneway && type!.type !== Type.TKN_VOID)
                throw Error("corba.js currently requires every oneway function to return void")
            if (!oneway && type!.type === Type.TKN_VOID)
                throw Error("corba.js currently requires operations returning void to be oneway")
            
            let identifier = op_decl!.child[2]!.text
            let parameter_decls = op_decl!.child[3]!.child
            this.out.write("    abstract ")
            this.out.write(identifier+"(")
            let comma = false
            for(let parameter_dcl of parameter_decls) {
                let attribute = parameter_dcl!.child[0]!.type
                let type = parameter_dcl!.child[1]
                let identifier = parameter_dcl!.child[2]!.text
                if (attribute !== Type.TKN_IN) {
                    throw Error("corba.js currently only supports 'in' parameters")
                }
                if (!comma) {
                    comma = true
                } else {
                    this.out.write(", ")
                }
                this.out.write(identifier)
                this.out.write(": ")
                this.out.write(typeIDLtoTS(type))
            }
            this.out.write("): ")
            this.out.write(typeIDLtoTS(type))
            this.out.write("\n")
        }
        this.out.write("}\n\n")
    }]
])

let generatorTSStub = new Map<Type, Function>([
    [ Type.SYN_SPECIFICATION, function(this: Generator) {
        this.out.write("declare global {\n")
        for(let definition of this.node.child) {
            if (definition!.type !== Type.SYN_TYPENAME)
                continue
            this.out.write("    interface "+definition!.text+" {}\n")
        }
        this.out.write("}\n\n")
        for(let definition of this.node.child) {
            if (definition!.type === Type.SYN_TYPENAME)
                continue
            this.generate(definition!)
        }
    }],
    [ Type.SYN_VALUE_DCL, function(this: Generator) {
    }],
    [ Type.SYN_INTERFACE, function(this: Generator) {
        let identifier = this.node.child[0]!.child[1]!.text
        this.out.write("export class "+identifier+" extends Stub {\n")
        this.out.write("    constructor(orb: ORB) {\n")
        this.out.write("        super(orb)\n")
        this.out.write("        this.orb.create(this, \""+identifier+"\")\n")
        this.out.write("    }\n")
        
        for(let op_decl of this.node.child[1]!.child) {
            let attribute = op_decl!.child[0]
            let type = op_decl!.child[1]
            
            let oneway = false
            if (attribute !== undefined && attribute.type === Type.TKN_ONEWAY)
                oneway = true

            if (oneway && type!.type !== Type.TKN_VOID)
                throw Error("corba.js currently requires every oneway function to return void")
            if (!oneway && type!.type === Type.TKN_VOID)
                throw Error("corba.js currently requires operations returning void to be oneway")
            
            let identifier = op_decl!.child[2]!.text
            let parameter_decls = op_decl!.child[3]!.child
            this.out.write("\n")
            this.out.write("    ")
            if (!oneway)
                this.out.write("async ")
            this.out.write(identifier+"(")
            let comma = false
            for(let parameter_dcl of parameter_decls) {
                let attribute = parameter_dcl!.child[0]!.type
                let type = parameter_dcl!.child[1]
                let identifier = parameter_dcl!.child[2]!.text
                if (attribute !== Type.TKN_IN) {
                    throw Error("corba.js currently only supports 'in' parameters")
                }
                if (!comma) {
                    comma = true
                } else {
                    this.out.write(", ")
                }
                this.out.write(identifier)
                this.out.write(": ")
                this.out.write(typeIDLtoTS(type))
            }
            this.out.write("): ")
            if (!oneway)
                this.out.write("Promise<")
            this.out.write(typeIDLtoTS(type))
            if (!oneway)
                this.out.write(">")
            this.out.write(" {\n")
            this.out.write("        ")
            if (!oneway)
                this.out.write("return await ")
            this.out.write("this.orb.call(this.id, \""+identifier+"\", [")
            comma = false
            for(let parameter_dcl of parameter_decls) {
                let identifier = parameter_dcl!.child[2]!.text
                if (!comma) {
                    comma = true
                } else {
                    this.out.write(", ")
                }
                this.out.write(identifier)
            }
            this.out.write("])\n")
            this.out.write("    }\n")
        }
        this.out.write("}\n\n")
    }]
])

class Generator {
    description: GeneratorDescription
    out: fs.WriteStream
    node: Node

    constructor(description: GeneratorDescription, out: fs.WriteStream) {
        this.description = description
        this.out = out
        this.node = new Node(Type.NONE) // dummy for typescript
    }
    
    generate(node: Node): void {
        let f = this.description.get(node.type)
        if (f === undefined) {
            throw Error("Generator: no way to handle node "+node.toString())
        }
        this.node = node
        f.call(this)
    }
}

function usage() {
    console.log("corba.js IDL compiler")
    console.log("Usage: corba.idl [--ts-stub|--ts-skel] file")
}

let lexer: Lexer | undefined
try {
    if (process.argv.length!==4) {
        usage()
        process.exit(1)
    }
    let fileName = process.argv[3]
    
    let n = fileName.lastIndexOf(".")
    if (n === -1) {
        throw Error("filename '"+fileName+"' must at least contain one dot ('.')")
    }
    let fileNamePrefix = fileName.substr(0, n)
    
    let file = fs.readFileSync(fileName, "utf8")

    let generator: Generator
    let out
    switch(process.argv[2]) {
        case "--ts-stub":
            out = fs.createWriteStream(fileNamePrefix+"_stub.ts")
            out.write("// This file is generated by the corba.js IDL compiler from '"+fileName+"'.\n\n")
            out.write("import { ORB, Stub } from 'corba.js'\n\n")
            generator = new Generator(generatorTSStub, out)
            break
        case "--ts-skel":
            out = fs.createWriteStream(fileNamePrefix+"_skel.ts")
            out.write("// This file is generated by the corba.js IDL compiler from '"+fileName+"'.\n\n")
            out.write("import { ORB, Skeleton } from 'corba.js'\n\n")
            generator = new Generator(generatorTSSkel, out)
            break
        default:
            usage()
            process.exit(1)
    }

    lexer = new Lexer(file)

    let tree = specification(lexer)
    if (tree === undefined) {
        throw Error("failed to parse IDL file '"+fileName+"'")
    }
    generator!.generate(tree)
}
catch(error) {
    if (lexer)
        console.log(error.message+" at line "+lexer.line+", column "+lexer.column)
    else
        console.log(error.message)
    console.log(error.stack)
    process.exit(1)
}
