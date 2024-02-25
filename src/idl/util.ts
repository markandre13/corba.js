import * as fs from "fs"
import { Type, Node } from "./idl-node"
import { typeIDLtoTS } from "./ts/typeIDLtoTS"
import { Writable } from "stream"

export let filename = ""
export let filenamePrefix = ""
export let filenameLocal = ""

export function setFilename(name: string) {
    filename = name
}

export function setFilenamePrefix(prefix: string) {
    filenamePrefix = prefix
}

export function setFilenameLocal(name: string) {
    filenameLocal = name
}

export let classAttributes = new Map<string, Array<string>>()

export function writeIndent(out: Writable, indent: number) {
    for (let i = 0; i < indent; ++i)
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

export function defaultValueIDLtoTS(type: Node | undefined, filetype: FileType = FileType.NONE): string {
    if (type === undefined)
        throw Error("internal error: parser delivered no type information")
    switch (type!.type) {
        case Type.TKN_IDENTIFIER:
            return "new " + type.text! + "()"
        case Type.TKN_BOOLEAN:
            return "false"
        case Type.TKN_CHAR:
            return "\"\0\""
        case Type.TKN_STRING:
            return "\"\""
        case Type.TKN_OCTET:
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
            throw Error(`no default value from IDL type '${type.toString()}' to default value`)
    }
}

export function hasValueType(specification: Node): boolean {
    for (let definition of specification.child) {
        switch (definition!.type) {
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
