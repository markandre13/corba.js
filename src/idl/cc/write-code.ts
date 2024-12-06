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
import { filenamePrefix, filename, filenameLocal, hasValueType, FileType, writeIndent } from "../util"
import { typeIDLtoGIOPCC } from "./typeIDLtoGIOPCC"
import { Direction, typeIDLtoCC } from "./typeIDLtoCC"

export function writeCCCode(specification: Node): void {
    let out = fs.createWriteStream(filenamePrefix + ".cc")
    out.write("// This file is generated by the corba.js IDL compiler from '" + filename + "'.\n\n")
    out.write(`#include <corba/corba.hh>\n`)
    out.write(`#include <corba/orb.hh>\n`)
    out.write(`#include <corba/giop.hh>\n`)
    out.write(`#include <corba/coroutine.hh>\n`)
    out.write(`#include <cstring>\n`)
    // out.write(`#include <vector>\n`)
    // out.write(`#include <span>\n`)
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

                            // _call() -> _<operation> OPERATION

                            //
                            // INCOMING CALL
                            //

                            out.write(`static CORBA::async<>`)
                    
                            out.write(` _${if_identifier}_${identifier}(${if_identifier} *obj, CORBA::GIOPDecoder &decoder, CORBA::GIOPEncoder &encoder) {\n`)
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
                                out.write(`${typeIDLtoGIOPCC(type, undefined, Direction.IN)}`)
                            }
                            
                            out.write(`);\n`)
                            if (type.type !== Type.TKN_VOID) {
                                out.write(`    ${typeIDLtoGIOPCC(type, "result", Direction.OUT)};\n`)
                            } else if (oneway) {
                                out.write(`    co_return;\n`)
                            }
                            out.write(`}\n`)
                                             
                            //
                            // OUTGOING CALL
                            //

                            // let op_dcl = _export!
                            // let attribute = op_dcl.child[0]
                            let returnType = op_dcl.child[1]!

                            // let oneway = false
                            // if (attribute !== undefined && attribute.type === Type.TKN_ONEWAY)
                            //     oneway = true
                            // if (oneway && returnType.type !== Type.TKN_VOID)
                            //     console.log("WARNING: corba.js currently requires every oneway function to return void")

                            // let identifier = op_dcl.child[2]!.text
                            // let parameter_decls = op_dcl.child[3]!.child

                            // out.write("    virtual ")
                            if (oneway) {
                                out.write(`${typeIDLtoCC(returnType, Direction.OUT)}`)
                            } else {
                                out.write(`CORBA::async<${typeIDLtoCC(returnType, Direction.OUT)}>`)
                            }
                            out.write(` ${if_identifier}_stub::${identifier}(`)
                            comma = false
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
                            out.write(`) {\n`)
                            out.write("    ")
                            if (!oneway) {
                                out.write("return ")
                            }
                            if (oneway) {
                                out.write(`get_ORB()->onewayCall(this, "${identifier}", `)
                            } else {
                                if (returnType.type !== Type.TKN_VOID) {
                                    out.write(`get_ORB()->twowayCall<${typeIDLtoCC(returnType, Direction.OUT)}>(this, "${identifier}", `)
                                } else {
                                    out.write(`get_ORB()->twowayCall(this, "${identifier}", `)
                                }
                            }

                            // encode
                            out.write(`[&](CORBA::GIOPEncoder &encoder) {\n`)
                            for (let parameter_dcl of parameter_decls) {
                                let type = parameter_dcl!.child[1]!
                                let identifier = parameter_dcl!.child[2]!.text
                                out.write(`        ${typeIDLtoGIOPCC(type, identifier, Direction.IN)};\n`)
                            }

                            if (oneway) {
                                out.write(`    });\n`)
                            } else {
                                if (returnType.type !== Type.TKN_VOID) {
                                    out.write(`    },\n`)
                                    out.write(`    `)
                                    out.write(`[&](CORBA::GIOPDecoder &decoder) { return ${typeIDLtoGIOPCC(returnType, undefined, Direction.OUT)}; });\n`)
                                } else {
                                    out.write(`    });\n`)
                                }
                            }
                            out.write("}\n")
                        } break
                        case Type.TKN_ATTRIBUTE: {
                            const readonly = _export!.child[0]?.type == Type.TKN_READONLY
                            const param_type_spec = _export!.child[1]!
                            const attr_declarator = _export!.child[2]!
                            for(const n of attr_declarator.child) {
                                const identifier = n!.text
                                // GETTER
                                out.write(`static CORBA::async<> _${if_identifier}_get_${identifier}(${if_identifier} *obj, CORBA::GIOPDecoder &decoder, CORBA::GIOPEncoder &encoder) {\n`)
                                out.write(`    ${typeIDLtoGIOPCC(param_type_spec, `co_await obj->${identifier}()`, Direction.OUT)};\n`)
                                out.write(`    co_return;\n`)
                                out.write(`}\n`)

                                out.write(`CORBA::async<${typeIDLtoCC(param_type_spec, Direction.OUT)}> ${if_identifier}_stub::${identifier}() {\n`)    
                                out.write(`    return get_ORB()->twowayCall<${typeIDLtoCC(param_type_spec, Direction.OUT)}>(\n`)
                                out.write(`        this, "_get_${identifier}",\n`)
                                out.write(`        [&](CORBA::GIOPEncoder &encoder) { },\n`)
                                out.write(`        [&](CORBA::GIOPDecoder &decoder) { return ${typeIDLtoGIOPCC(param_type_spec, undefined, Direction.OUT)}; }\n`)
                                out.write(`    );\n`)
                                out.write(`}\n`)

                                // SETTER
                                if (!readonly) {
                                    out.write(`static CORBA::async<> _${if_identifier}_set_${identifier}(${if_identifier} *obj, CORBA::GIOPDecoder &decoder, CORBA::GIOPEncoder &encoder) {\n`)
                                    out.write(`    return obj->${identifier}(${typeIDLtoGIOPCC(param_type_spec, undefined, Direction.IN)});\n`)
                                    out.write(`}\n`)

                                    out.write(`CORBA::async<void> ${if_identifier}_stub::${identifier}(${typeIDLtoCC(param_type_spec, Direction.IN)} _v) {\n`)
                                    out.write(`    return get_ORB()->twowayCall(\n`)
                                    out.write(`        this, "_set_${identifier}",\n`)
                                    out.write(`        [&](CORBA::GIOPEncoder &encoder) { ${typeIDLtoGIOPCC(param_type_spec, "_v", Direction.IN)}; }\n`)
                                    out.write(`    );\n`)
                                    out.write(`}\n`)
                                }
                            }
                        } break
                        default:
                            throw Error("yikes")
                    }
                }
                out.write(`std::map<std::string_view, std::function<CORBA::async<>(${if_identifier} *obj, CORBA::GIOPDecoder &decoder, CORBA::GIOPEncoder &encoder)>> _op_${if_identifier} = {\n`)
                for (let _export of interface_body.child) {
                    switch (_export!.type) {
                        case Type.SYN_OPERATION_DECLARATION: {
                            const op_dcl = _export!
                            const attribute = op_dcl.child[0]
                            const type = op_dcl.child[1]!
                            let identifier = op_dcl.child[2]!.text
                            out.write(`    {"${identifier}", _${if_identifier}_${identifier}},\n`)
                        } break
                        case Type.TKN_ATTRIBUTE: {
                            const readonly = _export!.child[0]?.type == Type.TKN_READONLY
                            const param_type_spec = _export!.child[1]!
                            const attr_declarator = _export!.child[2]!
                            for(const n of attr_declarator.child) {
                                const identifier = n!.text
                                if (!readonly) {
                                    out.write(`    {"_set_${identifier}", _${if_identifier}_set_${identifier}},\n`)
                                }
                                out.write(`    {"_get_${identifier}", _${if_identifier}_get_${identifier}},\n`)
                            }
                        } break
                        default:
                            throw Error("yikes")
                    }
                }
                out.write("};\n")

                out.write(`CORBA::async<> ${if_identifier}_skel::_call(const std::string_view &operation, CORBA::GIOPDecoder &decoder, CORBA::GIOPEncoder &encoder) {\n`)
                out.write(`    auto it = _op_${if_identifier}.find(operation);\n`)
                out.write(`    if (it == _op_${if_identifier}.end()) {\n`)
                out.write(`        throw CORBA::BAD_OPERATION(0, CORBA::YES);\n`)
                out.write(`    }\n`)
                out.write(`    co_await it->second(this, decoder, encoder);\n`)
                out.write("};\n\n")

                out.write(`std::string_view ${if_identifier}::_rid("IDL:${if_identifier}:1.0");\n`)
                out.write(`std::string_view ${if_identifier}::repository_id() const { return _rid;}\n\n`)

                out.write(`std::shared_ptr<${if_identifier}> ${if_identifier}::_narrow(std::shared_ptr<CORBA::Object> pointer) {\n`)
                out.write(`    auto ptr = pointer.get();\n`)
                out.write(`    auto ref = dynamic_cast<CORBA::IOR *>(ptr);\n`)
                out.write(`    if (ref) {\n`)
                out.write(`        if (ref->repository_id() != "IDL:${if_identifier}:1.0") {\n`)
                out.write(`            return std::shared_ptr<${if_identifier}>();\n`)
                out.write(`        }\n`)
                out.write(`        std::shared_ptr<CORBA::ORB> orb = ref->get_ORB();\n`)
                out.write(`        auto conn = orb->getConnection(ref->host, ref->port);\n`)
                out.write(`        auto stub = std::make_shared<${if_identifier}_stub>(orb, CORBA::blob_view(ref->objectKey), conn);\n`)
                out.write(`        return std::dynamic_pointer_cast<${if_identifier}>(stub);\n`)
                out.write(`    }\n`)
                out.write(`    auto obj = dynamic_cast<${if_identifier}*>(ptr);\n`)
                out.write(`    if (obj) {\n`)
                out.write(`        return std::dynamic_pointer_cast<${if_identifier}>(pointer);\n`)
                out.write(`    }\n`)
                out.write(`    return std::shared_ptr<${if_identifier}>();\n`)
                out.write(`}\n\n`)
            } break
            case Type.TKN_STRUCT: {
                let struct_type = definition!
                let identifier = struct_type.text
                // TODO: these utility messages belong into the .cc file
                out.write(`static ${identifier} _decode${identifier}(CORBA::GIOPDecoder &decoder) {\n`)
                out.write(`    return {\n`)
                for (let i = 0; i < struct_type.child.length; ++i) {
                    const member = struct_type.child[i]!
                    if (member.type === Type.SYN_MEMBER) {
                        let type = member.child[0]!
                        let declarators = member.child[1]!
                        for (let declarator of declarators.child) {
                            writeIndent(out, indent + 2)
                            out.write("." + declarator!.text + " = " + typeIDLtoGIOPCC(type, undefined, Direction.OUT) + ",\n")
                        }
                    }
                }
                out.write(`    };\n`)
                out.write(`}\n`)
                out.write(`static void _encode${identifier}(CORBA::GIOPEncoder &encoder, const ${identifier} &obj) {\n`)
                for (let i = 0; i < struct_type.child.length; ++i) {
                    const member = struct_type.child[i]!
                    if (member.type === Type.SYN_MEMBER) {
                        let type = member.child[0]!
                        let declarators = member.child[1]!
                        for (let declarator of declarators.child) {
                            writeIndent(out, indent + 1)
                            out.write(typeIDLtoGIOPCC(type, `obj.${declarator!.text}`, Direction.OUT) + ";\n")
                        }
                    }
                }
                out.write(`}\n`)
            }
        }
    }
}
