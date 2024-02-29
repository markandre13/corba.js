/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2020, 2021 Mark-André Hopf <mhopf@mark13.org>
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
import { Type, Node } from "../idl-node"
import { filenamePrefix, filename, filenameLocal, hasNative, hasValueType, writeIndent, classAttributes, FileType, defaultValueIDLtoTS } from "../util"
import { typeIDLtoGIOPTS } from "./typeIDLtoGIOPTS"
import { typeIDLtoTS } from "./typeIDLtoTS"

let initCalls = ""
export function writeTSValue(specification: Node): void {
    initCalls = ""

    let out = fs.createWriteStream(filenamePrefix + "_value.ts")
    out.write(`// This file is generated by the corba.js IDL compiler from '${filename}'.\n\n`)
    out.write(`import { ORB, GIOPDecoder, GIOPEncoder } from 'corba.js'\n`)
    out.write("import * as _interface from \"./" + filenameLocal + "\"\n\n")
    if (!hasValueType(specification)) {
        out.write("// no valuetype's defined in IDL")
        return
    }
    // out.write("import * as _interface from \"./" + filenameLocal + "\"\n\n")
    if (hasNative(specification)) {
        out.write("declare global {\n")
        for (let definition of specification.child) {
            if (definition!.type === Type.TKN_NATIVE) {
                let native = definition!
                let nativeName = native.text!
                if (nativeName.length <= 4 ||
                    nativeName.substring(nativeName.length - 4) !== "_ptr") {
                    out.write(`    interface ${nativeName} {}\n`)
                }
            }
        }
        out.write("}\n\n")
    }

    writeTSValueDefinitions(out, specification)

    out.write("let initialized = false\n")
    out.write("export function _init() {\n")
    out.write("    if (initialized)\n")
    out.write("        return\n")
    out.write("    initialized = true\n")
    out.write(initCalls)
    out.write("}\n")
    out.write("_init()\n")
}

function writeTSValueDefinitions(out: fs.WriteStream, specification: Node, prefix = "", indent = 0): void {
    for (let definition of specification.child) {
        switch (definition!.type) {
            case Type.TKN_MODULE: {
                writeIndent(out, indent)
                out.write(`export namespace ${definition!.text} {\n\n`)
                writeTSValueDefinitions(out, definition!, prefix + definition!.text + ".", indent + 1)
                writeIndent(out, indent)
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
                out.write(`export interface ${identifier}`)

                let attributes = new Array<string>()
                classAttributes.set(prefix + identifier, attributes)

                if (inheritance_spec !== undefined) {
                    if (inheritance_spec.child.length > 2) // FIXME: for interfaces we can
                        throw Error("multiple inheritance is not supported for TypeScript")
                    out.write(` extends ${inheritance_spec.child[1]!.text}`)

                    let superAttributes = classAttributes.get(prefix + inheritance_spec.child[1]!.text!)
                    if (superAttributes === undefined) {
                        superAttributes = classAttributes.get(inheritance_spec.child[1]!.text!)
                    }
                    if (superAttributes === undefined) {
                        throw Error("failed to find attributes for super class")
                    }
                    for (let attribute of superAttributes) {
                        attributes.push(attribute)
                    }
                }
                out.write(" {\n")

                for (let i = 1; i < value_dcl.child.length; ++i) {
                    let value_element = value_dcl.child[i]!
                    if (value_element.type === Type.SYN_STATE_MEMBER) {
                        let state_member = value_element
                        let attribute = state_member.child[0]!
                        let type = state_member.child[1]!
                        let declarators = state_member.child[2]!
                        for (let declarator of declarators.child) {
                            writeIndent(out, indent + 1)
                            out.write(declarator!.text + ": " + typeIDLtoTS(type, FileType.VALUE) + "\n")
                            attributes.push(declarator!.text!)
                        }
                    }
                }
                writeIndent(out, indent)
                out.write("}\n")

                writeIndent(out, indent)
                out.write(`export function init${identifier}(object: ${identifier}, init?: Partial<${identifier}> | GIOPDecoder) {\n`)
                ++indent
                writeIndent(out, indent)
                out.write(`if (init instanceof GIOPDecoder) {\n`)
                writeIndent(out, indent + 1)
                out.write(`const decoder = init\n`)
                writeTSInitValueFromGIOP(value_dcl, out, indent + 1)
                writeIndent(out, indent)
                out.write(`} else {\n`)
                writeTSInitValueFromPOJO(value_dcl, out, indent + 1)
                writeIndent(out, indent)
                out.write("}\n")
                --indent
                writeIndent(out, indent)
                out.write("}\n")

                writeIndent(out, indent)
                out.write(`export function encode${identifier}(encoder: GIOPEncoder, obj: ${identifier}) {\n`)
                ++indent
                if (inheritance_spec !== undefined) {
                    writeIndent(out, indent)
                    out.write(`encode${inheritance_spec.child[1]!.text}(encoder, obj)\n`)
                }
                for (let i = 1; i < value_dcl.child.length; ++i) {
                    let value_element = value_dcl.child[i]!
                    if (value_element.type === Type.SYN_STATE_MEMBER) {
                        let state_member = value_element
                        let attribute = state_member.child[0]!
                        let type = state_member.child[1]!
                        let declarators = state_member.child[2]!
                        for (let declarator of declarators.child) {
                            writeIndent(out, indent)
                            out.write(`${typeIDLtoGIOPTS(type, "obj." + declarator!.text!)}\n`)
                        }
                    }
                }
                --indent
                writeIndent(out, indent)
                out.write("}\n\n")

                initCalls += `    ORB.valueTypeByName.set("${prefix}${identifier}", {attributes:[`
                let comma = false
                for (let attribute of attributes) {
                    if (comma) {
                        initCalls += ", "
                    } else {
                        comma = true
                    }
                    initCalls += `"${attribute}"`
                }
                initCalls += `],encode:${prefix}encode${identifier}})\n`
            } break
        }
    }
}

