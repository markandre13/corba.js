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
import { filenamePrefix, filename, filenameLocal, hasValueType, FileType, typeIDLtoGIOP } from "../util"
import { typeIDLtoCC } from "./typeIDLtoCC"

export function writeCCCode(specification: Node): void {
    let out = fs.createWriteStream(filenamePrefix + ".cc")
    out.write("// This file is generated by the corba.js IDL compiler from '" + filename + "'.\n\n")
    out.write(`#include "../src/corba/corba.hh"\n`)
    out.write(`#include "../src/corba/orb.hh"\n`)
    out.write(`#include "../src/corba/giop.hh"\n`)
    out.write(`#include "../src/corba/coroutine.hh"\n`)
    out.write(`#include <cstring>`)
    out.write(`#include <vector>\n`)
    out.write(`#include <map>\n`)
    out.write(`#include <functional>\n`)
    if (hasValueType(specification)) {
        out.write(`import * as valuetype from \"./${filenameLocal}_valuetype\"\n`)
    }
    out.write(`#include "${filenameLocal}.hh"\n`)
    out.write(`#include "${filenameLocal}_skel.hh"\n`)
    out.write(`#include "${filenameLocal}_stub.hh"\n\n`)
    writeCCCodeDefinitions(out, specification)
}

function writeCCCodeDefinitions(out: fs.WriteStream, specification: Node, prefix = "", indent = 0): void {
    for (let definition of specification.child) {
        switch (definition!.type) {
            case Type.TKN_MODULE:
                out.write(`namespace ${definition!.text}{\n\n`)
                writeCCCodeDefinitions(out, definition!, prefix + definition!.text + ".", indent + 1)
                out.write(`} // namespace ${definition!.text}\n\n`)
                break
            case Type.SYN_INTERFACE: {
                const interface_dcl = definition!
                const if_identifier = interface_dcl.child[0]!.child[1]!.text
                const interface_body = interface_dcl.child[1]!

                for (let _export of interface_body.child) {
                    switch (_export!.type) {
                        case Type.SYN_OPERATION_DECLARATION: {
                            const op_dcl = _export!
                            const attribute = op_dcl.child[0]
                            const type = op_dcl.child[1]!

                            let oneway = false
                            if (attribute !== undefined && attribute.type === Type.TKN_ONEWAY) {
                                oneway = true
                            }
                            if (oneway && type.type !== Type.TKN_VOID) {
                                throw Error("oneway methods must return void")
                            }

                            let identifier = op_dcl.child[2]!.text
                            let parameter_decls = op_dcl.child[3]!.child
                            out.write(`static `)
                            if (oneway) {
                                out.write(`void`);
                            } else {
                                out.write(`CORBA::task<>`)
                            }
                            out.write(` _${identifier}(${if_identifier} *obj, CORBA::GIOPDecoder &decoder, CORBA::GIOPEncoder &encoder) {\n`)
                            switch(type.type) {
                                case Type.TKN_VOID:
                                    if (oneway) {
                                        out.write(`    obj->${identifier}(`)
                                    } else {
                                        out.write(`    co_await obj->${identifier}(`)
                                    }
                                    break
                                default:
                                    out.write(`    auto result = co_await obj->${identifier}(`)
                            }    

                            let comma = false
                            for (let parameter_dcl of parameter_decls) {
                                let attribute = parameter_dcl!.child[0]!.type
                                let type = parameter_dcl!.child[1]!
                                if (attribute !== Type.TKN_IN) {
                                    throw Error("corba.js currently only supports 'in' parameters")
                                }
                                if (!comma) {
                                    comma = true
                                } else {
                                    out.write(", ")
                                }
                                out.write(`${typeIDLtoGIOP(type)}`)
                            }
                            
                            out.write(`);\n`)
                            if (type.type !== Type.TKN_VOID) {
                                out.write(`    ${typeIDLtoGIOP(type, "result")};\n`)
                            }
                            out.write(`}\n`)
                            
                        } break
                        case Type.TKN_ATTRIBUTE: {
                        } break
                        default:
                            throw Error("yikes")
                    }
                }
                out.write(`std::map<std::string, std::function<CORBA::task<>(${if_identifier} *obj, CORBA::GIOPDecoder &decoder, CORBA::GIOPEncoder &encoder)>> _operations = {\n`)
                for (let _export of interface_body.child) {
                    switch (_export!.type) {
                        case Type.SYN_OPERATION_DECLARATION: {
                            const op_dcl = _export!
                            const attribute = op_dcl.child[0]
                            const type = op_dcl.child[1]!
                            let identifier = op_dcl.child[2]!.text
                            out.write(`    {"${identifier}", _${identifier}},\n`)
                        } break
                        case Type.TKN_ATTRIBUTE: {
                        } break
                        default:
                            throw Error("yikes")
                    }
                }
                out.write("};\n")

                out.write(`CORBA::task<> ${if_identifier}_skel::_call(const std::string &operation, CORBA::GIOPDecoder &decoder, CORBA::GIOPEncoder &encoder) {\n`)
                out.write(`    auto it = _operations.find(operation);\n`)
                out.write(`    if (it == _operations.end()) {\n`)
                out.write(`        throw CORBA::BAD_OPERATION(0, CORBA::YES);\n`)
                out.write(`    }\n`)
                out.write(`    co_await it->second(this, decoder, encoder);\n`)
                out.write("};\n\n")

                out.write(`std::shared_ptr<${if_identifier}> ${if_identifier}::_narrow(std::shared_ptr<CORBA::Object> pointer) {\n`)
                out.write(`    auto ptr = pointer.get();\n`)
                out.write(`    auto ref = dynamic_cast<CORBA::ObjectReference *>(ptr);\n`)
                out.write(`    if (ref) {\n`)
                out.write(`        if (std::strcmp(ref->repository_id(), "IDL:${if_identifier}:1.0") != 0) {\n`)
                out.write(`            return std::shared_ptr<${if_identifier}>();\n`)
                out.write(`        }\n`)
                out.write(`        CORBA::ORB *orb = ref->get_ORB();\n`)
                out.write(`        CORBA::detail::Connection *conn = orb->getConnection(ref->host, ref->port);\n`)
                out.write(`        auto stub = std::make_shared<${if_identifier}_stub>(orb, ref->objectKey, conn);\n`)
                out.write(`        return std::dynamic_pointer_cast<${if_identifier}>(stub);\n`)
                out.write(`    }\n`)
                out.write(`    auto obj = dynamic_cast<${if_identifier}*>(ptr);\n`)
                out.write(`    if (obj) {\n`)
                out.write(`        return std::dynamic_pointer_cast<${if_identifier}>(pointer);\n`)
                out.write(`    }\n`)
                out.write(`    return std::shared_ptr<${if_identifier}>();\n`)
                out.write(`}\n\n`)
            } break
        }
    }
}
