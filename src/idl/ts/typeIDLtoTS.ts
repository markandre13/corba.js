import { Type, Definition, TypeSpec } from "../idl-node"
import { FileType, firstName, firstNode, isPointerName, scopePrefix } from "../util"

// a type, or a declaration reached through a scoped name
export type TypeNode = TypeSpec | Definition

export function typeIDLtoTS(type: TypeNode | undefined, filetype: FileType = FileType.NONE): string {
    if (type === undefined)
        throw Error("internal error: parser delivered no type information")
    switch (type.type) {
        case Type.SYN_SCOPED_NAME: {
            const target = type.target
            const relativeName = [...type.path.map(module => module.name), "name" in target ? target.name : undefined].join(".")

            if (target.type === Type.TKN_NATIVE &&
                type.path.length === 0 &&
                isPointerName(type.name)) {
                const ptrTarget = target.ptrTarget
                const absoluteName = ptrTarget === undefined ? "" : `${scopePrefix(ptrTarget.scope)}.${ptrTarget.name}`
                return `${absoluteName.substring(1)} | undefined`
            }

            const absolutePrefix = scopePrefix(type.path.length > 0 ? type.path[0]!.parent : type.scope)

            let name: string
            switch (target.type) {
                case Type.TKN_VALUETYPE:
                    if (filetype !== FileType.VALUETYPE && filetype !== FileType.VALUE) {
                        name = `valuetype${absolutePrefix}.${relativeName}`
                    } else {
                        name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                    }
                    break
                case Type.SYN_INTERFACE:
                case Type.TKN_ENUM:
                case Type.TKN_UNION:
                    if (filetype !== FileType.INTERFACE) {
                        name = `_interface${absolutePrefix}.${relativeName}`
                    } else {
                        name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                    }
                    // TODO: interface can be undefined but the following line result in many more changes
                    // name += ` | undefined`
                    break
                case Type.TKN_STRUCT:
                    // FIXME: struct uses a wrong identifier node structure
                    name = firstName(type)
                    if (filetype !== FileType.INTERFACE) {
                        name = `_interface${absolutePrefix}.${name}`
                    }
                    break
                case Type.TKN_NATIVE:
                    name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                    break
                case Type.TKN_SEQUENCE:
                    name = typeIDLtoTS(firstNode(type), filetype)
                    break
                default:
                    throw Error(`Internal Error in typeIDLtoTS(): type ${Type[target.type]} is not implemented`)
            }
            return name
        }
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
        case Type.TKN_SEQUENCE: {
            let specialType: string | undefined
            const annotation = type.annotation
            if (annotation?.name === "js_mapping" && annotation.params[0]?.name === "type") {
                specialType = annotation.params[0].value
            }
            if (specialType) {
                let typedArray: string | undefined
                switch (type.elementType.type) {
                    case Type.TKN_OCTET:
                        typedArray = "Uint8Array"
                        break
                    case Type.TKN_FLOAT:
                        typedArray = "Float32Array"
                        break
                    case Type.TKN_DOUBLE:
                        typedArray = "Float64Array"
                        break
                }
                if (specialType !== typedArray) {
                    throw Error(`unsupported js mapping ${specialType} for sequence<...>`)
                }
                return typedArray!
            }
            return `Array<${typeIDLtoTS(type.elementType, filetype)}>`
        }
        default:
            throw Error(`no mapping from IDL type to TS type for ${Type[type.type]}`)
    }
}
