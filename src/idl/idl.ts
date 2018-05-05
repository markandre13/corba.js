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

function typeIDLtoTS(type: Node | undefined, filetype = Type.NONE): string {
    if (type === undefined)
        throw Error("internal error: parser delivered no type information")
    switch(type!.type) {
        case Type.TKN_IDENTIFIER:
            if ( type.child.length>0 &&
                 type.child[0]!.type === Type.TKN_NATIVE &&
                 type.text!.length > 4 &&
                 type.text!.substring(type.text!.length-4)==="_ptr" )
            {
                return type.text!.substring(0, type.text!.length-4) + " | undefined"
            }
            if ( filetype !== Type.TKN_VALUETYPE &&
                 type.child.length>0 &&
                 type.child[0]!.type === Type.TKN_VALUETYPE )
            {
                return "valuetype." + type.text!
            }
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
        case Type.TKN_SEQUENCE:
            return "Array<"+typeIDLtoTS(type!.child[0])+">"
        default:
            throw Error("no mapping from IDL type to TS type for "+type.toString())
    }
}

function defaultValueIDLtoTS(type: Node | undefined): string {
    if (type === undefined)
        throw Error("internal error: parser delivered no type information")
    switch(type!.type) {
        case Type.TKN_IDENTIFIER:
            return "new "+type.text!+"()"
        case Type.TKN_BOOLEAN:
            return "false"
        case Type.TKN_STRING:
            return "\"\""
        case Type.TKN_SHORT:
        case Type.TKN_LONG:
        case Type.SYN_LONGLONG:
        case Type.SYN_UNSIGNED_SHORT:
        case Type.SYN_UNSIGNED_LONG:
        case Type.SYN_UNSIGNED_LONGLONG:
        case Type.TKN_FLOAT:
        case Type.TKN_DOUBLE:
        case Type.SYN_LONG_DOUBLE:
            return "0"
        case Type.TKN_SEQUENCE:
            return "new Array<"+typeIDLtoTS(type!.child[0])+">()"
        default:
            throw Error("no default value for IDL type in TS for type "+type.toString())
    }
}

function hasValueType(specification: Node): boolean {
    for(let definition of specification.child) {
        if (definition!.type === Type.TKN_VALUETYPE) {
            return true
        }
    }
    return false
}

