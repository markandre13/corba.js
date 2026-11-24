import { Type } from "../idl-node"
import { FileType, isPointerName } from "../util"
import { TypeNode } from "./typeIDLtoTS"

export function typeIDLtoGIOPTS(
    type: TypeNode | undefined,
    arg: string | undefined = undefined,
    filetype = FileType.NONE
): string {
    if (type === undefined) throw Error("internal error: parser delivered no type information")
    // console.log(`typeIDLtoGIOP(${type.toString()}, ${arg})`)
    let name: string
    switch (type.type) {
        case Type.SYN_SCOPED_NAME:
            return typeIDLtoGIOPTS(type.target, arg, filetype)
        case Type.TKN_VALUETYPE:
            return arg === undefined ? `decoder.value("${type.name}")` : `encoder.value(${arg})`
        case Type.SYN_INTERFACE:
            name = "object"
            break

        case Type.TKN_UNION:
        case Type.TKN_STRUCT: {
            const prefix = filetype === FileType.INTERFACE ? "" : "_interface."
            return arg === undefined
                ? `${prefix}decode${type.name}(decoder)`
                : `${prefix}encode${type.name}(encoder,${arg})`
        }

        case Type.TKN_NATIVE:
            {
                const id = type.name
                if (isPointerName(id)) {
                    return arg === undefined
                        ? `decoder.value("${id.substring(0, id.length - 4)}")`
                        : `encoder.value(${arg})`
                } else {
                    return `undefined`
                }
            }
            break

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
        case Type.TKN_SEQUENCE: {
            let specialType: string | undefined
            const annotation = type.annotation
            if (annotation?.name === "js_mapping" && annotation.params[0]?.name === "type") {
                specialType = annotation.params[0].value
            }
            switch (specialType) {
                case "Uint8Array":
                    name = "sequenceOctet"
                    break
                case "Float32Array":
                    name = "sequenceFloat"
                    break
                case "Float64Array":
                    name = "sequenceDouble"
                    break
                default:
                    return arg === undefined
                        ? `decoder.sequence(() => ${typeIDLtoGIOPTS(type.elementType, undefined, filetype)})`
                        : `encoder.sequence(${arg}, (item) => ${typeIDLtoGIOPTS(type.elementType, "item", filetype)})`
            }
            break
        }
        default:
            throw Error(`no mapping from IDL type '${Type[type.type]}' to GIOP encoder/decoder`)
    }
    return arg === undefined ? `decoder.${name}()` : `encoder.${name}(${arg})`
}
