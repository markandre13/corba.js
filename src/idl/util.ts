import * as fs from "fs"
import { Type, Node } from "./idl-node"

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

export function writeIndent(out: fs.WriteStream, indent: number) {
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

export function typeIDLtoTS(type: Node | undefined, filetype: FileType = FileType.NONE): string {
    if (type === undefined)
        throw Error("internal error: parser delivered no type information")
    switch (type!.type) {
        case Type.TKN_IDENTIFIER: {

            let identifierType = type.child[type.child.length - 1]!
            let relativeName = ""
            for (let x of type.child) {
                relativeName = `${relativeName}.${x!.text!}`
            }
            relativeName = relativeName.substring(1)

            let absolutePrefix = ""
            for (let x: Node | undefined = type.child[0]?.typeParent; x; x = x.typeParent) {
                absolutePrefix = `.${x!.text}${absolutePrefix}`
            }

            if (type.child.length > 0 &&
                type.child[0]!.type === Type.TKN_NATIVE &&
                type.text!.length > 4 &&
                type.text!.substring(type.text!.length - 4) === "_ptr") {
                return `${absolutePrefix.substring(1)} | undefined`
            }

            let name: string
            switch (identifierType.type) {
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
                case Type.TKN_STRUCT:
                    // FIXME: struct uses a wrong identifier node structure
                    name = type!.text!
                    if (filetype !== FileType.INTERFACE)
                        name = `_interface${absolutePrefix}.${name}`
                    break
                case Type.TKN_NATIVE:
                    name = relativeName
                    break
                default:
                    throw Error(`Internal Error in typeIDLtoTS(): type ${identifierType.toString()} is not implemented`)
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
    switch (type!.type) {
        case Type.TKN_IDENTIFIER:
            return "new " + type.text! + "()"
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
