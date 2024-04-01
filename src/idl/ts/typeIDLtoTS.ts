import { Type, Node } from "../idl-node"
import { FileType } from "../util"


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
                case Type.TKN_UNION:
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
            switch(type!.child[0]!.type) {
                case Type.TKN_OCTET:
                    return "Uint8Array";
                case Type.TKN_FLOAT:
                    return "Float32Array";
                default:
                    return `Array<${typeIDLtoTS(type!.child[0], filetype)}>`
            }
        default:
            throw Error(`no mapping from IDL type to TS type for ${type.toString()}`)
    }
}
