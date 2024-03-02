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
import { filenamePrefix, filename, filenameLocal, hasValueType } from "../util"

export function writeCCSkeleton(specification: Node): void {
    let out = fs.createWriteStream(filenamePrefix + "_skel.hh")
    out.write("// This file is generated by the corba.js IDL compiler from '" + filename + "'.\n\n")
    out.write(`#pragma once\n`)
    out.write(`#include <corba/corba.hh>\n`)
    out.write(`#include <corba/orb.hh>\n`)
    out.write(`#include <corba/giop.hh>\n`)
    out.write(`#include <corba/coroutine.hh>\n`)
    out.write(`#include <vector>\n`)
    if (hasValueType(specification)) {
        out.write(`import * as valuetype from \"./${filenameLocal}_valuetype\"\n`)
    }
    out.write(`#include "${filenameLocal}.hh"\n\n`)
    writeCCSkeletonDefinitions(out, specification)
}

function writeCCSkeletonDefinitions(out: fs.WriteStream, specification: Node, prefix = "", indent = 0): void {
    for (let definition of specification.child) {
        switch (definition!.type) {
            case Type.TKN_MODULE:
                out.write(`namespace ${definition!.text}{\n\n`)
                writeCCSkeletonDefinitions(out, definition!, prefix + definition!.text + ".", indent + 1)
                out.write(`} // namespace ${definition!.text}\n\n`)
                break
            case Type.SYN_INTERFACE: {
                let interface_dcl = definition!
                let identifier = interface_dcl.child[0]!.child[1]!.text
                let interface_body = interface_dcl.child[1]!

                out.write(`class ${identifier}_skel: public CORBA::Skeleton, public ${prefix}${identifier} {\n`)
                out.write(`public:\n`)
                out.write(`    ${identifier}_skel(CORBA::ORB *orb) : Skeleton(orb) {}\n`)
                out.write(`private:\n`)
                out.write(`    CORBA::async<> _call(const std::string_view &operation, CORBA::GIOPDecoder &decoder, CORBA::GIOPEncoder &encoder) override;\n`)
                out.write("};\n\n")
            } break
        }
    }
}
