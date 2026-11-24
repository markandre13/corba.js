import * as fs from "fs"
import { Type, Specification, ModuleDecl, Declaration, ScopedName, TypeSpec } from "./idl-node"
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

// copies a documentation comment from the IDL as a /** */ block, which doxygen and JSDoc both read
export function writeDoc(out: Writable, doc: string[] | undefined, indent: number) {
    if (doc === undefined || doc.length === 0)
        return
    writeIndent(out, indent)
    out.write("/**\n")
    for (const line of doc) {
        writeIndent(out, indent)
        out.write(line === "" ? " *\n" : ` * ${line.replace(/\*\//g, "*\\/")}\n`)
    }
    writeIndent(out, indent)
    out.write(" */\n")
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

// The generators refer to a scoped name by the first name component, e.g. 'M' for 'M::Foo'.
// This is what the old parse tree stored as the text of the identifier.
// The name as written in the IDL, e.g. 'M.I' for 'M::I'
export function writtenName(name: ScopedName): string {
    return [...name.path.map(module => module.name), name.name].join(".")
}

// The declaration a name finally refers to, following typedef chains
export function resolvedTarget(name: ScopedName): Declaration {
    let target: Declaration = name.target
    while (target.type === Type.SYN_SCOPED_NAME)
        target = target.target
    return target
}

// types that map to a plain TypeScript value, not to a valuetype or interface
export const predefinedTypes: Type[] = [
    Type.TKN_FLOAT, Type.TKN_DOUBLE, Type.SYN_LONG_DOUBLE,
    Type.TKN_SHORT, Type.TKN_LONG, Type.SYN_LONGLONG,
    Type.SYN_UNSIGNED_SHORT, Type.SYN_UNSIGNED_LONG, Type.SYN_UNSIGNED_LONGLONG,
    Type.TKN_CHAR, Type.TKN_WCHAR, Type.TKN_BOOLEAN, Type.TKN_OCTET, Type.TKN_ANY,
    Type.TKN_STRING, Type.TKN_WSTRING
]

export function isPointerName(name: string): boolean {
    return name.length > 4 && name.substring(name.length - 4) === "_ptr"
}

// '.A.B' for the module chain from scope outwards, '' for the global scope
export function scopePrefix(scope: ModuleDecl | undefined): string {
    let prefix = ""
    for (let x: ModuleDecl | undefined = scope; x; x = x.parent)
        prefix = `.${x.name}${prefix}`
    return prefix
}

export function defaultValueIDLtoTS(type: TypeSpec | undefined, filetype: FileType = FileType.NONE): string {
    if (type === undefined)
        throw Error("internal error: parser delivered no type information")
    switch (type.type) {
        case Type.SYN_SCOPED_NAME:
            switch (type.target.type) {
                case Type.TKN_VALUETYPE:
                case Type.SYN_INTERFACE:
                case Type.TKN_STRUCT:
                case Type.TKN_UNION:
                case Type.TKN_ENUM:
                case Type.TKN_NATIVE:
                case Type.TKN_EXCEPTION:
                case Type.TKN_MODULE:
                    return "new " + writtenName(type) + "()"
                default:
                    return defaultValueIDLtoTS(type.target, filetype)
            }
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
            return `new Array<${typeIDLtoTS(type.elementType, filetype)}>()`
        default:
            throw Error(`no default value from IDL type '${Type[type.type]}' to default value`)
    }
}

export function hasValueType(scope: Specification | ModuleDecl): boolean {
    for (let definition of scope.definitions) {
        switch (definition.type) {
            case Type.TKN_VALUETYPE:
                return true
            case Type.TKN_MODULE:
                if (hasValueType(definition))
                    return true

        }
    }
    return false
}

export function hasNative(specification: Specification): boolean {
    for (let definition of specification.definitions) {
        if (definition.type === Type.TKN_NATIVE) {
            if (!isPointerName(definition.name))
                return true
        }
    }
    return false
}
