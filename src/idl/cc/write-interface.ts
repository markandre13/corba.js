/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2020, 2024 Mark-André Hopf <mhopf@mark13.org>
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
import { Writable } from "stream"
import { Type, Node } from "../idl-node"
import { filenamePrefix, filename, filenameLocal, hasValueType, FileType, writeIndent } from "../util"
import { typeIDLtoGIOPCC } from "./typeIDLtoGIOPCC"
import { Direction, typeIDLtoCC } from "./typeIDLtoCC"

export function writeCCInterface(specification: Node): void {
    let out = fs.createWriteStream(filenamePrefix + ".hh")
    out.write("// This file is generated by the corba.js IDL compiler from '" + filename + "'.\n\n")
    out.write(`#pragma once\n`)
    out.write(`#include <corba/orb.hh>\n`)
    out.write(`#include <corba/giop.hh>\n`)
    out.write(`#include <corba/coroutine.hh>\n`)
    out.write(`#include <corba/corba.hh>\n`)
    out.write(`#include <string>\n`)
    out.write(`#include <vector>\n`)
    out.write(`#include <span>\n`)
    out.write(`#include <utility>\n`)
    if (hasValueType(specification)) {
        out.write("import * as valuetype from \"./" + filenameLocal + "_valuetype\"\n")
    }
    out.write(`\n`)
    writeCCInterfaceDefinitions(out, specification)
}