function writeTSInitValueFromGIOP(value_dcl: Node, out: fs.WriteStream, indent: number) {
    for (let i = 1; i < value_dcl.child.length; ++i) {
        let value_element = value_dcl.child[i]!
        if (value_element.type === Type.SYN_STATE_MEMBER) {
            let state_member = value_element
            let type = state_member.child[1]!
            let declarators = state_member.child[2]!
            for (let declarator of declarators.child) {
                let decl_identifier = declarator!.text
                writeIndent(out, indent)
                out.write(`object.${decl_identifier} = ${typeIDLtoGIOPTS(type)}\n`)
            }
        }
    }
}

function writeTSInitValueFromPOJO(value_dcl: Node, out: fs.WriteStream, indent: number) {
    for (let i = 1; i < value_dcl.child.length; ++i) {
        let value_element = value_dcl.child[i]!
        if (value_element.type === Type.SYN_STATE_MEMBER) {
            let state_member = value_element
            let attribute = state_member.child[0]!
            let type = state_member.child[1]!
            let declarators = state_member.child[2]!
            for (let declarator of declarators.child) {
                let decl_identifier = declarator!.text
                writeIndent(out, indent)
                if (type.type === Type.TKN_IDENTIFIER) {
                    // FIXME: doesn't work for Array<Layer>()
                    // FIXME: in this case workflow doesn't require a copy, maybe just copy when the prototypes are wrong or a deep copy flag had been set?
                    //                                out.write(") ? new "+type.text+"() : new "+type.text+"(init."+decl_identifier+")\n")
                    // console.log(`writeTSValueDefinitions`, type, typeIDLtoTS(type))
                    if (type.child[0]?.type == Type.TKN_NATIVE &&
                        type.text!.length > 4 &&
                        type.text!.substring(type.text!.length - 4) === "_ptr") {
                        let name = typeIDLtoTS(type, FileType.VALUE)
                        out.write(`if (init !== undefined && init.${decl_identifier} !== undefined) object.${decl_identifier} = new (ORB.lookupValueType("${name}"))(init.${decl_identifier})\n`)
                    } else
                    if (type.child[0]?.type == Type.TKN_SEQUENCE) {
                        out.write(`object.${decl_identifier} = init?.${decl_identifier} instanceof Array ? init!.${decl_identifier} : []\n`)
                    } else {
                        let name = typeIDLtoTS(type, FileType.VALUE)
                        out.write(`const vt${decl_identifier} = ORB.lookupValueType("${name}")\n`)
                        writeIndent(out, indent)
                        out.write(`object.${decl_identifier} = vt${decl_identifier}.prototype.isPrototypeOf(init?.${decl_identifier}) ? init!.${decl_identifier} : new (vt${decl_identifier})(init?.${decl_identifier})\n`)
                    }
                } else {
                    out.write(`object.${decl_identifier} = (init === undefined || init.${decl_identifier} === undefined) ? `)
                    out.write(defaultValueIDLtoTS(type, FileType.VALUETYPE))
                    out.write(` : init.${decl_identifier}\n`)
                }
            }
        }
    }
}
