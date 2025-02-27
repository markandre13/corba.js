/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2020, 2021, 2024 Mark-André Hopf <mhopf@mark13.org>
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
import { filenamePrefix, filename, filenameLocal, hasValueType, FileType } from "../util"
import { typeIDLtoGIOPCC } from "./typeIDLtoGIOPCC"
import { Direction, typeIDLtoCC } from "./typeIDLtoCC"

export function writeCCStub(specification: Node): void {
    let out = fs.createWriteStream(filenamePrefix + "_stub.hh")
    out.write("// This file is generated by the corba.js IDL compiler from '" + filename + "'.\n\n")
    out.write(`#pragma once\n`)
    out.write(`#include <corba/corba.hh>\n`)
    out.write(`#include <corba/orb.hh>\n`)
    out.write(`#include <corba/giop.hh>\n`)
    out.write(`#include <corba/coroutine.hh>\n`)
    out.write(`#include <vector>\n`)
    if (hasValueType(specification)) {
        out.write("import * as valuetype from \"./" + filenameLocal + "_valuetype\"\n")
    }
    out.write(`#include "${filenameLocal}.hh"\n\n`)

    writeCCStubDefinitions(out, specification)
}
function writeCCStubDefinitions(out: fs.WriteStream, specification: Node, prefix = "", indent = 0): void {
    for (let definition of specification.child) {
        switch (definition!.type) {
            case Type.TKN_MODULE:
                out.write("namespace " + definition!.text + " {\n\n")
                writeCCStubDefinitions(out, definition!, prefix + definition!.text + ".", indent + 1)
                out.write("} // namespace " + definition!.text + "\n\n")
                break

            case Type.SYN_INTERFACE: {
                let interface_dcl = definition!
                let identifier = interface_dcl.child[0]!.child[1]!.text
                let interface_body = interface_dcl.child[1]!

                out.write(`class ${identifier}_stub: public ${prefix}${identifier}, public CORBA::Stub {\n`)
                out.write(`public:\n`)
                out.write(`    ${identifier}_stub(std::shared_ptr<CORBA::ORB> orb, CORBA::blob_view objectKey, std::shared_ptr<CORBA::detail::Connection> connection): Stub(orb, objectKey, connection) {}\n`)

                for (let _export of interface_body.child) {
                    switch (_export!.type) {
                        case Type.SYN_OPERATION_DECLARATION: {
                            let op_dcl = _export!
                            let attribute = op_dcl.child[0]
                            let returnType = op_dcl.child[1]!

                            let oneway = false
                            if (attribute !== undefined && attribute.type === Type.TKN_ONEWAY)
                                oneway = true
                            if (oneway && returnType.type !== Type.TKN_VOID)
                                console.log("WARNING: corba.js currently requires every oneway function to return void")

                            let identifier = op_dcl.child[2]!.text
                            let parameter_decls = op_dcl.child[3]!.child

                            out.write("    virtual ")
                            if (oneway) {
                                out.write(`${typeIDLtoCC(returnType, Direction.OUT)}`)
                            } else {
                                out.write(`CORBA::async<${typeIDLtoCC(returnType, Direction.OUT)}>`)
                            }
                            out.write(` ${identifier}(`)
                            let comma = false
                            for (let parameter_dcl of parameter_decls) {
                                let attribute = parameter_dcl!.child[0]!.type
                                let type = parameter_dcl!.child[1]
                                let identifier = parameter_dcl!.child[2]!.text
                                // TODO: move this check into the parser or attach file, row & col to the parse tree nodes
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
                            out.write(`) override;\n`)
                        } break
                        case Type.TKN_ATTRIBUTE: {
                            const readonly = _export!.child[0]?.type == Type.TKN_READONLY
                            const param_type_spec = _export!.child[1]!
                            const attr_declarator = _export!.child[2]!
                            for(const n of attr_declarator.child) {
                                const identifier = n!.text
                                out.write(`    virtual CORBA::async<${typeIDLtoCC(param_type_spec, Direction.OUT)}> ${identifier}() override;\n`)
                                if (!readonly) {
                                    out.write(`    virtual CORBA::async<void> ${identifier}(${typeIDLtoCC(param_type_spec, Direction.IN)}) override;\n`)
                                }
                            }
                        } break
                        default:
                            throw Error("yikes")
                    }
                }
                out.write("};\n\n")
            } break
        }
    }
}