export function writeCCInterfaceDefinitions(out: Writable, specification: Node, prefix = "", indent = 0): void {
    for (let definition of specification.child) {
        switch (definition!.type) {
            case Type.TKN_MODULE:
                out.write("namespace " + definition!.text + " {\n\n")
                writeCCInterfaceDefinitions(out, definition!, prefix + definition!.text + ".", indent + 1)
                out.write("} // namespace " + definition!.text + "\n\n")
                break

            case Type.SYN_INTERFACE: {
                let interface_dcl = definition!
                let identifier = interface_dcl.child[0]!.child[1]!.text
                let interface_body = interface_dcl.child[1]!

                out.write(`class ${identifier}: public virtual CORBA::Object {\n`)
                out.write(`    static std::string_view _rid;\n`);
                out.write(`public:\n`)
                for (let _export of interface_body.child) {
                    switch (_export!.type) {
                        case Type.SYN_OPERATION_DECLARATION: {
                            let op_dcl = _export!
                            let attribute = op_dcl.child[0]
                            let type = op_dcl.child[1]!

                            let oneway = false
                            if (attribute !== undefined && attribute.type === Type.TKN_ONEWAY)
                                oneway = true
                            if (oneway && type.type !== Type.TKN_VOID)
                                throw Error("oneway methods must return void")

                            let identifier = op_dcl.child[2]!.text
                            let parameter_decls = op_dcl.child[3]!.child
                            out.write("    virtual ")
                            if (oneway) {
                                out.write(`${typeIDLtoCC(type, Direction.OUT)}`)
                            } else {
                                out.write(`CORBA::async<${typeIDLtoCC(type, Direction.OUT)}>`)
                            }
                            out.write(` ${identifier}(`)
                            let comma = false
                            for (let parameter_dcl of parameter_decls) {
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
                                out.write(`${typeIDLtoCC(type, Direction.IN)} ${identifier}`)
                            }
                            out.write(`) = 0;\n`)
                        } break
                        case Type.TKN_ATTRIBUTE: {
                            const param_type_spec = _export!.child[1]!
                            const attr_declarator = _export!.child[2]!
                            for(const n of attr_declarator.child) {
                                const identifier = n!.text
                                out.write(`    virtual CORBA::async<${typeIDLtoCC(param_type_spec, Direction.OUT)}> ${identifier}() = 0;\n`)
                                out.write(`    virtual CORBA::async<void> ${identifier}(${typeIDLtoCC(param_type_spec, Direction.IN)}) = 0;\n`)
                            }
                        } break
                        default:
                            throw Error("yikes")
                    }
                }
                out.write(`    std::string_view repository_id() const override;\n`)
                out.write(`    static CORBA::async<std::shared_ptr<${identifier}>> _narrow(std::shared_ptr<CORBA::Object> pointer);\n`)
                out.write("};\n\n")
            } break

            case Type.TKN_STRUCT: {
                let struct_type = definition!
                // let value_header = value_dcl.child[0]!
                // let custom = value_header.child[0]
                let identifier = struct_type.text
                // const member_list = struct_type.child[0]!.child[1]!.child!

                writeIndent(out, indent)
                out.write(`struct ${identifier} {\n`)
                // console.log(struct_type.printTree())

                for (let i = 0; i < struct_type.child.length; ++i) {
                    const member = struct_type.child[i]!
                    if (member.type === Type.SYN_MEMBER) {
                        let type = member.child[0]!
                        let declarators = member.child[1]!
                        for (let declarator of declarators.child) {
                            writeIndent(out, indent + 1)
                            out.write(
                                typeIDLtoCC(type, Direction.IN) + " " + declarator!.text + ";\n"
                            )
                            // attributes.push(declarator!.text!)
                        }
                    }
                }
                writeIndent(out, indent)
                out.write("};\n")
            } break

            case Type.TKN_UNION: {
                const identifier = definition!.text!
                const union_type = definition!
                const switch_body = union_type.child[1]!
                let composite = ""
                switch_body.child.forEach( x => {
                    // console.log(x)
                    const case_label = x!.child[0]!
                    const type_spec = x!.child[1]!
                    const declarator = x!.child[2]!
                    writeIndent(out, indent)
                    out.write(`export type _${identifier}_${declarator.text} = {\n`)
                    writeIndent(out, indent+1)
                    out.write(`type: ${case_label.typeParent!.text}.${case_label.text}\n`)
                    writeIndent(out, indent+1)
                    out.write(`${declarator.text}: ${typeIDLtoCC(type_spec, Direction.IN)}\n`)
                    writeIndent(out, indent)
                    out.write(`}\n`)
                    if (composite.length !== 0)
                        composite = `${composite} | `
                    composite = `${composite}_${identifier}_${declarator.text}`
                })

                writeIndent(out, indent)
                out.write(`export type ${identifier} = ${composite}\n`)

                writeIndent(out, indent)
                out.write(`export function decode${identifier}(decoder: GIOPDecoder): ${identifier} {\n`)
                writeIndent(out, indent+1)
                out.write(`switch(decoder.ulong() as ${union_type.child[0]!.text}) {\n`) // FIXME: ulong is only valid for enums
                switch_body.child.forEach( x => {
                    const case_label = x!.child[0]!
                    const type_spec = x!.child[1]!
                    const declarator = x!.child[2]!
                    writeIndent(out, indent+2)
                    out.write(`case ${case_label.typeParent!.text}.${case_label.text}: return {\n`)
                    writeIndent(out, indent+3)
                    out.write(`type: ${case_label.typeParent!.text}.${case_label.text},\n`)
                    writeIndent(out, indent+3)
                    out.write(`${declarator.text}: ${typeIDLtoGIOPCC(type_spec, undefined, Direction.OUT)}\n`)
                    writeIndent(out, indent+2)
                    out.write(`}\n`)
                })
                writeIndent(out, indent+1)
                out.write(`}\n`)
                writeIndent(out, indent+1)
                out.write(`throw Error("invalid union value")\n`)
                writeIndent(out, indent)
                out.write(`}\n`)

                writeIndent(out, indent)
                out.write(`export function encode${identifier}(encoder: GIOPEncoder, obj: ${identifier}) {\n`)
                writeIndent(out, indent+1)
                out.write(`encoder.ulong(obj.type)\n`) // FIXME: ulong is only valid for enums
                writeIndent(out, indent+1)
                out.write(`switch(obj.type) {\n`)
                switch_body.child.forEach( x => {
                    const case_label = x!.child[0]!
                    const type_spec = x!.child[1]!
                    const declarator = x!.child[2]!
                    writeIndent(out, indent+2)
                    out.write(`case ${case_label.typeParent!.text}.${case_label.text}:\n`)
                    writeIndent(out, indent+3)
                    out.write(typeIDLtoGIOPCC(type_spec, `obj.${declarator!.text}`, Direction.OUT) + "\n")
                    writeIndent(out, indent+3)
                    out.write(`break\n`)
                })
                writeIndent(out, indent+1)
                out.write(`}\n`)
                out.write(`}\n\n`)
            } break

            case Type.TKN_ENUM: {
                const identifier = definition!.text!
                writeIndent(out, indent)
                out.write(`enum class ${identifier} {\n`)
                for (const enumerator of definition!.child) {
                    writeIndent(out, indent + 1)
                    out.write(`${enumerator!.text},\n`)
                }
                writeIndent(out, indent)
                out.write("};\n\n")
            } break
        }
    }
}
