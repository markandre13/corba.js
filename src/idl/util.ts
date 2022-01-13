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
                    if (filetype !== FileType.VALUETYPE && filetype !== FileType.VALUE)
                        name = `valuetype${absolutePrefix}.${relativeName}`
                    else
                        name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                    break
                case Type.SYN_INTERFACE:
                case Type.TKN_ENUM:
                    if (filetype !== FileType.INTERFACE)
                        name = `_interface${absolutePrefix}.${relativeName}`
                    else
                        name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                    break
                case Type.TKN_STRUCT:
                    // FIXME: struct uses a wrong identifier node structure
                    name = type!.text!
                    if (filetype !== FileType.INTERFACE)
                        name = `_interface${absolutePrefix}.${name}`
                    break
                case Type.TKN_NATIVE:
                    name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                    break
                case Type.TKN_SEQUENCE:
                    name = typeIDLtoTS(type.child[0], filetype)
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
        case Type.TKN_CHAR:
        case Type.TKN_STRING:
            return "string"
        case Type.TKN_OCTET:
        case Type.TKN_SHORT:
        case Type.TKN_LONG:
        case Type.SYN_UNSIGNED_SHORT:
        case Type.SYN_UNSIGNED_LONG:
        case Type.TKN_FLOAT:
        case Type.TKN_DOUBLE:
        case Type.SYN_LONG_DOUBLE:
            return "number"
        case Type.SYN_LONGLONG:
        case Type.SYN_UNSIGNED_LONGLONG:
            return "bigint"
        case Type.TKN_SEQUENCE:
            return `Array<${typeIDLtoTS(type!.child[0], filetype)}>`
        default:
            throw Error(`no mapping from IDL type to TS type for ${type.toString()}`)
    }
}

export function typeIDLtoGIOP(type: Node | undefined, arg: string | undefined = undefined): string {
    if (type === undefined)
        throw Error("internal error: parser delivered no type information")
    // console.log(`typeIDLtoGIOP(${type.toString()}, ${arg})`)
    let name: string
    switch (type!.type) {
        case Type.TKN_SEQUENCE:
            return arg === undefined ?
                `decoder.sequence(() => ${typeIDLtoGIOP(type.child[0])})` :
                `encoder.sequence(${arg}, (item) => ${typeIDLtoGIOP(type.child[0], "item")})`
        case Type.TKN_IDENTIFIER:
        case Type.TKN_MODULE:
            return typeIDLtoGIOP(type.child[0], arg)
        case Type.TKN_VALUETYPE:
            return arg === undefined ? `decoder.value("${type.text}")` : `encoder.value(${arg})`
        case Type.SYN_INTERFACE:
        case Type.TKN_STRUCT:
            name = "object"
            break

        case Type.TKN_NATIVE: {
            const id = type!.child[0]!.text!
            if (id.length > 4 && id.substring(id.length - 4) === "_ptr") {
                return arg === undefined ? `decoder.value("${id.substring(0, id.length-4)}")` : `encoder.value(${arg})`
            } else {
                return `undefined`
            }
        } break

        case Type.TKN_VOID:
            name = "void"
            break
        case Type.TKN_BOOLEAN:
            name = "bool"
            break
        case Type.TKN_STRING:
            name = "string"
            break
        case Type.TKN_CHAR:
            name = "char"
            break
        case Type.TKN_OCTET:
            name = "octet"
            break
        case Type.TKN_SHORT:
            name = "short"
            break
        case Type.TKN_LONG:
            name = "long"
            break
        case Type.SYN_LONGLONG:
            name = "longlong"
            break
        case Type.SYN_UNSIGNED_SHORT:
            name = "ushort"
            break
        case Type.SYN_UNSIGNED_LONG:
        case Type.TKN_ENUM:
            name = "ulong"
            break
        case Type.SYN_UNSIGNED_LONGLONG:
            name = "ulonglong"
            break
        case Type.TKN_FLOAT:
            name = "float"
            break
        case Type.TKN_DOUBLE:
            name = "double"
            break
        case Type.SYN_LONG_DOUBLE:
            throw Error("long double is not supported yet")
        default:
            type.printTree()
            throw Error(`no mapping from IDL type '${type.toString()}' to GIOP encoder/decoder`)
    }
    return arg === undefined ? `decoder.${name}()` : `encoder.${name}(${arg})`
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
