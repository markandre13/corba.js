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
import { writeTSInterface } from "./write-interface"
import { writeTSSkeleton } from "./write-skeleton"
import { writeTSStub } from "./write-stub"
import { writeTSValue } from "./write-value"
import { writeTSValueType } from "./write-valuetype"
import { writeTSValueImpl } from "./write-valueimpl"

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

export let filename = ""
export let filenamePrefix = ""
export let filenameLocal = ""

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

export let classAttributes = new Map<string, Array<string>>()

export function writeIndent(out: fs.WriteStream, indent: number) {
    for(let i=0; i<indent; ++i)
        out.write("    ")
}

export enum FileType {
    NONE,
    VALUE,
    VALUETYPE,
    VALUEIMPL,
    INTERFACE,
    SKELETON,
    STUB
}

export function typeIDLtoTS(type: Node | undefined, filetype: FileType = FileType.NONE): string {
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

export function defaultValueIDLtoTS(type: Node | undefined, filetype: FileType = FileType.NONE): string {
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

export function hasValueType(specification: Node): boolean {
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

export function hasNative(specification: Node): boolean {
    for (let definition of specification.child) {
        if (definition!.type === Type.TKN_NATIVE) {
            let native = definition!
            let nativeName = native.text!
            if (nativeName.length <= 4 ||
                nativeName.substring(nativeName.length - 4) !== "_ptr") {
                return true
            }
        }
    }
    return false
}
