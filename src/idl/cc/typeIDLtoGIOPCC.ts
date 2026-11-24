import { Type, Declaration } from "../idl-node"
import { Direction, typeIDLtoCC, resolvedType } from "./typeIDLtoCC"

// this is about how to call the GIOP(Encoder|Decoder)
export function typeIDLtoGIOPCC(
    type: Declaration,
    arg: string | undefined,
    direction: Direction,
    struct = false
): string {
    // console.log(`typeIDLtoGIOP(${type.toString()}, ${arg})`)
    let name: string
    switch (type.type) {
        case Type.SYN_SCOPED_NAME:
            return typeIDLtoGIOPCC(type.target, arg, direction, struct)
        case Type.TKN_VALUETYPE:
            return arg === undefined ? `decoder.value("${type.name}")` : `encoder.value(${arg})`
        case Type.SYN_INTERFACE:
            switch(direction) {
                case Direction.IN: // skel/impl: decode incoming argument
                    return arg === undefined ? `${type.name}::_narrow(decoder.readObject(obj->get_ORB()))` : `encoder.writeObject(${arg}.get())`
                case Direction.OUT: // stub: decode incoming return value
                    return arg === undefined ? `${type.name}::_narrow(decoder.readObject(${struct?"orb":"get_ORB()"}))` : `encoder.writeObject(${arg}.get())`
            }
        case Type.TKN_UNION:
            throw Error("union is not implemented yet")
        case Type.TKN_STRUCT: {
            // const prefix = filetype === FileType.INTERFACE ? "" : "_interface."
            // return arg === undefined
            //     ? `${prefix}decode${type.name}(decoder)`
            //     : `${prefix}encode${type.name}(encoder,${arg})`
            return arg === undefined
                 ? `_decode${type.name}(get_ORB(), decoder)` 
                 : `_encode${type.name}(encoder,${arg})`
        }
        case Type.TKN_NATIVE:
            {
                const id = type.name
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
            name = "Void"
            break
        case Type.TKN_BOOLEAN:
            name = "Boolean"
            break
        case Type.TKN_CHAR:
            name = "Char"
            break
        case Type.TKN_OCTET:
            name = "Octet"
            break
        case Type.TKN_SHORT:
            name = "Short"
            break
        case Type.TKN_LONG:
            name = "Long"
            break
        case Type.SYN_LONGLONG:
            name = "Longlong"
            break
        case Type.SYN_UNSIGNED_SHORT:
            name = "Ushort"
            break
        case Type.SYN_UNSIGNED_LONG:
            name = "Ulong"
            break
        case Type.SYN_UNSIGNED_LONGLONG:
            name = "Ulonglong"
            break
        case Type.TKN_FLOAT:
            name = "Float"
            break
        case Type.TKN_DOUBLE:
            name = "Double"
            break
        case Type.SYN_LONG_DOUBLE:
            name = "LongDouble"
            break
        case Type.TKN_STRING:
            switch(direction) {
                case Direction.IN: // skel/impl: decode incoming argument
                    return arg === undefined ? `decoder.readStringView()` : `encoder.writeString(${arg})`
                case Direction.OUT: // stub: decode incoming return value
                    return arg === undefined ? `decoder.readString()` : `encoder.writeString(${arg})`    
            }
            throw Error("yikes")
        case Type.TKN_ENUM:
            return arg === undefined ? `static_cast<${type.name}>(decoder.readUlong())` : `encoder.writeUlong(std::to_underlying(${arg}))`
        case Type.TKN_SEQUENCE:
            switch (resolvedType(type.elementType)) {
                case Type.TKN_OCTET: {
                    switch (direction) {
                        case Direction.IN:
                            return arg === undefined ? `decoder.readBlobView()` : `encoder.writeBlob(${arg})`
                        case Direction.OUT:
                            return arg === undefined ? `decoder.readBlob()` : `encoder.writeBlob(${arg})`
                    }
                }
                case Type.TKN_FLOAT: {
                    switch (direction) {
                        case Direction.IN:
                            return arg === undefined ? `decoder.readSequenceSpanFloat()` : `encoder.writeSequence(${arg})`
                        case Direction.OUT:
                            return arg === undefined ? `decoder.readSequenceVectorFloat()` : `encoder.writeSequence(${arg})`
                    }
                }
                case Type.TKN_DOUBLE: {
                    switch (direction) {
                        case Direction.IN:
                            return arg === undefined ? `decoder.readSequenceSpanDouble()` : `encoder.writeSequence(${arg})`
                        case Direction.OUT:
                            return arg === undefined ? `decoder.readSequenceVectorDouble()` : `encoder.writeSequence(${arg})`
                    }
                }
                case Type.TKN_STRING:
                    switch (direction) {
                        case Direction.IN:
                            return arg === undefined
                                ? `decoder.readSequence<std::string_view>([&] { return decoder.readStringView(); })`
                                : `encoder.writeSequence<std::string_view>(${arg}, [&](auto item) { encoder.writeString(item);})`
                        case Direction.OUT:
                            return arg === undefined
                                ? `decoder.readSequence<std::string>([&] { return decoder.readString(); })`
                                : `encoder.writeSequence<std::string>(${arg}, [&](auto item) { encoder.writeString(item);})`
                    }
                default:
                    return arg === undefined
                        ? `decoder.readSequence<${typeIDLtoCC(type.elementType, Direction.NESTED)}>([&] { return ${typeIDLtoGIOPCC(type.elementType, undefined, direction, struct)}; })`
                        : `encoder.writeSequence<${typeIDLtoCC(type.elementType, Direction.NESTED)}>(${arg}, [&](auto item) { ${typeIDLtoGIOPCC(type.elementType, "item", direction, struct)}; })`
            }
        default:
            throw Error(`no mapping from IDL type '${Type[type.type]}' to GIOP encoder/decoder`)
    }
    return arg === undefined ? `decoder.read${name}()` : `encoder.write${name}(${arg})`
}