let generatorTSValueType = new Map<Type, Function>([
    [ Type.SYN_SPECIFICATION, function(this: Generator) {
        let haveValueTypes = false
        for(let definition of this.node.child) {
            if (definition!.type === Type.TKN_VALUETYPE) {
                haveValueTypes = true
                break
            }
        }
        if (haveValueTypes) {
            this.out.write("declare global {\n")
            for(let definition of this.node.child) {
                if (definition!.type !== Type.TKN_NATIVE)
                    continue
                this.out.write("    interface "+definition!.text+" {}\n")
            }
            this.out.write("}\n\n")
        }

        for(let definition of this.node.child) {
            if (definition!.type === Type.SYN_VALUE_DCL)
                this.generate(definition!)
            if (definition!.type === Type.TKN_MODULE) {
                this.out.write("export namespace "+definition!.text+" {\n\n")
                for(let moduleDefinition of definition!.child) {
                    this.generate(moduleDefinition!)
                }
                this.out.write("} // namespace "+definition!.text+"\n\n")
            }
        }
    }],
    [ Type.SYN_VALUE_DCL, function(this: Generator) {
        let header = this.node.child[0]!
        let if_identifier = header.child[1]!.text
        let inheritance_spec = header.child[2]
        this.out.write("export class "+if_identifier)
        if (inheritance_spec) {
            if (inheritance_spec.child.length > 2)
                throw Error("multiple inheritance is not supported for typescript")
            this.out.write(" extends "+inheritance_spec.child[1]!.text)
        }
        this.out.write(" {\n")

        for(let i=1; i< this.node.child.length; ++i) {
            let node = this.node.child[i]!
            if (node.type !== Type.SYN_STATE_MEMBER)
                continue
            let state_member = node
            let attribute    = state_member.child[0]!
            let type         = state_member.child[1]!
            let declarators  = state_member.child[2]!
            for(let declarator of declarators.child) {
                this.out.write("    "+declarator!.text+": "+typeIDLtoTS(type, Type.TKN_VALUETYPE)+"\n")
            }
        }

        this.out.write("    constructor(")
        let comma = false
        for(let i=1; i< this.node.child.length; ++i) {
            let node = this.node.child[i]!
            if (node.type !== Type.SYN_STATE_MEMBER)
                continue
            let state_member = node
            let attribute    = state_member.child[0]!
            let type         = state_member.child[1]!
            let declarators  = state_member.child[2]!
            for(let declarator of declarators.child) {
                if (comma)
                    this.out.write(", ")
                else
                    comma = true
                this.out.write(declarator!.text+"?: "+typeIDLtoTS(type, Type.TKN_VALUETYPE))
            }
        }
        this.out.write(") {\n")
        if (inheritance_spec) {
            this.out.write("        super()\n") // FIXME: provide arguments for super class constructor
        }
        for(let i=1; i< this.node.child.length; ++i) {
            let state_member = this.node.child[i]!
            let attribute    = state_member.child[0]!
            let type         = state_member.child[1]!
            let declarators  = state_member.child[2]!
            for(let declarator of declarators.child) {
                let decl_identifier = declarator!.text
                this.out.write("        this."+decl_identifier+" = ("+decl_identifier+" === undefined) ? ")
                this.out.write(defaultValueIDLtoTS(type))
                this.out.write(" : "+decl_identifier+"\n")
            }
        }
        this.out.write("    }\n")

        for(let i=1; i< this.node.child.length; ++i) {
            let node = this.node.child[i]!
            if (node.type !== Type.SYN_OPERATION_DECLARATION)
                continue
            let op_decl = node
            let attribute = op_decl!.child[0]
            let type = op_decl!.child[1]!
            let op_identifier = op_decl!.child[2]!.text
            let parameter_decls = op_decl!.child[3]!.child
            this.out.write("\n")
            this.out.write("    ")
            this.out.write(op_identifier+"(")
            let comma = false
            for(let parameter_dcl of parameter_decls) {
                let attribute = parameter_dcl!.child[0]!.type
                let type = parameter_dcl!.child[1]
                let param_identifier = parameter_dcl!.child[2]!.text
                if (attribute !== Type.TKN_IN) {
                    throw Error("corba.js currently only supports 'in' parameters")
                }
                if (!comma) {
                    comma = true
                } else {
                    this.out.write(", ")
                }
                this.out.write(param_identifier)
                this.out.write(": ")
                this.out.write(typeIDLtoTS(type, Type.TKN_VALUETYPE))
            }
            this.out.write("): ")
            this.out.write(typeIDLtoTS(type))
            this.out.write(" {\n")
            this.out.write("        throw Error('pure virtual method "+if_identifier+"."+op_identifier+"() called')\n")
            this.out.write("    }\n")
        }

        this.out.write("}\n\n")
    }]
])

class Generator {
    description: Map<Type, Function>
    out: fs.WriteStream
    node: Node

    constructor(description: Map<Type, Function>, out: fs.WriteStream) {
        this.description = description
        this.out = out
        this.node = new Node(Type.NONE) // dummy for typescript
    }
    
    generate(node: Node): void {
        let f = this.description.get(node.type)
        if (f === undefined) {
            throw Error("Generator: no way to handle node "+node.toString())
        }
        let previousNode = this.node
        this.node = node
        f.call(this)
        this.node = previousNode
    }
}

function writeTSInterface(specification: Node): void
{
    let out = fs.createWriteStream(filenamePrefix+".ts")
    out.write("// This file is generated by the corba.js IDL compiler from '"+filename+"'.\n\n")
    
    if (hasValueType(specification)) {
        out.write("import * as valuetype from \"./" + filenameLocal + "_valuetype\"\n\n")
    }

    for(let definition of specification.child) {
        switch(definition!.type) {
            case Type.SYN_INTERFACE: {
                let interface_dcl = definition!
                let identifier = interface_dcl.child[0]!.child[1]!.text
                let interface_body = interface_dcl.child[1]!
                
                out.write("export interface "+identifier+" {\n")
                for (let _export of interface_body.child) {
                    switch(_export!.type) {
                        case Type.SYN_OPERATION_DECLARATION: {
                            let op_dcl = _export!
                            let attribute = op_dcl.child[0]
                            let type = op_dcl.child[1]!
            
                            let oneway = false
                            if (attribute !== undefined && attribute.type === Type.TKN_ONEWAY)
                                oneway = true

                            if (oneway && type.type !== Type.TKN_VOID)
                                throw Error("corba.js currently requires every oneway function to return void")
                            if (!oneway && type.type === Type.TKN_VOID)
                                throw Error("corba.js currently requires operations returning void to be oneway")
            
                            let identifier = op_dcl.child[2]!.text
                            let parameter_decls = op_dcl.child[3]!.child
                            out.write("    ")
                            out.write(identifier+"(")
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
                                    out.write(", ")
                                }
                                out.write(identifier+": "+typeIDLtoTS(type))
                            }
                            out.write("): Promise<" + typeIDLtoTS(type) + ">\n")
                        } break
                        case Type.TKN_ATTRIBUTE: {
                        } break
                        default:
                            throw Error("fuck")
                    }
                }
                out.write("}\n\n")
            } break
        }
    }
}

