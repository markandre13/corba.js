import { Type, Node } from "../idl-node"
import { FileType } from "../util"
import { Direction } from "./typeIDLtoCC"

// this is about how to call the GIOP(Encoder|Decoder)
export function typeIDLtoGIOPCC(
    type: Node | undefined,
    arg: string | undefined = undefined,
    direction: Direction
): string {
    if (type === undefined) throw Error("internal error: parser delivered no type information")
    // console.log(`typeIDLtoGIOP(${type.toString()}, ${arg})`)
    let name: string
    switch (type!.type) {
        case Type.TKN_IDENTIFIER:
        case Type.TKN_MODULE:
            return typeIDLtoGIOPCC(type.child[0], arg, direction)
        case Type.TKN_VALUETYPE:
            return arg === undefined ? `decoder.value("${type.text}")` : `encoder.value(${arg})`
        case Type.SYN_INTERFACE:
            name = "object"
            break

        case Type.TKN_UNION:
        case Type.TKN_STRUCT: {
            throw Error("yikes")
            // const prefix = filetype === FileType.INTERFACE ? "" : "_interface."
            // return arg === undefined
            //     ? `${prefix}decode${type!.text!}(decoder)`
            //     : `${prefix}encode${type!.text!}(encoder,${arg})`
        }

        case Type.TKN_NATIVE:
            {
                const id = type!.child[0]!.text!
                if (id.length > 4 && id.substring(id.length - 4) === "_ptr") {
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
            name = "boolean"
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
        case Type.TKN_STRING:
            switch(direction) {
                case Direction.IN: // skel/impl: decode incoming argument
                    return arg === undefined ? `decoder.string_view()` : `encoder.string(${arg})`
                case Direction.OUT: // stub: decode incoming return value
                    return arg === undefined ? `decoder.string()` : `encoder.string(${arg})`    
            }
            throw Error("yikes")
        case Type.TKN_SEQUENCE:
            if (type?.child[0]?.type === Type.TKN_OCTET) {
                switch(direction) {
                    case Direction.IN:
                        return arg === undefined ? `decoder.blob_view()` : `encoder.blob(${arg})`
                    case Direction.OUT:
                        return arg === undefined ? `decoder.blob()` : `encoder.blob(${arg})`    
                }
                throw Error("yikes")
            }
            return arg === undefined
                ? `decoder.sequence(() => ${typeIDLtoGIOPCC(type.child[0], undefined, direction)})`
                : `encoder.sequence(${arg}, (item) => ${typeIDLtoGIOPCC(type.child[0], "item", direction)})`
        default:
            type.printTree()
            throw Error(`no mapping from IDL type '${type.toString()}' to GIOP encoder/decoder`)
    }
    return arg === undefined ? `decoder.${name}()` : `encoder.${name}(${arg})`
}
