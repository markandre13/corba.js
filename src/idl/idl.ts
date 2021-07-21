/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2020 Mark-André Hopf <mhopf@mark13.org>
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

import * as fs from "fs"
import { Type, Node } from "./idl-node"
import { Lexer } from "./idl-lexer"
import { specification } from "./idl-parser"

let classAttributes = new Map<string, Array<string>>()

function writeIndent(out: fs.WriteStream, indent: number) {
    for(let i=0; i<indent; ++i)
        out.write("    ")
}

enum FileType {
    NONE,
    VALUE,
    VALUETYPE,
    VALUEIMPL,
    INTERFACE,
    SKELETON,
    STUB
}

function typeIDLtoTS(type: Node | undefined, filetype: FileType = FileType.NONE): string {
    if (type === undefined)
        throw Error("internal error: parser delivered no type information")
    switch(type!.type) {
        case Type.TKN_IDENTIFIER: {
            
            let identifierType = type.child[type.child.length-1]!
            let relativeName = ""
            for(let x of type.child) {
                relativeName = `${relativeName}.${x!.text!}`
            }
            relativeName = relativeName.substring(1)

            let absolutePrefix=""
            for(let x: Node|undefined=type.child[0]?.typeParent; x; x=x.typeParent) {
                absolutePrefix=`.${x!.text}${absolutePrefix}`
            }

            if ( type.child.length>0 &&
                type.child[0]!.type === Type.TKN_NATIVE &&
                type.text!.length > 4 &&
                type.text!.substring(type.text!.length-4)==="_ptr" )
            {
                return `${absolutePrefix.substring(1)} | undefined`
            }

            let name: string
            switch(identifierType.type) {
                case Type.TKN_VALUETYPE:
                    if (filetype !== FileType.VALUETYPE)
                        name = `valuetype${absolutePrefix}.${relativeName}`
                    else
                        name = relativeName
                    break
                case Type.SYN_INTERFACE:
                    if (filetype !== FileType.INTERFACE)
                        name = `_interface${absolutePrefix}.${relativeName}`
                    else
                        name = relativeName
                    break
                case Type.TKN_NATIVE:
                    name = relativeName
                    break
                default:
                    throw Error(`Internal Error in typeIDLtoTS(): not implemented identifierType ${identifierType.toString()}`)
            }

            return name

        } break
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
            return `Array<${typeIDLtoTS(type!.child[0], filetype)}>`
        default:
            throw Error(`no mapping from IDL type to TS type for ${type.toString()}`)
    }
}

function defaultValueIDLtoTS(type: Node | undefined, filetype: FileType = FileType.NONE): string {
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
            return `new Array<${typeIDLtoTS(type!.child[0], filetype)}>()`
        default:
            throw Error(`no default value for IDL type in TS for type ${type.toString()}`)
    }
}

function hasValueType(specification: Node): boolean {
    for(let definition of specification.child) {
        switch(definition!.type) {
            case Type.TKN_VALUETYPE:
                return true
            case Type.TKN_MODULE:
                if (hasValueType(definition!))
                    return true

        }
    }
    return false
}

function hasNative(specification: Node): boolean {
    for(let definition of specification.child) {
        if (definition!.type === Type.TKN_NATIVE) {
            let native = definition!
            let nativeName = native.text!
            if ( nativeName.length <= 4 ||
                 nativeName.substring(nativeName.length-4) !== "_ptr" )
            {
                return true
            }
        }
    }
    return false
}

function hasOperationDeclarations(value_dcl: Node): boolean {
    for(let i=1; i<value_dcl.child.length; ++i) {
        let value_element = value_dcl.child[i]!
        if (value_element.type === Type.SYN_OPERATION_DECLARATION) {
            return true
        }
    }
    
    let value_header = value_dcl.child[0]!
    let inheritance_spec = value_header.child[2]
    if (inheritance_spec !== undefined) {
        if (inheritance_spec.child[1]!.child[0]!.type === Type.TKN_VALUETYPE) {
            let value_dcl = inheritance_spec.child[1]!.child[0]!
            if (hasOperationDeclarations(value_dcl)) {
                return true
            }
        }
    }
    
    return false
}

function writeTSInterface(specification: Node): void
{
    let out = fs.createWriteStream(filenamePrefix+".ts")
    out.write("// This file is generated by the corba.js IDL compiler from '"+filename+"'.\n\n")
    
    if (hasValueType(specification)) {
        out.write("import * as valuetype from \"./" + filenameLocal + "_valuetype\"\n\n")
    }
    writeTSInterfaceDefinitions(out, specification)
}