function writeTSSkeleton(specification: Node): void
{
    let out = fs.createWriteStream(filenamePrefix+"_skel.ts")
    out.write("// This file is generated by the corba.js IDL compiler from '"+filename+"'.\n\n")
    out.write("import { ORB, Skeleton } from \"corba.js\"\n")
    if (hasValueType(specification)) {
        out.write("import * as valuetype from \"./" + filenameLocal + "_valuetype\"\n")
    }
    out.write("import * as _interface from \"./" + filenameLocal + "\"\n\n")
    
    for(let definition of specification.child) {
        switch(definition!.type) {
            case Type.SYN_INTERFACE: {
                let interface_dcl = definition!
                let identifier = interface_dcl.child[0]!.child[1]!.text
                let interface_body = interface_dcl.child[1]!
                
                out.write("export abstract class "+identifier+" extends Skeleton implements _interface." + identifier + " {\n")

                out.write("    _idlClassName(): string {\n")
                out.write("        return \"" + identifier + "\"\n")
                out.write("    }\n\n")

                for (let _export of interface_body.child) {
                    switch(_export!.type) {
                        case Type.SYN_OPERATION_DECLARATION: {
                            let op_dcl = _export!
                            let attribute = op_dcl.child[0]
                            let type = op_dcl.child[1]!
            
                            let oneway = false
                            if (attribute !== undefined && attribute.type === Type.TKN_ONEWAY)
                                oneway = true

                            if (oneway && type.type !== Type.TKN_VOID)
                                throw Error("corba.js currently requires every oneway function to return void")
                            if (!oneway && type.type === Type.TKN_VOID)
                                throw Error("corba.js currently requires operations returning void to be oneway")
            
                            let identifier = op_dcl.child[2]!.text
                            let parameter_decls = op_dcl.child[3]!.child
                            out.write("    abstract async ")
                            out.write(identifier+"(")
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
                                    out.write(", ")
                                }
                                out.write(identifier+": "+typeIDLtoTS(type))
                            }
                            out.write("): Promise<" + typeIDLtoTS(type) + ">\n")
                        } break
                        case Type.TKN_ATTRIBUTE: {
                        } break
                        default:
                            throw Error("fuck")
                    }
                }
                out.write("}\n\n")
            } break
        }
    }
}

function writeTSStub(specification: Node): void
{
    let out = fs.createWriteStream(filenamePrefix+"_stub.ts")
    out.write("// This file is generated by the corba.js IDL compiler from '"+filename+"'.\n\n")
    out.write("import { ORB, Stub } from \"corba.js\"\n")
    if (hasValueType(specification)) {
        out.write("import * as valuetype from \"./" + filenameLocal + "_valuetype\"\n")
    }
    out.write("import * as _interface from \"./" + filenameLocal + "\"\n\n")
    
    for(let definition of specification.child) {
        switch(definition!.type) {
            case Type.SYN_INTERFACE: {
                let interface_dcl = definition!
                let identifier = interface_dcl.child[0]!.child[1]!.text
                let interface_body = interface_dcl.child[1]!
                
                out.write("export class " + identifier + " extends Stub implements _interface." + identifier + " {\n")
                
                out.write("    _idlClassName(): string {\n")
                out.write("        return \"" + identifier + "\"\n")
                out.write("    }\n\n")

                out.write("    static narrow(object: any): " + identifier + " {\n")
                out.write("        if (object instanceof " + identifier + ")\n")
                out.write("            return object as " + identifier + "\n")
                out.write("        throw Error(\"" + identifier + ".narrow() failed\")\n")
                out.write("    }\n\n")
                
                for (let _export of interface_body.child) {
                    switch(_export!.type) {
                        case Type.SYN_OPERATION_DECLARATION: {
                            let op_dcl = _export!
                            let attribute = op_dcl.child[0]
                            let type = op_dcl.child[1]!
            
                            let oneway = false
                            if (attribute !== undefined && attribute.type === Type.TKN_ONEWAY)
                                oneway = true

                            if (oneway && type.type !== Type.TKN_VOID)
                                throw Error("corba.js currently requires every oneway function to return void")
                            if (!oneway && type.type === Type.TKN_VOID)
                                throw Error("corba.js currently requires operations returning void to be oneway")
            
                            let identifier = op_dcl.child[2]!.text
                            let parameter_decls = op_dcl.child[3]!.child
                            out.write("    async ")
                            out.write(identifier+"(")
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
                                    out.write(", ")
                                }
                                out.write(identifier+": "+typeIDLtoTS(type))
                            }
                            out.write("): Promise<" + typeIDLtoTS(type) + "> {\n")
                            out.write("        ")
                            if (!oneway)
                                out.write("return await ")
                            out.write("this.orb.call(this, \""+identifier+"\", [")
                            comma = false
                            for(let parameter_dcl of parameter_decls) {
                                let identifier = parameter_dcl!.child[2]!.text
                                if (!comma) {
                                    comma = true
                                } else {
                                    out.write(", ")
                                }
                                out.write(identifier)
                            }
                            out.write("])\n")
                            out.write("    }\n")
                        } break
                        case Type.TKN_ATTRIBUTE: {
                        } break
                        default:
                            throw Error("fuck")
                    }
                }
                out.write("}\n\n")
            } break
        }
    }
}

