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
import { filenamePrefix, filename, filenameLocal, hasNative, hasValueType, writeIndent, typeIDLtoTS, FileType } from "./util"

export function writeTSValueImpl(specification: Node): void {
    let out = fs.createWriteStream(filenamePrefix + "_valueimpl.ts")
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
        for (let definition of specification.child) {
            switch (definition!.type) {
                case Type.TKN_NATIVE: {
                    let native = definition!
                    let nativeName = native.text!
                    if (nativeName.length <= 4 ||
                        nativeName.substring(nativeName.length - 4) !== "_ptr") {
                        out.write("    interface " + nativeName + " {}\n")
                    }
                } break
            }
        }
        out.write("}\n\n")
    }

    writeTSValueImplDefinitions(out, specification)
}
function hasOperationDeclarations(value_dcl: Node): boolean {
    for (let i = 1; i < value_dcl.child.length; ++i) {
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
function writeTSValueImplDefinitions(out: fs.WriteStream, specification: Node, prefix = "", indent = 0) {
    for (let definition of specification.child) {
        switch (definition!.type) {
            case Type.TKN_MODULE: {
                out.write("export namespace " + definition!.text + " {\n\n")
                writeTSValueImplDefinitions(out, definition!, prefix + definition!.text + ".", indent + 1)
                out.write("} // namespace " + definition!.text + "\n\n")
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

                else if (inheritance_spec !== undefined) { // FIXME: this works only over one inheritance level, make it recursive
                    if (inheritance_spec.child[1]!.child[0]!.type === Type.TKN_VALUETYPE) {
                        let value_dcl = inheritance_spec.child[1]!.child[0]!
                        if (hasOperationDeclarations(value_dcl))
                            out.write("abstract ")
                    }
                }
                out.write("class " + identifier)
                if (inheritance_spec !== undefined) {
                    if (inheritance_spec.child.length > 2)
                        throw Error("multiple inheritance is not supported for TypeScript")
                    out.write(" extends " + inheritance_spec.child[1]!.text)
                }
                out.write(` implements valuetype.${prefix}${identifier} {\n`)

                for (let i = 1; i < value_dcl.child.length; ++i) {
                    let value_element = value_dcl.child[i]!
                    if (value_element.type === Type.SYN_STATE_MEMBER) {
                        let state_member = value_element
                        let attribute = state_member.child[0]!
                        let type = state_member.child[1]!
                        let declarators = state_member.child[2]!
                        for (let declarator of declarators.child) {
                            writeIndent(out, indent + 1)
                            out.write(declarator!.text + "!: " + typeIDLtoTS(type, FileType.VALUETYPE) + "\n")
                        }
                    }
                }

                out.write("\n")
                writeIndent(out, indent + 1)
                out.write(`constructor(init?: Partial<value.${prefix}${identifier}>) {\n`)
                if (inheritance_spec) {
                    writeIndent(out, indent + 2)
                    out.write("super(init)\n")
                }
                writeIndent(out, indent + 2)
                out.write(`value.${prefix}init${identifier}(this, init)\n`)
                writeIndent(out, indent + 1)
                out.write("}\n")

                for (let i = 1; i < value_dcl.child.length; ++i) {
                    let value_element = value_dcl.child[i]!
                    if (value_element.type === Type.SYN_OPERATION_DECLARATION) {
                        let op_decl = value_element
                        let attribute = op_decl!.child[0]
                        let type = op_decl!.child[1]!
                        let op_identifier = op_decl!.child[2]!.text
                        let parameter_decls = op_decl!.child[3]!.child
                        writeIndent(out, indent + 1)
                        out.write("abstract ")
                        out.write(op_identifier + "(")
                        let comma = false
                        for (let parameter_dcl of parameter_decls) {
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