function writeTSInterfaceDefinitions(out: fs.WriteStream, specification: Node, prefix="", indent=0): void
{
    for(let definition of specification.child) {
        switch(definition!.type) {
            case Type.TKN_MODULE:
                out.write("export namespace "+definition!.text+" {\n\n")
                writeTSInterfaceDefinitions(out, definition!, prefix+definition!.text+".", indent+1)
                out.write("} // namespace "+definition!.text+"\n\n")  
                break

            case Type.SYN_INTERFACE: {
                let interface_dcl = definition!
                let identifier = interface_dcl.child[0]!.child[1]!.text
                let interface_body = interface_dcl.child[1]!
                
                out.write(`export interface ${identifier} {\n`)
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
                                out.write(identifier+": "+typeIDLtoTS(type, FileType.INTERFACE))
                            }
                            out.write("): Promise<" + typeIDLtoTS(type, FileType.INTERFACE) + ">\n")
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
    out.write("import { ORB, Skeleton } from 'corba.js'\n")
    if (hasValueType(specification)) {
        out.write("import * as valuetype from \"./" + filenameLocal + "_valuetype\"\n")
    }
    out.write("import * as _interface from \"./" + filenameLocal + "\"\n\n")
    writeTSSkeletonDefitions(out, specification)
}

function writeTSSkeletonDefitions(out: fs.WriteStream, specification: Node, prefix="", indent=0): void
{ 
    for(let definition of specification.child) {
        switch(definition!.type) {
            case Type.TKN_MODULE:
                out.write("export namespace "+definition!.text+" {\n\n")
                writeTSSkeletonDefitions(out, definition!, prefix+definition!.text+".", indent+1)
                out.write("} // namespace "+definition!.text+"\n\n")  
                break
            case Type.SYN_INTERFACE: {
                let interface_dcl = definition!
                let identifier = interface_dcl.child[0]!.child[1]!.text
                let interface_body = interface_dcl.child[1]!
                
                out.write(`export abstract class ${identifier} extends Skeleton implements _interface.${prefix}${identifier} {\n`)
                out.write(`    constructor(orb: ORB) { super(orb) }\n`)
                out.write("    static _idlClassName(): string {\n")
                out.write(`        return "${prefix}${identifier}"\n`)
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
                            out.write(`    abstract ${identifier}(`)
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
                                out.write(identifier+": "+typeIDLtoTS(type, FileType.SKELETON))
                            }
                            out.write(`): Promise<${typeIDLtoTS(type, FileType.SKELETON)}>\n`)
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
    out.write("import { ORB, Stub } from 'corba.js'\n")
    if (hasValueType(specification)) {
        out.write("import * as valuetype from \"./" + filenameLocal + "_valuetype\"\n")
    }
    out.write("import * as _interface from \"./" + filenameLocal + "\"\n\n")

    writeTSStubDefinitions(out, specification)
}

function writeTSStubDefinitions(out: fs.WriteStream, specification: Node, prefix="", indent=0): void
{ 
    for(let definition of specification.child) {
        switch(definition!.type) {
            case Type.TKN_MODULE:
                out.write("export namespace "+definition!.text+" {\n\n")
                writeTSStubDefinitions(out, definition!, prefix+definition!.text+".", indent+1)
                out.write("} // namespace "+definition!.text+"\n\n")  
                break

            case Type.SYN_INTERFACE: {
                let interface_dcl = definition!
                let identifier = interface_dcl.child[0]!.child[1]!.text
                let interface_body = interface_dcl.child[1]!

                out.write(`export class ${identifier} extends Stub implements _interface.${prefix}${identifier} {\n`)
                
                out.write(`    static _idlClassName(): string {\n`)
                out.write(`        return "${prefix}${identifier}"\n`)
                out.write(`    }\n\n`)

                out.write(`    static narrow(object: any): ${prefix}${identifier} {\n`)
                out.write(`        if (object instanceof ${prefix}${identifier})\n`)
                out.write(`            return object as ${prefix}${identifier}\n`)
                out.write(`        throw Error("${prefix}${identifier}.narrow() failed")\n`)
                out.write(`    }\n\n`)
                
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
                                out.write(identifier+": "+typeIDLtoTS(type, FileType.STUB))
                            }
                            out.write("): Promise<" + typeIDLtoTS(type, FileType.STUB) + "> {\n")
                            out.write("        ")
                            if (!oneway)
                                out.write("return ")
                            out.write(`await this.orb.call(this, ${oneway}, "${identifier}", [`)
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

let initCalls = ""

function writeTSValue(specification: Node): void
{
    initCalls = ""

    let out = fs.createWriteStream(filenamePrefix+"_value.ts")
    out.write("// This file is generated by the corba.js IDL compiler from '"+filename+"'.\n\n")
    out.write("import { ORB } from 'corba.js'\n")
    if (!hasValueType(specification)) {
        out.write("// no valuetype's defined in IDL")
        return
    }
    // out.write("import * as _interface from \"./" + filenameLocal + "\"\n\n")
    
    if (hasNative(specification)) {
        out.write("declare global {\n")
        for(let definition of specification.child) {
            if (definition!.type === Type.TKN_NATIVE) {
                let native = definition!
                let nativeName = native.text!
                if ( nativeName.length <= 4 ||
                     nativeName.substring(nativeName.length-4) !== "_ptr" )
                {
                    out.write("    interface " + nativeName + " {}\n")
                }
            }
        }
        out.write("}\n\n")
    }
    
    writeTSValueDefinitions(out, specification)

    out.write("\nlet initialized = false\n")
    out.write("export function _init() {\n")
    out.write("    if (initialized)\n")
    out.write("        return\n")
    out.write("    initialized = true\n")
    out.write(initCalls)
    out.write("}\n")
    out.write("_init()\n")
}

function writeTSValueDefinitions(out: fs.WriteStream, specification: Node, prefix="", indent=0): void
{
    for(let definition of specification.child) {
        switch(definition!.type) {
            case Type.TKN_MODULE: {
                writeIndent(out, indent)
                out.write("export namespace "+definition!.text+" {\n\n")
                writeTSValueDefinitions(out, definition!, prefix+definition!.text+".", indent+1)
                writeIndent(out, indent)
                out.write("} // namespace "+definition!.text+"\n\n")
            } break
            case Type.TKN_NATIVE: {
            } break
            case Type.TKN_VALUETYPE: {
                let value_dcl = definition!
                let value_header = value_dcl.child[0]!
                let custom = value_header.child[0]
                let identifier = value_header.child[1]!.text
                let inheritance_spec = value_header.child[2]

                writeIndent(out, indent)
                out.write(`export interface ${identifier}`)

                let attributes = new Array<string>()
                classAttributes.set(prefix+identifier, attributes)

                if (inheritance_spec !== undefined) {
                    if (inheritance_spec.child.length > 2)  // FIXME: for interfaces we can
                        throw Error("multiple inheritance is not supported for TypeScript")
                    out.write(" extends "+inheritance_spec.child[1]!.text)
                    
                    let superAttributes = classAttributes.get(prefix+inheritance_spec.child[1]!.text!)
                    if (superAttributes === undefined) {
                        superAttributes = classAttributes.get(inheritance_spec.child[1]!.text!)
                    }
                    if (superAttributes === undefined) {
                        throw Error("failed to find attributes for super class")
                    }
                    for(let attribute of superAttributes) {
                        attributes.push(attribute)
                    }
                }
                out.write(" {\n")

                for(let i=1; i<value_dcl.child.length; ++i) {
                    let value_element = value_dcl.child[i]!
                    if (value_element.type === Type.SYN_STATE_MEMBER) {
                        let state_member = value_element
                        let attribute    = state_member.child[0]!
                        let type         = state_member.child[1]!
                        let declarators  = state_member.child[2]!
                        for(let declarator of declarators.child) {
                            writeIndent(out, indent+1)
                            out.write(declarator!.text+": "+typeIDLtoTS(type, FileType.VALUETYPE)+"\n")
                            attributes.push(declarator!.text!)
                        }
                    }
                }
                writeIndent(out, indent)
                out.write("}\n\n")

                writeIndent(out, indent)
                out.write(`export function init${identifier}(object: ${identifier}, init?: Partial<${identifier}>) {\n`)
                for(let i=1; i<value_dcl.child.length; ++i) {
                    let value_element = value_dcl.child[i]!
                    if (value_element.type === Type.SYN_STATE_MEMBER) {
                        let state_member = value_element
                        let attribute    = state_member.child[0]!
                        let type         = state_member.child[1]!
                        let declarators  = state_member.child[2]!
                        for(let declarator of declarators.child) {
                            let decl_identifier = declarator!.text
                            writeIndent(out, indent+1)
                            if (type.type === Type.TKN_IDENTIFIER) {
                                // FIXME: doesn't work for Array<Layer>()
                                // FIXME: in this case workflow doesn't require a copy, maybe just copy when the prototypes are wrong or a deep copy flag had been set?
//                                out.write(") ? new "+type.text+"() : new "+type.text+"(init."+decl_identifier+")\n")

                                // console.log(`writeTSValueDefinitions`, type, typeIDLtoTS(type))
                                
                                if (type.child[0]?.type == Type.TKN_NATIVE &&
                                    type.text!.length > 4 &&
                                    type.text!.substring(type.text!.length-4)==="_ptr")
                                {
                                    let name = typeIDLtoTS(type)
                                    out.write(`if (init !== undefined && init.${decl_identifier} !== undefined) object.${decl_identifier} = new (ORB.lookupValueType("${name}"))(init.${decl_identifier})\n`)
                                } else {
                                    let name = typeIDLtoTS(type).substring(10) // hack: strip "valuetype."
                                    out.write(`object.${decl_identifier} = new (ORB.lookupValueType("${name}"))(init === undefined ? undefined : init.${decl_identifier})\n`)
                                }
                            } else {
                                out.write(`object.${decl_identifier} = (init === undefined || init.${decl_identifier} === undefined) ? `)
                                out.write(defaultValueIDLtoTS(type, FileType.VALUETYPE))
                                out.write(` : init.${decl_identifier}\n`)
                            }
                        }
                    }
                }
                writeIndent(out, indent)
                out.write("}\n\n")

                initCalls += `    ORB.valueTypeByName.set("${prefix}${identifier}", {attributes:[`
                let comma = false
                for(let attribute of attributes) {
                    if (comma) {
                        initCalls += ", "
                    } else {
                        comma = true
                    }
                    initCalls += `"${attribute}"`
                }
                initCalls += "]})\n"
            } break
        }
    }
}

function writeTSValueType(specification: Node): void
{
    let out = fs.createWriteStream(filenamePrefix+"_valuetype.ts")
    out.write("// This file is generated by the corba.js IDL compiler from '"+filename+"'.\n\n")
    out.write("import { ORB } from 'corba.js'\n")
    if (!hasValueType(specification)) {
        out.write("// no valuetype's defined in IDL")
        return
    }
    // out.write("import * as _interface from \"./" + filenameLocal + "\"\n\n")
    out.write(`import * as value from "./${filenameLocal}_value\"\n\n`)
    
    if (hasNative(specification)) {
        out.write("declare global {\n")
        for(let definition of specification.child) {
            if (definition!.type === Type.TKN_NATIVE) {
                let native = definition!
                let nativeName = native.text!
                if ( nativeName.length <= 4 ||
                     nativeName.substring(nativeName.length-4) !== "_ptr" )
                {
                    out.write("    interface " + nativeName + " {}\n")
                }
            }
        }
        out.write("}\n\n")
    }
    
    writeTSValueTypeDefinitions(out, specification)
}

function writeTSValueTypeDefinitions(out: fs.WriteStream, specification: Node, prefix="", indent=0)
{
    for(let definition of specification.child) {
        switch(definition!.type) {
            case Type.TKN_MODULE: {
                out.write(`export namespace ${definition!.text} {\n\n`)
                writeTSValueTypeDefinitions(out, definition!, prefix+definition!.text+".", indent+1)
                out.write(`} // namespace ${definition!.text}\n\n`)
            } break
            case Type.TKN_NATIVE: {
            } break
            case Type.TKN_VALUETYPE: {
                let value_dcl = definition!
                let value_header = value_dcl.child[0]!
                let custom = value_header.child[0]
                let identifier = value_header.child[1]!.text
                let inheritance_spec = value_header.child[2]

                writeIndent(out, indent)
                out.write(`export interface ${identifier} extends value.${prefix}${identifier}`) // FIXME: namespace

                if (inheritance_spec !== undefined) {
                    if (inheritance_spec.child.length > 2)
                        throw Error("multiple inheritance is not supported for TypeScript") // FIXME: for interfaces we can
                    out.write(", "+inheritance_spec.child[1]!.text)
                }
                out.write(" {\n")

                for(let i=1; i<value_dcl.child.length; ++i) {
                    let value_element = value_dcl.child[i]!
                    if (value_element.type === Type.SYN_OPERATION_DECLARATION) {
                        let op_decl = value_element
                        let attribute = op_decl!.child[0]
                        let type = op_decl!.child[1]!
                        let op_identifier = op_decl!.child[2]!.text
                        let parameter_decls = op_decl!.child[3]!.child
                        writeIndent(out, indent+1)
                        out.write(op_identifier+"(")
                        let comma = false
                        for(let parameter_dcl of parameter_decls) {
                            let attribute = parameter_dcl!.child[0]!.type
                            let type = parameter_dcl!.child[1]
                            let param_identifier = parameter_dcl!.child[2]!.text
                            if (attribute !== Type.TKN_IN) {
                                throw Error("corba.js currently only supports 'in' parameters")
                            }
                            if (comma) {
                                out.write(", ")
                            } else {
                                comma = true
                            }
                            out.write(param_identifier)
                            out.write(": ")
                            out.write(typeIDLtoTS(type, FileType.VALUETYPE))
                        }
                        out.write("): ")
                        out.write(typeIDLtoTS(type, FileType.VALUETYPE))
                        out.write("\n")
                    }
                }
                writeIndent(out, indent)
                out.write("}\n\n")
                
            } break
        }
    }
}

function writeTSValueImpl(specification: Node): void
{
    let out = fs.createWriteStream(filenamePrefix+"_valueimpl.ts")
    out.write(`// This file is generated by the corba.js IDL compiler from '${filename}'.\n\n`)
    out.write("import { ORB } from 'corba.js'\n")
    if (!hasValueType(specification)) {
        out.write("// no valuetype's defined in IDL")
        return
    }
    out.write(`import * as value from "./${filenameLocal}_value"\n\n`)
    out.write(`import * as valuetype from "./${filenameLocal}_valuetype"\n\n`)
    out.write(`import * as _interface from "./${filenameLocal}"\n\n`)
    
    if (hasNative(specification)) {
        out.write("declare global {\n")
        for(let definition of specification.child) {
            switch(definition!.type) {
                case Type.TKN_NATIVE: {
                    let native = definition!
                    let nativeName = native.text!
                    if ( nativeName.length <= 4 ||
                        nativeName.substring(nativeName.length-4) !== "_ptr" )
                    {
                        out.write("    interface " + nativeName + " {}\n")
                    }
                } break
            }
        }
        out.write("}\n\n")
    }
    
    writeTSValueImplDefinitions(out, specification)
}

function writeTSValueImplDefinitions(out: fs.WriteStream, specification: Node, prefix="", indent=0)
{
    for(let definition of specification.child) {
        switch(definition!.type) {
            case Type.TKN_MODULE: {
                out.write("export namespace "+definition!.text+" {\n\n")
                writeTSValueImplDefinitions(out, definition!, prefix+definition!.text+".", indent+1)
                out.write("} // namespace "+definition!.text+"\n\n")
            } break
            case Type.TKN_NATIVE: {
            } break
            case Type.TKN_VALUETYPE: {
                let value_dcl = definition!
                let value_header = value_dcl.child[0]!
                let custom = value_header.child[0]
                let identifier = value_header.child[1]!.text
                let inheritance_spec = value_header.child[2]

                writeIndent(out, indent)
                out.write("export ")
                if (hasOperationDeclarations(value_dcl))
                    out.write("abstract ")
                else
                if (inheritance_spec !== undefined) { // FIXME: this works only over one inheritance level, make it recursive
                    if (inheritance_spec.child[1]!.child[0]!.type === Type.TKN_VALUETYPE) {
                        let value_dcl = inheritance_spec.child[1]!.child[0]!
                        if (hasOperationDeclarations(value_dcl))
                            out.write("abstract ")
                    }
                }
                out.write("class "+identifier)
                if (inheritance_spec !== undefined) {
                    if (inheritance_spec.child.length > 2)
                        throw Error("multiple inheritance is not supported for TypeScript")
                    out.write(" extends "+inheritance_spec.child[1]!.text)
                }
                out.write(` implements valuetype.${prefix}${identifier} {\n`)

                for(let i=1; i<value_dcl.child.length; ++i) {
                    let value_element = value_dcl.child[i]!
                    if (value_element.type === Type.SYN_STATE_MEMBER) {
                        let state_member = value_element
                        let attribute    = state_member.child[0]!
                        let type         = state_member.child[1]!
                        let declarators  = state_member.child[2]!
                        for(let declarator of declarators.child) {
                            writeIndent(out, indent+1)
                            out.write(declarator!.text+"!: "+typeIDLtoTS(type, FileType.VALUETYPE)+"\n")
                        }
                    }
                }
                
                out.write("\n")
                writeIndent(out, indent+1)
                out.write(`constructor(init?: Partial<value.${prefix}${identifier}>) {\n`)
                if (inheritance_spec) {
                    writeIndent(out, indent+2)
                    out.write("super(init)\n")
                }
                writeIndent(out, indent+2)
                out.write(`value.${prefix}init${identifier}(this, init)\n`)
                writeIndent(out, indent+1)
                out.write("}\n")

                for(let i=1; i<value_dcl.child.length; ++i) {
                    let value_element = value_dcl.child[i]!
                    if (value_element.type === Type.SYN_OPERATION_DECLARATION) {
                        let op_decl = value_element
                        let attribute = op_decl!.child[0]
                        let type = op_decl!.child[1]!
                        let op_identifier = op_decl!.child[2]!.text
                        let parameter_decls = op_decl!.child[3]!.child
                        writeIndent(out, indent+1)
                        out.write("abstract ")
                        out.write(op_identifier+"(")
                        let comma = false
                        for(let parameter_dcl of parameter_decls) {
                            let attribute = parameter_dcl!.child[0]!.type
                            let type = parameter_dcl!.child[1]
                            let param_identifier = parameter_dcl!.child[2]!.text
                            if (attribute !== Type.TKN_IN) {
                                throw Error("corba.js currently only supports 'in' parameters")
                            }
                            if (comma) {
                                out.write(", ")
                            } else {
                                comma = true
                            }
                            out.write(param_identifier)
                            out.write(": ")
                            out.write(typeIDLtoTS(type))
                        }
                        out.write("): ")
                        out.write(typeIDLtoTS(type))
                        out.write("\n")
                    }
                }
                writeIndent(out, indent)
                out.write("}\n\n")
            } break
        }
    }
}

function printHelp() {
    console.log(
`corba.js IDL compiler
Copyright (C) 2018, 2020 Mark-André Hopf <mhopf@mark13.org>
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

let debug = 0, tsInterface = false, tsStub = false, tsSkeleton = false, tsValueType = false, tsValueImpl = false
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
        // case "--ts-valueimpl":
        //     tsValueImpl = true
        //     break
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
                console.log(`corba-idl: error: unrecognized command line option '${process.argv[i]}'`)
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
        console.log(`corba-idl: error: filename '${filename}' must at least contain one dot ('.')`)
        process.exit(1)
    }
    filenamePrefix = filename.substr(0, n)
    
    n = filenamePrefix.lastIndexOf("/")
    if (n === -1)
        filenameLocal = filenamePrefix
    else
        filenameLocal = filenamePrefix.substr(n+1)

    let filedata: string
    try {
        filedata = fs.readFileSync(filename, "utf8")
    }
    catch(error) {
        if (error instanceof Error)
            console.log(`corba-idl: error: failed to read file '${filename}': ${error.message}`)
        else
            console.log(error)
        process.exit(1)
    }

    let lexer = new Lexer(filedata)
    let syntaxTree: Node | undefined
    try {
        syntaxTree = specification(lexer)
    }
    catch(error) {
        if (error instanceof Error) {
            console.log(`corba-idl: error: ${error.message} in file '${filename}' at line ${lexer.line}, column ${lexer.column}`)
            if (debug)
                console.log(error.stack)
        } else {
            console.log(error)
        }
        process.exit(1)
    }
    if (syntaxTree === undefined) {
        console.log("corba-idl: error: empty file or unexpected internal failure")
        process.exit(1)
    }
    if (debug>1)
        syntaxTree.printTree()

    try {
        if (tsInterface)
            writeTSInterface(syntaxTree!)
        if (tsSkeleton)
            writeTSSkeleton(syntaxTree!)
        if (tsStub)
            writeTSStub(syntaxTree!)
        if (tsValueType) {
            writeTSValue(syntaxTree!)
            writeTSValueType(syntaxTree!)
        }
        if (tsValueImpl)
            writeTSValueImpl(syntaxTree!)
    }
    catch(error) {
        if (error instanceof Error) {
            console.log(`corba-idl: error: ${error.message} in file '${filename}'`)
            if (debug)
                console.log(error.stack)
        } else {
            console.log(error)
        }
        process.exit(1)
    }
}