function printHelp() {
    console.log(
`corba.js IDL compiler
Copyright (C) 2018 Mark-André Hopf <mhopf@mark13.org>
This is free software; see the source for copying conditions.  There is
ABSOLUTELY NO WARRANTY; not even for MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.

Usage: corba-idl [options] file...
Options:
  --ts-all        create all TypeScript files
  --ts-interface  create TypeScript interface file for stub and skeleton
  --ts-stub       create TypeScript stub file
  --ts-skeleton   create TypeScript skeleton file
  --ts-valuetype  create TypeScript valuetype file
  --debug|-d      increase debug level
  --help|-h       this page
`)
}

let debug = 0, tsInterface = false, tsStub = false, tsSkeleton = false, tsValueType = false
let i

argloop:
for(i=2; i<process.argv.length; ++i) {
    switch(process.argv[i]) {
        case "--":
            ++i
            break argloop
        case "--ts-all":
            tsInterface = tsStub = tsSkeleton = tsValueType = true
            break
        case "--ts-interface":
            tsInterface = true
            break
        case "--ts-stub":
            tsStub = true
            break
        case "--ts-skeleton":
            tsSkeleton = true
            break
        case "--ts-valuetype":
            tsValueType = true
            break
        case "--debug":
        case "-d":
            ++debug
            break
        case "--help":
        case "-h":
            printHelp()
            process.exit(0)
        default:
            if (process.argv[i].length>0 && process.argv[i].charAt(0)=="-") {
                console.log("corba-idl: error: unrecognized command line option '"+process.argv[i]+"'")
                process.exit(1)
            }
            break argloop
    }
}
if (i === process.argv.length) {
    console.log("corba-idl: no input files")
    process.exit(1)
}

let filename = ""
let filenamePrefix = ""
let filenameLocal = ""

for(; i<process.argv.length; ++i) {
    filename = process.argv[i]

    let n = filename.lastIndexOf(".")
    if (n === -1) {
        console.log("corba-idl: error: filename '"+filename+"' must at least contain one dot ('.')")
        process.exit(1)
    }
    filenamePrefix = filename.substr(0, n)
    
    n = filenamePrefix.lastIndexOf("/")
    if (n === -1)
        filenameLocal = filenamePrefix
    else
        filenameLocal = filenamePrefix.substr(n+1)

    let filedata = fs.readFileSync(filename, "utf8")

    let lexer = new Lexer(filedata)
    let syntaxTree
    try {
        syntaxTree = specification(lexer)
    }
    catch(error) {
        console.log("corba-idl: error: "+error.message+" in file '"+filename+" at line "+lexer.line+", column "+lexer.column)
        if (debug)
            console.log(error.stack)
        process.exit(1)
    }
    if (syntaxTree === undefined) {
        console.log("corba-idl: error: empty file or unexpected internal failure")
        process.exit(1)
    }

    try {
        if (tsInterface)
            writeTSInterface(syntaxTree!)
        if (tsSkeleton)
            writeTSSkeleton(syntaxTree!)
        if (tsStub)
            writeTSStub(syntaxTree!)
        if (tsValueType) {
            let out = fs.createWriteStream(filenamePrefix+"_valuetype.ts")
            out.write("// This file is generated by the corba.js IDL compiler from '"+filename+"'.\n\n")
            let generator = new Generator(generatorTSValueType, out)
            generator.generate(syntaxTree!)
        }
    }
    catch(error) {
        console.log("corba-idl: error: "+error.message+" in file '"+filename+"'")
        if (debug)
            console.log(error.stack)
        process.exit(1)
    }
}
